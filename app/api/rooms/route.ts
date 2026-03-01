import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth, requirePermission } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'

// GET /api/rooms - List all rooms (All authenticated users)
export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const rooms = await db.getRooms()

    // Filter rooms for operators (they can only see assigned rooms)
    const { session } = authResult
    if (session.role === 'operator') {
      const filteredRooms = rooms.filter((room) =>
        session.assignedRooms.includes(room._id.toString())
      )
      return NextResponse.json({ success: true, data: filteredRooms })
    }

    return NextResponse.json({ success: true, data: rooms })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถดึงข้อมูลห้องได้' },
      { status: 500 }
    )
  }
}

// POST /api/rooms - Create new room (Admin only)
export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(request)

  // Check permission to create rooms
  const authResult = await requirePermission(request, 'canCreateRoom')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const { name, description, location, thresholds } = body

    if (!name || !thresholds) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    const newRoom = await db.createRoom({
      name,
      description: description || '',
      location: location || '',
      thresholds,
      notifications: {
        discord: { enabled: false, webhookUrl: '' },
        line: { enabled: false, accessToken: '' },
        alertOnThreshold: true,
        alertOnAnomaly: true,
        alertOnOffline: true,
      },
      isActive: true,
    })

    // Log the action
    const { session } = authResult
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'room_create',
      resource: 'room',
      resourceId: newRoom._id.toString(),
      details: `สร้างห้องใหม่: ${name}`,
      metadata: { roomName: name, location },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, data: newRoom }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถสร้างห้องได้' },
      { status: 500 }
    )
  }
}
