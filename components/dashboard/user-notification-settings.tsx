'use client'

import { useState, useEffect } from 'react'
import { Save, MessageSquare, CheckCircle2, AlertCircle, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

interface UserNotifPrefs {
  discord: boolean
  discordWebhookUrl: string
  email: boolean
}

const DEFAULT_PREFS: UserNotifPrefs = {
  discord: false,
  discordWebhookUrl: '',
  email: true,
}

interface UserNotificationSettingsProps {
  trigger?: React.ReactNode
}

export function UserNotificationSettings({ trigger }: UserNotificationSettingsProps) {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<UserNotifPrefs>(DEFAULT_PREFS)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    setSaveStatus('idle')
    fetch('/api/users/me/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setPrefs({ ...DEFAULT_PREFS, ...res.data })
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [open])

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted transition-colors">
            <Bell className="h-4 w-4" />
            ตั้งค่าการแจ้งเตือน
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>การตั้งค่าการแจ้งเตือนส่วนตัว</DialogTitle>
          <DialogDescription>
            กำหนด Discord Webhook URL ของคุณเอง
            ระบบจะใช้ค่านี้ส่งการแจ้งเตือนมาหาคุณโดยตรง
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Discord */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-[#5865F2]/10 p-1.5">
                <MessageSquare className="h-4 w-4 text-[#5865F2]" />
              </div>
              <span className="text-sm font-medium">Discord Webhook</span>
              <Switch
                className="ml-auto"
                disabled={isLoading}
                checked={prefs.discord}
                onCheckedChange={(checked) => setPrefs({ ...prefs, discord: checked })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-discord-url" className="text-xs text-muted-foreground">
                Webhook URL
              </Label>
              <Input
                id="u-discord-url"
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                value={prefs.discordWebhookUrl}
                disabled={!prefs.discord || isLoading}
                onChange={(e) => setPrefs({ ...prefs, discordWebhookUrl: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {saveStatus === 'success' && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  บันทึกเรียบร้อยแล้ว
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  บันทึกไม่สำเร็จ
                </span>
              )}
            </div>
            <Button onClick={handleSave} disabled={isSaving || isLoading} size="sm">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
