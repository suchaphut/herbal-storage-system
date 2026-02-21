import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { auditLogService } from '@/lib/audit-log-service'

// GET /api/audit-logs/stats - Get audit log statistics (Admin only)
export async function GET(request: NextRequest) {
  // Check authentication and admin role
  const authResult = await requireRole(request, 'admin')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const [stats, total, recentLogins, successCount, failureCount] = await Promise.all([
      auditLogService.getStats(),
      auditLogService.getCount(),
      auditLogService.getLoginActivities(10),
      auditLogService.getCount({ success: true }),
      auditLogService.getCount({ success: false }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        total,
        successCount,
        failureCount,
        actionCounts: stats,
        recentLogins,
      },
    })
  } catch (error) {
    console.error('Audit stats error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ' },
      { status: 500 }
    )
  }
}
