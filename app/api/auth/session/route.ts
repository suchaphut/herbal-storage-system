import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { authService } from '@/lib/auth-service'
import { ROLE_PERMISSIONS } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    // Get token from cookie or Authorization header
    const cookieToken = request.cookies.get('auth-token')?.value
    const headerToken = request.headers.get('Authorization')?.replace('Bearer ', '')
    const token = cookieToken || headerToken

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบ token การยืนยันตัวตน' },
        { status: 401 }
      )
    }

    // Verify token
    const session = await authService.verifyToken(token)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'token ไม่ถูกต้องหรือหมดอายุ' },
        { status: 401 }
      )
    }

    // Get fresh user data
    const user = await db.getUserById(session.userId)
    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบบัญชีผู้ใช้' },
        { status: 401 }
      )
    }

    const safeUser = authService.toSafeUser(user)

    return NextResponse.json({
      success: true,
      user: safeUser,
      permissions: ROLE_PERMISSIONS[user.role],
    })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    )
  }
}
