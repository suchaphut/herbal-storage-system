import { NextRequest, NextResponse } from 'next/server'
import { checkSensorHeartbeat } from '@/lib/alert-service'

/**
 * GET /api/sensors/check-offline
 *
 * ตรวจสอบเซ็นเซอร์ที่ไม่ส่งข้อมูลเกิน 10 นาที แล้ว mark เป็น offline
 * พร้อมสร้าง alert และส่งแจ้งเตือน Discord/LINE ไปยังผู้ดูแลห้อง
 * รวมถึง auto-resolve เมื่อเซ็นเซอร์กลับมาออนไลน์
 *
 * ข้อความแจ้งเตือนจะระบุ: ชื่อห้อง, ชื่อเซ็นเซอร์, Node ID,
 * ระยะเวลาที่ offline, และคำแนะนำให้ตรวจสอบ WiFi / อุปกรณ์
 *
 * เรียกใช้ได้จาก:
 * - Vercel Cron (vercel.json) ทุก 5 นาที
 * - External cron/scheduler ผ่าน API key
 *
 * ป้องกันด้วย SENSOR_API_KEY หรือ CRON_SECRET
 */

function verifyApiKeyOrCron(request: NextRequest): boolean {
  // Vercel Cron sends this header automatically
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) return true

  // Fallback: SENSOR_API_KEY
  const apiKey = process.env.SENSOR_API_KEY
  if (!apiKey) return false
  const provided =
    request.headers.get('x-api-key') ||
    request.headers.get('Authorization')?.replace('Bearer ', '')
  return provided === apiKey
}

export async function GET(request: NextRequest) {
  if (!verifyApiKeyOrCron(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const result = await checkSensorHeartbeat()

    console.log(
      `[CheckOffline] Checked ${result.checkedNodes} nodes: ` +
      `${result.markedOffline} marked offline, ${result.alertsCreated} alerts created, ` +
      `${result.notificationsSent} notifications sent, ${result.autoResolved} auto-resolved`
    )

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Check offline error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check offline sensors' },
      { status: 500 }
    )
  }
}
