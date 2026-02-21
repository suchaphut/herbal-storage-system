'use client'

import { AirVent, Power, PowerOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ACStatus } from '@/lib/types'

interface ACStatusCardProps {
  acStatus: ACStatus | undefined
}

export function ACStatusCard({ acStatus }: ACStatusCardProps) {
  if (!acStatus || acStatus.summary.totalUnits === 0) {
    return null
  }

  const { summary, byRoom } = acStatus

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <AirVent className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">สถานะเครื่องปรับอากาศ</CardTitle>
            <CardDescription>จาก Power Sensor ในแต่ละห้อง</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-success" />
            <span className="text-sm text-muted-foreground">เปิด</span>
            <span className="text-lg font-semibold text-foreground">{summary.onCount}</span>
            <span className="text-sm text-muted-foreground">เครื่อง</span>
          </div>
          <div className="flex items-center gap-2">
            <PowerOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">ปิด</span>
            <span className="text-lg font-semibold text-foreground">{summary.offCount}</span>
            <span className="text-sm text-muted-foreground">เครื่อง</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">รวม</span>
            <span className="text-lg font-semibold text-foreground">{summary.totalUnits}</span>
            <span className="text-sm text-muted-foreground">เครื่อง</span>
            <span className="ml-1 text-sm text-muted-foreground">
              ({summary.totalPowerWatts.toFixed(0)} W)
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">แยกตามห้อง</p>
          <ul className="space-y-2">
            {byRoom.map((room) => (
              <li
                key={room.roomId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-card p-3"
              >
                <span className="font-medium text-foreground">{room.roomName}</span>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-success">
                    เปิด {room.onCount} เครื่อง
                  </span>
                  <span className="text-muted-foreground">
                    ปิด {room.offCount} เครื่อง
                  </span>
                  <span className="text-muted-foreground">
                    {room.totalPowerWatts.toFixed(0)} W
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
