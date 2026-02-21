import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const resolved = searchParams.get('resolved')

    let alerts
    if (resolved === 'true') {
      alerts = await db.getAlerts(true)
    } else if (resolved === 'false') {
      alerts = await db.getAlerts(false)
    } else {
      alerts = await db.getAlerts()
    }

    return NextResponse.json({ success: true, data: alerts })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}
