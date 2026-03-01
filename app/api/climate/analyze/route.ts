import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-middleware'
import { dbService as db } from '@/lib/db-service'
import { getWeatherService } from '@/lib/weather-service'
import { ClimateAnalyzer } from '@/lib/climate-analyzer'
import type { EnvironmentalSensorData, ExternalWeatherData } from '@/lib/types'
import dbConnect from '@/lib/mongodb'
import { ExternalWeatherDataModel } from '@/lib/models'

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

    // ดึงข้อมูลเซ็นเซอร์ย้อนหลัง (มากกว่า 1 จุด เพื่อให้ ML ใช้ได้)
    const envData = await db.getSensorDataByRoomAndType(roomId, 'environmental', 288) as EnvironmentalSensorData[]

    if (!envData || envData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No sensor data available for this room' },
        { status: 404 }
      )
    }

    const latestData = envData[0]

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

    // ดึง historical weather data สำหรับ ML (ถ้ามี)
    let historicalWeather: ExternalWeatherData[] = []
    try {
      await dbConnect()
      const weatherDocs = await ExternalWeatherDataModel
        .find({})
        .sort({ timestamp: -1 })
        .limit(288)
        .lean()
      historicalWeather = weatherDocs.map((doc: Record<string, unknown>) => ({
        location: (doc.location as string) || '',
        timestamp: doc.timestamp as Date,
        temperature: (doc.temperature as number) || 0,
        humidity: (doc.humidity as number) || 0,
        pressure: (doc.pressure as number) || 0,
        feelsLike: (doc.feelsLike as number) || 0,
        weatherCondition: (doc.weatherCondition as string) || '',
        weatherMain: (doc.weatherMain as string) || '',
        windSpeed: (doc.windSpeed as number) || 0,
        cloudiness: (doc.cloudiness as number) || 0,
        source: (doc.source as 'TMD' | 'OpenWeatherMap') || 'OpenWeatherMap',
      })) as ExternalWeatherData[]
    } catch {
      // ไม่มี historical weather — ML จะ fallback เป็นไม่ใช้ external regressors
    }

    // ใช้ ML-enhanced analysis (fallback เป็น rule-based อัตโนมัติ)
    const analysis = await ClimateAnalyzer.analyzeWithML({
      roomId,
      insideTemperature: latestData.readings.temperature,
      insideHumidity: latestData.readings.humidity,
      outsideWeather,
      historicalSensorData: envData,
      historicalWeatherData: historicalWeather.length > 0 ? historicalWeather : undefined,
    })

    return NextResponse.json({
      success: true,
      data: analysis,
    })
  } catch (error) {
    console.error('Climate Analysis API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
