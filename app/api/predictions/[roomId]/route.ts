import { NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { getPrediction } from '@/lib/ml-service'
import { aggregateEnvironmentalByTime } from '@/lib/sensor-aggregation'
import type { EnvironmentalSensorData } from '@/lib/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const room = await db.getRoomById(roomId)

    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      )
    }

    const nodes = await db.getSensorNodes()
    const roomNodes = nodes.filter((n) => n.roomId?.toString() === roomId)
    const environmentalNode = roomNodes.find((n) => n.type === 'environmental')

    if (!environmentalNode) {
      return NextResponse.json(
        { success: false, error: 'No environmental sensor found in this room' },
        { status: 404 }
      )
    }

    const envData = await db.getSensorDataByRoomAndType(roomId, 'environmental', 288) as EnvironmentalSensorData[]
    const aggregatedEnv = aggregateEnvironmentalByTime(envData, 1, roomId)
    if (aggregatedEnv.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Insufficient data for prediction' },
        { status: 400 }
      )
    }

    const predictions = await getPrediction(
      aggregatedEnv,
      roomId,
      'room-aggregated'
    )

    return NextResponse.json({ success: true, data: predictions })
  } catch (error) {
    console.error('Prediction API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate predictions' },
      { status: 500 }
    )
  }
}
