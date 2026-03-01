/**
 * ML Evaluation Metrics - MAE, RMSE, MAPE
 * ใช้ประเมินผลการพยากรณ์ (Actual vs Predicted)
 */

import type { PredictionMetrics } from './types'

/**
 * Mean Absolute Error
 */
export function mae(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0
  const sum = actual.reduce((acc, a, i) => acc + Math.abs(a - predicted[i]), 0)
  return sum / actual.length
}

/**
 * Root Mean Square Error
 */
export function rmse(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0
  const sum = actual.reduce((acc, a, i) => acc + (a - predicted[i]) ** 2, 0)
  return Math.sqrt(sum / actual.length)
}

/**
 * Mean Absolute Percentage Error (%)
 * หลีกเลี่ยง division by zero โดยข้ามจุดที่ actual = 0
 */
export function mape(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0
  let sum = 0
  let count = 0
  for (let i = 0; i < actual.length; i++) {
    if (Math.abs(actual[i]) > 1e-6) {
      sum += Math.abs((actual[i] - predicted[i]) / actual[i])
      count++
    }
  }
  if (count === 0) return 0
  return (sum / count) * 100
}

/**
 * คำนวณ MAE, RMSE, MAPE สำหรับอุณหภูมิและความชื้น
 */
export function computePredictionMetrics(
  actualTemp: number[],
  predictedTemp: number[],
  actualHumidity: number[],
  predictedHumidity: number[]
): PredictionMetrics {
  const maeTemp = mae(actualTemp, predictedTemp)
  const maeHum = mae(actualHumidity, predictedHumidity)
  const rmseTemp = rmse(actualTemp, predictedTemp)
  const rmseHum = rmse(actualHumidity, predictedHumidity)
  const mapeTemp = mape(actualTemp, predictedTemp)
  const mapeHum = mape(actualHumidity, predictedHumidity)

  return {
    mae: (maeTemp + maeHum) / 2,
    rmse: (rmseTemp + rmseHum) / 2,
    mape: (mapeTemp + mapeHum) / 2,
  }
}
