'use client'

import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  MapPin,
  Thermometer,
  Droplets,
  AirVent,
  Power,
  PowerOff,
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { Room, SensorNode, ACStatus } from '@/lib/types'

interface RoomManagementProps {
  rooms: Room[]
  sensors: SensorNode[]
  /** สถานะเครื่องปรับอากาศต่อห้อง (จาก power sensor) เพื่อแสดงในการ์ดห้อง */
  acStatus?: ACStatus
  onUpdate: () => void
}

interface RoomFormData {
  name: string
  description: string
  location: string
  thresholds: {
    temperature: { min: number; max: number }
    humidity: { min: number; max: number }
  }
}

const defaultFormData: RoomFormData = {
  name: '',
  description: '',
  location: '',
  thresholds: {
    temperature: { min: 20, max: 28 },
    humidity: { min: 40, max: 60 },
  },
}

export function RoomManagement({ rooms, sensors, acStatus, onUpdate }: RoomManagementProps) {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('canCreateRoom')
  const canEdit = hasPermission('canEditRoom')
  const canDelete = hasPermission('canDeleteRoom')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [formData, setFormData] = useState<RoomFormData>(defaultFormData)
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenDialog = (room?: Room) => {
    if (room) {
      setEditingRoom(room)
      setFormData({
        name: room.name,
        description: room.description,
        location: room.location,
        thresholds: room.thresholds,
      })
    } else {
      setEditingRoom(null)
      setFormData(defaultFormData)
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      if (editingRoom) {
        await fetch(`/api/rooms/${editingRoom._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      } else {
        await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      }
      onUpdate()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving room:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (roomId: string) => {
    if (!confirm('คุณต้องการลบห้องนี้หรือไม่?')) return

    try {
      await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' })
      onUpdate()
    } catch (error) {
      console.error('Error deleting room:', error)
    }
  }

  const getRoomSensors = (roomId: string) =>
    sensors.filter((s) => s.roomId === roomId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">จัดการห้องเก็บยา</h2>
          <p className="text-sm text-muted-foreground">
            {canCreate ? 'เพิ่ม แก้ไข หรือลบห้องเก็บยาสมุนไพร' : 'ดูรายการห้องเก็บยาสมุนไพร'}
          </p>
        </div>
        {canCreate && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มห้องใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? 'แก้ไขห้อง' : 'เพิ่มห้องใหม่'}
              </DialogTitle>
              <DialogDescription>
                กรอกข้อมูลห้องเก็บยาสมุนไพรและค่า Threshold
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">ชื่อห้อง</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="เช่น ห้องเก็บยาสมุนไพรแห้ง A"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="location">ตำแหน่ง</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="เช่น อาคาร 1 ชั้น 2"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="อธิบายลักษณะการใช้งานห้อง"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 rounded-lg border p-4">
                <Label className="text-sm font-medium">
                  ค่า Threshold อุณหภูมิ (°C)
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="tempMin" className="text-xs text-muted-foreground">
                      ต่ำสุด
                    </Label>
                    <Input
                      id="tempMin"
                      type="number"
                      value={formData.thresholds.temperature.min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          thresholds: {
                            ...formData.thresholds,
                            temperature: {
                              ...formData.thresholds.temperature,
                              min: Number(e.target.value),
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tempMax" className="text-xs text-muted-foreground">
                      สูงสุด
                    </Label>
                    <Input
                      id="tempMax"
                      type="number"
                      value={formData.thresholds.temperature.max}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          thresholds: {
                            ...formData.thresholds,
                            temperature: {
                              ...formData.thresholds.temperature,
                              max: Number(e.target.value),
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-lg border p-4">
                <Label className="text-sm font-medium">
                  ค่า Threshold ความชื้น (%)
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="humidityMin" className="text-xs text-muted-foreground">
                      ต่ำสุด
                    </Label>
                    <Input
                      id="humidityMin"
                      type="number"
                      value={formData.thresholds.humidity.min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          thresholds: {
                            ...formData.thresholds,
                            humidity: {
                              ...formData.thresholds.humidity,
                              min: Number(e.target.value),
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="humidityMax" className="text-xs text-muted-foreground">
                      สูงสุด
                    </Label>
                    <Input
                      id="humidityMax"
                      type="number"
                      value={formData.thresholds.humidity.max}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          thresholds: {
                            ...formData.thresholds,
                            humidity: {
                              ...formData.thresholds.humidity,
                              max: Number(e.target.value),
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
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
              <Button onClick={handleSubmit} disabled={isLoading || !formData.name}>
                {isLoading ? 'กำลังบันทึก...' : editingRoom ? 'บันทึก' : 'เพิ่มห้อง'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => {
          const roomSensors = getRoomSensors(room._id)
          const onlineCount = roomSensors.filter((s) => s.status === 'online').length
          const roomAC = acStatus?.byRoom.find((r) => r.roomId === room._id)

          return (
            <Card key={room._id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{room.name}</CardTitle>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {room.location}
                      </div>
                    </div>
                  </div>
                  {(canEdit || canDelete) && (
                  <div className="flex gap-1">
                    {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenDialog(room)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    )}
                    {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(room._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                  </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{room.description}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Thermometer className="h-3 w-3" />
                      อุณหภูมิ
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {room.thresholds.temperature.min}-{room.thresholds.temperature.max}°C
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Droplets className="h-3 w-3" />
                      ความชื้น
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {room.thresholds.humidity.min}-{room.thresholds.humidity.max}%
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AirVent className="h-3.5 w-3.5" />
                    <span>เครื่องปรับอากาศ</span>
                  </div>
                  {roomAC && roomAC.units.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm text-success">
                        <Power className="h-3.5 w-3.5" />
                        เปิด {roomAC.onCount}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <PowerOff className="h-3.5 w-3.5" />
                        ปิด {roomAC.offCount}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        · {roomAC.totalPowerWatts.toFixed(0)} W
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      ไม่ได้ติดตั้ง Power sensor ในห้องนี้
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">
                    {roomSensors.length} เซ็นเซอร์
                  </span>
                  {onlineCount > 0 && (
                    <Badge variant="secondary" className="bg-success/10 text-success">
                      {onlineCount} ออนไลน์
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
