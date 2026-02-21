/**
 * Machine Learning Service for IoT Herbal Storage Monitoring System
 *
 * This module provides:
 * 1. Time Series Prediction - Holt-Winters Triple Exponential Smoothing
 * 2. Anomaly Detection - Z-Score, IQR, Rate of Change, Isolation Forest principles
 * 3. Dynamic Thresholds - ML-based adaptive thresholds
 * 4. User-Friendly Results - Thai language interpretations
 *
 * Reference: Documented ML approach for herbal medicine storage monitoring
 */

import { computePredictionMetrics } from './ml-metrics'
import {
  runProphet,
  runIsolationForest,
  runIsolationForestSync,
  type ProphetOutput,
} from './ml-python-bridge'
import { getCachedPrediction, setCachedPrediction } from './ml-cache'
import { th } from './i18n'
import { dbService } from './db-service'
import type {
  EnvironmentalSensorData,
  PowerSensorData,
  PredictionResult,
  AnomalyDetectionResult,
  MLModelConfig,
  MLAnalysisResult,
  UserFriendlyPrediction,
  UserFriendlyAnomaly,
  AnomalyType,
  PredictionMetrics,
  PowerAnomalyResult,
  Room,
} from './types'

const ENABLE_PYTHON_ML =
  process.env.ENABLE_PYTHON_ML === '1' || process.env.ENABLE_PYTHON_ML === 'true'

// ============================================================================
// Configuration
// ============================================================================

const ML_CONFIG: MLModelConfig = {
  prediction: {
    alpha: 0.2, // Level smoothing
    beta: 0.1, // Trend smoothing
    gamma: 0.15, // Seasonal smoothing
    seasonLength: 24, // 24 hours for daily pattern
    horizonHours: 6, // Predict 6 hours ahead
  },
  anomaly: {
    zScoreThreshold: 2.5, // Standard deviations for anomaly
    isolationForestContamination: 0.05, // 5% expected anomaly rate
    minSamplesForTraining: 288, // 24 hours * 12 points/hour
    rapidChangeThresholds: {
      temperature: 3, // 3°C change per 5 minutes is suspicious
      humidity: 10, // 10% change per 5 minutes is suspicious
    },
  },
}

// Model version for tracking
const MODEL_VERSION = 'HoltWinters-v2.0'

// ============================================================================
// Statistical Utilities
// ============================================================================

/**
 * Calculate mean of array
 */
function mean(data: number[]): number {
  if (data.length === 0) return 0
  return data.reduce((sum, val) => sum + val, 0) / data.length
}

/**
 * Calculate standard deviation
 */
function standardDeviation(data: number[], dataMean?: number): number {
  if (data.length === 0) return 1
  const m = dataMean ?? mean(data)
  const squaredDiffs = data.map((val) => Math.pow(val - m, 2))
  return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length)
}

/**
 * Calculate quartiles for IQR method
 */
