import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ipAddress, userAgent } = getClientInfo(request)

  // Check authentication
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await params
    const { session } = authResult

    // Get alert info before resolving
    const alert = await db.getAlertById(id)

    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบการแจ้งเตือนที่ระบุ' },
        { status: 404 }
      )
    }

    // Check if operator has access to this room
    if (
      session.role === 'operator' &&
      alert.roomId &&
      !session.assignedRooms.includes(String(alert.roomId))
    ) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีสิทธิ์ในการจัดการการแจ้งเตือนนี้' },
        { status: 403 }
      )
    }

    // Viewer cannot resolve alerts
    if (session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'ผู้ดูไม่สามารถยืนยันการแจ้งเตือนได้' },
        { status: 403 }
      )
    }

    const resolved = await db.resolveAlert(id, session.name)

    if (!resolved) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบการแจ้งเตือนที่ระบุ' },
        { status: 404 }
      )
    }

    // Log the action
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'alert_resolve',
      resource: 'alert',
      resourceId: id,
      details: `ยืนยันการแจ้งเตือน: ${alert.message}`,
      metadata: { alertType: alert.type, severity: alert.severity, roomId: alert.roomId },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, data: resolved })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถยืนยันการแจ้งเตือนได้' },
      { status: 500 }
    )
  }
}
