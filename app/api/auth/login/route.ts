import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { authService } from '@/lib/auth-service'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(request)

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await db.getUserByEmail(email)
    if (!user) {
      // Log failed login attempt
      await auditLogService.create({
        userId: null,
        userEmail: email,
        userName: 'ไม่พบผู้ใช้',
        userRole: null,
        action: 'login_failed',
        resource: 'auth',
        details: `เข้าสู่ระบบไม่สำเร็จ: ไม่พบอีเมล ${email}`,
        metadata: { reason: 'user_not_found' },
        ipAddress,
        userAgent,
        success: false,
      })

      return NextResponse.json(
        { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    // Check if account is active
    if (!user.isActive) {
      await auditLogService.create({
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'login_failed',
        resource: 'auth',
        details: `เข้าสู่ระบบไม่สำเร็จ: บัญชีถูกระงับ`,
        metadata: { reason: 'account_inactive' },
        ipAddress,
        userAgent,
        success: false,
      })

      return NextResponse.json(
        { success: false, error: 'บัญชีนี้ถูกระงับการใช้งาน' },
        { status: 401 }
      )
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const lockTimeRemaining = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / 60000
      )

      await auditLogService.create({
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'login_failed',
        resource: 'auth',
        details: `เข้าสู่ระบบไม่สำเร็จ: บัญชีถูกล็อคชั่วคราว`,
        metadata: { reason: 'account_locked', lockTimeRemaining },
        ipAddress,
        userAgent,
        success: false,
      })

      return NextResponse.json(
        {
          success: false,
          error: `บัญชีถูกล็อคชั่วคราว กรุณารอ ${lockTimeRemaining} นาที`,
        },
        { status: 401 }
      )
    }

    const isPasswordValid = await authService.verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      // Increment login attempts
      const newAttempts = (user.loginAttempts || 0) + 1
      const maxAttempts = 5
      const lockDuration = 15 * 60 * 1000 // 15 minutes

      let lockedUntil: Date | null = null
      if (newAttempts >= maxAttempts) {
        lockedUntil = new Date(Date.now() + lockDuration)
      }

      // Update user login attempts
      await db.updateUser(String(user._id), {
        loginAttempts: newAttempts,
        lockedUntil,
      })

      await auditLogService.create({
        userId: user._id.toString(),
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'login_failed',
        resource: 'auth',
        details: `เข้าสู่ระบบไม่สำเร็จ: รหัสผ่านไม่ถูกต้อง (ครั้งที่ ${newAttempts}/${maxAttempts})`,
        metadata: {
          reason: 'invalid_password',
          attempts: newAttempts,
          locked: !!lockedUntil,
        },
        ipAddress,
        userAgent,
        success: false,
      })

      if (lockedUntil) {
        return NextResponse.json(
          {
            success: false,
            error: 'บัญชีถูกล็อคเนื่องจากพยายามเข้าสู่ระบบผิดพลาดหลายครั้ง',
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: `อีเมลหรือรหัสผ่านไม่ถูกต้อง (เหลือโอกาสอีก ${maxAttempts - newAttempts} ครั้ง)`,
        },
        { status: 401 }
      )
    }

    // Generate token (use authService for consistency with session verification)
    const token = await authService.createToken(user)

    // Reset login attempts and update last login
    await db.updateUser(String(user._id), {
      loginAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date(),
    })

    // Log successful login
    await auditLogService.create({
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'login',
      resource: 'auth',
      details: `เข้าสู่ระบบสำเร็จ`,
      metadata: { role: user.role },
      ipAddress,
      userAgent,
      success: true,
    })

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          _id: String(user._id),
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    })

    // Set HTTP-only cookie for security
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours (ตรงกับ JWT_EXPIRES_IN ใน auth-service)
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' },
      { status: 500 }
    )
  }
}
