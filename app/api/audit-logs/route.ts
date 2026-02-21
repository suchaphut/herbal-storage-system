import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { auditLogService } from '@/lib/audit-log-service'
import type { AuditLogFilter, AuditAction } from '@/lib/types'

// GET /api/audit-logs - List audit logs (Admin only)
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
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '50'), 100)
    const offset = Number.parseInt(searchParams.get('offset') || '0')
    const userId = searchParams.get('userId') || undefined
    const action = searchParams.get('action') as AuditAction | undefined
    const resource = searchParams.get('resource') || undefined
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined
    const success = searchParams.get('success')
      ? searchParams.get('success') === 'true'
      : undefined

    // Build filter
    const filter: AuditLogFilter = {
      userId,
      action,
      resource: resource as AuditLogFilter['resource'],
      startDate,
      endDate,
      success,
    }

    // Get logs and count
    const [logs, total] = await Promise.all([
      auditLogService.getAll(filter, limit, offset),
      auditLogService.getCount(filter),
    ])

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + logs.length < total,
        },
      },
    })
  } catch (error) {
    console.error('Audit logs fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 }
    )
  }
}
