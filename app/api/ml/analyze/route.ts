import { NextResponse } from 'next/server'
import { dbService as db } from '@/lib/db-service'
import { analyzeRoom, detectPowerAnomaly } from '@/lib/ml-service'
import { aggregateEnvironmentalByTime } from '@/lib/sensor-aggregation'
import type { EnvironmentalSensorData, PowerSensorData } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'roomId is required' },
        { status: 400 }
      )
    }

    const room = await db.getRoomById(roomId)
    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      )
    }

    const historicalData = await db.getSensorDataByRoom(roomId, 288)
    const envData = historicalData.filter(
      (d): d is EnvironmentalSensorData => d.type === 'environmental'
    )
    const powerData = historicalData.filter(
      (d): d is PowerSensorData => d.type === 'power'
    )

    const nodes = await db.getSensorNodes()
    const roomNodes = nodes.filter((n) => n.roomId?.toString() === roomId)
    const environmentalNode = roomNodes.find((n) => n.type === 'environmental')

    if (!environmentalNode) {
      return NextResponse.json(
        { success: false, error: 'No environmental sensor found in this room' },
        { status: 404 }
      )
    }

    // รวมเป็นค่าเฉลี่ยต่อช่วงเวลา (ทุก 1 นาที) เพื่อให้ได้จุดข้อมูลมากพอสำหรับ ML
    const aggregatedEnv = aggregateEnvironmentalByTime(envData, 1, roomId)
    if (aggregatedEnv.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: `ข้อมูลย้อนหลังไม่เพียงพอ (มี ${aggregatedEnv.length} จุด ต้องการอย่างน้อย 6 จุด)`,
        },
        { status: 400 }
      )
    }

    const analysis = await analyzeRoom(
      roomId,
      'room-aggregated',
      aggregatedEnv,
      room
    )

    // เพิ่มการวิเคราะห์ Power Sensor (แอร์/กระแสไฟ) ถ้าห้องมี power sensor
    const powerNode = roomNodes.find((n) => n.type === 'power')
    if (powerNode) {
      const powerHistory = powerData.filter((d) => d.nodeId === powerNode.nodeId)
      const latestPower = powerHistory[powerHistory.length - 1]
      if (latestPower && powerHistory.length >= 2) {
        const powerAnomaly = detectPowerAnomaly(
          latestPower,
          powerHistory.slice(0, -1),
          { useHistoricalRange: true, deviceExpectedOn: false }
        )
        analysis.powerAnomaly = powerAnomaly
        analysis.powerPredictionSummary =
          'การพยากรณ์กระแส/กำลังไฟใช้ข้อมูลจาก Power Sensor ในห้องนี้ — ค่าปัจจุบันและเกณฑ์จากประวัติ'
      } else {
        analysis.powerPredictionSummary =
          'มี Power Sensor ในห้องนี้ — รอข้อมูลเพิ่มเพื่อวิเคราะห์การพยากรณ์และความผิดปกติ'
      }
    }

    return NextResponse.json({ success: true, data: analysis })
  } catch (error) {
    console.error('ML analysis error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to perform ML analysis' },
      { status: 500 }
    )
  }
}
