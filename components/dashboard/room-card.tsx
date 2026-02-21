'use client'

import { Thermometer, Droplets, MapPin, Cpu, Settings, AirVent, Power, PowerOff, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

        {/* AC status */}
        <div
          className={`rounded-xl border p-3.5 ${hasPowerAlert
            ? 'border-warning/50 bg-warning/5'
            : 'border-border/40 bg-muted/20'
            }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <AirVent className="h-3.5 w-3.5" />
              <span>เครื่องปรับอากาศ</span>
            </div>
            {hasPowerAlert && (
              <Badge
                variant="outline"
                className="border-warning/60 bg-warning/10 text-warning text-[10px]"
              >
                <AlertTriangle className="mr-0.5 h-3 w-3" />
                กระแสผิดปกติ
              </Badge>
            )}
          </div>
          {roomACStatus && roomACStatus.units.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-1 text-success">
                <Power className="h-3.5 w-3.5" />
                เปิด {roomACStatus.onCount}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <PowerOff className="h-3.5 w-3.5" />
                ปิด {roomACStatus.offCount}
              </span>
              <span className="text-muted-foreground">
                {roomACStatus.totalPowerWatts.toFixed(0)} W
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              ไม่ได้ติดตั้ง Power sensor ในห้องนี้
            </p>
          )}
          {hasPowerAlert && (
            <p className="mt-2 text-xs text-warning">
              แอร์มีการกินกระแสมากกว่าปกติ — แอร์อาจจะชำรุด
            </p>
          )}
        </div>

        {/* Footer: sensors & status */}
        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cpu className="h-4 w-4 opacity-70" />
            <span>{nodes.length} เซ็นเซอร์</span>
          </div>
          <div className="flex gap-2">
            {onlineNodes > 0 && (
              <Badge variant="secondary" className="bg-success/15 text-success font-medium">
                {onlineNodes} ออนไลน์
              </Badge>
            )}
            {offlineNodes > 0 && (
              <Badge variant="secondary" className="bg-destructive/15 text-destructive font-medium">
                {offlineNodes} ออฟไลน์
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
