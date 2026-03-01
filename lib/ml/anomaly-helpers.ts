/**
 * Anomaly detection helper functions
 * Z-Score, Rate of Change, Sensor Malfunction, Dynamic Thresholds
 */

import { mean, standardDeviation } from './utils'

/**
 * Z-Score based anomaly detection
 */
export function detectZScoreAnomaly(
  current: number,
  historical: number[],
  threshold: number = 3.0
): { isAnomaly: boolean; zScore: number } {
  const m = mean(historical)
  const std = standardDeviation(historical, m)

  if (std === 0) return { isAnomaly: false, zScore: 0 }

  const zScore = Math.abs(current - m) / std
  return { isAnomaly: zScore > threshold, zScore }
}

/**
 * Rate of change detection
 */
export function detectRapidChange(
  current: number,
  previous: number,
  maxRate: number
): { isRapid: boolean; changeRate: number } {
  const changeRate = Math.abs(current - previous)
  return { isRapid: changeRate > maxRate, changeRate }
}

/**
 * Sensor malfunction detection (constant values or impossible readings)
 */
export function detectSensorMalfunction(
  data: number[],
  type: 'temperature' | 'humidity'
): boolean {
  // Check for constant values (stuck sensor)
  const last10 = data.slice(-10)
  if (last10.length >= 10) {
    const allSame = last10.every((v) => v === last10[0])
    if (allSame) return true
  }

  // Check for impossible values
  const current = data[data.length - 1]
  if (type === 'temperature') {
    if (current < -40 || current > 80) return true // Impossible for storage
  } else {
    if (current < 0 || current > 100) return true
  }

  return false
}

/**
 * Calculate dynamic thresholds based on historical data
 */
export function calculateDynamicThreshold(
  historicalData: number[],
  baseMin: number,
  baseMax: number,
  sensitivity: number = 1.0
): { min: number; max: number } {
  const m = mean(historicalData)
  const std = standardDeviation(historicalData, m)

  // Dynamic threshold based on historical pattern
  const dynamicMin = Math.min(baseMin, m - sensitivity * 2 * std)
  const dynamicMax = Math.max(baseMax, m + sensitivity * 2 * std)

  return {
    min: Math.max(dynamicMin, baseMin - Math.abs(baseMin) * 0.2), // Don't go too far from base
    max: Math.min(dynamicMax, baseMax + Math.abs(baseMax) * 0.2),
  }
}
