'use client'

import { AlertTriangle, AlertCircle, Zap, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Alert, SensorNode } from '@/lib/types'

interface PowerAlertsCardProps {
  /** เฉพาะการแจ้งเตือนที่เกี่ยวกับ power sensor (แอร์/กระแสไฟ) */
  alerts: Alert[]
  /** เซ็นเซอร์ทั้งหมด เพื่อกรองว่า alert ไหนเป็นของ power node */
  sensors: SensorNode[]
  onResolve?: (alertId: string) => void
}

export function PowerAlertsCard({ alerts, sensors, onResolve }: PowerAlertsCardProps) {
  const powerNodeIds = new Set(
    sensors.filter((s) => s.type === 'power').map((s) => s.nodeId)
  )
  const powerAlerts = alerts.filter(
    (a) => !a.isResolved && a.nodeId != null && powerNodeIds.has(a.nodeId)
  )

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
    return new Date(date).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (powerNodeIds.size === 0) return null

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-lg">แอร์ / กระแสไฟ</CardTitle>
            <CardDescription>
              แจ้งเตือนเมื่อแอร์กินกระแสผิดปกติ หรืออาจชำรุด
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[220px] pr-2">
          <div className="space-y-3">
            {powerAlerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-success/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  ไม่มีแจ้งเตือนแอร์/กระแสไฟ
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  กระแสและกำลังไฟอยู่ในเกณฑ์ปกติ
                </p>
              </div>
            )}
            {powerAlerts.map((alert) => (
              <div
                key={alert._id}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3"
              >
                <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-foreground">{alert.message}</p>
                  {alert.data?.value != null && alert.data?.threshold != null && (
                    <p className="text-xs text-muted-foreground">
                      กระแส {alert.data.value.toFixed(2)} A
                      {alert.data.threshold > 0 && (
                        <> (เกณฑ์สูงสุดประมาณ {alert.data.threshold.toFixed(1)} A)</>
                      )}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(alert.createdAt)}
                  </div>
                </div>
                {onResolve && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => onResolve(alert._id)}
                  >
                    แก้ไขแล้ว
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        {powerAlerts.length > 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            แอร์มีการกินกระแสมากกว่าปกติอาจบ่งชี้ว่าเครื่องปรับอากาศอาจชำรุด
            แนะนำให้ตรวจสอบหรือบำรุงรักษา
          </p>
        )}
      </CardContent>
    </Card>
  )
}
