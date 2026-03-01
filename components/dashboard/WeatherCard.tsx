'use client'

import { Cloud, CloudRain, Sun, Wind, Droplets, Thermometer, MapPin } from 'lucide-react'
import { ExternalWeatherData } from '@/lib/types'

interface WeatherCardProps {
  weather: ExternalWeatherData
}

export function WeatherCard({ weather }: WeatherCardProps) {
  const getWeatherIcon = (condition: string) => {
    const lower = condition.toLowerCase()
    if (lower.includes('rain') || lower.includes('ฝน')) {
      return <CloudRain className="h-5 w-5 text-blue-400" />
    } else if (lower.includes('cloud') || lower.includes('เมฆ')) {
      return <Cloud className="h-5 w-5 text-slate-400" />
    } else {
      return <Sun className="h-5 w-5 text-amber-400" />
    }
  }

  const getTempColor = (temp: number) => {
    if (temp > 35) return 'text-red-500'
    if (temp > 30) return 'text-orange-500'
    if (temp < 20) return 'text-blue-500'
    return 'text-emerald-500'
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-sky-200/60 bg-gradient-to-r from-sky-50/80 to-blue-50/50 px-4 py-2.5 dark:border-sky-900/40 dark:from-sky-950/30 dark:to-blue-950/20">
      {/* Location + icon */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {getWeatherIcon(weather.weatherCondition)}
        <MapPin className="h-3 w-3 opacity-60" />
        <span className="font-medium text-foreground">{weather.location}</span>
        <span className="hidden text-xs sm:inline">·</span>
        <span className="hidden text-xs capitalize sm:inline">{weather.weatherCondition}</span>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Thermometer className="h-3.5 w-3.5 opacity-60" />
          <span className={`font-bold tabular-nums ${getTempColor(weather.temperature)}`}>
            {weather.temperature.toFixed(1)}°C
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Droplets className="h-3.5 w-3.5 opacity-60" />
          <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
            {weather.humidity.toFixed(0)}%
          </span>
        </span>
        {weather.feelsLike != null && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            รู้สึก {weather.feelsLike.toFixed(0)}°C
          </span>
        )}
        {weather.windSpeed != null && weather.windSpeed > 0 && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
            <Wind className="h-3 w-3" />
            {weather.windSpeed.toFixed(1)} m/s
          </span>
        )}
      </div>

      {/* Timestamp — far right */}
      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">
        {new Date(weather.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
