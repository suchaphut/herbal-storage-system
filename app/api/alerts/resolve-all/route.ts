import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(request)

  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status })
  }

  const { session } = authResult

  if (session.role === 'viewer') {
    return NextResponse.json({ success: false, error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 })
  }

  try {
    const count = await db.resolveAllAlerts(session.name)

    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'alert_resolve',
      resource: 'alert',
      resourceId: 'all',
      details: `ยืนยันการแจ้งเตือนทั้งหมด ${count} รายการ`,
      metadata: { count },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({ success: true, count })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'ไม่สามารถยืนยันการแจ้งเตือนได้' }, { status: 500 })
  }
}
