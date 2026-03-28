'use client'

import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Cpu,
  Bell,
  Settings,
  Brain,
  Activity,
  Shield,
  Users,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth/auth-context'
import type { UserRole } from '@/lib/types'

interface SidebarNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  allowedRoles?: UserRole[] // If undefined, all roles can access
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'rooms', label: 'จัดการห้องเก็บยา', icon: Building2 },
  { id: 'sensors', label: 'จัดการเซ็นเซอร์', icon: Cpu },
  { id: 'alerts', label: 'การแจ้งเตือน', icon: Bell },
  { id: 'predictions', label: 'ML พยากรณ์', icon: Brain },
  { id: 'logs', label: 'ประวัติข้อมูล', icon: Activity },
  { id: 'users', label: 'จัดการผู้ใช้', icon: Users, allowedRoles: ['admin'] },
  { id: 'audit', label: 'Audit Log', icon: Shield, allowedRoles: ['admin'] },
  { id: 'settings', label: 'ตั้งค่า', icon: Settings, allowedRoles: ['admin', 'operator'] },
  { id: 'about', label: 'เกี่ยวกับ', icon: Info },
]

export function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  const { user } = useAuth()
  const userRole = user?.role

  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) => {
    if (!item.allowedRoles) return true
    return userRole && item.allowedRoles.includes(userRole)
  })

  return (
    <nav className="flex flex-col gap-1 p-3">
      {visibleNavItems.map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          className={cn(
            'justify-start gap-3 px-3',
            activeTab === item.id
              ? 'bg-primary/15 text-primary font-medium shadow-sm'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
          onClick={() => onTabChange(item.id)}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Button>
      ))}
    </nav>
  )
}
