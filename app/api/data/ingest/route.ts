import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dbService as db } from '@/lib/db-service'
import {
  checkEnvironmentalThresholds,
  checkEnvironmentalAnomaly,
  checkPowerAnomaly,
} from '@/lib/alert-service'
import { checkRateLimit } from '@/lib/rate-limit'
import { th } from '@/lib/i18n'
import type { SensorData } from '@/lib/types'

// Rate limit: 60 requests per minute per nodeId (1 req/sec average)
const INGEST_RATE_LIMIT = { maxRequests: 60, windowMs: 60 * 1000 }

// ─── Zod schemas for readings validation ─────────────────────────────────────

const EnvironmentalReadingsSchema = z.object({
  temperature: z.number({ required_error: 'temperature is required' }).min(-40).max(80),
  humidity: z.number({ required_error: 'humidity is required' }).min(0).max(100),
})

const PowerReadingsSchema = z.object({
  voltage: z.number().min(0).max(500),
  current: z.number().min(0).max(100),
  power: z.number().min(0).max(50000),
  energy: z.number().min(0),
})

const IngestBodySchema = z.discriminatedUnion('type', [
  z.object({
    nodeId: z.string().min(1),
    type: z.literal('environmental'),
    readings: EnvironmentalReadingsSchema,
  }),
  z.object({
    nodeId: z.string().min(1),
    type: z.literal('power'),
    readings: PowerReadingsSchema,
  }),
])

// ─── API key verification ─────────────────────────────────────────────────────

function verifyApiKey(request: NextRequest): boolean {
  const apiKey = process.env.SENSOR_API_KEY
  if (!apiKey) return false
  const provided =
    request.headers.get('x-api-key') ||
    request.headers.get('Authorization')?.replace('Bearer ', '')
  return provided === apiKey
}

// ─── GET /api/data/ingest ─────────────────────────────────────────────────────

/** GET /api/data/ingest - ใช้ตรวจสอบว่า API ทำงาน และดู nodeId ที่ลงทะเบียนแล้ว */
export async function GET(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: invalid or missing API key' },
      { status: 401 }
    )
  }
  try {
    const nodes = await db.getSensorNodes()
    const nodeIds = nodes.map((n) => ({
      nodeId: n.nodeId,
      type: n.type,
      roomId: n.roomId ? String(n.roomId) : null,
    }))
    return NextResponse.json({
      success: true,
      message: th.api.ingestHint,
      nodeIds: nodeIds.length ? nodeIds : [th.api.noSensors],
    })
  } catch (e) {
    console.error('Ingest GET error:', e)
    return NextResponse.json({ success: false, error: 'Failed to list nodes' }, { status: 500 })
  }
}

// ─── POST /api/data/ingest ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: invalid or missing API key' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // Validate request body with Zod
    const parsed = IngestBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { nodeId, type, readings } = parsed.data

    // ─── Rate limiting per nodeId ──────────────────────────────────────────────
    const rl = checkRateLimit(`ingest:${nodeId}`, INGEST_RATE_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded for ${nodeId}. Max ${rl.limit} requests per minute.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    const node = await db.getSensorNodeByNodeId(nodeId)
    if (!node) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unknown nodeId. Please register the sensor first.',
          hint: th.api.unknownNodeHint,
        },
        { status: 404 }
      )
    }

    const roomIdStr = node.roomId ? String(node.roomId) : null
    const sensorData: Omit<SensorData, '_id'> = {
      nodeId,
      roomId: roomIdStr,
      timestamp: new Date(),
      type,
      readings,
    }

    const saved = await db.addSensorData(sensorData)

    // ─── Update sensor status to online + lastSeen ────────────────────────────
    const wasOffline = node.status === 'offline'
    db.updateSensorNode(String(node._id), {
      status: 'online',
      lastSeen: new Date(),
    }).catch((err) =>
      console.error('[Ingest] Failed to update sensor status:', err)
    )

    // ─── Auto-resolve offline alerts when sensor comes back online ───────────
    if (wasOffline && node.roomId) {
      db.resolveOfflineAlertsForNode(String(node.roomId), nodeId, 'system').catch((err) =>
        console.error('[Ingest] Failed to auto-resolve offline alerts:', err)
      )
    }

    // ─── Environmental: threshold check + ML anomaly detection ───────────────
    if (type === 'environmental' && node.roomId) {
      const roomId = node.roomId.toString()
      const room = await db.getRoomById(roomId)
      if (room) {
        await checkEnvironmentalThresholds(nodeId, roomId, readings, room.thresholds, room)
        // Fire-and-forget: anomaly detection is throttled internally (5 min debounce)
        checkEnvironmentalAnomaly(saved, nodeId, roomId, room).catch((err) =>
          console.error('[AlertService] Environmental anomaly check failed:', err)
        )
      }
    }

    // ─── Power: ML anomaly detection ─────────────────────────────────────────
    if (type === 'power' && node.roomId) {
      const roomId = node.roomId.toString()
      const room = await db.getRoomById(roomId)
      // Fire-and-forget: anomaly detection is throttled internally (5 min debounce)
      checkPowerAnomaly(saved, nodeId, roomId, false, room).catch((err) =>
        console.error('[AlertService] Power anomaly check failed:', err)
      )
    }

    return NextResponse.json({
      success: true,
      data: saved,
      message: 'Data received successfully',
    })
  } catch (error) {
    console.error('Data ingest error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process sensor data' },
      { status: 500 }
    )
  }
}
