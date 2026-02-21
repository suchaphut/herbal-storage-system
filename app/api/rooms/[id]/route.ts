import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { requireRoomAccess, requirePermission } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'

// GET /api/rooms/[id] - Get room details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check room access
    const authResult = await requireRoomAccess(request, id, false)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const room = await db.getRoomById(id)

    if (!room) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบห้องที่ระบุ' },
        { status: 404 }
      )
    }

    const nodes = await db.getSensorNodesByRoom(id)
    const rawData = await db.getSensorDataByRoom(id, 200)
    const sensorData = (rawData || [])
      .filter((d) => d.type === 'environmental' && d.readings && 'temperature' in d.readings)
      .map((d) => ({
        _id: String(d._id),
        nodeId: d.nodeId,
        roomId: d.roomId != null ? String(d.roomId) : null,
        timestamp: d.timestamp instanceof Date ? d.timestamp.toISOString() : d.timestamp,
        type: d.type,
        readings: d.readings,
      }))

    return NextResponse.json({
      success: true,
      data: {
        room,
        nodes: nodes || [],
        sensorData,
      },
    })
  } catch (error) {
    console.error('API Room Error:', error)
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถดึงข้อมูลห้องได้' },
      { status: 500 }
    )
  }
}

// PUT /api/rooms/[id] - Update room (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ipAddress, userAgent } = getClientInfo(request)

  try {
    const { id } = await params

    // Check permission to edit rooms
    const authResult = await requirePermission(request, 'canEditRoom')
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    // Get original room for logging
    const originalRoom = await db.getRoomById(id)
    if (!originalRoom) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบห้องที่ระบุ' },
        { status: 404 }
      )
    }

    const updated = await db.updateRoom(id, body)

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบห้องที่ระบุ' },
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
      action: 'room_update',
      resource: 'room',
      resourceId: id,
      details: `แก้ไขข้อมูลห้อง: ${originalRoom.name}`,
      metadata: { changes: body, originalName: originalRoom.name },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถแก้ไขข้อมูลห้องได้' },
      { status: 500 }
    )
  }
}

// DELETE /api/rooms/[id] - Delete room (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ipAddress, userAgent } = getClientInfo(request)

  try {
    const { id } = await params

    // Check permission to delete rooms
    const authResult = await requirePermission(request, 'canDeleteRoom')
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Get room info for logging
    const room = await db.getRoomById(id)
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบห้องที่ระบุ' },
        { status: 404 }
      )
    }

    const deleted = await db.deleteRoom(id)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบห้องที่ระบุ' },
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
      action: 'room_delete',
      resource: 'room',
      resourceId: id,
      details: `ลบห้อง: ${room.name}`,
      metadata: { roomName: room.name },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, message: 'ลบห้องสำเร็จ' })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถลบห้องได้' },
      { status: 500 }
    )
  }
}
