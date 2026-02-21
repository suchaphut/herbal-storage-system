import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'

/** GET /api/data/latest - ค่าล่าสุดอุณหภูมิ/ความชื้นต่อห้อง (สำหรับการ์ดห้อง) */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  try {
    const latest = await db.getLatestEnvironmentalReadingsPerRoom()
    const serialized: Record<string, { temperature: number; humidity: number; timestamp: string }> = {}
    for (const [roomId, v] of Object.entries(latest)) {
      serialized[roomId] = {
        ...v,
        timestamp: v.timestamp.toISOString(),
      }
    }
    return NextResponse.json({ success: true, data: serialized })
  } catch (e) {
    console.error('Latest data error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch latest data' }, { status: 500 })
  }
}
