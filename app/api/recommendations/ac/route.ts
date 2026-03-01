import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'
import { dbService as db } from '@/lib/db-service'
import { getWeatherService } from '@/lib/weather-service'
import { ACOptimizer } from '@/lib/ac-optimizer'
import type { EnvironmentalSensorData } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

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

    const weatherService = getWeatherService()
    if (!weatherService) {
      return NextResponse.json(
        {
          success: false,
          error: 'Weather service not configured. Please set OPENWEATHER_API_KEY.',
        },
        { status: 503 }
      )
    }

    const envSensorData = await db.getSensorDataByRoomAndType(roomId, 'environmental', 1)
    if (!envSensorData || envSensorData.length === 0 || !('temperature' in envSensorData[0].readings)) {
      return NextResponse.json(
        { success: false, error: 'No environmental sensor data available' },
        { status: 404 }
      )
    }

    const latestEnvData = envSensorData[0] as EnvironmentalSensorData

    const nodes = await db.getSensorNodesByRoom(roomId)
    const powerNode = nodes?.find((n) => n.type === 'power')

    let acPower = 0
    let acRunning = false

    if (powerNode) {
      const powerData = await db.getSensorDataByNodeId(powerNode.nodeId, 1)
      if (powerData && powerData.length > 0 && powerData[0].type === 'power') {
        const latestPowerData = powerData[0]
        if ('power' in latestPowerData.readings) {
          acPower = latestPowerData.readings.power
          acRunning = acPower > 50
        }
      }
    }

    const outsideWeather = await weatherService.getCurrentWeather(
      room.externalWeather?.coordinates?.lat,
      room.externalWeather?.coordinates?.lon,
      room.externalWeather?.location || 'ปราจีนบุรี'
    )

    if (!outsideWeather) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch external weather data' },
        { status: 500 }
      )
    }

    const forecastWeather = await weatherService.getForecastForHours(6)

    const recommendation = await ACOptimizer.generateWithRL({
      roomId,
      currentTemperature: latestEnvData.readings.temperature,
      currentHumidity: latestEnvData.readings.humidity,
      targetTemperature: (room.thresholds.temperature.min + room.thresholds.temperature.max) / 2,
      targetHumidity: (room.thresholds.humidity.min + room.thresholds.humidity.max) / 2,
      acPower,
      acRunning,
      outsideWeather,
      forecastWeather: forecastWeather || undefined,
      energySavingMode: room.acOptimization?.energySavingMode ?? false,
    })

    return NextResponse.json({
      success: true,
      data: recommendation,
    })
  } catch (error) {
    console.error('AC Recommendation API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
