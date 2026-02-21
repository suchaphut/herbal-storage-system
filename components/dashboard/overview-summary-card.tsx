'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Thermometer, Droplets, MousePointer2, Leaf } from 'lucide-react'
import type { Room } from '@/lib/types'

type LatestByRoom = Record<string, { temperature: number; humidity: number; timestamp: string }>

interface OverviewSummaryCardProps {
  rooms: Room[]
  latestData: LatestByRoom | undefined
  selectedRoomId: string | null
  onRoomSelect?: (roomId: string) => void
}

function formatTimeAgo(iso: string) {
  try {
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 60000
    if (diff < 1) return 'เมื่อสักครู่'
    if (diff < 60) return `${Math.floor(diff)} นาทีที่แล้ว`
    const h = Math.floor(diff / 60)
    if (h < 24) return `${h} ชม. ที่แล้ว`
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  } catch {
    return '—'
  }
}

export function OverviewSummaryCard({
  rooms,
  latestData,
  selectedRoomId,
  onRoomSelect,
}: OverviewSummaryCardProps) {
  const hasLatest = latestData && Object.keys(latestData).length > 0

  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-b from-primary/5 to-transparent shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Leaf className="h-4 w-4 text-primary" />
          {selectedRoomId ? 'กำลังดูรายละเอียดห้อง' : 'เริ่มต้นใช้งาน'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedRoomId ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
            คลิกการ์ดห้องด้านบนเพื่อดูกราฟอุณหภูมิ/ความชื้น และผลวิเคราะห์ ML
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            รายละเอียดกราฟและการพยากรณ์แสดงในส่วนด้านล่าง
          </p>
        )}

        {hasLatest && rooms.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/50 p-3">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              ค่าล่าสุดแต่ละห้อง
            </p>
            <div className="space-y-2">
              {rooms.slice(0, 6).map((room) => {
                const latest = latestData[room._id]
                const isSelected = selectedRoomId === room._id
                return (
                  <button
                    key={room._id}
                    type="button"
                    onClick={() => onRoomSelect?.(room._id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${isSelected
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/40 hover:border-primary/30 hover:bg-muted/50'
                      }`}
                  >
                    <span className="truncate text-sm font-medium text-foreground">
                      {room.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {latest ? (
                        <>
                          <span className="flex items-center gap-1 tabular-nums">
                            <Thermometer className="h-3 w-3" />
                            {latest.temperature.toFixed(1)}°C
                          </span>
                          <span className="flex items-center gap-1 tabular-nums">
                            <Droplets className="h-3 w-3" />
                            {latest.humidity.toFixed(0)}%
                          </span>
                          <span className="hidden text-muted-foreground/80 sm:inline">
                            {formatTimeAgo(latest.timestamp)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
