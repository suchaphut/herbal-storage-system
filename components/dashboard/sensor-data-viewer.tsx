'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import {
  Thermometer,
  Droplets,
  Zap,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Room, SensorNode, SensorData, EnvironmentalSensorData, PowerSensorData } from '@/lib/types'

interface SensorDataViewerProps {
  rooms: Room[]
  sensors: SensorNode[]
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json())

const PAGE_SIZE = 50

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function EnvironmentalRow({ record, roomName, nodeName }: { record: EnvironmentalSensorData; roomName: string; nodeName: string }) {
  const { temperature, humidity } = record.readings
  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(record.timestamp)}
      </td>
      <td className="px-4 py-2.5 text-xs font-medium">{roomName || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{record.nodeId}</td>
      <td className="px-4 py-2.5">
        <Badge variant="secondary" className="text-[10px]">สิ่งแวดล้อม</Badge>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1 text-xs">
          <Thermometer className="h-3 w-3 text-chart-1" />
          <span className="font-medium tabular-nums">{temperature.toFixed(1)}°C</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1 text-xs">
          <Droplets className="h-3 w-3 text-chart-2" />
          <span className="font-medium tabular-nums">{humidity.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
    </tr>
  )
}

function PowerRow({ record, roomName, nodeName }: { record: PowerSensorData; roomName: string; nodeName: string }) {
  const { voltage, current, power, energy } = record.readings
  return (
    <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(record.timestamp)}
      </td>
      <td className="px-4 py-2.5 text-xs font-medium">{roomName || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{record.nodeId}</td>
      <td className="px-4 py-2.5">
        <Badge className="bg-chart-3/15 text-chart-3 hover:bg-chart-3/20 text-[10px]">ไฟฟ้า</Badge>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground" colSpan={2}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-chart-3" />
            <span className="font-medium tabular-nums">{power.toFixed(1)} W</span>
          </span>
          <span className="text-muted-foreground/60">{voltage.toFixed(1)} V · {current.toFixed(2)} A</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
        {energy.toFixed(3)} kWh
      </td>
    </tr>
  )
}

export function SensorDataViewer({ rooms, sensors }: SensorDataViewerProps) {
  const [roomFilter, setRoomFilter] = useState('all')
  const [nodeFilter, setNodeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filteredNodes = sensors.filter(
    (s) => roomFilter === 'all' || s.roomId === roomFilter
  )

  const params = new URLSearchParams()
  if (roomFilter !== 'all') params.set('roomId', roomFilter)
  if (nodeFilter !== 'all') params.set('nodeId', nodeFilter)
  if (typeFilter !== 'all') params.set('type', typeFilter)
  params.set('limit', String(PAGE_SIZE))
  params.set('page', String(page))

  const { data, isLoading, mutate } = useSWR<{
    success: boolean
    data: SensorData[]
    total: number
    totalPages: number
  }>(`/api/data/history?${params.toString()}`, fetcher, { refreshInterval: 30000 })

  const records = data?.data || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  const getRoomName = useCallback(
    (roomId: string | null) => rooms.find((r) => r._id === roomId)?.name || '',
    [rooms]
  )
  const getNodeName = useCallback(
    (nodeId: string) => sensors.find((s) => s.nodeId === nodeId)?.name || nodeId,
    [sensors]
  )

  const handleRoomChange = (val: string) => {
    setRoomFilter(val)
    setNodeFilter('all')
    setPage(1)
  }
  const handleNodeChange = (val: string) => { setNodeFilter(val); setPage(1) }
  const handleTypeChange = (val: string) => { setTypeFilter(val); setPage(1) }

  const exportCSV = () => {
    if (!records.length) return
    const header = 'เวลา,ห้อง,เซ็นเซอร์,ประเภท,อุณหภูมิ (°C),ความชื้น (%),กำลังไฟ (W),พลังงาน (kWh)'
    const rows = records.map((r) => {
      const time = new Date(r.timestamp).toLocaleString('th-TH')
      const room = getRoomName(r.roomId)
      const node = getNodeName(r.nodeId)
      if (r.type === 'environmental') {
        const e = r as EnvironmentalSensorData
        return `${time},${room},${node},สิ่งแวดล้อม,${e.readings.temperature.toFixed(1)},${e.readings.humidity.toFixed(1)},,`
      } else {
        const p = r as PowerSensorData
        return `${time},${room},${node},ไฟฟ้า,,,${p.readings.power.toFixed(1)},${p.readings.energy.toFixed(3)}`
      }
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sensor-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="border-border/40">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

          <Select value={roomFilter} onValueChange={handleRoomChange}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="ทุกห้อง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกห้อง</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r._id} value={r._id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={nodeFilter} onValueChange={handleNodeChange}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="ทุกเซ็นเซอร์" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกเซ็นเซอร์</SelectItem>
              {filteredNodes.map((s) => (
                <SelectItem key={s.nodeId} value={s.nodeId}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="ทุกประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              <SelectItem value="environmental">สิ่งแวดล้อม</SelectItem>
              <SelectItem value="power">ไฟฟ้า</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total.toLocaleString()} รายการ
            </span>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => mutate()}>
              <RefreshCw className="h-3 w-3" />
              รีเฟรช
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportCSV} disabled={!records.length}>
              <Download className="h-3 w-3" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/40 overflow-hidden">
        <CardHeader className="border-b border-border/40 px-4 py-3">
          <CardTitle className="text-sm font-semibold">
            ข้อมูลเซ็นเซอร์ย้อนหลัง
            {!isLoading && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                หน้า {page} / {totalPages}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">เวลา</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ห้อง</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">เซ็นเซอร์</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ประเภท</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">อุณหภูมิ</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ความชื้น</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">พลังงาน</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        กำลังโหลด...
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && records.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                )}
                {!isLoading && records.map((record) => {
                  const roomName = getRoomName(record.roomId)
                  const nodeName = getNodeName(record.nodeId)
                  if (record.type === 'environmental') {
                    return (
                      <EnvironmentalRow
                        key={String(record._id)}
                        record={record as EnvironmentalSensorData}
                        roomName={roomName}
                        nodeName={nodeName}
                      />
                    )
                  }
                  return (
                    <PowerRow
                      key={String(record._id)}
                      record={record as PowerSensorData}
                      roomName={roomName}
                      nodeName={nodeName}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                แสดง {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} จาก {total.toLocaleString()} รายการ
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i
                  if (p > totalPages) return null
                  return (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
