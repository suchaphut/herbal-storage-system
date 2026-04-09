import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const user = await db.getUserById(auth.session.userId)
    if (!user) {
      return NextResponse.json({ success: false, error: 'ไม่พบผู้ใช้' }, { status: 404 })
    }

    const prefs = user.notificationPreferences ?? {
      discord: false,
      discordWebhookUrl: '',
      email: true,
    }

    return NextResponse.json({ success: true, data: prefs })
  } catch {
    return NextResponse.json({ success: false, error: 'ไม่สามารถดึงการตั้งค่าได้' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()

    const allowed = ['discord', 'discordWebhookUrl', 'email']
    const prefs: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) prefs[key] = body[key]
    }

    const updated = await db.updateUserNotificationWebhooks(auth.session.userId, prefs)
    if (!updated) {
      return NextResponse.json({ success: false, error: 'ไม่พบผู้ใช้' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated.notificationPreferences })
  } catch {
    return NextResponse.json({ success: false, error: 'ไม่สามารถบันทึกการตั้งค่าได้' }, { status: 500 })
  }
}
