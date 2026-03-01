/**
 * Power sensor anomaly detection (AC / current sensor)
 */

import { mean, standardDeviation } from './utils'
import {
  runIsolationForest,
} from '../ml-python-bridge'
import { th } from '../i18n'
import type { PowerSensorData, PowerAnomalyResult } from '../types'

const ENABLE_PYTHON_ML =
  process.env.ENABLE_PYTHON_ML === '1' || process.env.ENABLE_PYTHON_ML === 'true'

export interface PowerAnomalyOptions {
  /** แอร์/อุปกรณ์ควรเปิดอยู่หรือไม่ (ถ้า true แต่กระแส=0 = ดับ) */
  deviceExpectedOn?: boolean
  /** กระแสสูงเกิน (A) - แอร์กินไฟผิดปกติ คอมเพรสเซอร์อาจมีปัญหา */
  currentMax?: number
  /** กระแสต่ำผิดปกติ (A) */
  currentMin?: number
  /** ใช้ค่าจากประวัติถ้าไม่ระบุ currentMax/currentMin */
  useHistoricalRange?: boolean
}

/**
 * ตรวจจับความผิดปกติของ Current Sensor
 * - กระแสสูงผิดปกติ → แอร์กินไฟมากเกิน (คอมเพรสเซอร์)
 * - กระแสต่ำผิดปกติ
 * - กระแส = 0 ทั้งที่ควรทำงาน → อุปกรณ์ดับ
 * - ถ้า ENABLE_PYTHON_ML=1 ใช้ Isolation Forest (current, power) ร่วมกับกฎด้านบน
 */
export async function detectPowerAnomaly(
  currentData: PowerSensorData,
  historicalData: PowerSensorData[],
  options: PowerAnomalyOptions = {},
  contamination: number = 0.02
): Promise<PowerAnomalyResult> {
  const current = currentData.readings.current ?? 0
  const power = currentData.readings.power ?? 0
  const currents = historicalData.map((d) => d.readings.current ?? 0).filter((c) => c >= 0)
  const meanCurrent = currents.length > 0 ? mean(currents) : 0
  const stdCurrent = currents.length > 1 ? standardDeviation(currents, meanCurrent) : 1

  const anomalyTypes: PowerAnomalyResult['anomalyType'] = []
  let anomalyScore = 0
  let message = ''

  const deviceExpectedOn = options.deviceExpectedOn ?? false
  const currentMax = options.currentMax ?? (meanCurrent + 2 * stdCurrent)
  const currentMin = options.currentMin ?? Math.max(0, meanCurrent - 2 * stdCurrent)

  // กระแส = 0 ทั้งที่ควรทำงาน → อุปกรณ์ดับ
  if (deviceExpectedOn && current < 0.01) {
    anomalyTypes.push('device_off_expected')
    anomalyScore = Math.max(anomalyScore, 0.95)
    message = th.power.deviceOff
  }

  // กระแสสูงผิดปกติ → แอร์กินไฟมากเกิน
  if (currentMax > 0 && current > currentMax) {
    anomalyTypes.push('current_high')
    const severity = (current - currentMax) / (stdCurrent || 1)
    anomalyScore = Math.max(anomalyScore, Math.min(1, 0.6 + severity * 0.1))
    if (!message) message = th.power.currentHigh(current)
  }

  // กระแสต่ำผิดปกติ (และไม่ใช่กรณีดับ)
  if (currentMin >= 0 && current > 0.01 && current < currentMin) {
    anomalyTypes.push('current_low')
    anomalyScore = Math.max(anomalyScore, 0.5)
    if (!message) message = th.power.currentLow(current)
  }

  // Isolation Forest สำหรับ power sensor (current, power) เมื่อเปิด Python ML
  let ifScore = 0.5
  const ifWindowSize = Math.min(120, historicalData.length + 1)
  const ifData: number[][] = []
  for (let i = Math.max(0, historicalData.length - ifWindowSize + 1); i < historicalData.length; i++) {
    const d = historicalData[i]
    ifData.push([d.readings.current ?? 0, d.readings.power ?? 0])
  }
  ifData.push([current, power])
  if (ENABLE_PYTHON_ML && ifData.length >= 10) {
    try {
      const pyOut = await runIsolationForest({
        data: ifData,
        contamination,
        feature_set: 'power',
      })
      ifScore = pyOut.scores[pyOut.scores.length - 1] ?? 0.5
      if (ifScore >= 0.6 && anomalyTypes.length === 0) {
        anomalyTypes.push('statistical_outlier')
        if (!message) message = th.power.ifAnomaly
      }
      anomalyScore = Math.max(anomalyScore, ifScore)
    } catch {
      // fallback: ใช้เฉพาะกฎด้านบน
    }
  }

  if (!message) message = anomalyTypes.length > 0 ? th.power.anomalyGeneric : th.power.normal

  const finalScore =
    typeof anomalyScore === 'number' && !Number.isNaN(anomalyScore)
      ? Math.max(0, Math.min(1, anomalyScore))
      : 0.5

  return {
    nodeId: currentData.nodeId,
    roomId: currentData.roomId,
    timestamp: currentData.timestamp,
    isAnomaly: anomalyTypes.length > 0,
    anomalyScore: finalScore,
    anomalyType: anomalyTypes,
    message,
    current,
    power,
    expectedRange: { min: currentMin, max: currentMax },
    deviceExpectedOn,
  }
}
