import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'
import type { RoomNotificationSettings } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { id } = await params
    const room = await db.getRoomById(id)
    if (!room) {
      return NextResponse.json({ success: false, error: 'ไม่พบห้องที่ระบุ' }, { status: 404 })
    }

    const notifications: RoomNotificationSettings = room.notifications ?? {
      discord: { enabled: false, webhookUrl: '' },
      line: { enabled: false, accessToken: '' },
      alertOnThreshold: true,
      alertOnAnomaly: true,
      alertOnOffline: true,
    }

    return NextResponse.json({ success: true, data: notifications })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'ไม่สามารถดึงการตั้งค่าได้' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth(request)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  if (auth.session.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'เฉพาะ Admin เท่านั้นที่แก้ไขการตั้งค่าได้' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body: RoomNotificationSettings = await request.json()

    const updated = await db.updateRoomNotifications(id, body)
    if (!updated) {
      return NextResponse.json({ success: false, error: 'ไม่พบห้องที่ระบุ' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated.notifications })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'ไม่สามารถบันทึกการตั้งค่าได้' }, { status: 500 })
  }
}
