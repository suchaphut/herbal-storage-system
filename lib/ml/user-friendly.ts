/**
 * User-friendly ML result generation (Thai language)
 */

import { mean } from './utils'
import { th } from '../i18n'
import type {
  PredictionResult,
  AnomalyDetectionResult,
  UserFriendlyPrediction,
  UserFriendlyAnomaly,
  Room,
} from '../types'

/**
 * Generate user-friendly prediction summary in Thai
 */
export function generateUserFriendlyPrediction(
  predictions: PredictionResult['predictions'],
  currentTemp: number,
  currentHumidity: number,
  thresholds: Room['thresholds'],
  horizonHours: number = 6
): UserFriendlyPrediction {
  const lastPrediction = predictions[predictions.length - 1]
  const tempTrend = lastPrediction.temperature - currentTemp
  const humidityTrend = lastPrediction.humidity - currentHumidity

  // Determine trend
  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
  if (Math.abs(tempTrend) > 1 || Math.abs(humidityTrend) > 3) {
    trend = tempTrend > 0 || humidityTrend > 0 ? 'increasing' : 'decreasing'
  }

  // Find when thresholds will be exceeded
  let warningTime: Date | undefined
  let riskLevel: 'safe' | 'caution' | 'danger' = 'safe'

  for (const pred of predictions) {
    const tempExceeded =
      pred.temperature > thresholds.temperature.max ||
      pred.temperature < thresholds.temperature.min
    const humidityExceeded =
      pred.humidity > thresholds.humidity.max || pred.humidity < thresholds.humidity.min

    if (tempExceeded || humidityExceeded) {
      if (!warningTime) warningTime = pred.time
      riskLevel = 'danger'
      break
    }

    // Caution if approaching threshold (within 80%)
    const tempApproaching =
      pred.temperature > thresholds.temperature.max * 0.9 ||
      pred.temperature < thresholds.temperature.min * 1.1
    const humidityApproaching =
      pred.humidity > thresholds.humidity.max * 0.9 ||
      pred.humidity < thresholds.humidity.min * 1.1

    if (tempApproaching || humidityApproaching) {
      riskLevel = 'caution'
    }
  }

  // Generate summary in Thai
  let summary = ''
  if (trend === 'increasing') {
    summary = th.prediction.increasing(
      lastPrediction.temperature,
      lastPrediction.humidity,
      horizonHours
    )
  } else if (trend === 'decreasing') {
    summary = th.prediction.decreasing(
      lastPrediction.temperature,
      lastPrediction.humidity,
      horizonHours
    )
  } else {
    summary = th.prediction.stable(lastPrediction.temperature, lastPrediction.humidity)
  }

  // Generate recommendation
  let recommendation = ''
  if (riskLevel === 'danger') {
    if (lastPrediction.temperature > thresholds.temperature.max) {
      recommendation = th.predictionRec.tempHigh
    } else if (lastPrediction.humidity > thresholds.humidity.max) {
      recommendation = th.predictionRec.humHigh
    } else {
      recommendation = th.predictionRec.danger
    }
  } else if (riskLevel === 'caution') {
    recommendation = th.predictionRec.caution
  } else {
    recommendation = th.predictionRec.safe
  }

  // Determine confidence level
  const avgConfidence = mean(predictions.map((p) => p.confidence))
  let confidence: 'high' | 'medium' | 'low' = 'medium'
  if (avgConfidence >= 0.8) confidence = 'high'
  else if (avgConfidence < 0.6) confidence = 'low'

  return {
    summary,
    confidence,
    recommendation,
    trend,
    warningTime,
    riskLevel,
  }
}

/**
 * Generate user-friendly anomaly description in Thai
 */
export function generateUserFriendlyAnomaly(
  anomaly: AnomalyDetectionResult
): UserFriendlyAnomaly | undefined {
  if (!anomaly.isAnomaly) return undefined

  const possibleCauses: string[] = []
  const recommendations: string[] = []

  // Determine type description based on anomaly types
  let typeDesc: string = th.anomaly.generic

  if (anomaly.anomalyType.includes('threshold_exceeded')) {
    typeDesc = th.anomaly.thresholdExceeded
    possibleCauses.push(th.cause.hvacMalfunction)
    possibleCauses.push(th.cause.doorLeftOpen)
    recommendations.push(th.recommendation.checkHvac)
  }

  if (anomaly.anomalyType.includes('rapid_change')) {
    typeDesc = th.anomaly.rapidChange
    possibleCauses.push(th.cause.doorOpen)
    possibleCauses.push(th.cause.coolingSystemToggle)
    recommendations.push(th.recommendation.checkDoor)
    recommendations.push(th.recommendation.checkCooling)
  }

  if (anomaly.anomalyType.includes('sensor_malfunction')) {
    typeDesc = th.anomaly.sensorMalfunction
    possibleCauses.push(th.cause.sensorDamaged)
    possibleCauses.push(th.cause.sensorConnection)
    recommendations.push(th.recommendation.checkSensor)
    recommendations.push(th.recommendation.replaceSensor)
  }

  if (anomaly.anomalyType.includes('statistical_outlier')) {
    typeDesc = th.anomaly.statisticalOutlier
    possibleCauses.push(th.cause.externalFactor)
    recommendations.push(th.recommendation.checkExternal)
  }

  // Add generic recommendations if none specific
  if (recommendations.length === 0) {
    recommendations.push(th.recommendation.checkRoom)
    recommendations.push(th.recommendation.contactAdmin)
  }

  return {
    type: typeDesc,
    severity: anomaly.severity === 'critical' ? 'critical' : 'warning',
    description: th.anomaly.description(typeDesc, anomaly.anomalyScore * 100),
    possibleCauses,
    recommendations,
  }
}
