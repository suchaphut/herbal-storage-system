'use client'

import { Bell, Moon, Sun, Leaf, LogIn, LogOut, User, AlertCircle, AlertTriangle, Info, CheckCircle2, Clock, Settings } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-context'
import { UserNotificationSettings } from './user-notification-settings'
import type { UserRole, Alert } from '@/lib/types'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'ผู้ดูแลระบบ',
  operator: 'ผู้ปฏิบัติการ',
  viewer: 'ผู้ดูข้อมูล',
}

interface HeaderProps {
  alertCount: number
  alerts?: Alert[]
  onResolveAlert?: (alertId: string) => void
  onResolveAll?: () => void
}

function formatTimeAgo(date: Date) {
  const diff = (Date.now() - new Date(date).getTime()) / 60000
  if (diff < 1) return 'เมื่อสักครู่'
  if (diff < 60) return `${Math.floor(diff)} นาทีที่แล้ว`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h} ชม. ที่แล้ว`
  return new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export function Header({ alertCount, alerts = [], onResolveAlert, onResolveAll }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { user, logout, isLoading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground sm:text-lg">
              <span className="sm:hidden">ห้องเก็บยาสมุนไพร</span>
              <span className="hidden sm:inline">ระบบติดตามห้องเก็บยาสมุนไพร</span>
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Herbal Storage Monitoring System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {alertCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1.5 text-xs"
                  >
                    {alertCount > 99 ? '99+' : alertCount}
                  </Badge>
                )}
                <span className="sr-only">การแจ้งเตือน</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
              {/* Header */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-semibold">การแจ้งเตือน</span>
                </div>
                {alertCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {alertCount} รายการ
                  </Badge>
                )}
              </div>

              {/* Alert list */}
              <ScrollArea className="max-h-[420px]">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <CheckCircle2 className="h-10 w-10 text-success/50" />
                    <p className="text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {alerts.filter((a) => !a.isResolved).map((alert) => (
                      <div key={alert._id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                        <div className="mt-0.5 shrink-0">
                          {alert.severity === 'critical' && <AlertCircle className="h-4 w-4 text-destructive" />}
                          {alert.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-warning" />}
                          {alert.severity === 'info' && <Info className="h-4 w-4 text-chart-2" />}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs text-foreground leading-snug">{alert.message}</p>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(alert.createdAt)}
                          </div>
                        </div>
                        {onResolveAlert && (
                          <button
                            onClick={() => onResolveAlert(alert._id)}
                            className="shrink-0 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            แก้ไขแล้ว
                          </button>
                        )}
                      </div>
                    ))}
                    {alerts.filter((a) => !a.isResolved).length === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                        <CheckCircle2 className="h-10 w-10 text-success/50" />
                        <p className="text-sm text-muted-foreground">ไม่มีการแจ้งเตือนที่ค้างอยู่</p>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              {alerts.filter((a) => !a.isResolved).length > 0 && (
                <div className="flex items-center justify-between border-t px-4 py-2">
                  <p className="text-[11px] text-muted-foreground">
                    {alerts.filter((a) => !a.isResolved).length} รายการที่ยังไม่แก้ไข
                  </p>
                  {onResolveAll && (
                    <button
                      onClick={onResolveAll}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      แก้ไขทั้งหมด
                    </button>
                  )}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                {mounted ? (
                  <>
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </>
                ) : (
                  <div className="h-5 w-5" />
                )}
                <span className="sr-only">สลับธีม</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                สว่าง
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                มืด
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                ตามระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!isLoading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="hidden text-left sm:block">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[user.role]}
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </div>
                  <DropdownMenuSeparator />
                  <UserNotificationSettings
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Settings className="mr-2 h-4 w-4" />
                        ตั้งค่าการแจ้งเตือน
                      </DropdownMenuItem>
                    }
                  />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    ออกจากระบบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="default" asChild>
                <Link href="/login" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  เข้าสู่ระบบ
                </Link>
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  )
}
