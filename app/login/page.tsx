'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Leaf } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(email, password)

      if (result.success) {
        router.replace('/')
        return
      }

      setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ')
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md">
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Leaf className="h-6 w-6" />
              </div>
            </div>
            <CardTitle className="text-2xl text-white">
              ระบบติดตามห้องเก็บยาสมุนไพร
            </CardTitle>
            <CardDescription className="text-slate-400">
              Herbal Storage Monitoring System
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-200">
                  อีเมล
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@herbal.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-200">
                  รหัสผ่าน
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </Button>
            </form>

            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-6 space-y-2 rounded-lg bg-slate-700/30 p-4 text-sm text-slate-300">
                <p className="font-medium text-slate-200">Demo Accounts:</p>
                <div className="space-y-1 text-xs">
                  <p>Admin: admin@herbal.local / admin123</p>
                  <p>Operator: operator@herbal.local / operator123</p>
                  <p>Viewer: viewer@herbal.local / viewer123</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
