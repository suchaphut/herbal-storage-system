'use client'

import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Brain } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClimateAnalysis } from '@/lib/types'

interface ClimateComparisonCardProps {
  analysis: ClimateAnalysis
}

export function ClimateComparisonCard({ analysis }: ClimateComparisonCardProps) {
  const getTempDeltaIcon = (delta: number) => {
    if (delta > 2) return <ArrowUp className="h-4 w-4 text-red-500" />
    if (delta < -2) return <ArrowDown className="h-4 w-4 text-blue-500" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-600'
    if (efficiency >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getEfficiencyProgressColor = (efficiency: number) => {
    if (efficiency >= 80) return 'bg-green-500'
    if (efficiency >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">การวิเคราะห์สภาพอากาศ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ภายใน</p>
            <div className="space-y-0.5">
              <p className="text-lg font-semibold">{analysis.inside.temperature.toFixed(1)}°C</p>
              <p className="text-sm text-muted-foreground">{analysis.inside.humidity.toFixed(0)}%</p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ภายนอก</p>
            <div className="space-y-0.5">
              <p className="text-lg font-semibold">{analysis.outside.temperature.toFixed(1)}°C</p>
              <p className="text-sm text-muted-foreground">{analysis.outside.humidity.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">ความต่างอุณหภูมิ</span>
            <div className="flex items-center gap-1">
              {getTempDeltaIcon(analysis.delta.temperature)}
              <span className="font-medium">
                {Math.abs(analysis.delta.temperature).toFixed(1)}°C
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Heat Load</span>
            <span className="font-medium">{analysis.heatLoad.toFixed(1)} W/m²</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ประสิทธิภาพแอร์</span>
            <span className={`text-lg font-bold ${getEfficiencyColor(analysis.efficiency)}`}>
              {analysis.efficiency.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${getEfficiencyProgressColor(analysis.efficiency)}`}
              style={{ width: `${analysis.efficiency}%` }}
            />
          </div>
        </div>

        {/* ML Prediction (if available) */}
        {analysis.mlPrediction && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Brain className="h-3.5 w-3.5" />
              <span>ML พยากรณ์ 6 ชม.</span>
              <span className="ml-auto text-muted-foreground">
                confidence {(analysis.mlPrediction.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">แนวโน้ม</span>
              <div className="flex items-center gap-1">
                {analysis.mlPrediction.trend === 'warming' && <TrendingUp className="h-3.5 w-3.5 text-red-500" />}
                {analysis.mlPrediction.trend === 'cooling' && <TrendingDown className="h-3.5 w-3.5 text-blue-500" />}
                {analysis.mlPrediction.trend === 'stable' && <Minus className="h-3.5 w-3.5 text-gray-500" />}
                <span className="font-medium">
                  {analysis.mlPrediction.trend === 'warming' ? 'ร้อนขึ้น' : analysis.mlPrediction.trend === 'cooling' ? 'เย็นลง' : 'คงที่'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">คาดการณ์ภายใน</span>
              <span className="font-medium">{analysis.mlPrediction.predictedIndoorTemp6h.toFixed(1)}°C</span>
            </div>
            {analysis.mlPrediction.usesExternalWeather && (
              <p className="text-[10px] text-muted-foreground">ใช้ข้อมูลอากาศภายนอกเป็น regressor</p>
            )}
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.recommendation}
          </p>
          {analysis.mlModel && (
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Model: {analysis.mlModel.name} · MAE {analysis.mlModel.mae?.toFixed(2) ?? '—'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
