'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import type { PredictionMetrics } from '@/lib/types'

interface MLMetricsCardProps {
  metrics: PredictionMetrics | null | undefined
  modelName?: string
  error?: string
  isRoomSelected?: boolean
}

export function MLMetricsCard({ metrics, modelName, error, isRoomSelected }: MLMetricsCardProps) {
  const showError = Boolean(isRoomSelected && error)
  const showPlaceholder = !metrics && !showError

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <BarChart3 className="h-4 w-4 text-primary" />
          เมตริกการพยากรณ์
        </CardTitle>
        <CardDescription>
          ประเมินผลแบบ Backtest (จริง vs พยากรณ์) • {modelName || 'Holt-Winters'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {metrics ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">MAE</p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {metrics.mae.toFixed(3)}
              </p>
              <p className="text-[10px] text-muted-foreground">Mean Absolute Error</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">RMSE</p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {metrics.rmse.toFixed(3)}
              </p>
              <p className="text-[10px] text-muted-foreground">Root Mean Square Error</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">MAPE</p>
              <p className="text-lg font-bold text-foreground tabular-nums">
                {metrics.mape.toFixed(2)}%
              </p>
              <p className="text-[10px] text-muted-foreground">Mean Absolute % Error</p>
            </div>
          </div>
        ) : showError ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 py-6 px-4 text-center text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">โหลดผลวิเคราะห์ไม่ได้</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              ตรวจสอบว่าห้องนี้มี environmental sensor และมีข้อมูลย้อนหลังอย่างน้อย 6 จุด (หรือรอให้เซนเซอร์ส่งข้อมูลเพิ่ม)
            </p>
          </div>
        ) : showPlaceholder ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูล validation (ต้องการข้อมูลย้อนหลังอย่างน้อย 36 จุดเพื่อคำนวณ MAE, RMSE, MAPE)
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
