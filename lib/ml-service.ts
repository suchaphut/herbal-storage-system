/**
 * Machine Learning Service — Orchestrator
 *
 * This module orchestrates all ML functionality:
 * 1. Time Series Prediction (Holt-Winters / Prophet)
 * 2. Anomaly Detection (Z-Score, IQR, IF, Ensemble)
 * 3. Full Room Analysis Pipeline
 *
 * Sub-modules in lib/ml/:
 *   utils.ts, isolation-forest.ts, holt-winters.ts,
 *   anomaly-helpers.ts, user-friendly.ts, power-anomaly.ts
 */

import { computePredictionMetrics } from './ml-metrics'
import {
  runProphet,
  runIsolationForest,
  runIsolationForestSync,
  runEnsembleAnomaly,
  type ProphetOutput,
} from './ml-python-bridge'
import { getCachedPrediction, setCachedPrediction } from './ml-cache'
import { dbService } from './db-service'
import type {
  EnvironmentalSensorData,
  PredictionResult,
  AnomalyDetectionResult,
  MLModelConfig,
  MLAnalysisResult,
  AnomalyType,
  PredictionMetrics,
  Room,
} from './types'

// Sub-module imports
import { mean, standardDeviation, winsorizeData } from './ml/utils'
import { isolationForestScores } from './ml/isolation-forest'
import { holtWintersPredict } from './ml/holt-winters'
import {
  detectZScoreAnomaly,
  detectRapidChange,
  detectSensorMalfunction,
  calculateDynamicThreshold,
} from './ml/anomaly-helpers'
import { generateUserFriendlyPrediction, generateUserFriendlyAnomaly } from './ml/user-friendly'

// Re-export sub-modules for external consumers
export { detectPowerAnomaly, type PowerAnomalyOptions } from './ml/power-anomaly'

const ENABLE_PYTHON_ML =
  process.env.ENABLE_PYTHON_ML === '1' || process.env.ENABLE_PYTHON_ML === 'true'

const USE_ENSEMBLE_ANOMALY =
  process.env.USE_ENSEMBLE_ANOMALY === '1' || process.env.USE_ENSEMBLE_ANOMALY === 'true'

const DISABLE_LSTM =
  process.env.DISABLE_LSTM === '1' || process.env.DISABLE_LSTM === 'true'

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
    zScoreThreshold: 3.0, // Standard deviations for anomaly (stricter)
    isolationForestContamination: 0.02, // 2% expected anomaly rate (less false positives)
    minSamplesForTraining: 288, // 24 hours * 12 points/hour
    rapidChangeThresholds: {
      temperature: 3, // 3°C change per 5 minutes is suspicious
      humidity: 10, // 10% change per 5 minutes is suspicious
    },
  },
}

// Model version for tracking
const MODEL_VERSION = 'HoltWinters-v2.0'

// Sub-module implementations now live in lib/ml/*.ts
// See: utils.ts, isolation-forest.ts, holt-winters.ts,
//      anomaly-helpers.ts, user-friendly.ts, power-anomaly.ts

// ============================================================================
// Python ML (Prophet) – ใช้เมื่อ ENABLE_PYTHON_ML=1
// ============================================================================

const PYTHON_MODEL_VERSION = 'Prophet-v2.0'

