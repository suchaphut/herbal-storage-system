import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(request)

  try {
    // Get current user before logging out
    const authResult = await verifyAuth(request)

    // Log the logout if user was authenticated
    if (authResult.success) {
      const { session } = authResult
      await auditLogService.create({
        userId: session.userId,
        userEmail: session.email,
        userName: session.name,
        userRole: session.role,
        action: 'logout',
        resource: 'auth',
        details: 'ออกจากระบบสำเร็จ',
        ipAddress,
        userAgent,
        success: true,
      })
    }

    const response = NextResponse.json({
      success: true,
      message: 'ออกจากระบบสำเร็จ',
    })

    response.cookies.delete('auth-token')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการออกจากระบบ' },
      { status: 500 }
    )
  }
}
