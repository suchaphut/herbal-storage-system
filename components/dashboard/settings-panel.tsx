'use client'

import { useState } from 'react'
import { Save, Bell, Send, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

export function SettingsPanel() {
  const [settings, setSettings] = useState({
    discordEnabled: true,
    discordWebhook: '',
    lineEnabled: true,
    lineToken: '',
    alertOnThreshold: true,
    alertOnAnomaly: true,
    alertOnOffline: true,
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
    alert('บันทึกการตั้งค่าเรียบร้อยแล้ว')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">ตั้งค่าระบบ</h2>
        <p className="text-sm text-muted-foreground">
          กำหนดค่าการแจ้งเตือนและการเชื่อมต่อ
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Discord Settings */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#5865F2]/10 p-2">
                <MessageSquare className="h-5 w-5 text-[#5865F2]" />
              </div>
              <div>
                <CardTitle className="text-base">Discord Webhook</CardTitle>
                <CardDescription>ส่งการแจ้งเตือนไปยัง Discord Channel</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="discord-enabled">เปิดใช้งาน Discord</Label>
              <Switch
                id="discord-enabled"
                checked={settings.discordEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, discordEnabled: checked })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="discord-webhook">Webhook URL</Label>
              <Input
                id="discord-webhook"
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                value={settings.discordWebhook}
                onChange={(e) =>
                  setSettings({ ...settings, discordWebhook: e.target.value })
                }
                disabled={!settings.discordEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* LINE Notify Settings */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[#00B900]/10 p-2">
                <Send className="h-5 w-5 text-[#00B900]" />
              </div>
              <div>
                <CardTitle className="text-base">LINE Notify</CardTitle>
                <CardDescription>ส่งการแจ้งเตือนไปยัง LINE</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="line-enabled">เปิดใช้งาน LINE</Label>
              <Switch
                id="line-enabled"
                checked={settings.lineEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, lineEnabled: checked })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="line-token">Access Token</Label>
              <Input
                id="line-token"
                type="password"
                placeholder="LINE Notify Access Token"
                value={settings.lineToken}
                onChange={(e) =>
                  setSettings({ ...settings, lineToken: e.target.value })
                }
                disabled={!settings.lineEnabled}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Triggers */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2">
              <Bell className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle className="text-base">เงื่อนไขการแจ้งเตือน</CardTitle>
              <CardDescription>กำหนดเหตุการณ์ที่ต้องการให้ส่งการแจ้งเตือน</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>ค่าเกิน Threshold</Label>
              <p className="text-sm text-muted-foreground">
                แจ้งเตือนเมื่ออุณหภูมิหรือความชื้นเกินค่าที่กำหนด
              </p>
            </div>
            <Switch
              checked={settings.alertOnThreshold}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, alertOnThreshold: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>ตรวจพบค่าผิดปกติ (Anomaly)</Label>
              <p className="text-sm text-muted-foreground">
                แจ้งเตือนเมื่อ ML ตรวจพบรูปแบบข้อมูลผิดปกติ
              </p>
            </div>
            <Switch
              checked={settings.alertOnAnomaly}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, alertOnAnomaly: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>เซ็นเซอร์ออฟไลน์</Label>
              <p className="text-sm text-muted-foreground">
                แจ้งเตือนเมื่อเซ็นเซอร์ไม่ส่งข้อมูลเกิน 5 นาที
              </p>
            </div>
            <Switch
              checked={settings.alertOnOffline}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, alertOnOffline: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* API Info */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">API Endpoints สำหรับ ESP32</CardTitle>
          <CardDescription>
            ใช้ endpoints เหล่านี้สำหรับส่งข้อมูลจากอุปกรณ์
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-2 text-sm font-medium text-foreground">
              ส่งข้อมูลเซ็นเซอร์
            </p>
            <code className="block rounded bg-background p-2 text-sm">
              POST /api/data/ingest
            </code>
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
            <p className="mb-2 text-sm font-medium text-foreground">
              ส่งข้อมูลพลังงาน
            </p>
            <code className="block rounded bg-background p-2 text-sm">
              POST /api/data/ingest
            </code>
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </Button>
      </div>
    </div>
  )
}
