import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { verifyAuth } from '@/lib/auth-middleware'

/**
 * GET /api/data/history
 * Query params:
 *   roomId   - filter by room (optional)
 *   nodeId   - filter by node (optional)
 *   type     - 'environmental' | 'power' | '' (optional)
 *   limit    - number of records (default 200, max 1000)
 *   page     - page number (default 1)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.success) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId') || ''
    const nodeId = searchParams.get('nodeId') || ''
    const type = searchParams.get('type') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000)
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)

    const data = await db.getSensorDataHistory({ roomId, nodeId, type, limit, page })

    return NextResponse.json({
      success: true,
      data: data.records,
      total: data.total,
      page,
      limit,
      totalPages: Math.ceil(data.total / limit),
    })
  } catch (error) {
    console.error('History fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 })
  }
}
