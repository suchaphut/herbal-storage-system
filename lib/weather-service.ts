import { ExternalWeatherData } from './types'

const OPENWEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5'
const CACHE_DURATION_MS = 15 * 60 * 1000 // 15 minutes

interface WeatherCache {
  data: ExternalWeatherData
  timestamp: number
}

const cache = new Map<string, WeatherCache>()

export interface WeatherServiceConfig {
  apiKey: string
  defaultLocation?: {
    lat: number
    lon: number
  }
}

export class WeatherService {
  private apiKey: string
  private defaultLocation: { lat: number; lon: number }

  constructor(config: WeatherServiceConfig) {
    this.apiKey = config.apiKey
    this.defaultLocation = config.defaultLocation || {
      lat: 14.0583, // Prachin Buri latitude
      lon: 101.3711, // Prachin Buri longitude
    }
  }

  /**
   * Get current weather data for a location
   */
  async getCurrentWeather(
    lat?: number,
    lon?: number,
    location?: string
  ): Promise<ExternalWeatherData | null> {
    const targetLat = lat || this.defaultLocation.lat
    const targetLon = lon || this.defaultLocation.lon
    const cacheKey = `current_${targetLat}_${targetLon}`

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.data
    }

    try {
      const url = `${OPENWEATHER_API_BASE}/weather?lat=${targetLat}&lon=${targetLon}&appid=${this.apiKey}&units=metric&lang=th`
      const response = await fetch(url, {
        next: { revalidate: 900 }, // 15 minutes
      })

      if (!response.ok) {
        console.error('OpenWeatherMap API error:', response.status, response.statusText)
        return null
      }

      const data = await response.json()

      const weatherData: ExternalWeatherData = {
        location: location || data.name || 'ปราจีนบุรี',
        timestamp: new Date(data.dt * 1000),
        temperature: data.main.temp,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        feelsLike: data.main.feels_like,
        weatherCondition: data.weather[0]?.description || 'ไม่ทราบ',
        weatherMain: data.weather[0]?.main || 'Unknown',
        windSpeed: data.wind?.speed || 0,
        cloudiness: data.clouds?.all || 0,
        source: 'OpenWeatherMap',
        coordinates: {
          lat: data.coord.lat,
          lon: data.coord.lon,
        },
      }

      // Update cache
      cache.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now(),
      })

      return weatherData
    } catch (error) {
      console.error('Error fetching weather data:', error)
      return null
    }
  }

  /**
   * Get weather forecast (3-hour intervals, 5 days)
   */
  async getForecast(
    lat?: number,
    lon?: number,
    location?: string
  ): Promise<ExternalWeatherData[] | null> {
    const targetLat = lat || this.defaultLocation.lat
    const targetLon = lon || this.defaultLocation.lon
    const cacheKey = `forecast_${targetLat}_${targetLon}`

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.data as unknown as ExternalWeatherData[]
    }

    try {
      const url = `${OPENWEATHER_API_BASE}/forecast?lat=${targetLat}&lon=${targetLon}&appid=${this.apiKey}&units=metric&lang=th`
      const response = await fetch(url, {
        next: { revalidate: 900 }, // 15 minutes
      })

      if (!response.ok) {
        console.error('OpenWeatherMap Forecast API error:', response.status, response.statusText)
        return null
      }

      const data = await response.json()

      const forecasts: ExternalWeatherData[] = data.list.map((item: any) => ({
        location: location || data.city.name || 'ปราจีนบุรี',
        timestamp: new Date(item.dt * 1000),
        temperature: item.main.temp,
        humidity: item.main.humidity,
        pressure: item.main.pressure,
        feelsLike: item.main.feels_like,
        weatherCondition: item.weather[0]?.description || 'ไม่ทราบ',
        weatherMain: item.weather[0]?.main || 'Unknown',
        windSpeed: item.wind?.speed || 0,
        cloudiness: item.clouds?.all || 0,
        source: 'OpenWeatherMap',
        coordinates: {
          lat: data.city.coord.lat,
          lon: data.city.coord.lon,
        },
      }))

      // Update cache
      cache.set(cacheKey, {
        data: forecasts as unknown as ExternalWeatherData,
        timestamp: Date.now(),
      })

      return forecasts
    } catch (error) {
      console.error('Error fetching forecast data:', error)
      return null
    }
  }

  /**
   * Get weather data for next N hours (for ML predictions)
   */
  async getForecastForHours(hours: number = 6): Promise<ExternalWeatherData[] | null> {
    const forecasts = await this.getForecast()
    if (!forecasts) return null

    const now = new Date()
    const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000)

    return forecasts.filter((f) => {
      const forecastTime = new Date(f.timestamp)
      return forecastTime >= now && forecastTime <= targetTime
    })
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    cache.clear()
  }
}

// Singleton instance
let weatherServiceInstance: WeatherService | null = null

export function getWeatherService(): WeatherService | null {
  const apiKey = process.env.OPENWEATHER_API_KEY

  if (!apiKey) {
    console.warn('OPENWEATHER_API_KEY not set. Weather features disabled.')
    return null
  }

  if (!weatherServiceInstance) {
    weatherServiceInstance = new WeatherService({ apiKey })
  }

  return weatherServiceInstance
}
