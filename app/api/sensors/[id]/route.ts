import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth, requireSensorManagement } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'

// ─── Zod schema for sensor update validation ────────────────────────────────

const UpdateSensorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['environmental', 'power']).optional(),
  roomId: z.string().nullable().optional(),
  status: z.enum(['online', 'offline', 'warning']).optional(),
  config: z.object({
    reportInterval: z.number().min(1),
    firmware: z.string(),
  }).optional(),
  isActive: z.boolean().optional(),
}).strict()

// GET /api/sensors/[id] - Get sensor details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await params
    const node = await db.getSensorNodeById(id)

    if (!node) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบเซ็นเซอร์ที่ระบุ' },
        { status: 404 }
      )
    }

    // Check access for operators
    const { session } = authResult
    if (
      session.role === 'operator' &&
      node.roomId &&
      !session.assignedRooms.includes(String(node.roomId))
    ) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีสิทธิ์เข้าถึงเซ็นเซอร์นี้' },
        { status: 403 }
      )
    }

    const sensorData = await db.getSensorDataByNodeId(node.nodeId, 100)

    return NextResponse.json({
      success: true,
      data: { node, sensorData },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถดึงข้อมูลเซ็นเซอร์ได้' },
      { status: 500 }
    )
  }
}

// PUT /api/sensors/[id] - Update sensor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ipAddress, userAgent } = getClientInfo(request)

  try {
    const { id } = await params

    // Get sensor first to check room assignment
    const node = await db.getSensorNodeById(id)
    if (!node) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบเซ็นเซอร์ที่ระบุ' },
        { status: 404 }
      )
    }

    // Check permission to manage sensors
    const authResult = await requireSensorManagement(request, node.roomId ? String(node.roomId) : null)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    // Validate request body
    const parsed = UpdateSensorSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'ข้อมูลไม่ถูกต้อง',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const updated = await db.updateSensorNode(id, parsed.data)

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบเซ็นเซอร์ที่ระบุ' },
        { status: 404 }
      )
    }

    // Log the action
    const { session } = authResult
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'sensor_update',
      resource: 'sensor',
      resourceId: id,
      details: `แก้ไขเซ็นเซอร์: ${node.name} (${node.nodeId})`,
      metadata: { nodeId: node.nodeId, changes: body },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถแก้ไขเซ็นเซอร์ได้' },
      { status: 500 }
    )
  }
}

// DELETE /api/sensors/[id] - Delete sensor (Admin: any; Operator: assigned rooms only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ipAddress, userAgent } = getClientInfo(request)

  try {
    const { id } = await params

    // Get sensor first to check room assignment for permission check
    const node = await db.getSensorNodeById(id)
    if (!node) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบเซ็นเซอร์ที่ระบุ' },
        { status: 404 }
      )
    }

    // Check permission — operators may only delete sensors in assigned rooms
    const authResult = await requireSensorManagement(request, node.roomId ? String(node.roomId) : null)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const deleted = await db.deleteSensorNode(id)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบเซ็นเซอร์ที่ระบุ' },
        { status: 404 }
      )
    }

    // Log the action
    const { session } = authResult
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'sensor_delete',
      resource: 'sensor',
      resourceId: id,
      details: `ลบเซ็นเซอร์: ${node.name} (${node.nodeId})`,
      metadata: { nodeId: node.nodeId, nodeName: node.name },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, message: 'ลบเซ็นเซอร์สำเร็จ' })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถลบเซ็นเซอร์ได้' },
      { status: 500 }
    )
  }
}
