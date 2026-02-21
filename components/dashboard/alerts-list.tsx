'use client'

import { AlertTriangle, AlertCircle, Info, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Alert } from '@/lib/types'

interface AlertsListProps {
  alerts: Alert[]
  onResolve?: (alertId: string) => void
  onResolveAll?: () => void
}

export function AlertsList({ alerts, onResolve, onResolveAll }: AlertsListProps) {
  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />
      case 'info':
        return <Info className="h-4 w-4 text-chart-2" />
    }
  }

  const getSeverityBadge = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <Badge variant="destructive" className="text-xs">
            วิกฤต
          </Badge>
        )
      case 'warning':
        return (
          <Badge className="bg-warning/10 text-warning hover:bg-warning/20 text-xs">
            เตือน
          </Badge>
        )
      case 'info':
        return (
          <Badge variant="secondary" className="text-xs">
            ข้อมูล
          </Badge>
        )
    }
  }

  const getTypeBadge = (type: Alert['type']) => {
    switch (type) {
      case 'threshold':
        return 'ค่าเกินกำหนด'
      case 'anomaly':
        return 'ค่าผิดปกติ'
      case 'offline':
        return 'ออฟไลน์'
      case 'system':
        return 'ระบบ'
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 60) {
      return `${minutes} นาทีที่แล้ว`
    } else if (hours < 24) {
      return `${hours} ชั่วโมงที่แล้ว`
    } else {
      return new Date(date).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  const unresolvedAlerts = alerts.filter((a) => !a.isResolved)
  const resolvedAlerts = alerts.filter((a) => a.isResolved).slice(0, 5)

  return (
    <Card className="overflow-hidden border-border/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold tracking-tight">การแจ้งเตือน</CardTitle>
          <div className="flex items-center gap-2">
            {unresolvedAlerts.length > 0 && (
              <Badge variant="destructive">{unresolvedAlerts.length} รายการ</Badge>
            )}
            {onResolveAll && unresolvedAlerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onResolveAll}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                แก้ไขทั้งหมด
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {unresolvedAlerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-success/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  ไม่มีการแจ้งเตือนที่ต้องดำเนินการ
                </p>
              </div>
            )}

            {unresolvedAlerts.map((alert) => (
              <div
                key={alert._id}
                className="flex items-start gap-3 rounded-xl border border-border/40 bg-card p-3 transition-colors hover:bg-muted/30"
              >
                <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(alert.severity)}
                    <span className="text-xs text-muted-foreground">
                      {getTypeBadge(alert.type)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{alert.message}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime(alert.createdAt)}
                  </div>
                </div>
                {onResolve && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => onResolve(alert._id)}
                  >
                    แก้ไขแล้ว
                  </Button>
                )}
              </div>
            ))}

            {resolvedAlerts.length > 0 && (
              <>
                <div className="my-4 border-t pt-4">
                  <p className="mb-3 text-xs font-medium text-muted-foreground">
                    แก้ไขแล้วล่าสุด
                  </p>
                </div>
                {resolvedAlerts.map((alert) => (
                  <div
                    key={alert._id}
                    className="flex items-start gap-3 rounded-lg bg-muted/30 p-3 opacity-60"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm text-foreground line-through">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        แก้ไขเมื่อ {formatTime(alert.resolvedAt!)}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
