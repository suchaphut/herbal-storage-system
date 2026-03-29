'use client'

import { useState, useEffect } from 'react'
import { Save, Bell, Send, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

interface UserNotifPrefs {
  discord: boolean
  discordWebhookUrl: string
  line: boolean
  lineAccessToken: string
  email: boolean
}

const DEFAULT_PREFS: UserNotifPrefs = {
  discord: false,
  discordWebhookUrl: '',
  line: false,
  lineAccessToken: '',
  email: true,
}

export function SettingsPanel() {
  const [prefs, setPrefs] = useState<UserNotifPrefs>(DEFAULT_PREFS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/users/me/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setPrefs({ ...DEFAULT_PREFS, ...res.data })
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch('/api/users/me/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const data = await res.json()
      setSaveStatus(data.success ? 'success' : 'error')
    } catch {
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">ตั้งค่าการแจ้งเตือน</h2>
        <p className="text-sm text-muted-foreground">
          กำหนด Discord Webhook URL และ LINE Access Token ส่วนตัวของคุณ
          ระบบจะส่งการแจ้งเตือนมาหาคุณโดยตรงเมื่อเกิด alert ในห้องที่คุณรับผิดชอบ
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Discord */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#5865F2]/10 p-2">
                <MessageSquare className="h-5 w-5 text-[#5865F2]" />
              </div>
              <div>
                <CardTitle className="text-base">Discord Webhook</CardTitle>
                <CardDescription>ส่งการแจ้งเตือนไปยัง Discord Channel ของคุณ</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="discord-enabled">เปิดใช้งาน Discord</Label>
              <Switch
                id="discord-enabled"
                disabled={isLoading}
                checked={prefs.discord}
                onCheckedChange={(checked) => setPrefs({ ...prefs, discord: checked })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="discord-webhook">Webhook URL</Label>
              <Input
                id="discord-webhook"
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                value={prefs.discordWebhookUrl}
                disabled={!prefs.discord || isLoading}
                onChange={(e) => setPrefs({ ...prefs, discordWebhookUrl: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* LINE Notify */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#00B900]/10 p-2">
                <Send className="h-5 w-5 text-[#00B900]" />
              </div>
              <div>
                <CardTitle className="text-base">LINE Notify</CardTitle>
                <CardDescription>ส่งการแจ้งเตือนไปยัง LINE ของคุณ</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="line-enabled">เปิดใช้งาน LINE</Label>
              <Switch
                id="line-enabled"
                disabled={isLoading}
                checked={prefs.line}
                onCheckedChange={(checked) => setPrefs({ ...prefs, line: checked })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="line-token">Access Token</Label>
              <Input
                id="line-token"
                type="password"
                placeholder="LINE Notify Access Token"
                value={prefs.lineAccessToken}
                disabled={!prefs.line || isLoading}
                onChange={(e) => setPrefs({ ...prefs, lineAccessToken: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saveStatus === 'success' && (
          <span className="flex items-center gap-1 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            บันทึกเรียบร้อยแล้ว
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            บันทึกไม่สำเร็จ
          </span>
        )}
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </Button>
      </div>

      {/* API Info */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">API Endpoints สำหรับ ESP32</CardTitle>
          <CardDescription>ใช้ endpoints เหล่านี้สำหรับส่งข้อมูลจากอุปกรณ์</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-2 text-sm font-medium text-foreground">ส่งข้อมูลเซ็นเซอร์</p>
            <code className="block rounded bg-background p-2 text-sm">POST /api/data/ingest</code>
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">
{`{
  "nodeId": "ESP32-ENV-001",
  "type": "environmental",
  "readings": {
    "temperature": 25.5,
    "humidity": 55.0
  }
}`}
            </pre>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-2 text-sm font-medium text-foreground">ส่งข้อมูลพลังงาน</p>
            <code className="block rounded bg-background p-2 text-sm">POST /api/data/ingest</code>
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">
{`{
  "nodeId": "ESP32-PWR-001",
  "type": "power",
  "readings": {
    "voltage": 220.5,
    "current": 2.5,
    "power": 551.25,
    "energy": 12.5
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