const TEMP_RANGE = { min: 15, max: 35 }
const HUM_RANGE = { min: 20, max: 85 }

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

  // Calculate recent data stats for sanity-checking predictions
  const recentTemp = temperature.slice(-Math.min(10, temperature.length))
  const recentHum = humidity.slice(-Math.min(10, humidity.length))
  const recentTempMean = recentTemp.reduce((a, b) => a + b, 0) / recentTemp.length
  const recentHumMean = recentHum.reduce((a, b) => a + b, 0) / recentHum.length
  const MAX_TEMP_DEV = 5.0  // Max °C deviation from recent mean
  const MAX_HUM_DEV = 15.0  // Max % deviation from recent mean

  const predictions: PredictionResult['predictions'] = rawPred.slice(0, totalSteps).map((p, i) => {
    // Confidence decreases over horizon time, multiplied by data quality factor
    const horizonConfidence = Math.max(0.5, 1 - i * 0.03)
    const confidence = horizonConfidence * dataConfidenceFactor

    // Clamp to recent mean ± max deviation (prevents wild swings)
    const clampedTemp = Math.max(
      TEMP_RANGE.min,
      Math.min(TEMP_RANGE.max, Math.max(recentTempMean - MAX_TEMP_DEV, Math.min(recentTempMean + MAX_TEMP_DEV, p.temperature)))
    )
    const clampedHum = Math.max(
      HUM_RANGE.min,
      Math.min(HUM_RANGE.max, Math.max(recentHumMean - MAX_HUM_DEV, Math.min(recentHumMean + MAX_HUM_DEV, p.humidity)))
    )

    return {
      time: new Date(p.time),
      temperature: clampedTemp,
      humidity: clampedHum,
      confidence,
      upperBound: {
        temperature: Math.min(TEMP_RANGE.max, clampedTemp + band * (1 + i * 0.05)),
        humidity: Math.min(HUM_RANGE.max, clampedHum + band * (1 + i * 0.05)),
      },
      lowerBound: {
        temperature: Math.max(TEMP_RANGE.min, clampedTemp - band * (1 + i * 0.05)),
        humidity: Math.max(HUM_RANGE.min, clampedHum - band * (1 + i * 0.05)),
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
      temperature: Math.max(TEMP_RANGE.min, Math.min(TEMP_RANGE.max, tempPred)),
      humidity: Math.max(HUM_RANGE.min, Math.min(HUM_RANGE.max, humidPred)),
      confidence,
      upperBound: {
        temperature: Math.min(TEMP_RANGE.max, tempPred + tempStd * bandMultiplier),
        humidity: Math.min(HUM_RANGE.max, humidPred + humidityStd * bandMultiplier),
      },
      lowerBound: {
        temperature: Math.max(TEMP_RANGE.min, tempPred - tempStd * bandMultiplier),
        humidity: Math.max(HUM_RANGE.min, humidPred - humidityStd * bandMultiplier),
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

  // รวมคะแนนจาก Z-Score และ ML model (weighted average แทน max)
  const combinedZScore = Math.sqrt((tempZScore.zScore ** 2 + humidityZScore.zScore ** 2) / 2)
  const zNormalized = Math.min(1, combinedZScore / 4) // normalize: z=4 → score=1.0

  // Weighted blend: Z-Score 40%, ML model 60% — ทั้งสองต้องเห็นตรงกันถึงจะ score สูง
  let anomalyScore = 0.4 * zNormalized + 0.6 * ifScore

  // Only flag as statistical_outlier from ML if score is genuinely high
  if (ifScore >= 0.8 && !anomalyTypes.includes('statistical_outlier')) {
    anomalyTypes.push('statistical_outlier')
  }

  // Mild boost if multiple independent anomaly types detected
  if (anomalyTypes.length > 1) {
    anomalyScore = Math.min(1, anomalyScore * 1.1)
  }

  // Determine severity — higher thresholds to reduce false alarms
  let severity: 'normal' | 'warning' | 'critical' = 'normal'
  if (anomalyScore >= 0.85 || anomalyTypes.includes('sensor_malfunction')) {
    severity = 'critical'
  } else if (anomalyScore >= 0.6 || anomalyTypes.includes('threshold_exceeded')) {
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
    isAnomaly: anomalyTypes.length > 0 && finalScore >= 0.4,
    anomalyScore: finalScore,
    severity: (anomalyTypes.length > 0 && finalScore >= 0.4) ? severity : 'normal',
    anomalyType: finalScore >= 0.4 ? anomalyTypes : [],
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

  // Run anomaly detection — คำนวณ ML score แบบ async ก่อน แล้วส่งผลเข้า detectAnomaly
  // เพื่อป้องกัน spawnSync บล็อก event loop
  const historicalForAnomaly = historicalData.slice(0, -1)
  let precomputedIfScore: number | undefined
  let anomalyModelName = 'Isolation Forest + Z-Score'
  if (ENABLE_PYTHON_ML) {
    const temperatures = historicalForAnomaly.map((d) => d.readings.temperature)
    const humidities = historicalForAnomaly.map((d) => d.readings.humidity)
    const ifWindowSize = Math.min(60, temperatures.length + 1)
    const ifData: number[][] = []
    for (let i = Math.max(0, temperatures.length - ifWindowSize + 1); i < temperatures.length; i++) {
      ifData.push([temperatures[i], humidities[i]])
    }
    ifData.push([currentData.readings.temperature, currentData.readings.humidity])

    if (USE_ENSEMBLE_ANOMALY && ifData.length >= 10) {
      // ใช้ Ensemble Anomaly Detector (IF + LSTM + SVM)
      try {
        const ensembleOut = await runEnsembleAnomaly({
          data: ifData,
          contamination: ML_CONFIG.anomaly.isolationForestContamination,
          feature_set: 'environmental',
          ...(DISABLE_LSTM && { weights: { isolation_forest: 0.6, lstm_autoencoder: 0, one_class_svm: 0.4 } }),
        })
        precomputedIfScore = ensembleOut.scores[ensembleOut.scores.length - 1] ?? 0.5
        const modelsUsed = ensembleOut.meta?.models_used ?? []
        const modelAbbrevs = modelsUsed.map((m: string) => {
          if (m === 'isolation_forest') return 'IF'
          if (m === 'lstm_autoencoder') return 'LSTM'
          if (m === 'one_class_svm') return 'SVM'
          return m
        })
        anomalyModelName = `Ensemble (${modelAbbrevs.join('+')}) + Z-Score`
      } catch (err) {
        console.error('[ML] Ensemble anomaly failed, falling back to IF:', err instanceof Error ? err.message : err)
        // fallback to Isolation Forest
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
    } else if (ifData.length >= 10) {
      // ใช้ Isolation Forest เดี่ยว
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
  anomaly.modelName = anomalyModelName

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

// Power anomaly detection is now in lib/ml/power-anomaly.ts
// Re-exported at top of this file via: export { detectPowerAnomaly, type PowerAnomalyOptions } from './ml/power-anomaly'
