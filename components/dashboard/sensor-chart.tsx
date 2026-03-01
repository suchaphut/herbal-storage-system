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
import type { EnvironmentalSensorData, Room } from '@/lib/types'

interface SensorChartProps {
  data: EnvironmentalSensorData[]
  room?: Room
  title?: string
}

export function SensorChart({ data, room, title = 'ข้อมูลเซ็นเซอร์' }: SensorChartProps) {
  const envData = Array.isArray(data)
    ? data.filter(
      (item): item is EnvironmentalSensorData =>
        item?.type === 'environmental' &&
        item?.readings != null &&
        'temperature' in item.readings &&
        'humidity' in item.readings
    )
    : []

  const aggregatedData = envData.reduce((acc, item) => {
    const d = new Date(item.timestamp)
    // Use date + HH:mm as key to avoid merging data across different days
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    const display = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    })
    if (!acc[key]) {
      acc[key] = {
        key,
        time: display,
        temperatures: [] as number[],
        humidities: [] as number[],
      }
    }
    acc[key].temperatures.push(item.readings.temperature)
    acc[key].humidities.push(item.readings.humidity)
    return acc
  }, {} as Record<string, { key: string; time: string; temperatures: number[]; humidities: number[] }>)

  const chartData = Object.values(aggregatedData)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => ({
      time: item.time,
      temperature: item.temperatures.reduce((a, b) => a + b, 0) / item.temperatures.length,
      humidity: item.humidities.reduce((a, b) => a + b, 0) / item.humidities.length,
    }))
    .slice(-48) // Last 48 data points

  const tealColor = 'var(--chart-1)'
  const blueColor = 'var(--chart-2)'
  const warningColor = 'var(--warning)'
  const hasData = chartData.length > 0

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
      <CardContent>
        {!hasData && (
          <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
            ยังไม่มีข้อมูล • รัน node scripts/test-sensor-environmental.js (และเลือกห้องที่มีเซ็นเซอร์)
          </div>
        )}
        {hasData && (
          <Tabs defaultValue="combined" className="space-y-4">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="combined">รวม</TabsTrigger>
              <TabsTrigger value="temperature">อุณหภูมิ</TabsTrigger>
              <TabsTrigger value="humidity">ความชื้น</TabsTrigger>
            </TabsList>

            <TabsContent value="combined">
              <ChartContainer
                config={{
                  temperature: {
                    label: 'อุณหภูมิ (°C)',
                    color: tealColor,
                  },
                  humidity: {
                    label: 'ความชื้น (%)',
                    color: blueColor,
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      yAxisId="temp"
                      orientation="left"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[15, 35]}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      yAxisId="humidity"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[30, 90]}
                      className="text-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="temperature"
                      stroke={tealColor}
                      strokeWidth={2}
                      dot={false}
                      name="อุณหภูมิ"
                    />
                    <Line
                      yAxisId="humidity"
                      type="monotone"
                      dataKey="humidity"
                      stroke={blueColor}
                      strokeWidth={2}
                      dot={false}
                      name="ความชื้น"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </TabsContent>

            <TabsContent value="temperature">
              <ChartContainer
                config={{
                  temperature: {
                    label: 'อุณหภูมิ (°C)',
                    color: tealColor,
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={tealColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={tealColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[15, 35]}
                    />
                    {room && (
                      <>
                        <ReferenceLine
                          y={room.thresholds.temperature.max}
                          stroke={warningColor}
                          strokeDasharray="5 5"
                          label={{ value: 'สูงสุด', fill: warningColor, fontSize: 10 }}
                        />
                        <ReferenceLine
                          y={room.thresholds.temperature.min}
                          stroke={warningColor}
                          strokeDasharray="5 5"
                          label={{ value: 'ต่ำสุด', fill: warningColor, fontSize: 10 }}
                        />
                      </>
                    )}
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke={tealColor}
                      strokeWidth={2}
                      fill="url(#tempGradient)"
                      name="อุณหภูมิ"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </TabsContent>

            <TabsContent value="humidity">
              <ChartContainer
                config={{
                  humidity: {
                    label: 'ความชื้น (%)',
                    color: blueColor,
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={blueColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={blueColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[30, 90]}
                    />
                    {room && (
                      <>
                        <ReferenceLine
                          y={room.thresholds.humidity.max}
                          stroke={warningColor}
                          strokeDasharray="5 5"
                          label={{ value: 'สูงสุด', fill: warningColor, fontSize: 10 }}
                        />
                        <ReferenceLine
                          y={room.thresholds.humidity.min}
                          stroke={warningColor}
                          strokeDasharray="5 5"
                          label={{ value: 'ต่ำสุด', fill: warningColor, fontSize: 10 }}
                        />
                      </>
                    )}
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="humidity"
                      stroke={blueColor}
                      strokeWidth={2}
                      fill="url(#humidityGradient)"
                      name="ความชื้น"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
