'use client'

import { Thermometer, Droplets, MapPin, Cpu, Settings, AirVent, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Room, SensorNode, EnvironmentalSensorData, ACRoomStatus } from '@/lib/types'

interface RoomCardProps {
  room: Room
  nodes: SensorNode[]
  latestData?: EnvironmentalSensorData
  /** สถานะเครื่องปรับอากาศของห้องนี้ (จาก power sensor) */
  roomACStatus?: ACRoomStatus
  /** มีการแจ้งเตือนแอร์/กระแสไฟของห้องนี้หรือไม่ (แอร์กินกระแสผิดปกติ เป็นต้น) */
  hasPowerAlert?: boolean
  onSelect: (roomId: string) => void
}

export function RoomCard({ room, nodes, latestData, roomACStatus, hasPowerAlert, onSelect }: RoomCardProps) {
  const onlineNodes = nodes.filter((n) => n.status === 'online').length
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length

  const temp = latestData?.readings.temperature ?? null
  const humidity = latestData?.readings.humidity ?? null

  const isTempWarning =
    temp !== null &&
    (temp < room.thresholds.temperature.min || temp > room.thresholds.temperature.max)

  const isHumidityWarning =
    humidity !== null &&
    (humidity < room.thresholds.humidity.min || humidity > room.thresholds.humidity.max)

  const hasWarning = isTempWarning || isHumidityWarning || hasPowerAlert

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-border/50 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
      onClick={() => onSelect(room._id)}
    >
      {/* Accent bar on top */}
      <div
        className={`h-1.5 w-full transition-colors ${hasWarning ? 'bg-warning' : 'bg-primary'}`}
        aria-hidden
      />

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold tracking-tight text-foreground">
              {room.name}
            </CardTitle>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="truncate">{room.location}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-70 transition-opacity hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Temp & Humidity - compact blocks */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`rounded-xl border p-3.5 transition-colors ${isTempWarning
              ? 'border-warning/40 bg-warning/10'
              : 'border-border/40 bg-muted/30'
              }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${isTempWarning ? 'bg-warning/20' : 'bg-chart-4/15'
                  }`}
              >
                <Thermometer
                  className={`h-4 w-4 ${isTempWarning ? 'text-warning' : 'text-chart-4'}`}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">อุณหภูมิ</span>
            </div>
            <p
              className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${isTempWarning ? 'text-warning' : 'text-foreground'
                }`}
            >
              {temp !== null ? `${temp.toFixed(1)}°C` : '--'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              เป้า {room.thresholds.temperature.min}–{room.thresholds.temperature.max}°C
            </p>
          </div>

          <div
            className={`rounded-xl border p-3.5 transition-colors ${isHumidityWarning
              ? 'border-warning/40 bg-warning/10'
              : 'border-border/40 bg-muted/30'
              }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${isHumidityWarning ? 'bg-warning/20' : 'bg-chart-2/15'
                  }`}
              >
                <Droplets
                  className={`h-4 w-4 ${isHumidityWarning ? 'text-warning' : 'text-chart-2'}`}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">ความชื้น</span>
            </div>
            <p
              className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${isHumidityWarning ? 'text-warning' : 'text-foreground'
                }`}
            >
              {humidity !== null ? `${humidity.toFixed(1)}%` : '--'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              เป้า {room.thresholds.humidity.min}–{room.thresholds.humidity.max}%
            </p>
          </div>
        </div>

        {/* Footer: sensors + AC status compact */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 opacity-70" />
            {nodes.length} เซ็นเซอร์
          </span>
          {onlineNodes > 0 && (
            <span className="inline-flex items-center gap-1 text-success">
              <Wifi className="h-3 w-3" />
              {onlineNodes}
            </span>
          )}
          {offlineNodes > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <WifiOff className="h-3 w-3" />
              {offlineNodes}
            </span>
          )}
          {roomACStatus && roomACStatus.units.length > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5">
              <AirVent className="h-3.5 w-3.5" />
              {roomACStatus.onCount > 0 ? (
                <span className="text-success">{roomACStatus.onCount} เปิด</span>
              ) : (
                <span>ปิด</span>
              )}
              {hasPowerAlert && (
                <AlertTriangle className="h-3 w-3 text-warning" />
              )}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
