'use client'

import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
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
import { Badge } from '@/components/ui/badge'
import { Brain } from 'lucide-react'
import type { PredictionResult } from '@/lib/types'

const tealColor = 'var(--chart-1)'
const blueColor = 'var(--chart-2)'

const chartConfig = {
  temperature: { label: 'อุณหภูมิ (°C)', color: tealColor },
  humidity: { label: 'ความชื้น (%)', color: blueColor },
  actualTemperature: { label: 'อุณหภูมิ (จริง)', color: '#0d9488' },
  actualHumidity: { label: 'ความชื้น (จริง)', color: '#2563eb' },
}

interface PredictionChartProps {
  predictions: PredictionResult | null
  title?: string
  /** แสดงทั้งกราฟจริง vs พยากรณ์ และกราฟพยากรณ์ล่วงหน้า (เมื่อมี validation) */
  showBothCharts?: boolean
}

export function PredictionChart({
  predictions,
  title = 'การพยากรณ์ ML',
  showBothCharts = true,
}: PredictionChartProps) {
  if (!predictions) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Brain className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>กรุณาเลือกห้องเพื่อดูการพยากรณ์</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            ยังไม่มีข้อมูลการพยากรณ์
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasValidation =
    (predictions.actuals?.length ?? 0) > 0 && (predictions.backtestPredicted?.length ?? 0) > 0

  // Downsample ให้เหลือ ~12 จุดสำหรับ display (ทุก 30 นาที)
  // ป้องกันกราฟแน่นเกินเมื่อ ML ส่งข้อมูลถี่ (เช่น ทุก 1 นาที = 360 จุด)
  const TARGET_DISPLAY_POINTS = 12
  const downsample = <T,>(arr: T[]): T[] => {
    if (arr.length <= TARGET_DISPLAY_POINTS) return arr
    const step = arr.length / TARGET_DISPLAY_POINTS
    return Array.from({ length: TARGET_DISPLAY_POINTS }, (_, i) =>
      arr[Math.min(Math.round(i * step), arr.length - 1)]
    )
  }

  const validationData =
    hasValidation && predictions.actuals && predictions.backtestPredicted
      ? downsample(predictions.actuals.map((a, i) => {
        const p = predictions.backtestPredicted![i]
        const t = new Date(a.time)
        return {
          time: t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          temperature: p?.temperature,
          humidity: p?.humidity,
          actualTemperature: a.temperature,
          actualHumidity: a.humidity,
        }
      }))
      : []

  const futureData = downsample(predictions.predictions).map((p) => {
    const t = new Date(p.time)
    return {
      time: t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      temperature: p.temperature,
      humidity: p.humidity,
      confidence: p.confidence * 100,
    }
  })

  const renderChart = (
    data: { time: string; temperature?: number; humidity?: number; actualTemperature?: number; actualHumidity?: number; confidence?: number }[],
    isValidation: boolean
  ) => (
    <div className="h-[400px] w-full overflow-hidden">
    <ChartContainer config={chartConfig} className="h-full w-full">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="temp"
            orientation="left"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[15, 35]}
          />
          <YAxis
            yAxisId="humidity"
            orientation="right"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[30, 90]}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            stroke={tealColor}
            strokeWidth={2}
            strokeDasharray={isValidation ? '5 5' : undefined}
            dot={{ r: 3 }}
            name="อุณหภูมิ (พยากรณ์)"
          />
          {isValidation && (
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="actualTemperature"
              stroke="#0d9488"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="อุณหภูมิ (จริง)"
            />
          )}
          <Line
            yAxisId="humidity"
            type="monotone"
            dataKey="humidity"
            stroke={blueColor}
            strokeWidth={2}
            strokeDasharray={isValidation ? '5 5' : undefined}
            dot={{ r: 3 }}
            name="ความชื้น (พยากรณ์)"
          />
          {isValidation && (
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="actualHumidity"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="ความชื้น (จริง)"
            />
          )}
        </LineChart>
    </ChartContainer>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* กราฟจริง vs พยากรณ์ (เมื่อมี validation) */}
      {hasValidation && showBothCharts && (
        <Card className="border-border/50 overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Brain className="h-4 w-4 text-primary" />
                  กราฟจริง vs พยากรณ์ (Validation)
                </CardTitle>
                <CardDescription>
                  เปรียบเทียบค่าจริงกับค่าพยากรณ์จาก Backtest • โมเดล {predictions.model}
                </CardDescription>
              </div>
              {predictions.metrics && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    MAE: {predictions.metrics.mae.toFixed(3)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    RMSE: {predictions.metrics.rmse.toFixed(3)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    MAPE: {predictions.metrics.mape.toFixed(2)}%
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-hidden">{renderChart(validationData, true)}</CardContent>
        </Card>
      )}

      {/* กราฟพยากรณ์ล่วงหน้า 6 ชม. */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Brain className="h-4 w-4 text-primary" />
                {hasValidation && showBothCharts ? 'พยากรณ์ล่วงหน้า 6 ชั่วโมง' : title}
              </CardTitle>
              <CardDescription>
                โมเดล {predictions.model}
                {!hasValidation && ' • ต้องการข้อมูลย้อนหลังมากขึ้นเพื่อแสดงกราฟจริง vs พยากรณ์'}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              ความเชื่อมั่นเฉลี่ย:{' '}
              {(
                futureData.reduce((acc, d) => acc + (d.confidence ?? 0), 0) / futureData.length
              ).toFixed(0)}
              %
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden">{renderChart(futureData, false)}</CardContent>
      </Card>
    </div>
  )
}
