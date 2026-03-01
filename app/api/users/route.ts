import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { authService } from '@/lib/auth-service'
import { requirePermission } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'
import type { CreateUserRequest } from '@/lib/types'

// GET /api/users - List all users (Admin only)
export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'canManageUsers')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  const users = (await db.getAllUsers()).map((u) => authService.toSafeUser(u))

  return NextResponse.json({ success: true, data: users })
}

// POST /api/users - Create new user (Admin only)
export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getClientInfo(request)

  const authResult = await requirePermission(request, 'canManageUsers')
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body: CreateUserRequest = await request.json()
    const { email, password, name, role, assignedRooms = [] } = body

    // Validation
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await db.getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['admin', 'operator', 'viewer'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'ประเภทผู้ใช้ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password)

    // Create user
    const newUser = await db.createUser({
      email,
      passwordHash,
      name,
      role,
      assignedRooms: role === 'operator' ? assignedRooms : [],
      notificationPreferences: {
        discord: false,
        discordWebhookUrl: '',
        line: false,
        lineAccessToken: '',
        email: true,
      },
      lastLogin: null,
      loginAttempts: 0,
      lockedUntil: null,
      isActive: true,
    })

    const safeUser = authService.toSafeUser(newUser)

    // Log user creation
    const { session } = authResult
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'user_create',
      resource: 'user',
      resourceId: String(newUser._id),
      details: `สร้างผู้ใช้ใหม่: ${name} (${email}) - ${role}`,
      metadata: { newUserEmail: email, newUserRole: role, assignedRooms },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json(
      { success: true, data: safeUser, message: 'สร้างผู้ใช้สำเร็จ' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    )
  }
}
