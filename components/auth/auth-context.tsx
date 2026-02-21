'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { SafeUser, RolePermissions, UserRole, ROLE_PERMISSIONS } from '@/lib/types'

interface AuthContextType {
  user: SafeUser | null
  permissions: RolePermissions | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  hasPermission: (permission: keyof RolePermissions) => boolean
  canAccessRoom: (roomId: string) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null)
  const [permissions, setPermissions] = useState<RolePermissions | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setUser(data.user)
          setPermissions(data.permissions)
          return
        }
      }
      setUser(null)
      setPermissions(null)
    } catch {
      setUser(null)
      setPermissions(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (data.success) {
        // refreshSession fetches full user + permissions (cookie is now set)
        await refreshSession()
        return { success: true }
      }

      return { success: false, error: data.error || 'เข้าสู่ระบบไม่สำเร็จ' }
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setPermissions(null)
    }
  }

  const hasPermission = useCallback(
    (permission: keyof RolePermissions): boolean => {
      if (!permissions) return false
      return permissions[permission]
    },
    [permissions]
  )

  const canAccessRoom = useCallback(
    (roomId: string): boolean => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'viewer') return true
      if (user.role === 'operator') {
        return user.assignedRooms.includes(roomId)
      }
      return false
    },
    [user]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshSession,
        hasPermission,
        canAccessRoom,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
