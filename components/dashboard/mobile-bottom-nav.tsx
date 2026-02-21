'use client'

import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Bell,
  Brain,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'

interface MobileBottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  alertCount?: number
}

const navItems = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'rooms', label: 'ห้อง', icon: Building2 },
  { id: 'alerts', label: 'แจ้งเตือน', icon: Bell },
  { id: 'predictions', label: 'ML', icon: Brain },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings },
]

export function MobileBottomNav({ activeTab, onTabChange, alertCount = 0 }: MobileBottomNavProps) {
  const { user } = useAuth()

  const visibleItems = navItems.filter((item) => {
    if (item.id === 'settings') return user?.role === 'admin' || user?.role === 'operator'
    return true
  })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {visibleItems.map((item) => {
          const isActive = activeTab === item.id
          const showBadge = item.id === 'alerts' && alertCount > 0
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                isActive ? 'bg-primary/15' : ''
              )}>
                <item.icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute right-2 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