function calculateQuartiles(data: number[]): { q1: number; q2: number; q3: number; iqr: number } {
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length

  const q1 = sorted[Math.floor(n * 0.25)]
  const q2 = sorted[Math.floor(n * 0.5)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1

  return { q1, q2, q3, iqr }
}

/**
 * IQR-based outlier detection and winsorization
 */
function winsorizeData(data: number[]): number[] {
  const { q1, q3, iqr } = calculateQuartiles(data)
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  return data.map((val) => {
    if (val < lowerBound) return lowerBound
    if (val > upperBound) return upperBound
    return val
  })
}

/**
 * Linear interpolation for missing data
 */
function interpolateMissing(data: (number | null)[]): number[] {
  const result: number[] = []

  for (let i = 0; i < data.length; i++) {
    if (data[i] !== null) {
      result.push(data[i] as number)
    } else if (i > 0 && i < data.length - 1) {
      // Find next non-null value
      let nextIdx = i + 1
      while (nextIdx < data.length && data[nextIdx] === null) nextIdx++

      if (nextIdx < data.length && data[nextIdx] !== null) {
        // Linear interpolation
        const prevVal = result[result.length - 1]
        const nextVal = data[nextIdx] as number
        const steps = nextIdx - i + 1
        result.push(prevVal + (nextVal - prevVal) / steps)
      } else {
        // Forward fill
        result.push(result[result.length - 1])
      }
    } else if (i === 0 && data.length > 1) {
      // Find first non-null value and backfill
      let nextIdx = 1
      while (nextIdx < data.length && data[nextIdx] === null) nextIdx++
      result.push(nextIdx < data.length ? (data[nextIdx] as number) : 0)
    }
  }

  return result
}

/**
 * Create sliding windows for time series analysis
 */
function createSlidingWindows(data: number[], windowSize: number, step: number = 1): number[][] {
  const windows: number[][] = []
  for (let i = 0; i <= data.length - windowSize; i += step) {
    windows.push(data.slice(i, i + windowSize))
  }
  return windows
}

// ============================================================================
// Isolation Forest (simplified) - Anomaly Score from path length
// ============================================================================

const IF_N_TREES = 20
const IF_MAX_DEPTH = 10
const IF_SUBAMPLE = 256

/**
 * Single isolation tree: random splits, path length = number of edges to isolate point
 */
function isolationTreePathLength(
  point: number[],
  data: number[][],
  depth: number,
  maxDepth: number
): number {
  if (data.length <= 1 || depth >= maxDepth) return depth

  const dim = point.length
  const col = Math.floor(Math.random() * dim)
  const values = data.map((row) => row[col]).filter((v) => v != null)
  if (values.length < 2) return depth

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return depth

  const split = min + Math.random() * (max - min)
  const left: number[][] = []
  const right: number[][] = []
  for (const row of data) {
    if (row[col] < split) left.push(row)
    else right.push(row)
  }

  const goLeft = point[col] < split
  const child = goLeft ? left : right
  return 1 + isolationTreePathLength(point, child, depth + 1, maxDepth)
}

/**
 * c(n) normalizing constant for Isolation Forest
 */
function c(n: number): number {
  if (n <= 1) return 0
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n
}

/**
 * Isolation Forest anomaly score per row (0 = normal, 1 = anomaly)
 * data: rows of [temperature, humidity] (or more features)
 */
function isolationForestScores(data: number[][]): number[] {
  if (data.length === 0) return []
  const n = Math.min(data.length, IF_SUBAMPLE)
  const scores: number[] = []

  for (let i = 0; i < data.length; i++) {
    const point = data[i]
    let pathSum = 0
    for (let t = 0; t < IF_N_TREES; t++) {
      const idx = Array.from({ length: data.length }, (_, j) => j)
      for (let k = idx.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [idx[k], idx[j]] = [idx[j], idx[k]]
      }
      const sample = idx.slice(0, n).map((j) => data[j])
      const path = isolationTreePathLength(point, sample, 0, IF_MAX_DEPTH)
      pathSum += path
    }
    const avgPath = pathSum / IF_N_TREES
    const score = Math.pow(2, -avgPath / c(n))
    scores.push(Math.min(1, Math.max(0, score)))
  }
  return scores
}

// ============================================================================
// Holt-Winters Triple Exponential Smoothing
// ============================================================================

interface HoltWintersState {
  level: number
  trend: number
  seasonals: number[]
}

/**
 * Initialize Holt-Winters state from historical data
 */
function initializeHoltWinters(
  data: number[],
  seasonLength: number
): HoltWintersState {
  // Initial level: average of first season
  const firstSeason = data.slice(0, Math.min(seasonLength, data.length))
  const level = mean(firstSeason)

  // Initial trend: average difference between corresponding points in first two seasons
  let trend = 0
  if (data.length >= seasonLength * 2) {
    for (let i = 0; i < seasonLength; i++) {
      trend += (data[seasonLength + i] - data[i]) / seasonLength
    }
    trend /= seasonLength
  }

  // Initial seasonal factors
  const seasonals: number[] = []
  for (let i = 0; i < seasonLength; i++) {
    if (i < data.length) {
      seasonals.push(data[i] - level)
    } else {
      seasonals.push(0)
    }
  }

  return { level, trend, seasonals }
}

/**
 * Holt-Winters prediction step
 */
function holtWintersPredict(
  data: number[],
  steps: number,
  config: typeof ML_CONFIG.prediction
): { predictions: number[]; state: HoltWintersState } {
  const { alpha, beta, gamma, seasonLength } = config

  // Winsorize data to handle outliers
  const cleanData = winsorizeData(data)

  // Initialize state
  let state = initializeHoltWinters(cleanData, seasonLength)

  // Update state with all historical data
  for (let t = seasonLength; t < cleanData.length; t++) {
    const seasonIdx = t % seasonLength
    const observation = cleanData[t]

    // Update level
    const newLevel =
      alpha * (observation - state.seasonals[seasonIdx]) +
      (1 - alpha) * (state.level + state.trend)

    // Update trend
    const newTrend = beta * (newLevel - state.level) + (1 - beta) * state.trend

    // Update seasonal
    state.seasonals[seasonIdx] =
      gamma * (observation - newLevel) + (1 - gamma) * state.seasonals[seasonIdx]

    state.level = newLevel
    state.trend = newTrend
  }

  // Generate predictions
  const predictions: number[] = []
  for (let h = 1; h <= steps; h++) {
    const seasonIdx = (cleanData.length + h - 1) % seasonLength
    const prediction = state.level + h * state.trend + state.seasonals[seasonIdx]
    predictions.push(prediction)
  }

  return { predictions, state }
}

// ============================================================================
// Anomaly Detection
// ============================================================================

/**
 * Z-Score based anomaly detection
 */
function detectZScoreAnomaly(
  current: number,
  historical: number[],
  threshold: number = ML_CONFIG.anomaly.zScoreThreshold
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
function detectRapidChange(
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
function detectSensorMalfunction(
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
function calculateDynamicThreshold(
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

// ============================================================================
// User-Friendly Result Generation
// ============================================================================

/**
 * Generate user-friendly prediction summary in Thai
 */
function generateUserFriendlyPrediction(
  predictions: PredictionResult['predictions'],
  currentTemp: number,
  currentHumidity: number,
  thresholds: Room['thresholds']
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
      ML_CONFIG.prediction.horizonHours
    )
  } else if (trend === 'decreasing') {
    summary = th.prediction.decreasing(
      lastPrediction.temperature,
      lastPrediction.humidity,
      ML_CONFIG.prediction.horizonHours
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
function generateUserFriendlyAnomaly(
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

// ============================================================================
// Python ML (Prophet) – ใช้เมื่อ ENABLE_PYTHON_ML=1
// ============================================================================

const PYTHON_MODEL_VERSION = 'Prophet-v1.0'

const TEMP_RANGE = { min: 10, max: 40 }
const HUM_RANGE = { min: 5, max: 98 }

function clipSeries(values: number[], min: number, max: number): number[] {
  return values.map((v) => (typeof v !== 'number' || Number.isNaN(v) ? min : Math.max(min, Math.min(max, v))))
}

async function predictionFromPython(
  historicalData: EnvironmentalSensorData[],
  roomId: string,
  nodeId: string
): Promise<PredictionResult> {
  const now = new Date()
  const timestamps = historicalData.map((d) => d.timestamp.toISOString())
  // จำกัดสเกลก่อนส่งไป Prophet (หน่วย: อุณหภูมิ °C 10–40, ความชื้น % 5–98)
  const temperature = clipSeries(
    historicalData.map((d) => d.readings.temperature),
    TEMP_RANGE.min,
    TEMP_RANGE.max
  )
  const humidity = clipSeries(
    historicalData.map((d) => d.readings.humidity),
    HUM_RANGE.min,
    HUM_RANGE.max
  )

  // คำนวณ freq_minutes จาก interval จริงของข้อมูล แทน hardcode 30
  // เพื่อให้ Prophet สร้าง future timestamps ที่ถูกต้อง
  const freqMinutes = Math.max(1, Math.round(estimateIntervalMinutes(historicalData)))

  const out: ProphetOutput = await runProphet({
    timestamps,
    temperature,
    humidity,
    horizon_hours: ML_CONFIG.prediction.horizonHours,
    freq_minutes: freqMinutes,
  })

  const { predictions: rawPred, metrics, meta } = out
  // stepsPerHour ต้อง match กับ freq_minutes ที่ส่งไป Prophet
  const stepsPerHour = Math.round(60 / freqMinutes)
  const totalSteps = ML_CONFIG.prediction.horizonHours * stepsPerHour
  const stepMs = freqMinutes * 60 * 1000
  const band = Math.max(metrics.rmse, 0.5)

  // Confidence calculation based on data amount (if available)
  const trainingPoints = meta?.training_points ? Number(meta.training_points) : 24
  const dataConfidenceFactor = Math.min(1.0, trainingPoints / 24) // < 24 points penalizes confidence

  const predictions: PredictionResult['predictions'] = rawPred.slice(0, totalSteps).map((p, i) => {
    // Confidence decreases over horizon time, multiplied by data quality factor
    const horizonConfidence = Math.max(0.5, 1 - i * 0.03)
    const confidence = horizonConfidence * dataConfidenceFactor

    return {
      time: new Date(p.time),
      temperature: Math.max(10, Math.min(40, p.temperature)),
      humidity: Math.max(20, Math.min(95, p.humidity)),
      confidence,
      upperBound: {
        temperature: Math.min(40, p.temperature + band * (1 + i * 0.1)),
        humidity: Math.min(95, p.humidity + band * (1 + i * 0.1)),
      },
      lowerBound: {
        temperature: Math.max(10, p.temperature - band * (1 + i * 0.1)),
        humidity: Math.max(20, p.humidity - band * (1 + i * 0.1)),
      },
      metric: metrics,
    }
  })

  // Ensure 'actuals' and 'backtestPredicted' are correctly mapped
  const actuals: PredictionResult['actuals'] = out.actuals?.map((a) => ({
    time: new Date(a.time),
    temperature: a.temperature,
    humidity: a.humidity,
  }))

  const backtestPredicted: PredictionResult['backtestPredicted'] = out.backtest_predicted?.map(
    (b) => ({
      time: new Date(b.time),
      temperature: b.temperature,
      humidity: b.humidity,
    })
  )

  // Allow larger metric values for debugging, but still prevent infinite/NaN
  // Cap at 999 to match Python script logic
  const safeMae = Math.min(999, Math.max(0, Number(metrics.mae) || 0))
  const safeRmse = Math.min(999, Math.max(0, Number(metrics.rmse) || 0))
  const safeMape = Math.min(999, Math.max(0, Number(metrics.mape) || 0))

  return {
    roomId,
    nodeId,
    timestamp: now,
    predictions,
    actuals,
    backtestPredicted,
    model: `${PYTHON_MODEL_VERSION} (n=${trainingPoints})`,
    generatedAt: now,
    metrics: {
      mae: safeMae,
      rmse: safeRmse,
      mape: safeMape,
    },
  }

}

// ============================================================================
// Main ML Functions
// ============================================================================

/**
 * พยากรณ์: ลอง Prophet ก่อน (ถ้า ENABLE_PYTHON_ML=1) ไม่ได้ค่อยใช้ Holt-Winters
 * ใช้กับ API ได้เมื่อต้องการผลเดียว
 */
export async function getPrediction(
  historicalData: EnvironmentalSensorData[],
  roomId: string,
  nodeId: string
): Promise<PredictionResult> {
  // Return cached result if still fresh
  const cached = getCachedPrediction(roomId, nodeId)
  if (cached) return cached

  let result: PredictionResult
  if (ENABLE_PYTHON_ML) {
    try {
      result = await predictionFromPython(historicalData, roomId, nodeId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ML] Prophet failed, using Holt-Winters:', msg)
      result = predictTimeSeries(historicalData, roomId, nodeId)
    }
  } else {
    result = predictTimeSeries(historicalData, roomId, nodeId)
  }

  setCachedPrediction(roomId, nodeId, result)

  // Persist metrics for drift analysis (fire-and-forget, non-blocking)
  if (result.metrics && roomId && nodeId) {
    dbService.recordModelMetrics({
      nodeId,
      roomId,
      modelType: result.model,
      mae: result.metrics.mae,
      rmse: result.metrics.rmse,
      mape: result.metrics.mape,
      trainingPoints: null,
    }).catch((err) => console.error('[ML] Failed to record model metrics:', err))
  }

  return result
}

/**
 * Estimate the median interval between data points in minutes
 */
function estimateIntervalMinutes(historicalData: EnvironmentalSensorData[]): number {
  if (historicalData.length < 2) return 30
  const diffs: number[] = []
  for (let i = 1; i < Math.min(historicalData.length, 20); i++) {
    const a = new Date(historicalData[i - 1].timestamp).getTime()
    const b = new Date(historicalData[i].timestamp).getTime()
    const diffMin = Math.abs(b - a) / 60000
    if (diffMin > 0 && diffMin < 120) diffs.push(diffMin)
  }
  if (diffs.length === 0) return 30
  diffs.sort((a, b) => a - b)
  return diffs[Math.floor(diffs.length / 2)]
}

/**
 * Time Series Prediction using Holt-Winters Triple Exponential Smoothing
 */
export function predictTimeSeries(
  historicalData: EnvironmentalSensorData[],
  roomId: string,
  nodeId: string
): PredictionResult {
  const now = new Date()

  // Extract and clean data
  const temperatures = winsorizeData(historicalData.map((d) => d.readings.temperature))
  const humidities = winsorizeData(historicalData.map((d) => d.readings.humidity))

  // คำนวณ seasonLength จาก interval จริงของข้อมูล
  // เช่น interval 1 นาที → 1 วัน = 1440 จุด, interval 30 นาที → 48 จุด
  // จำกัดไว้ที่ข้อมูลที่มีจริง เพื่อไม่ให้ Holt-Winters ต้องการข้อมูลมากเกินไป
  const intervalMinutes = estimateIntervalMinutes(historicalData)
  const pointsPerDay = Math.round(24 * 60 / intervalMinutes)
  const dynamicSeasonLength = Math.min(pointsPerDay, Math.floor(historicalData.length / 2))
  const effectiveSeasonLength = Math.max(dynamicSeasonLength, ML_CONFIG.prediction.seasonLength)

  const predConfig = { ...ML_CONFIG.prediction, seasonLength: effectiveSeasonLength }

  // Calculate prediction steps — interval เดิมของข้อมูล
  const stepsPerHour = Math.round(60 / intervalMinutes)
  const totalSteps = ML_CONFIG.prediction.horizonHours * stepsPerHour
  const stepMs = intervalMinutes * 60 * 1000

  // Run Holt-Winters prediction
  const tempPredictions = holtWintersPredict(
    temperatures,
    totalSteps,
    predConfig
  )
  const humidityPredictions = holtWintersPredict(
    humidities,
    totalSteps,
    predConfig
  )

  // Calculate historical metrics for confidence bands
  const tempStd = standardDeviation(temperatures.slice(-24))
  const humidityStd = standardDeviation(humidities.slice(-24))

  // Generate predictions with confidence bands
  const predictions = []
  for (let i = 0; i < totalSteps; i++) {
    const futureTime = new Date(now.getTime() + (i + 1) * stepMs)

    // Confidence decreases over time
    const confidence = Math.max(0.5, 1 - i * 0.03)

    // Confidence band widens over time
    const bandMultiplier = 1 + i * 0.1

    const tempPred = tempPredictions.predictions[i]
    const humidPred = humidityPredictions.predictions[i]

    predictions.push({
      time: futureTime,
      temperature: Math.max(10, Math.min(40, tempPred)),
      humidity: Math.max(20, Math.min(95, humidPred)),
      confidence,
      upperBound: {
        temperature: Math.min(40, tempPred + tempStd * bandMultiplier),
        humidity: Math.min(95, humidPred + humidityStd * bandMultiplier),
      },
      lowerBound: {
        temperature: Math.max(10, tempPred - tempStd * bandMultiplier),
        humidity: Math.max(20, humidPred - humidityStd * bandMultiplier),
      },
    })
  }

  // Backtest: คำนวณ MAE, RMSE, MAPE จริงจากข้อมูลย้อนหลัง
  const holdoutSize = 12
  let metrics: PredictionMetrics = {
    mae: tempStd * 0.3,
    rmse: tempStd * 0.4,
    mape: Math.abs(mean(temperatures)) > 1e-6 ? (tempStd / mean(temperatures)) * 100 * 0.3 : 0,
  }
  const actuals: PredictionResult['actuals'] = []
  const backtestPredicted: PredictionResult['backtestPredicted'] = []

  if (historicalData.length >= ML_CONFIG.anomaly.minSamplesForTraining / 12 + holdoutSize) {
    const trainData = historicalData.slice(0, -holdoutSize)
    const holdout = historicalData.slice(-holdoutSize)
    const trainT = winsorizeData(trainData.map((d) => d.readings.temperature))
    const trainH = winsorizeData(trainData.map((d) => d.readings.humidity))

    const predT = holtWintersPredict(trainT, holdoutSize, predConfig)
    const predH = holtWintersPredict(trainH, holdoutSize, predConfig)

    const actualTemp = holdout.map((d) => d.readings.temperature)
    const actualHum = holdout.map((d) => d.readings.humidity)
    metrics = computePredictionMetrics(
      actualTemp,
      predT.predictions,
      actualHum,
      predH.predictions
    )

    holdout.forEach((d, i) => {
      actuals.push({
        time: d.timestamp,
        temperature: actualTemp[i],
        humidity: actualHum[i],
      })
      backtestPredicted.push({
        time: d.timestamp,
        temperature: predT.predictions[i],
        humidity: predH.predictions[i],
      })
    })
  }

  return {
    roomId,
    nodeId,
    timestamp: now,
    predictions,
    actuals: actuals.length > 0 ? actuals : undefined,
    backtestPredicted: backtestPredicted.length > 0 ? backtestPredicted : undefined,
    model: MODEL_VERSION,
    generatedAt: now,
    metrics,
  }
}

/**
 * Anomaly Detection using multiple methods
 * @param precomputedIfScore - optional pre-computed Isolation Forest score (0-1) from async Python call
 *   ถ้าส่งมา จะข้าม spawnSync และใช้ค่านี้แทน (ป้องกัน event loop blocking)
 */
export function detectAnomaly(
  currentData: EnvironmentalSensorData,
  historicalData: EnvironmentalSensorData[],
  roomThresholds?: Room['thresholds'],
  precomputedIfScore?: number
): AnomalyDetectionResult {
  const temperatures = historicalData.map((d) => d.readings.temperature)
  const humidities = historicalData.map((d) => d.readings.humidity)

  const currentTemp = currentData.readings.temperature
  const currentHumidity = currentData.readings.humidity

  const anomalyTypes: AnomalyType[] = []
  const contributingFactors: AnomalyDetectionResult['contributingFactors'] = []

  // 1. Z-Score Analysis
  const tempZScore = detectZScoreAnomaly(currentTemp, temperatures)
  const humidityZScore = detectZScoreAnomaly(currentHumidity, humidities)

  if (tempZScore.isAnomaly) {
    anomalyTypes.push('statistical_outlier')
    contributingFactors.push({
      factor: 'temperature_deviation',
      contribution: tempZScore.zScore / (tempZScore.zScore + humidityZScore.zScore + 0.001),
      zScore: tempZScore.zScore,
    })
  }

  if (humidityZScore.isAnomaly) {
    if (!anomalyTypes.includes('statistical_outlier')) {
      anomalyTypes.push('statistical_outlier')
    }
    contributingFactors.push({
      factor: 'humidity_deviation',
      contribution: humidityZScore.zScore / (tempZScore.zScore + humidityZScore.zScore + 0.001),
      zScore: humidityZScore.zScore,
    })
  }

  // 2. Rate of Change Detection
  if (historicalData.length > 0) {
    const lastData = historicalData[historicalData.length - 1]
    const tempChange = detectRapidChange(
      currentTemp,
      lastData.readings.temperature,
      ML_CONFIG.anomaly.rapidChangeThresholds.temperature
    )
    const humidityChange = detectRapidChange(
      currentHumidity,
      lastData.readings.humidity,
      ML_CONFIG.anomaly.rapidChangeThresholds.humidity
    )

    if (tempChange.isRapid) {
      anomalyTypes.push('rapid_change')
      contributingFactors.push({
        factor: 'rapid_temperature_change',
        contribution: Math.min(1, tempChange.changeRate / 5),
        zScore: tempChange.changeRate,
      })
    }

    if (humidityChange.isRapid) {
      if (!anomalyTypes.includes('rapid_change')) {
        anomalyTypes.push('rapid_change')
      }
      contributingFactors.push({
        factor: 'rapid_humidity_change',
        contribution: Math.min(1, humidityChange.changeRate / 20),
        zScore: humidityChange.changeRate,
      })
    }
  }

  // 3. Sensor Malfunction Detection
  if (
    detectSensorMalfunction([...temperatures, currentTemp], 'temperature') ||
    detectSensorMalfunction([...humidities, currentHumidity], 'humidity')
  ) {
    anomalyTypes.push('sensor_malfunction')
    contributingFactors.push({
      factor: 'sensor_malfunction',
      contribution: 1,
      zScore: 0,
    })
  }

  // 4. Threshold Exceeded Check
  if (roomThresholds) {
    const tempExceeded =
      currentTemp > roomThresholds.temperature.max ||
      currentTemp < roomThresholds.temperature.min
    const humidityExceeded =
      currentHumidity > roomThresholds.humidity.max ||
      currentHumidity < roomThresholds.humidity.min

    if (tempExceeded || humidityExceeded) {
      anomalyTypes.push('threshold_exceeded')
      if (tempExceeded) {
        contributingFactors.push({
          factor: 'temperature_threshold_exceeded',
          contribution: 1,
          zScore: tempZScore.zScore,
        })
      }
      if (humidityExceeded) {
        contributingFactors.push({
          factor: 'humidity_threshold_exceeded',
          contribution: 1,
          zScore: humidityZScore.zScore,
        })
      }
    }
  }

  // Isolation Forest score (multivariate: temp + humidity)
  const ifWindowSize = Math.min(60, temperatures.length + 1)
  const ifData: number[][] = []
  for (let i = Math.max(0, temperatures.length - ifWindowSize + 1); i < temperatures.length; i++) {
    ifData.push([temperatures[i], humidities[i]])
  }
  ifData.push([currentTemp, currentHumidity])

  let ifScore = 0.5
  if (precomputedIfScore !== undefined) {
    // ใช้ค่าที่คำนวณมาแล้วจาก async call (analyzeRoom) — ไม่ต้อง spawnSync
    ifScore = precomputedIfScore
  } else if (ifData.length >= 10) {
    if (ENABLE_PYTHON_ML) {
      try {
        const pyOut = runIsolationForestSync({
          data: ifData,
          contamination: ML_CONFIG.anomaly.isolationForestContamination,
        })
        ifScore = pyOut.scores[pyOut.scores.length - 1] ?? 0.5
      } catch {
        const ifScores = isolationForestScores(ifData)
        ifScore = ifScores[ifScores.length - 1] ?? 0.5
      }
    } else {
      const ifScores = isolationForestScores(ifData)
      ifScore = ifScores[ifScores.length - 1] ?? 0.5
    }
  }

  // รวมคะแนนจาก Z-Score และ Isolation Forest
  const combinedZScore = Math.sqrt((tempZScore.zScore ** 2 + humidityZScore.zScore ** 2) / 2)
  let anomalyScore = Math.min(1, combinedZScore / 3)
  anomalyScore = Math.max(anomalyScore, ifScore)
  if (ifScore >= 0.6 && !anomalyTypes.includes('statistical_outlier')) {
    anomalyTypes.push('statistical_outlier')
  }

  // Boost score if multiple anomaly types detected
  if (anomalyTypes.length > 1) {
    anomalyScore = Math.min(1, anomalyScore * 1.2)
  }

  // Determine severity
  let severity: 'normal' | 'warning' | 'critical' = 'normal'
  if (anomalyScore >= 0.9 || anomalyTypes.includes('sensor_malfunction')) {
    severity = 'critical'
  } else if (anomalyScore >= 0.7 || anomalyTypes.includes('threshold_exceeded')) {
    severity = 'warning'
  }

  // Calculate dynamic thresholds
  const defaultThresholds = {
    temperature: { min: 15, max: 30 },
    humidity: { min: 40, max: 70 },
  }
  const thresholds = roomThresholds || defaultThresholds

  const dynamicThresholds = {
    temperature: calculateDynamicThreshold(
      temperatures,
      thresholds.temperature.min,
      thresholds.temperature.max
    ),
    humidity: calculateDynamicThreshold(
      humidities,
      thresholds.humidity.min,
      thresholds.humidity.max
    ),
  }

  const finalScore =
    typeof anomalyScore === 'number' && !Number.isNaN(anomalyScore)
      ? Math.max(0, Math.min(1, anomalyScore))
      : 0.5

  return {
    roomId: currentData.roomId || '',
    nodeId: currentData.nodeId,
    timestamp: currentData.timestamp,
    isAnomaly: anomalyTypes.length > 0,
    anomalyScore: finalScore,
    severity,
    anomalyType: anomalyTypes,
    contributingFactors,
    expectedValues: {
      temperature: mean(temperatures),
      humidity: mean(humidities),
    },
    actualValues: {
      temperature: currentTemp,
      humidity: currentHumidity,
    },
    dynamicThresholds,
  }
}

/**
 * Batch anomaly detection
 */
export function detectAnomaliesBatch(
  dataPoints: EnvironmentalSensorData[],
  roomThresholds?: Room['thresholds']
): AnomalyDetectionResult[] {
  const results: AnomalyDetectionResult[] = []
  const windowSize = 12 // Minimum window for analysis

  for (let i = windowSize; i < dataPoints.length; i++) {
    const historical = dataPoints.slice(0, i)
    const current = dataPoints[i]
    results.push(detectAnomaly(current, historical, roomThresholds))
  }

  return results
}

/**
 * Full ML Analysis Pipeline
 */
export async function analyzeRoom(
  roomId: string,
  nodeId: string,
  historicalData: EnvironmentalSensorData[],
  roomConfig: Room
): Promise<MLAnalysisResult> {
  // Get latest data point
  const currentData = historicalData[historicalData.length - 1]

  // Run prediction (Python Prophet ถ้า ENABLE_PYTHON_ML=1, ไม่เช่นนั้น Holt-Winters)
  let prediction: PredictionResult
  if (ENABLE_PYTHON_ML) {
    try {
      prediction = await predictionFromPython(historicalData, roomId, nodeId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        '[ML] Python Prophet ไม่พร้อม ใช้ Holt-Winters แทน — สาเหตุ:',
        msg
      )
      if (err instanceof Error && err.stack) console.error(err.stack)
      prediction = predictTimeSeries(historicalData, roomId, nodeId)
    }
  } else {
    prediction = predictTimeSeries(historicalData, roomId, nodeId)
  }

  // Run anomaly detection — คำนวณ Isolation Forest แบบ async ก่อน แล้วส่งผลเข้า detectAnomaly
  // เพื่อป้องกัน spawnSync บล็อก event loop
  const historicalForAnomaly = historicalData.slice(0, -1)
  let precomputedIfScore: number | undefined
  if (ENABLE_PYTHON_ML) {
    const temperatures = historicalForAnomaly.map((d) => d.readings.temperature)
    const humidities = historicalForAnomaly.map((d) => d.readings.humidity)
    const ifWindowSize = Math.min(60, temperatures.length + 1)
    const ifData: number[][] = []
    for (let i = Math.max(0, temperatures.length - ifWindowSize + 1); i < temperatures.length; i++) {
      ifData.push([temperatures[i], humidities[i]])
    }
    ifData.push([currentData.readings.temperature, currentData.readings.humidity])
    if (ifData.length >= 10) {
      try {
        const pyOut = await runIsolationForest({
          data: ifData,
          contamination: ML_CONFIG.anomaly.isolationForestContamination,
        })
        precomputedIfScore = pyOut.scores[pyOut.scores.length - 1] ?? 0.5
      } catch {
        // fallback: detectAnomaly จะใช้ JS implementation แทน
      }
    }
  }
  const anomaly = detectAnomaly(currentData, historicalForAnomaly, roomConfig.thresholds, precomputedIfScore)

  // Generate user-friendly results
  const userFriendlyPrediction = generateUserFriendlyPrediction(
    prediction.predictions,
    currentData.readings.temperature,
    currentData.readings.humidity,
    roomConfig.thresholds
  )

  const userFriendlyAnomaly = generateUserFriendlyAnomaly(anomaly)

  // Persist metrics for drift analysis (fire-and-forget, non-blocking)
  if (prediction.metrics && roomId && nodeId) {
    dbService.recordModelMetrics({
      nodeId,
      roomId,
      modelType: prediction.model,
      mae: prediction.metrics.mae,
      rmse: prediction.metrics.rmse,
      mape: prediction.metrics.mape,
      trainingPoints: null,
    }).catch((err) => console.error('[ML] analyzeRoom: Failed to record model metrics:', err))
  }

  return {
    prediction,
    anomaly,
    userFriendly: {
      prediction: userFriendlyPrediction,
      anomaly: userFriendlyAnomaly,
    },
    processedAt: new Date(),
  }
}

/**
 * Get model metrics
 * ค่า mae/rmse/mape คำนวณจาก backtest จริงผ่าน predictTimeSeries()
 * ถ้าไม่มีข้อมูลเพียงพอจะคืน null เพื่อให้ caller แสดงว่า "ยังไม่มีข้อมูล"
 */
export async function getModelMetrics(
  historicalData?: EnvironmentalSensorData[]
): Promise<{
  prediction: {
    model: string
    version: string
    mae: number | null
    rmse: number | null
    mape: number | null
    pythonEnabled: boolean
  }
  anomalyDetection: {
    model: string
    version: string
  }
}> {
  let mae: number | null = null
  let rmse: number | null = null
  let mape: number | null = null

  if (historicalData && historicalData.length >= 36) {
    const result = predictTimeSeries(historicalData, '', '')
    if (result.metrics) {
      mae = result.metrics.mae
      rmse = result.metrics.rmse
      mape = result.metrics.mape
    }
  }

  return {
    prediction: {
      model: ENABLE_PYTHON_ML ? 'Prophet Ensemble' : 'Holt-Winters Triple Exponential Smoothing',
      version: ENABLE_PYTHON_ML ? PYTHON_MODEL_VERSION : MODEL_VERSION,
      mae,
      rmse,
      mape,
      pythonEnabled: ENABLE_PYTHON_ML,
    },
    anomalyDetection: {
      model: ENABLE_PYTHON_ML ? 'Isolation Forest (Python/sklearn)' : 'Z-Score + IQR + Rate of Change',
      version: ENABLE_PYTHON_ML ? 'sklearn-v2' : 'v2.0',
    },
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function processDataThroughML(
  newData: EnvironmentalSensorData,
  historicalData: EnvironmentalSensorData[]
): Promise<{
  prediction: PredictionResult
  anomaly: AnomalyDetectionResult
}> {
  const anomaly = detectAnomaly(newData, historicalData)
  const allData = [...historicalData, newData]
  const prediction = predictTimeSeries(allData, newData.roomId || '', newData.nodeId)

  return { prediction, anomaly }
}

// ============================================================================
// Current / Power Sensor Anomaly (แอร์ เครื่องปรับอากาศ)
// ============================================================================

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
export function detectPowerAnomaly(
  currentData: PowerSensorData,
  historicalData: PowerSensorData[],
  options: PowerAnomalyOptions = {}
): PowerAnomalyResult {
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
      const pyOut = runIsolationForestSync({
        data: ifData,
        contamination: ML_CONFIG.anomaly.isolationForestContamination,
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
