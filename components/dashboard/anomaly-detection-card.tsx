'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Thermometer, Droplets } from 'lucide-react'
import type { AnomalyDetectionResult, UserFriendlyAnomaly } from '@/lib/types'

interface AnomalyDetectionCardProps {
  anomaly: AnomalyDetectionResult | null | undefined
  userFriendlyAnomaly: UserFriendlyAnomaly | undefined
  error?: string
  isRoomSelected?: boolean
}

export function AnomalyDetectionCard({
  anomaly,
  userFriendlyAnomaly,
  error,
  isRoomSelected,
}: AnomalyDetectionCardProps) {
  if (!anomaly) {
    const showError = Boolean(isRoomSelected && error)
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Anomaly Detection
          </CardTitle>
          <CardDescription>ผลการตรวจจับความผิดปกติจาก ML</CardDescription>
        </CardHeader>
        <CardContent>
          {showError ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 py-6 px-4 text-center text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">โหลดผลวิเคราะห์ไม่ได้</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 py-6 text-center text-sm text-muted-foreground">
              เลือกห้องเพื่อดูผลวิเคราะห์
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const severityColor =
    anomaly.severity === 'critical'
      ? 'text-destructive'
      : anomaly.severity === 'warning'
        ? 'text-yellow-600 dark:text-yellow-500'
        : 'text-muted-foreground'
  const severityLabel =
    anomaly.severity === 'critical'
      ? 'วิกฤต'
      : anomaly.severity === 'warning'
        ? 'ควรระวัง'
        : 'ปกติ'

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Anomaly Detection
          </CardTitle>
          <Badge
            variant={anomaly.isAnomaly ? 'destructive' : 'secondary'}
            className={anomaly.isAnomaly ? '' : 'bg-green-500/15 text-green-700 dark:text-green-400'}
          >
            {anomaly.isAnomaly ? severityLabel : 'ปกติ'}
          </Badge>
        </div>
        <CardDescription>Isolation Forest + Z-Score • คะแนนความผิดปกติ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Anomaly Score */}
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">Anomaly Score</span>
            <span className={`font-medium ${anomaly.isAnomaly ? severityColor : 'text-foreground'}`}>
              {(anomaly.anomalyScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                anomaly.severity === 'critical'
                  ? 'bg-destructive'
                  : anomaly.severity === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, anomaly.anomalyScore * 100)}%` }}
            />
          </div>
        </div>

        {/* Actual vs Expected */}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">อุณหภูมิ</p>
              <p className="text-sm font-medium">
                จริง <span className="tabular-nums">{anomaly.actualValues.temperature.toFixed(1)}°C</span>
                {' / '}
                คาด <span className="tabular-nums">{anomaly.expectedValues.temperature.toFixed(1)}°C</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">ความชื้น</p>
              <p className="text-sm font-medium">
                จริง <span className="tabular-nums">{anomaly.actualValues.humidity.toFixed(0)}%</span>
                {' / '}
                คาด <span className="tabular-nums">{anomaly.expectedValues.humidity.toFixed(0)}%</span>
              </p>
            </div>
          </div>
        </div>

        {/* Anomaly types */}
        {anomaly.anomalyType.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">ประเภท</p>
            <div className="flex flex-wrap gap-1">
              {anomaly.anomalyType.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* User-friendly message & recommendations */}
        {userFriendlyAnomaly && anomaly.isAnomaly && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-foreground">{userFriendlyAnomaly.description}</p>
            <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
              {userFriendlyAnomaly.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {!anomaly.isAnomaly && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            ไม่พบความผิดปกติในรูปแบบข้อมูลปัจจุบัน
          </div>
        )}
      </CardContent>
    </Card>
  )
}
