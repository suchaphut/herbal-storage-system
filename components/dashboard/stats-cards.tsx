'use client'

import { Building2, Cpu, Wifi, WifiOff, AlertTriangle, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardStats } from '@/lib/types'

interface StatsCardsProps {
  stats: DashboardStats
}

const cardConfig = [
  {
    label: 'ห้องทั้งหมด',
    getValue: (s: DashboardStats) => s.totalRooms,
    icon: Building2,
    accent: 'from-primary/15 to-primary/5',
    iconBg: 'bg-primary/15',
    iconColor: 'text-primary',
    borderColor: 'border-l-primary/50',
  },
  {
    label: 'เซ็นเซอร์ทั้งหมด',
    getValue: (s: DashboardStats) => s.totalNodes,
    icon: Cpu,
    accent: 'from-chart-2/15 to-chart-2/5',
    iconBg: 'bg-chart-2/15',
    iconColor: 'text-chart-2',
    borderColor: 'border-l-chart-2/50',
  },
  {
    label: 'ออนไลน์',
    getValue: (s: DashboardStats) => s.onlineNodes,
    icon: Wifi,
    accent: 'from-success/15 to-success/5',
    iconBg: 'bg-success/15',
    iconColor: 'text-success',
    borderColor: 'border-l-success/50',
  },
  {
    label: 'ออฟไลน์',
    getValue: (s: DashboardStats) => s.offlineNodes,
    icon: WifiOff,
    accent: 'from-muted-foreground/10 to-muted/50',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    borderColor: 'border-l-muted-foreground/30',
  },
  {
    label: 'แจ้งเตือนที่ยังไม่แก้ไข',
    getValue: (s: DashboardStats) => s.activeAlerts,
    icon: AlertTriangle,
    accent: 'from-warning/15 to-warning/5',
    iconBg: 'bg-warning/15',
    iconColor: 'text-warning',
    borderColor: 'border-l-warning/50',
  },
  {
    label: 'แจ้งเตือนวิกฤต',
    getValue: (s: DashboardStats) => s.criticalAlerts,
    icon: AlertCircle,
    accent: 'from-destructive/15 to-destructive/5',
    iconBg: 'bg-destructive/15',
    iconColor: 'text-destructive',
    borderColor: 'border-l-destructive/50',
  },
] as const

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cardConfig.map((card) => {
        const Icon = card.icon
        const value = card.getValue(stats)
        return (
          <Card
            key={card.label}
            className={`group overflow-hidden border-border/40 bg-gradient-to-br ${card.accent} shadow-sm transition-all duration-300 hover:shadow-lg hover:border-border/60 border-l-4 ${card.borderColor}`}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor} transition-transform duration-300 group-hover:scale-110`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">
                  {value}
                </p>
                <p className="truncate text-[11px] font-medium text-muted-foreground">
                  {card.label}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
