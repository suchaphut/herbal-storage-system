'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Zap } from 'lucide-react'
import type { MLAnalysisResult } from '@/lib/types'

interface MLAnalysisPanelProps {
  analysis: MLAnalysisResult | null
}

export function MLAnalysisPanel({ analysis }: MLAnalysisPanelProps) {
  if (!analysis) return null

  const { prediction, anomaly, userFriendly, powerAnomaly, powerPredictionSummary } = analysis
  const p = userFriendly.prediction
  const hasPower = powerAnomaly != null || powerPredictionSummary != null

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-destructive" />
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-blue-500" />
      default: return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'danger': return <Badge variant="destructive">อันตราย</Badge>
      case 'caution': return <Badge variant="secondary" className="bg-yellow-500 text-white">ควรระวัง</Badge>
      default: return <Badge variant="secondary" className="bg-green-500 text-white">ปลอดภัย</Badge>
    }
  }

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm">
      <div className="h-1 w-full bg-primary/50" aria-hidden />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Brain className="h-5 w-5 text-primary" />
          บทวิเคราะห์จาก AI
        </CardTitle>
        <CardDescription>วิเคราะห์แนวโน้มและความผิดปกติด้วย Machine Learning</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {prediction.metrics && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">MAE: {prediction.metrics.mae.toFixed(3)}</Badge>
            <Badge variant="outline">RMSE: {prediction.metrics.rmse.toFixed(3)}</Badge>
            <Badge variant="outline">MAPE: {prediction.metrics.mape.toFixed(2)}%</Badge>
          </div>
        )}
        <div className="rounded-lg bg-background/50 p-3 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              {getTrendIcon(p.trend)}
              แนวโน้ม: {p.trend === 'increasing' ? 'เพิ่มขึ้น' : p.trend === 'decreasing' ? 'ลดลง' : 'คงที่'}
            </span>
            {getRiskBadge(p.riskLevel)}
          </div>
          <p className="text-sm text-foreground font-medium">{p.summary}</p>
          <p className="text-xs text-muted-foreground mt-1">{p.recommendation}</p>
        </div>

        {userFriendly.anomaly && (
          <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-bold">ตรวจพบความผิดปกติ: {userFriendly.anomaly.type}</span>
            </div>
            <p className="text-xs text-foreground">{userFriendly.anomaly.description}</p>
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">ข้อแนะนำ:</p>
              <ul className="text-xs list-disc list-inside">
                {userFriendly.anomaly.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!userFriendly.anomaly && (
          <div className="flex items-center gap-2 text-green-600 text-xs">
            <CheckCircle2 className="h-4 w-4" />
            ไม่พบความผิดปกติในรูปแบบข้อมูลปัจจุบัน
          </div>
        )}

        {/* แอร์ / Power Sensor — การพยากรณ์และ Anomaly Detection */}
        {hasPower && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Zap className="h-4 w-4 text-amber-500" />
              แอร์ / กระแสไฟ (Power Sensor)
            </div>
            {powerPredictionSummary && (
              <div className="rounded-lg bg-background/50 p-3 border border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">การพยากรณ์</p>
                <p className="text-sm text-foreground">{powerPredictionSummary}</p>
                {powerAnomaly && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ค่าปัจจุบัน: กระแส {powerAnomaly.current.toFixed(2)} A · กำลัง {powerAnomaly.power.toFixed(0)} W
                    {powerAnomaly.expectedRange && (
                      <> · เกณฑ์ประมาณ {powerAnomaly.expectedRange.min.toFixed(1)}–{powerAnomaly.expectedRange.max.toFixed(1)} A</>
                    )}
                  </p>
                )}
              </div>
            )}
            {powerAnomaly && (
              powerAnomaly.isAnomaly ? (
                <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-bold">Anomaly Detection: กระแส/กำลังไฟผิดปกติ</span>
                  </div>
                  <p className="text-xs text-foreground">{powerAnomaly.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    คะแนนความผิดปกติ {(powerAnomaly.anomalyScore * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    แอร์มีการกินกระแสมากกว่าปกติอาจบ่งชี้ว่าเครื่องปรับอากาศอาจชำรุด แนะนำให้ตรวจสอบหรือบำรุงรักษา
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  กระแส/กำลังไฟอยู่ในเกณฑ์ปกติ
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
