import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth, requirePermission } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'
import type { SensorNodeType } from '@/lib/types'

// GET /api/sensors - List all sensors (All authenticated users)
export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const nodes = await db.getSensorNodes()
    const { session } = authResult

    // Filter sensors for operators (they can only see sensors in assigned rooms)
    if (session.role === 'operator') {
      const filteredNodes = nodes.filter(
        (node) => node.roomId && session.assignedRooms.includes(String(node.roomId))
      )
      return NextResponse.json({ success: true, data: filteredNodes })
    }

    return NextResponse.json({ success: true, data: nodes })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถดึงข้อมูลเซ็นเซอร์ได้' },
      { status: 500 }
    )
  }
}

// POST /api/sensors - Create new sensor (Admin only)
export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(request)

  // Check permission to create sensors
  const authResult = await requirePermission(request, 'canCreateSensor')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const { nodeId, name, type, roomId, config } = body

    if (!nodeId || !name || !type) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอก nodeId, name และ type' },
        { status: 400 }
      )
    }

    // Check if nodeId already exists
    const existing = await db.getSensorNodeByNodeId(nodeId)
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Node ID นี้มีอยู่แล้วในระบบ' },
        { status: 409 }
      )
    }

    const newNode = await db.createSensorNode({
      nodeId,
      name,
      type: type as SensorNodeType,
      roomId: roomId || null,
      status: 'offline',
      lastSeen: null,
      config: config || { reportInterval: 60, firmware: 'unknown' },
      isActive: true,
    })

    // Log the action
    const { session } = authResult
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'sensor_create',
      resource: 'sensor',
      resourceId: newNode._id,
      details: `เพิ่มเซ็นเซอร์ใหม่: ${name} (${nodeId})`,
      metadata: { nodeId, name, type, roomId },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, data: newNode }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถสร้างเซ็นเซอร์ได้' },
      { status: 500 }
    )
  }
}
