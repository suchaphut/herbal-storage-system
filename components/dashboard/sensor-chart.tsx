'use client'

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EnvironmentalSensorData, PowerSensorData, Room, SensorNode } from '@/lib/types'

interface SensorChartProps {
  data: EnvironmentalSensorData[]
  powerData?: PowerSensorData[]
  room?: Room
  nodes?: SensorNode[]
  title?: string
}

function buildPowerChartData(items: PowerSensorData[]) {
  return items
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-48)
    .map((item) => {
      const d = new Date(item.timestamp)
      return {
        time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        current: Math.round(item.readings.current * 100) / 100,
        power: Math.round(item.readings.power * 10) / 10,
        voltage: Math.round(item.readings.voltage * 10) / 10,
      }
    })
}

interface PowerSensorChartProps {
  nodeId: string
  items: PowerSensorData[]
  orangeColor: string
  purpleColor: string
}

function PowerSensorChart({ nodeId, items, orangeColor, purpleColor }: PowerSensorChartProps) {
  const chartData = buildPowerChartData(items)
  const safeId = nodeId.replace(/[^a-zA-Z0-9]/g, '_')

  if (chartData.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        ไม่มีข้อมูลจากเซ็นเซอร์ไฟฟ้า {nodeId}
      </div>
    )
  }

  return (
    <Tabs defaultValue={`pw-combined-${safeId}`} className="space-y-3">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value={`pw-combined-${safeId}`}>รวม</TabsTrigger>
        <TabsTrigger value={`pw-current-${safeId}`}>กระแส (A)</TabsTrigger>
        <TabsTrigger value={`pw-power-${safeId}`}>กำลังไฟ (W)</TabsTrigger>
      </TabsList>

      <TabsContent value={`pw-combined-${safeId}`}>
        <ChartContainer
          config={{
            current: { label: 'กระแส (A)', color: orangeColor },
            power: { label: 'กำลังไฟ (W)', color: purpleColor },
          }}
          className="h-[260px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
              <YAxis yAxisId="current" orientation="left" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
              <YAxis yAxisId="power" orientation="right" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line yAxisId="current" type="monotone" dataKey="current" stroke={orangeColor} strokeWidth={2} dot={false} name="กระแส" />
              <Line yAxisId="power" type="monotone" dataKey="power" stroke={purpleColor} strokeWidth={2} dot={false} name="กำลังไฟ" />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>

      <TabsContent value={`pw-current-${safeId}`}>
        <ChartContainer config={{ current: { label: 'กระแส (A)', color: orangeColor } }} className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={`currentGradient-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={orangeColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={orangeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="current" stroke={orangeColor} strokeWidth={2} fill={`url(#currentGradient-${safeId})`} name="กระแส" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>

      <TabsContent value={`pw-power-${safeId}`}>
        <ChartContainer config={{ power: { label: 'กำลังไฟ (W)', color: purpleColor } }} className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={`powerGradient-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={purpleColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={purpleColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="power" stroke={purpleColor} strokeWidth={2} fill={`url(#powerGradient-${safeId})`} name="กำลังไฟ" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>
    </Tabs>
  )
}

function buildChartData(items: EnvironmentalSensorData[]) {
  const aggregated = items.reduce((acc, item) => {
    const d = new Date(item.timestamp)
    // Use date + HH:mm as key to avoid merging data across different days
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const display = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    if (!acc[key]) {
      acc[key] = { key, time: display, temperatures: [] as number[], humidities: [] as number[] }
    }
    acc[key].temperatures.push(item.readings.temperature)
    acc[key].humidities.push(item.readings.humidity)
    return acc
  }, {} as Record<string, { key: string; time: string; temperatures: number[]; humidities: number[] }>)

  return Object.values(aggregated)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => ({
      time: item.time,
      temperature: item.temperatures.reduce((a, b) => a + b, 0) / item.temperatures.length,
      humidity: item.humidities.reduce((a, b) => a + b, 0) / item.humidities.length,
    }))
    .slice(-48)
}

interface SingleSensorChartProps {
  nodeId: string
  items: EnvironmentalSensorData[]
  room?: Room
  tealColor: string
  blueColor: string
  warningColor: string
}

function SingleSensorChart({ nodeId, items, room, tealColor, blueColor, warningColor }: SingleSensorChartProps) {
  const chartData = buildChartData(items)
  const safeId = nodeId.replace(/[^a-zA-Z0-9]/g, '_')

  if (chartData.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        ไม่มีข้อมูลจากเซ็นเซอร์ {nodeId}
      </div>
    )
  }

  return (
    <Tabs defaultValue={`combined-${safeId}`} className="space-y-3">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value={`combined-${safeId}`}>รวม</TabsTrigger>
        <TabsTrigger value={`temperature-${safeId}`}>อุณหภูมิ</TabsTrigger>
        <TabsTrigger value={`humidity-${safeId}`}>ความชื้น</TabsTrigger>
      </TabsList>

      <TabsContent value={`combined-${safeId}`}>
        <ChartContainer
          config={{
            temperature: { label: 'อุณหภูมิ (°C)', color: tealColor },
            humidity: { label: 'ความชื้น (%)', color: blueColor },
          }}
          className="h-[260px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
              <YAxis yAxisId="temp" orientation="left" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[15, 35]} className="text-muted-foreground" />
              <YAxis yAxisId="humidity" orientation="right" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[30, 90]} className="text-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke={tealColor} strokeWidth={2} dot={false} name="อุณหภูมิ" />
              <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke={blueColor} strokeWidth={2} dot={false} name="ความชื้น" />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>

      <TabsContent value={`temperature-${safeId}`}>
        <ChartContainer config={{ temperature: { label: 'อุณหภูมิ (°C)', color: tealColor } }} className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={`tempGradient-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tealColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={tealColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[15, 35]} />
              {room && (
                <>
                  <ReferenceLine y={room.thresholds.temperature.max} stroke={warningColor} strokeDasharray="5 5" label={{ value: 'สูงสุด', fill: warningColor, fontSize: 10 }} />
                  <ReferenceLine y={room.thresholds.temperature.min} stroke={warningColor} strokeDasharray="5 5" label={{ value: 'ต่ำสุด', fill: warningColor, fontSize: 10 }} />
                </>
              )}
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="temperature" stroke={tealColor} strokeWidth={2} fill={`url(#tempGradient-${safeId})`} name="อุณหภูมิ" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>

      <TabsContent value={`humidity-${safeId}`}>
        <ChartContainer config={{ humidity: { label: 'ความชื้น (%)', color: blueColor } }} className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id={`humidityGradient-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={blueColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={blueColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[30, 90]} />
              {room && (
                <>
                  <ReferenceLine y={room.thresholds.humidity.max} stroke={warningColor} strokeDasharray="5 5" label={{ value: 'สูงสุด', fill: warningColor, fontSize: 10 }} />
                  <ReferenceLine y={room.thresholds.humidity.min} stroke={warningColor} strokeDasharray="5 5" label={{ value: 'ต่ำสุด', fill: warningColor, fontSize: 10 }} />
                </>
              )}
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="humidity" stroke={blueColor} strokeWidth={2} fill={`url(#humidityGradient-${safeId})`} name="ความชื้น" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </TabsContent>
    </Tabs>
  )
}

export function SensorChart({ data, powerData = [], room, nodes, title = 'ข้อมูลเซ็นเซอร์' }: SensorChartProps) {
  const envData = Array.isArray(data)
    ? data.filter(
      (item): item is EnvironmentalSensorData =>
        item?.type === 'environmental' &&
        item?.readings != null &&
        'temperature' in item.readings &&
        'humidity' in item.readings
    )
    : []

  const tealColor = 'var(--chart-1)'
  const blueColor = 'var(--chart-2)'
  const warningColor = 'var(--warning)'
  const orangeColor = 'var(--chart-3)'
  const purpleColor = 'var(--chart-4)'
  const hasData = envData.length > 0

  const powerGroups = powerData.reduce((acc, item) => {
    if (!acc[item.nodeId]) acc[item.nodeId] = []
    acc[item.nodeId].push(item)
    return acc
  }, {} as Record<string, PowerSensorData[]>)

  const powerNodeIds = Object.keys(powerGroups)
  const hasPowerData = powerNodeIds.length > 0

  const sensorGroups = envData.reduce((acc, item) => {
    if (!acc[item.nodeId]) acc[item.nodeId] = []
    acc[item.nodeId].push(item)
    return acc
  }, {} as Record<string, EnvironmentalSensorData[]>)

  const nodeIds = Object.keys(sensorGroups)

  const getSensorLabel = (nodeId: string) => {
    const node = nodes?.find((n) => n.nodeId === nodeId)
    return node?.name ? `${node.name}` : nodeId
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>
          {hasData
            ? `ข้อมูลย้อนหลัง (${envData.length} จุด) - อัปเดตทุก 5 วินาที`
            : 'กำลังรับข้อมูลจากเซ็นเซอร์... ส่งข้อมูลจากสคริปต์ทดสอบหรืออุปกรณ์จริง'}
          {room && ` - ${room.name}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasData && (
          <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
            ยังไม่มีข้อมูล • รัน node scripts/test-sensor-environmental.js (และเลือกห้องที่มีเซ็นเซอร์)
          </div>
        )}
        {hasData && nodeIds.map((nodeId, index) => (
          <div key={nodeId} className={index > 0 ? 'border-t border-border/40 pt-5' : ''}>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-primary" />
              <span className="text-sm font-semibold text-foreground">{getSensorLabel(nodeId)}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {nodeId}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {sensorGroups[nodeId].length} จุด
              </span>
            </div>
            <SingleSensorChart
              nodeId={nodeId}
              items={sensorGroups[nodeId]}
              room={room}
              tealColor={tealColor}
              blueColor={blueColor}
              warningColor={warningColor}
            />
          </div>
        ))}

        {hasPowerData && (
          <div className={hasData ? 'border-t border-border/40 pt-5' : ''}>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-1 rounded-full bg-orange-400" />
              <span className="text-sm font-semibold text-foreground">เซ็นเซอร์ไฟฟ้า</span>
            </div>
            <div className="space-y-5">
              {powerNodeIds.map((nodeId, index) => (
                <div key={nodeId} className={index > 0 ? 'border-t border-border/40 pt-5' : ''}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full" style={{ backgroundColor: orangeColor }} />
                    <span className="text-sm font-semibold text-foreground">{getSensorLabel(nodeId)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {nodeId}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {powerGroups[nodeId].length} จุด
                    </span>
                  </div>
                  <PowerSensorChart
                    nodeId={nodeId}
                    items={powerGroups[nodeId]}
                    orangeColor={orangeColor}
                    purpleColor={purpleColor}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
