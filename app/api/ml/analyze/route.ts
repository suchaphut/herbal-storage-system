import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { analyzeRoom, detectPowerAnomaly } from '@/lib/ml-service'
import { sendNotificationToRoomUsers } from '@/lib/notification-service'
import { aggregateEnvironmentalByTime } from '@/lib/sensor-aggregation'
import { th } from '@/lib/i18n'
import type { EnvironmentalSensorData, PowerSensorData } from '@/lib/types'

// ─── Rate limit: ป้องกันส่ง notification ซ้ำบ่อยเกินไป ──────────────────
// Key: `${roomId}:${nodeId}`, Value: timestamp ที่ส่งล่าสุด (ms)
const lastNotificationSentMs = new Map<string, number>()
const NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000 // ส่งซ้ำได้ทุก 10 นาที

function canSendNotification(roomId: string, nodeId: string): boolean {
  const key = `${roomId}:${nodeId}`
  const lastSent = lastNotificationSentMs.get(key)
  if (!lastSent) return true
  return Date.now() - lastSent > NOTIFICATION_COOLDOWN_MS
}

function markNotificationSent(roomId: string, nodeId: string): void {
  lastNotificationSentMs.set(`${roomId}:${nodeId}`, Date.now())
}

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const roomId = request.nextUrl.searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId is required' },
        { status: 400 }
      )
    }

    const room = await db.getRoomById(roomId)
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      )
    }

    const [envData, powerData] = await Promise.all([
      db.getSensorDataByRoomAndType(roomId, 'environmental', 288) as Promise<EnvironmentalSensorData[]>,
      db.getSensorDataByRoomAndType(roomId, 'power', 288) as Promise<PowerSensorData[]>,
    ])

    const nodes = await db.getSensorNodes()
    const roomNodes = nodes.filter((n) => n.roomId?.toString() === roomId)
    const environmentalNode = roomNodes.find((n) => n.type === 'environmental')

    if (!environmentalNode) {
      return NextResponse.json(
        { success: false, error: 'No environmental sensor found in this room' },
        { status: 404 }
      )
    }

    // รวมเป็นค่าเฉลี่ยต่อช่วงเวลา (ทุก 1 นาที) เพื่อให้ได้จุดข้อมูลมากพอสำหรับ ML
    const aggregatedEnv = aggregateEnvironmentalByTime(envData, 1, roomId)
    if (aggregatedEnv.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: `ข้อมูลย้อนหลังไม่เพียงพอ (มี ${aggregatedEnv.length} จุด ต้องการอย่างน้อย 6 จุด)`,
        },
        { status: 400 }
      )
    }

    const analysis = await analyzeRoom(
      roomId,
      'room-aggregated',
      aggregatedEnv,
      room
    )

    // เพิ่มการวิเคราะห์ Power Sensor (แอร์/กระแสไฟ) ถ้าห้องมี power sensor
    const powerNode = roomNodes.find((n) => n.type === 'power')
    if (powerNode) {
      const powerHistory = powerData.filter((d) => d.nodeId === powerNode.nodeId)
      const latestPower = powerHistory[0]
      if (latestPower && powerHistory.length >= 2) {
        const powerAnomaly = await detectPowerAnomaly(
          latestPower,
          powerHistory.slice(1),
          { useHistoricalRange: true, deviceExpectedOn: false }
        )
        analysis.powerAnomaly = powerAnomaly
        analysis.powerPredictionSummary =
          'การพยากรณ์กระแส/กำลังไฟใช้ข้อมูลจาก Power Sensor ในห้องนี้ — ค่าปัจจุบันและเกณฑ์จากประวัติ'
      } else {
        analysis.powerPredictionSummary =
          'มี Power Sensor ในห้องนี้ — รอข้อมูลเพิ่มเพื่อวิเคราะห์การพยากรณ์และความผิดปกติ'
      }
    }

    // ─── สร้าง Alert + ส่งแจ้งเตือนเมื่อตรวจพบ Anomaly ────────────────────
    if (analysis.anomaly.isAnomaly && environmentalNode.roomId) {
      const anomalyNodeId = environmentalNode.nodeId
      const hasActiveAnomalyAlert = await db.hasActiveAlertForNode(
        roomId,
        anomalyNodeId,
        'anomaly'
      )

      const safeScore = Math.max(0, Math.min(1, analysis.anomaly.anomalyScore))

      const newSeverity = safeScore > 0.85 ? 'critical' : 'warning' as const
      const newMessage = `[ML] ${th.alert.anomalyDetected(safeScore * 100)}`

      if (!hasActiveAnomalyAlert) {
        // สร้าง alert ใหม่ + ส่งแจ้งเตือน
        const alert = await db.createAlert({
          roomId,
          nodeId: anomalyNodeId,
          type: 'anomaly',
          severity: newSeverity,
          message: newMessage,
          data: {
            anomalyScore: safeScore,
            source: 'ml_environmental',
          },
          isResolved: false,
          resolvedAt: null,
          resolvedBy: null,
        })

        console.log(`[ML Analyze] Created anomaly alert (score=${(safeScore * 100).toFixed(0)}%) — sending notification`)
        markNotificationSent(roomId, anomalyNodeId)
        db.getAllUsers().then(async (users) => {
          return sendNotificationToRoomUsers(users, roomId, alert, room, environmentalNode)
        }).catch((err) =>
          console.error('[ML Analyze] Failed to send anomaly notification:', err)
        )
      } else {
        // มี alert อยู่แล้ว → อัปเดต severity/score ให้ตรงกับค่าปัจจุบัน
        // แล้วส่งแจ้งเตือนใหม่ (rate limited ทุก 10 นาที) ด้วยข้อมูลล่าสุด
        const unresolvedAlerts = await db.getAlerts(false, 50)
        const existingAlert = unresolvedAlerts.find(
          (a) => a.nodeId === anomalyNodeId && a.type === 'anomaly' && String(a.roomId) === roomId
        )
        if (existingAlert) {
          // อัปเดต alert ให้สะท้อนค่า anomaly ล่าสุด
          const updatedAlert = await db.updateAlert(existingAlert._id, {
            severity: newSeverity,
            message: newMessage,
            data: { ...existingAlert.data, anomalyScore: safeScore, source: 'ml_environmental' },
          })

          if (updatedAlert && canSendNotification(roomId, anomalyNodeId)) {
            console.log(`[ML Analyze] Updated existing alert (score=${(safeScore * 100).toFixed(0)}%) — sending notification`)
            markNotificationSent(roomId, anomalyNodeId)
            db.getAllUsers().then(async (users) => {
              return sendNotificationToRoomUsers(users, roomId, updatedAlert, room, environmentalNode)
            }).catch((err) =>
              console.error('[ML Analyze] Failed to send updated anomaly notification:', err)
            )
          }
        }
      }
    }

    // ─── สร้าง Alert + ส่งแจ้งเตือนเมื่อตรวจพบ Power Anomaly ──────────────
    if (analysis.powerAnomaly?.isAnomaly && powerNode?.roomId) {
      const powerNodeId = powerNode.nodeId
      const hasActivePowerAlert = await db.hasActiveAlertForNode(
        roomId,
        powerNodeId,
        'anomaly'
      )

      if (!hasActivePowerAlert) {
        const safeScore = Math.max(0, Math.min(1, analysis.powerAnomaly.anomalyScore))
        const alert = await db.createAlert({
          roomId,
          nodeId: powerNodeId,
          type: 'anomaly',
          severity: safeScore >= 0.9 ? 'critical' : 'warning',
          message: `[ML] ${analysis.powerAnomaly.message}`,
          data: {
            anomalyScore: safeScore,
            source: 'ml_power',
          },
          isResolved: false,
          resolvedAt: null,
          resolvedBy: null,
        })

        console.log(`[ML Analyze] Created power anomaly alert — sending notification`)
        db.getAllUsers().then(async (users) => {
          return sendNotificationToRoomUsers(users, roomId, alert, room, powerNode)
        }).catch((err) =>
          console.error('[ML Analyze] Failed to send power anomaly notification:', err)
        )
      }
    }

    return NextResponse.json({ success: true, data: analysis })
  } catch (error) {
    console.error('ML analysis error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to perform ML analysis' },
      { status: 500 }
    )
  }
}
