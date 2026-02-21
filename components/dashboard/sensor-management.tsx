'use client'

import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle,
  Thermometer,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SensorNode, SensorNodeType, Room } from '@/lib/types'

interface SensorManagementProps {
  sensors: SensorNode[]
  rooms: Room[]
  onUpdate: () => void
}

interface SensorFormData {
  nodeId: string
  name: string
  type: SensorNodeType
  roomId: string | null
  config: {
    reportInterval: number
    firmware: string
  }
}

const defaultFormData: SensorFormData = {
  nodeId: '',
  name: '',
  type: 'environmental',
  roomId: null,
  config: {
    reportInterval: 60,
    firmware: 'v1.0.0',
  },
}

export function SensorManagement({
  sensors,
  rooms,
  onUpdate,
}: SensorManagementProps) {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('canCreateSensor')
  const canEdit = hasPermission('canEditSensor')
  const canDelete = hasPermission('canDeleteSensor')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSensor, setEditingSensor] = useState<SensorNode | null>(null)
  const [formData, setFormData] = useState<SensorFormData>(defaultFormData)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenDialog = (sensor?: SensorNode) => {
    if (sensor) {
      setEditingSensor(sensor)
      setFormData({
        nodeId: sensor.nodeId,
        name: sensor.name,
        type: sensor.type,
        roomId: sensor.roomId,
        config: sensor.config,
      })
    } else {
      setEditingSensor(null)
      setFormData(defaultFormData)
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      if (editingSensor) {
        await fetch(`/api/sensors/${editingSensor._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      } else {
        await fetch('/api/sensors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      }
      onUpdate()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving sensor:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (sensorId: string) => {
    if (!confirm('คุณต้องการลบเซ็นเซอร์นี้หรือไม่?')) return

    try {
      await fetch(`/api/sensors/${sensorId}`, { method: 'DELETE' })
      onUpdate()
    } catch (error) {
      console.error('Error deleting sensor:', error)
    }
  }

  const getRoomName = (roomId: string | null) => {
    if (!roomId) return 'ยังไม่ได้กำหนด'
    const room = rooms.find((r) => r._id === roomId)
    return room?.name || 'ไม่พบห้อง'
  }

  const getStatusBadge = (status: SensorNode['status']) => {
    switch (status) {
      case 'online':
        return (
          <Badge variant="secondary" className="bg-success/10 text-success">
            <Wifi className="mr-1 h-3 w-3" />
            ออนไลน์
          </Badge>
        )
      case 'offline':
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            <WifiOff className="mr-1 h-3 w-3" />
            ออฟไลน์
          </Badge>
        )
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-warning/10 text-warning">
            <AlertTriangle className="mr-1 h-3 w-3" />
            เตือน
          </Badge>
        )
    }
  }

  const getTypeBadge = (type: SensorNodeType) => {
    switch (type) {
      case 'environmental':
        return (
          <Badge variant="outline" className="gap-1">
            <Thermometer className="h-3 w-3" />
            อุณหภูมิ/ความชื้น
          </Badge>
        )
      case 'power':
        return (
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            พลังงาน
          </Badge>
        )
    }
  }

  const formatLastSeen = (lastSeen: Date | null) => {
    if (!lastSeen) return 'ไม่เคยเชื่อมต่อ'
    const date = new Date(lastSeen)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'เมื่อสักครู่'
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`
    if (minutes < 1440) return `${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`
    return date.toLocaleDateString('th-TH')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">จัดการเซ็นเซอร์</h2>
          <p className="text-sm text-muted-foreground">
            {canCreate || canEdit ? 'เพิ่ม แก้ไข หรือกำหนดห้องให้ Sensor Node' : 'ดูรายการเซ็นเซอร์'}
          </p>
        </div>
        {canCreate && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มเซ็นเซอร์
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSensor ? 'แก้ไขเซ็นเซอร์' : 'เพิ่มเซ็นเซอร์ใหม่'}
              </DialogTitle>
              <DialogDescription>
                กำหนด Node ID ให้ตรงกับค่าที่ตั้งบน ESP32 ผ่าน WiFiManager
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nodeId">Node ID (ESP32)</Label>
                <Input
                  id="nodeId"
                  value={formData.nodeId}
                  onChange={(e) =>
                    setFormData({ ...formData, nodeId: e.target.value })
                  }
                  placeholder="เช่น ESP32-ENV-001"
                  disabled={!!editingSensor}
                />
                <p className="text-xs text-muted-foreground">
                  ค่านี้ต้องตรงกับที่ตั้งค่าบนอุปกรณ์ ESP32
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">ชื่อเซ็นเซอร์</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="เช่น เซ็นเซอร์หลัก A1"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">ประเภทเซ็นเซอร์</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as SensorNodeType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="environmental">
                      อุณหภูมิ / ความชื้น (Environmental)
                    </SelectItem>
                    <SelectItem value="power">
                      พลังงาน / กระแสไฟฟ้า (Power)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="room">กำหนดห้อง</Label>
                <Select
                  value={formData.roomId || 'none'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      roomId: value === 'none' ? null : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกห้อง" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ยังไม่กำหนด</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room._id} value={room._id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="interval">ช่วงเวลาส่งข้อมูล (วินาที)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={formData.config.reportInterval}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      config: {
                        ...formData.config,
                        reportInterval: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !formData.nodeId || !formData.name}
              >
                {isLoading
                  ? 'กำลังบันทึก...'
                  : editingSensor
                    ? 'บันทึก'
                    : 'เพิ่มเซ็นเซอร์'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 p-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="font-medium text-foreground">วิธีเชื่อมต่อ ESP32</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>เพิ่ม Sensor Node ในระบบและกำหนดห้อง</li>
              <li>ตั้งค่า Node ID บน ESP32 ผ่าน WiFiManager ให้ตรงกัน</li>
              <li>ESP32 จะส่งข้อมูลมาที่ API endpoint: POST /api/data/ingest</li>
              <li>ระบบจะผูกข้อมูลกับห้องอัตโนมัติผ่าน nodeId</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Sensors Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">รายการเซ็นเซอร์</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Node ID</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>ห้อง</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>เชื่อมต่อล่าสุด</TableHead>
                {(canEdit || canDelete) && (
                <TableHead className="text-right">จัดการ</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sensors.map((sensor) => (
                <TableRow key={sensor._id}>
                  <TableCell className="font-mono text-sm">
                    {sensor.nodeId}
                  </TableCell>
                  <TableCell className="font-medium">{sensor.name}</TableCell>
                  <TableCell>{getTypeBadge(sensor.type)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {getRoomName(sensor.roomId)}
                  </TableCell>
                  <TableCell>{getStatusBadge(sensor.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastSeen(sensor.lastSeen)}
                  </TableCell>
                  {(canEdit || canDelete) && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDialog(sensor)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      )}
                      {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(sensor._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      )}
                    </div>
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
