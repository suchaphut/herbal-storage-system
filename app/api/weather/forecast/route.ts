import { NextRequest, NextResponse } from 'next/server'
import { getWeatherService } from '@/lib/weather-service'
import { verifyAuth } from '@/lib/auth-middleware'

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
    const hours = searchParams.get('hours') ? parseInt(searchParams.get('hours')!) : undefined

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

    const forecastData = hours
      ? await weatherService.getForecastForHours(hours)
      : await weatherService.getForecast(lat, lon, location)

    if (!forecastData) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch forecast data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: forecastData,
      count: forecastData.length,
    })
  } catch (error) {
    console.error('Weather Forecast API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
