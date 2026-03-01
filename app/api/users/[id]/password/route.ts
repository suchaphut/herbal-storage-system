import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { authService } from '@/lib/auth-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'
import type { ChangePasswordRequest } from '@/lib/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ipAddress, userAgent } = getClientInfo(request)

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
    const isSelf = String(session.userId) === id

    // Only allow users to change their own password, or admin to reset any password
    if (!isSelf && !session.permissions.canManageUsers) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีสิทธิ์ในการเปลี่ยนรหัสผ่านผู้ใช้นี้' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body as ChangePasswordRequest & { newPassword: string }

    const user = await db.getUserById(id)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบผู้ใช้' },
        { status: 404 }
      )
    }

    // If changing own password, require and verify current password
    if (isSelf) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'กรุณากรอกรหัสผ่านปัจจุบัน' },
          { status: 400 }
        )
      }
      const isValid = await authService.verifyPassword(currentPassword, user.passwordHash)

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
          { status: 400 }
        )
      }
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' },
        { status: 400 }
      )
    }

    // Hash and update password
    const passwordHash = await authService.hashPassword(newPassword)
    await db.updateUser(id, { passwordHash })

    // Log password change
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'user_password_change',
      resource: 'user',
      resourceId: id,
      details: isSelf
        ? 'เปลี่ยนรหัสผ่านตนเอง'
        : `เปลี่ยนรหัสผ่านผู้ใช้: ${user.name} (${user.email})`,
      metadata: { targetUser: user.email, isSelf },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    )
  }
}
