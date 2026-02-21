'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  UserPlus,
  UserMinus,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-react'
import type { AuditLog, AuditAction } from '@/lib/types'

// Icon mapping for actions
const actionIcons: Record<string, React.ReactNode> = {
  login: <LogIn className="h-4 w-4 text-green-500" />,
  logout: <LogOut className="h-4 w-4 text-blue-500" />,
  login_failed: <XCircle className="h-4 w-4 text-red-500" />,
  user_create: <UserPlus className="h-4 w-4 text-green-500" />,
  user_update: <Settings className="h-4 w-4 text-yellow-500" />,
  user_delete: <UserMinus className="h-4 w-4 text-red-500" />,
  user_password_change: <Shield className="h-4 w-4 text-purple-500" />,
  room_create: <CheckCircle className="h-4 w-4 text-green-500" />,
  room_update: <Settings className="h-4 w-4 text-yellow-500" />,
  room_delete: <XCircle className="h-4 w-4 text-red-500" />,
  sensor_create: <CheckCircle className="h-4 w-4 text-green-500" />,
  sensor_update: <Settings className="h-4 w-4 text-yellow-500" />,
  sensor_delete: <XCircle className="h-4 w-4 text-red-500" />,
  alert_resolve: <CheckCircle className="h-4 w-4 text-blue-500" />,
  settings_update: <Settings className="h-4 w-4 text-yellow-500" />,
  data_export: <AlertTriangle className="h-4 w-4 text-orange-500" />,
}

// Role badge colors
const roleBadgeVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  admin: 'destructive',
  operator: 'default',
  viewer: 'secondary',
}

// Action labels in Thai
const actionLabels: Record<AuditAction, string> = {
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  login_failed: 'เข้าสู่ระบบไม่สำเร็จ',
  user_create: 'สร้างผู้ใช้',
  user_update: 'แก้ไขผู้ใช้',
  user_delete: 'ลบผู้ใช้',
  user_password_change: 'เปลี่ยนรหัสผ่าน',
  room_create: 'สร้างห้อง',
  room_update: 'แก้ไขห้อง',
  room_delete: 'ลบห้อง',
  sensor_create: 'เพิ่มเซ็นเซอร์',
  sensor_update: 'แก้ไขเซ็นเซอร์',
  sensor_delete: 'ลบเซ็นเซอร์',
  alert_resolve: 'ยืนยันแจ้งเตือน',
  settings_update: 'แก้ไขการตั้งค่า',
  data_export: 'ส่งออกข้อมูล',
}

// Resource labels
const resourceLabels: Record<string, string> = {
  auth: 'ระบบยืนยันตัวตน',
  user: 'ผู้ใช้',
  room: 'ห้อง',
  sensor: 'เซ็นเซอร์',
  alert: 'การแจ้งเตือน',
  settings: 'การตั้งค่า',
  data: 'ข้อมูล',
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false,
  })

  // Filters
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterResource, setFilterResource] = useState<string>('all')
  const [filterSuccess, setFilterSuccess] = useState<string>('all')

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('limit', pagination.limit.toString())
      params.set('offset', pagination.offset.toString())

      if (filterAction !== 'all') {
        params.set('action', filterAction)
      }
      if (filterResource !== 'all') {
        params.set('resource', filterResource)
      }
      if (filterSuccess !== 'all') {
        params.set('success', filterSuccess)
      }

      const res = await fetch(`/api/audit-logs?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setLogs(data.data.logs)
        setPagination((prev) => ({
          ...prev,
          total: data.data.pagination.total,
          hasMore: data.data.pagination.hasMore,
        }))
      } else {
        setError(data.error || 'ไม่สามารถดึงข้อมูลได้')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setIsLoading(false)
    }
  }, [pagination.limit, pagination.offset, filterAction, filterResource, filterSuccess])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPagination((prev) => ({
      ...prev,
      offset:
        direction === 'next'
          ? prev.offset + prev.limit
          : Math.max(0, prev.offset - prev.limit),
    }))
  }

  const handleFilterChange = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }))
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1
  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <CardDescription>
              บันทึกกิจกรรมของผู้ใช้ในระบบ ({pagination.total} รายการ)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">กรอง:</span>
          </div>
          <Select
            value={filterAction}
            onValueChange={(value) => {
              setFilterAction(value)
              handleFilterChange()
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="ประเภทกิจกรรม" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกกิจกรรม</SelectItem>
              <SelectItem value="login">เข้าสู่ระบบ</SelectItem>
              <SelectItem value="logout">ออกจากระบบ</SelectItem>
              <SelectItem value="login_failed">เข้าสู่ระบบไม่สำเร็จ</SelectItem>
              <SelectItem value="user_create">สร้างผู้ใช้</SelectItem>
              <SelectItem value="user_update">แก้ไขผู้ใช้</SelectItem>
              <SelectItem value="user_delete">ลบผู้ใช้</SelectItem>
              <SelectItem value="room_create">สร้างห้อง</SelectItem>
              <SelectItem value="room_update">แก้ไขห้อง</SelectItem>
              <SelectItem value="sensor_create">เพิ่มเซ็นเซอร์</SelectItem>
              <SelectItem value="sensor_update">แก้ไขเซ็นเซอร์</SelectItem>
              <SelectItem value="alert_resolve">ยืนยันแจ้งเตือน</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterResource}
            onValueChange={(value) => {
              setFilterResource(value)
              handleFilterChange()
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="หมวดหมู่" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="auth">ยืนยันตัวตน</SelectItem>
              <SelectItem value="user">ผู้ใช้</SelectItem>
              <SelectItem value="room">ห้อง</SelectItem>
              <SelectItem value="sensor">เซ็นเซอร์</SelectItem>
              <SelectItem value="alert">การแจ้งเตือน</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filterSuccess}
            onValueChange={(value) => {
              setFilterSuccess(value)
              handleFilterChange()
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="true">สำเร็จ</SelectItem>
              <SelectItem value="false">ไม่สำเร็จ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="p-4 mb-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {/* Table */}
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">เวลา</TableHead>
                <TableHead>ผู้ใช้</TableHead>
                <TableHead>กิจกรรม</TableHead>
                <TableHead>รายละเอียด</TableHead>
                <TableHead className="w-[100px]">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <span className="text-muted-foreground">กำลังโหลด...</span>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{log.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {log.userEmail}
                        </span>
                        {log.userRole && (
                          <Badge
                            variant={roleBadgeVariants[log.userRole] || 'outline'}
                            className="w-fit text-xs"
                          >
                            {log.userRole}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {actionIcons[log.action] || <Settings className="h-4 w-4" />}
                        <span>{actionLabels[log.action] || log.action}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {resourceLabels[log.resource] || log.resource}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm truncate" title={log.details}>
                        {log.details}
                      </p>
                      {log.ipAddress && (
                        <span className="text-xs text-muted-foreground">
                          IP: {log.ipAddress}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          สำเร็จ
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          <XCircle className="h-3 w-3 mr-1" />
                          ล้มเหลว
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            หน้า {currentPage} จาก {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('prev')}
              disabled={pagination.offset === 0 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('next')}
              disabled={!pagination.hasMore || isLoading}
            >
              ถัดไป
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
