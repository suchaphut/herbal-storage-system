/**
 * GET /api/ml/metrics
 *
 * Returns ML model accuracy history for a given node or room.
 * Used by the dashboard to display RMSE trends and detect model drift.
 *
 * Query params:
 *   nodeId  - history for a specific node (returns up to `limit` records)
 *   roomId  - latest metrics per node in a room
 *   limit   - max records to return (default 90, max 365)
 */

import { NextRequest, NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')
    const roomId = searchParams.get('roomId')
    const limitParam = parseInt(searchParams.get('limit') ?? '90', 10)
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 90 : limitParam), 365)

    if (nodeId) {
      const history = await db.getModelMetricsHistory(nodeId, limit)
      return NextResponse.json({ success: true, nodeId, data: history })
    }

    if (roomId) {
      const latest = await db.getLatestModelMetricsByRoom(roomId)
      return NextResponse.json({ success: true, roomId, data: latest })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Provide either nodeId or roomId query parameter',
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('[API] /api/ml/metrics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch model metrics' },
      { status: 500 }
    )
  }
}
