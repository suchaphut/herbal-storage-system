'use client'

import React from "react"

import { useState } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/components/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Key,
  Shield,
  User,
  Eye,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import type { SafeUser, UserRole, Room } from '@/lib/types'

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((res) => res.json())

const roleLabels: Record<UserRole, string> = {
  admin: 'ผู้ดูแลระบบ',
  operator: 'เจ้าหน้าที่',
  viewer: 'ผู้ตรวจสอบ',
}

const roleColors: Record<UserRole, string> = {
  admin: 'bg-destructive/10 text-destructive',
  operator: 'bg-primary/10 text-primary',
  viewer: 'bg-muted text-muted-foreground',
}

const roleIcons: Record<UserRole, React.ReactNode> = {
  admin: <Shield className="h-3 w-3" />,
  operator: <User className="h-3 w-3" />,
  viewer: <Eye className="h-3 w-3" />,
}

interface UserManagementProps {
  rooms: Room[]
}

export function UserManagement({ rooms }: UserManagementProps) {
  const { user: currentUser, hasPermission } = useAuth()
  const canManageUsers = hasPermission('canManageUsers')

  const { data: usersData, mutate } = useSWR<{ success: boolean; data: SafeUser[] }>(
    canManageUsers ? '/api/users' : null,
    fetcher
  )

  const users = usersData?.data || []

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'viewer' as UserRole,
    assignedRooms: [] as string[],
  })

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  })

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'viewer',
      assignedRooms: [],
    })
    setPasswordData({ newPassword: '', confirmPassword: '' })
    setMessage(null)
  }

  const handleCreate = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'สร้างผู้ใช้สำเร็จ' })
        mutate()
        setTimeout(() => {
          setIsCreateOpen(false)
          resetForm()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' })
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' })
    }

    setIsLoading(false)
  }

  const handleEdit = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          role: formData.role,
          assignedRooms: formData.assignedRooms,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'อัปเดตข้อมูลสำเร็จ' })
        mutate()
        setTimeout(() => {
          setIsEditOpen(false)
          resetForm()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' })
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' })
    }

    setIsLoading(false)
  }

  const handleDelete = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/users/${selectedUser._id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'ลบผู้ใช้สำเร็จ' })
        mutate()
        setTimeout(() => {
          setIsDeleteOpen(false)
          setSelectedUser(null)
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' })
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' })
    }

    setIsLoading(false)
  }

  const handleChangePassword = async () => {
    if (!selectedUser) return

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'รหัสผ่านไม่ตรงกัน' })
      return
    }

    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/users/${selectedUser._id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: passwordData.newPassword }),
      })

      const data = await res.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ' })
        setTimeout(() => {
          setIsPasswordOpen(false)
          resetForm()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'เกิดข้อผิดพลาด' })
      }
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' })
    }

    setIsLoading(false)
  }

  const openEditDialog = (user: SafeUser) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      assignedRooms: user.assignedRooms,
    })
    setMessage(null)
    setIsEditOpen(true)
  }

  const openDeleteDialog = (user: SafeUser) => {
    setSelectedUser(user)
    setMessage(null)
    setIsDeleteOpen(true)
  }

  const openPasswordDialog = (user: SafeUser) => {
    setSelectedUser(user)
    setPasswordData({ newPassword: '', confirmPassword: '' })
    setMessage(null)
    setIsPasswordOpen(true)
  }

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            คุณไม่มีสิทธิ์ในการจัดการผู้ใช้
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">จัดการผู้ใช้งาน</h2>
          <p className="text-sm text-muted-foreground">
            เพิ่ม แก้ไข และจัดการสิทธิ์ผู้ใช้งานในระบบ
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มผู้ใช้
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
              <DialogDescription>กรอกข้อมูลผู้ใช้ที่ต้องการเพิ่มในระบบ</DialogDescription>
            </DialogHeader>

            {message && (
              <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                {message.type === 'error' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="create-name">ชื่อ</Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ชื่อผู้ใช้"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-email">อีเมล</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-password">รหัสผ่าน</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-role">ประเภทผู้ใช้</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: UserRole) =>
                    setFormData({ ...formData, role: value, assignedRooms: [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                    <SelectItem value="operator">เจ้าหน้าที่ (Operator)</SelectItem>
                    <SelectItem value="viewer">ผู้ตรวจสอบ (Viewer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === 'operator' && (
                <div className="grid gap-2">
                  <Label>ห้องที่รับผิดชอบ</Label>
                  <div className="rounded-md border p-3 space-y-2">
                    {rooms.map((room) => (
                      <div key={room._id} className="flex items-center gap-2">
                        <Checkbox
                          id={`create-room-${room._id}`}
                          checked={formData.assignedRooms.includes(room._id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                assignedRooms: [...formData.assignedRooms, room._id],
                              })
                            } else {
                              setFormData({
                                ...formData,
                                assignedRooms: formData.assignedRooms.filter((id) => id !== room._id),
                              })
                            }
                          }}
                        />
                        <Label htmlFor={`create-room-${room._id}`} className="font-normal">
                          {room.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isLoading}>
                ยกเลิก
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                สร้างผู้ใช้
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รายชื่อผู้ใช้งาน</CardTitle>
          <CardDescription>ผู้ใช้งานทั้งหมด {users.length} คน</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>ห้องที่รับผิดชอบ</TableHead>
                <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user._id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={roleColors[user.role]}>
                      {roleIcons[user.role]}
                      <span className="ml-1">{roleLabels[user.role]}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === 'operator' && user.assignedRooms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.assignedRooms.map((roomId) => {
                          const room = rooms.find((r) => r._id === roomId)
                          return (
                            <Badge key={roomId} variant="outline" className="text-xs">
                              {room?.name || roomId}
                            </Badge>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleString('th-TH')
                      : 'ยังไม่เคยเข้าสู่ระบบ'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(user)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          แก้ไข
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openPasswordDialog(user)}>
                          <Key className="mr-2 h-4 w-4" />
                          เปลี่ยนรหัสผ่าน
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(user)}
                          className="text-destructive"
                          disabled={user._id === currentUser?._id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          ลบ
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
            <DialogDescription>แก้ไขข้อมูลผู้ใช้ {selectedUser?.name}</DialogDescription>
          </DialogHeader>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">ชื่อ</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">อีเมล</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-role">ประเภทผู้ใช้</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) =>
                  setFormData({ ...formData, role: value, assignedRooms: [] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                  <SelectItem value="operator">เจ้าหน้าที่ (Operator)</SelectItem>
                  <SelectItem value="viewer">ผู้ตรวจสอบ (Viewer)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'operator' && (
              <div className="grid gap-2">
                <Label>ห้องที่รับผิดชอบ</Label>
                <div className="rounded-md border p-3 space-y-2">
                  {rooms.map((room) => (
                    <div key={room._id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-room-${room._id}`}
                        checked={formData.assignedRooms.includes(room._id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              assignedRooms: [...formData.assignedRooms, room._id],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              assignedRooms: formData.assignedRooms.filter((id) => id !== room._id),
                            })
                          }
                        }}
                      />
                      <Label htmlFor={`edit-room-${room._id}`} className="font-normal">
                        {room.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isLoading}>
              ยกเลิก
            </Button>
            <Button onClick={handleEdit} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบผู้ใช้</DialogTitle>
            <DialogDescription>
              คุณต้องการลบผู้ใช้ {selectedUser?.name} ({selectedUser?.email}) ใช่หรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isLoading}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              ลบผู้ใช้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordOpen} onOpenChange={(open) => { setIsPasswordOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle>
            <DialogDescription>
              เปลี่ยนรหัสผ่านสำหรับ {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordOpen(false)} disabled={isLoading}>
              ยกเลิก
            </Button>
            <Button onClick={handleChangePassword} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              เปลี่ยนรหัสผ่าน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
