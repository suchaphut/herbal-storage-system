'use client'

import { 
  AlertCircle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Zap,
  ThermometerSun,
  Wind,
  Brain
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACRecommendation } from '@/lib/types'

interface ACRecommendationCardProps {
  recommendation: ACRecommendation
}

export function ACRecommendationCard({ recommendation }: ACRecommendationCardProps) {
  const getActionIcon = (action: ACRecommendation['recommendation']['action']) => {
    switch (action) {
      case 'increase':
        return <TrendingUp className="h-5 w-5 text-red-500" />
      case 'decrease':
        return <TrendingDown className="h-5 w-5 text-blue-500" />
      case 'turn_on':
        return <Wind className="h-5 w-5 text-green-500" />
      case 'turn_off':
        return <Minus className="h-5 w-5 text-gray-500" />
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />
    }
  }

  const getActionText = (action: ACRecommendation['recommendation']['action']) => {
    switch (action) {
      case 'increase':
        return 'เพิ่มกำลังแอร์'
      case 'decrease':
        return 'ลดกำลังแอร์'
      case 'turn_on':
        return 'เปิดแอร์'
      case 'turn_off':
        return 'ปิดแอร์'
      default:
        return 'รักษาระดับปัจจุบัน'
    }
  }

  const getActionColor = (action: ACRecommendation['recommendation']['action']) => {
    switch (action) {
      case 'increase':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'decrease':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'turn_on':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'turn_off':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const getPriorityBadge = (priority: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    }
    const labels = {
      low: 'ต่ำ',
      medium: 'ปานกลาง',
      high: 'สูง',
    }
    return (
      <Badge variant="outline" className={colors[priority]}>
        {labels[priority]}
      </Badge>
    )
  }

  const getTrendIcon = (trend: 'warming' | 'cooling' | 'stable') => {
    switch (trend) {
      case 'warming':
        return <ThermometerSun className="h-4 w-4 text-orange-500" />
      case 'cooling':
        return <Wind className="h-4 w-4 text-blue-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendText = (trend: 'warming' | 'cooling' | 'stable') => {
    switch (trend) {
      case 'warming':
        return 'อุณหภูมิจะเพิ่มขึ้น'
      case 'cooling':
        return 'อุณหภูมิจะลดลง'
      default:
        return 'อุณหภูมิคงที่'
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">คำแนะนำการปรับแอร์</CardTitle>
          {getPriorityBadge(recommendation.recommendation.priority)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${getActionColor(recommendation.recommendation.action)}`}>
          {getActionIcon(recommendation.recommendation.action)}
          <div className="flex-1">
            <p className="font-semibold">{getActionText(recommendation.recommendation.action)}</p>
            {recommendation.recommendation.targetTemperature && (
              <p className="text-sm mt-1">
                เป้าหมาย: {recommendation.recommendation.targetTemperature}°C
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">อุณหภูมิปัจจุบัน</span>
            <span className="font-medium">{recommendation.currentStatus.temperature.toFixed(1)}°C</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">สถานะแอร์</span>
            <Badge variant={recommendation.currentStatus.acRunning ? 'default' : 'secondary'}>
              {recommendation.currentStatus.acRunning ? 'เปิด' : 'ปิด'}
            </Badge>
          </div>

          {recommendation.currentStatus.acRunning && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">กำลังไฟ</span>
              <span className="font-medium">{recommendation.currentStatus.acPower.toFixed(0)} W</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">ประหยัดพลังงาน</span>
            <span className="text-sm text-green-600 font-semibold ml-auto">
              {recommendation.recommendation.energySavingPotential}%
            </span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {recommendation.recommendation.reason}
          </p>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon(recommendation.forecast.nextHourTrend)}
            <span className="text-sm font-medium">พยากรณ์ชั่วโมงหน้า</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {getTrendText(recommendation.forecast.nextHourTrend)}
          </p>
          {recommendation.forecast.suggestedPreemptiveAction && (
            <p className="text-sm text-blue-600 mt-1">
              💡 {recommendation.forecast.suggestedPreemptiveAction}
            </p>
          )}
        </div>

        {/* RL Model Info (if available) */}
        {recommendation.rlRecommendation && (
          <div className="space-y-1.5 pt-2 border-t">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Brain className="h-3.5 w-3.5" />
              <span>ML/RL แนะนำ</span>
              <span className="ml-auto text-muted-foreground">
                confidence {(recommendation.rlRecommendation.confidence * 100).toFixed(0)}%
              </span>
            </div>
            {recommendation.rlRecommendation.totalEpisodes != null && (
              <p className="text-[10px] text-muted-foreground">
                เรียนรู้จาก {recommendation.rlRecommendation.totalEpisodes.toLocaleString()} episodes
              </p>
            )}
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            อุณหภูมิภายนอก: {recommendation.externalConditions.temperature.toFixed(1)}°C • {' '}
            {recommendation.externalConditions.weatherCondition}
          </p>
          {recommendation.mlModel && (
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Model: {recommendation.mlModel.name}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
