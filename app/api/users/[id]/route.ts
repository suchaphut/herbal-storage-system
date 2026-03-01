import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { authService } from '@/lib/auth-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { auditLogService, getClientInfo } from '@/lib/audit-log-service'
import type { UpdateUserRequest } from '@/lib/types'

// GET /api/users/[id] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuth(request)
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status }
    )
  }

  const { id } = await params
  const { session } = authResult

  // Users can view their own profile, admins can view any profile
  if (String(session.userId) !== id && !session.permissions.canManageUsers) {
    return NextResponse.json(
      { success: false, error: 'ไม่มีสิทธิ์ในการดูข้อมูลผู้ใช้นี้' },
      { status: 403 }
    )
  }

  const user = await db.getUserById(id)
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'ไม่พบผู้ใช้' },
      { status: 404 }
    )
  }

  const safeUser = authService.toSafeUser(user)
  return NextResponse.json({ success: true, data: safeUser })
}

// PUT /api/users/[id] - Update user
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

  const { id } = await params
  const { session } = authResult
  const isSelfUpdate = String(session.userId) === id

  // Users can update some of their own data, admins can update any user
  if (!isSelfUpdate && !session.permissions.canManageUsers) {
    return NextResponse.json(
      { success: false, error: 'ไม่มีสิทธิ์ในการแก้ไขผู้ใช้นี้' },
      { status: 403 }
    )
  }

  try {
    const body: UpdateUserRequest = await request.json()
    const { email, name, role, assignedRooms, notificationPreferences, isActive } = body

    const user = await db.getUserById(id)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบผู้ใช้' },
        { status: 404 }
      )
    }

    // Regular users can only update their name and notification preferences
    if (!session.permissions.canManageUsers) {
      const updates: Partial<typeof user> = {}
      if (name) updates.name = name
      if (notificationPreferences) {
        updates.notificationPreferences = {
          ...user.notificationPreferences,
          ...notificationPreferences,
          discordWebhookUrl: notificationPreferences.discordWebhookUrl ?? user.notificationPreferences.discordWebhookUrl,
          lineAccessToken: notificationPreferences.lineAccessToken ?? user.notificationPreferences.lineAccessToken,
        }
      }

      const updatedUser = await db.updateUser(id, updates)

      // Log self-update
      await auditLogService.create({
        userId: session.userId,
        userEmail: session.email,
        userName: session.name,
        userRole: session.role,
        action: 'user_update',
        resource: 'user',
        resourceId: id,
        details: `แก้ไขข้อมูลตนเอง`,
        metadata: { changes: Object.keys(updates) },
        ipAddress,
        userAgent,
        success: true,
      })

      return NextResponse.json({
        success: true,
        data: authService.toSafeUser(updatedUser!),
        message: 'อัปเดตข้อมูลสำเร็จ',
      })
    }

    // Admin updates
    const updates: Partial<typeof user> = {}

    if (email && email !== user.email) {
      // Check if email is already in use
      const existingUser = await db.getUserByEmail(email)
      if (existingUser && String(existingUser._id) !== id) {
        return NextResponse.json(
          { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' },
          { status: 400 }
        )
      }
      updates.email = email
    }

    if (name) updates.name = name
    if (role && ['admin', 'operator', 'viewer'].includes(role)) {
      updates.role = role
      // Clear assigned rooms if changing to admin or viewer
      if (role !== 'operator') {
        updates.assignedRooms = []
      }
    }
    if (assignedRooms && (updates.role ?? user.role) === 'operator') {
      updates.assignedRooms = assignedRooms
    }
    if (notificationPreferences) {
      updates.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences,
        discordWebhookUrl: notificationPreferences.discordWebhookUrl ?? user.notificationPreferences.discordWebhookUrl,
        lineAccessToken: notificationPreferences.lineAccessToken ?? user.notificationPreferences.lineAccessToken,
      }
    }
    if (typeof isActive === 'boolean') {
      // Prevent admin from deactivating themselves
      if (id === String(session.userId) && !isActive) {
        return NextResponse.json(
          { success: false, error: 'ไม่สามารถปิดใช้งานบัญชีตัวเองได้' },
          { status: 400 }
        )
      }
      updates.isActive = isActive
    }

    const updatedUser = await db.updateUser(id, updates)

    // Log admin update
    await auditLogService.create({
      userId: session.userId,
      userEmail: session.email,
      userName: session.name,
      userRole: session.role,
      action: 'user_update',
      resource: 'user',
      resourceId: id,
      details: `แก้ไขข้อมูลผู้ใช้: ${user.name}`,
      metadata: { targetUser: user.email, changes: updates },
      ipAddress,
      userAgent,
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: authService.toSafeUser(updatedUser!),
      message: 'อัปเดตข้อมูลสำเร็จ',
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Delete user (Admin only)
export async function DELETE(
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

  const { session } = authResult

  if (!session.permissions.canManageUsers) {
    return NextResponse.json(
      { success: false, error: 'ไม่มีสิทธิ์ในการลบผู้ใช้' },
      { status: 403 }
    )
  }

  const { id } = await params

  // Prevent admin from deleting themselves
  if (id === String(session.userId)) {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถลบบัญชีตัวเองได้' },
      { status: 400 }
    )
  }

  const user = await db.getUserById(id)
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'ไม่พบผู้ใช้' },
      { status: 404 }
    )
  }

  await db.deleteUser(id)

  // Log user deletion
  await auditLogService.create({
    userId: session.userId,
    userEmail: session.email,
    userName: session.name,
    userRole: session.role,
    action: 'user_delete',
    resource: 'user',
    resourceId: id,
    details: `ลบผู้ใช้: ${user.name} (${user.email})`,
    metadata: { deletedUser: user.email, deletedUserRole: user.role },
    ipAddress,
    userAgent,
    success: true,
  })

  return NextResponse.json({
    success: true,
    message: 'ลบผู้ใช้สำเร็จ',
  })
}
