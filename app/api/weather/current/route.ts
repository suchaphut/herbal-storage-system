import { NextRequest, NextResponse } from 'next/server'
import { getWeatherService } from '@/lib/weather-service'
import { verifyAuth } from '@/lib/auth-middleware'
import { ExternalWeatherDataModel } from '@/lib/models'
import dbConnect from '@/lib/mongodb'

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
    const location = searchParams.get('location') || 'ปราจีนบุรี'
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined
    const lon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : undefined
    const saveToDb = searchParams.get('save') === 'true'

    const weatherService = getWeatherService()
    if (!weatherService) {
      return NextResponse.json(
        {
          success: false,
          error: 'Weather service not configured. Please set OPENWEATHER_API_KEY in environment variables.',
        },
        { status: 503 }
      )
    }

    const weatherData = await weatherService.getCurrentWeather(lat, lon, location)

    if (!weatherData) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch weather data' },
        { status: 500 }
      )
    }

    if (saveToDb) {
      try {
        await dbConnect()
        await ExternalWeatherDataModel.create(weatherData)
      } catch (dbError) {
        console.error('Error saving weather data to DB:', dbError)
      }
    }

    return NextResponse.json({
      success: true,
      data: weatherData,
    })
  } catch (error) {
    console.error('Weather API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
