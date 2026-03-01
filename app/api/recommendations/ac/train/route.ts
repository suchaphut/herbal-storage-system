import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'
import { dbService as db } from '@/lib/db-service'
import { ACOptimizer } from '@/lib/ac-optimizer'
import { getWeatherService } from '@/lib/weather-service'
import type { EnvironmentalSensorData, PowerSensorData } from '@/lib/types'
import type { RLACEpisode } from '@/lib/ml-python-bridge'
import dbConnect from '@/lib/mongodb'
import { ExternalWeatherDataModel } from '@/lib/models'

/**
 * POST /api/recommendations/ac/train
 * Train RL model จากข้อมูลย้อนหลังของห้อง
 * Body: { roomId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const roomId = body.roomId

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

    // ดึง historical sensor data (288 จุด ≈ 24 ชม. ที่ interval 5 นาที)
    const [envDataDesc, powerDataDesc] = await Promise.all([
      db.getSensorDataByRoomAndType(roomId, 'environmental', 288) as Promise<EnvironmentalSensorData[]>,
      db.getSensorDataByRoomAndType(roomId, 'power', 288) as Promise<PowerSensorData[]>,
    ])
    // DB returns newest-first; sort ascending for training
    const envData = envDataDesc.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const powerData = powerDataDesc.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    if (envData.length < 10) {
      return NextResponse.json(
        { success: false, error: `ข้อมูลไม่เพียงพอ (${envData.length} จุด, ต้องการ >= 10)` },
        { status: 400 }
      )
    }

    // ดึง historical weather data
    let weatherMap = new Map<number, { temperature: number; humidity: number }>()
    try {
      await dbConnect()
      const weatherDocs = await ExternalWeatherDataModel
        .find({})
        .sort({ timestamp: -1 })
        .limit(288)
        .lean()
      for (const doc of weatherDocs) {
        const ts = new Date(doc.timestamp as Date).getTime()
        weatherMap.set(ts, {
          temperature: (doc.temperature as number) || 30,
          humidity: (doc.humidity as number) || 60,
        })
      }
    } catch {
      // ใช้ค่าเริ่มต้น
    }

    // ดึงข้อมูลอากาศปัจจุบันเป็น fallback
    const weatherService = getWeatherService()
    let defaultOutdoorTemp = 30
    let defaultOutdoorHum = 60
    if (weatherService) {
      const current = await weatherService.getCurrentWeather()
      if (current) {
        defaultOutdoorTemp = current.temperature
        defaultOutdoorHum = current.humidity
      }
    }

    const targetTemp = (room.thresholds.temperature.min + room.thresholds.temperature.max) / 2

    // สร้าง episodes จาก consecutive env data points
    const episodes: RLACEpisode[] = []
    for (let i = 0; i < envData.length - 1; i++) {
      const current = envData[i]
      const next = envData[i + 1]
      const ts = new Date(current.timestamp).getTime()
      const hour = new Date(current.timestamp).getHours()

      // หา outdoor weather ที่ใกล้ที่สุด
      let outdoorTemp = defaultOutdoorTemp
      let outdoorHum = defaultOutdoorHum
      let minDiff = Infinity
      for (const [wTs, wData] of weatherMap) {
        const diff = Math.abs(wTs - ts)
        if (diff < minDiff) {
          minDiff = diff
          outdoorTemp = wData.temperature
          outdoorHum = wData.humidity
        }
      }

      // หา power data ที่ใกล้ที่สุด
      let acPower = 0
      let acRunning = false
      let minPowerDiff = Infinity
      for (const pd of powerData) {
        const diff = Math.abs(new Date(pd.timestamp).getTime() - ts)
        if (diff < minPowerDiff) {
          minPowerDiff = diff
          if ('power' in pd.readings) {
            acPower = pd.readings.power
            acRunning = acPower > 50
          }
        }
      }

      episodes.push({
        indoor_temp: current.readings.temperature,
        indoor_humidity: current.readings.humidity,
        outdoor_temp: outdoorTemp,
        outdoor_humidity: outdoorHum,
        ac_power: acPower,
        ac_running: acRunning,
        hour,
        target_temp: targetTemp,
        next_indoor_temp: next.readings.temperature,
      })
    }

    const result = await ACOptimizer.trainFromHistory(roomId, episodes)

    return NextResponse.json({
      success: result.trained,
      data: {
        totalEpisodes: result.totalEpisodes,
        thermalModelMAE: result.thermalMAE,
        episodesUsed: episodes.length,
      },
      error: result.error,
    })
  } catch (error) {
    console.error('AC RL Training API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
