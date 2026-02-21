/**
 * Alert Service for IoT Herbal Storage Monitoring System
 *
 * Centralizes threshold checking and alert creation logic that was previously
 * embedded inside the /api/data/ingest route. Moving it here makes the logic:
 * - Independently unit-testable
 * - Reusable across multiple API routes
 * - Easier to extend (e.g. adding email channel, escalation rules)
 */

import { dbService as db } from './db-service'
import { detectAnomaly, detectPowerAnomaly } from './ml-service'
import { th } from './i18n'
import type {
  EnvironmentalSensorData,
  PowerSensorData,
  SensorData,
  Room,
} from './types'

// ─── Throttle state: track last anomaly-detection run per nodeId ──────────────
// Key: nodeId, Value: timestamp of last ML anomaly detection run (ms)
const lastAnomalyRunMs = new Map<string, number>()

/** Minimum interval between ML anomaly detection runs for the same node (ms) */
const ANOMALY_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Returns true if enough time has passed since the last anomaly detection run
 * for this node, and records the current time if so.
 */
function shouldRunAnomalyDetection(nodeId: string): boolean {
  const now = Date.now()
  const last = lastAnomalyRunMs.get(nodeId) ?? 0
  if (now - last < ANOMALY_DEBOUNCE_MS) return false
  lastAnomalyRunMs.set(nodeId, now)
  return true
}

// ─── Environmental threshold checking ────────────────────────────────────────

/**
 * Check temperature and humidity against room thresholds.
 * Creates DB alerts only when no active alert of the same type already exists.
 */
export async function checkEnvironmentalThresholds(
  nodeId: string,
  roomId: string,
  readings: EnvironmentalSensorData['readings'],
  thresholds: Room['thresholds']
): Promise<void> {
  const { temperature, humidity } = readings

  if (temperature < thresholds.temperature.min || temperature > thresholds.temperature.max) {
    const hasActive = await db.hasActiveAlertForNode(roomId, nodeId, 'threshold', 'อุณหภูมิ')
    if (!hasActive) {
      const isHigh = temperature > thresholds.temperature.max
      const isCritical =
        temperature > thresholds.temperature.max + 5 ||
        temperature < thresholds.temperature.min - 5
      await db.createAlert({
        roomId,
        nodeId,
        type: 'threshold',
        severity: isCritical ? 'critical' : 'warning',
        message: isHigh
          ? th.alert.temperatureHigh(temperature)
          : th.alert.temperatureLow(temperature),
        data: {
          value: temperature,
          threshold: isHigh ? thresholds.temperature.max : thresholds.temperature.min,
        },
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
      })
    }
  }

  if (humidity < thresholds.humidity.min || humidity > thresholds.humidity.max) {
    const hasActive = await db.hasActiveAlertForNode(roomId, nodeId, 'threshold', 'ความชื้น')
    if (!hasActive) {
      const isHigh = humidity > thresholds.humidity.max
      const isCritical =
        humidity > thresholds.humidity.max + 10 ||
        humidity < thresholds.humidity.min - 10
      await db.createAlert({
        roomId,
        nodeId,
        type: 'threshold',
        severity: isCritical ? 'critical' : 'warning',
        message: isHigh
          ? th.alert.humidityHigh(humidity)
          : th.alert.humidityLow(humidity),
        data: {
          value: humidity,
          threshold: isHigh ? thresholds.humidity.max : thresholds.humidity.min,
        },
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
      })
    }
  }
}

// ─── Environmental anomaly detection ─────────────────────────────────────────

/**
 * Run ML anomaly detection for an environmental sensor reading.
 * Throttled per nodeId — skips if called within ANOMALY_DEBOUNCE_MS of the last run.
 * Creates a DB alert when an anomaly is detected and no active anomaly alert exists.
 */
export async function checkEnvironmentalAnomaly(
  saved: SensorData,
  nodeId: string,
  roomId: string
): Promise<void> {
  if (!shouldRunAnomalyDetection(nodeId)) return

  const historicalData = await db.getSensorDataByRoom(roomId, 288)
  const nodeHistoricalData = historicalData.filter(
    (d): d is EnvironmentalSensorData =>
      d.type === 'environmental' && d.nodeId === nodeId
  )

  const anomaly = detectAnomaly(saved as EnvironmentalSensorData, nodeHistoricalData)

  const safeScore = (v: number) =>
    typeof v === 'number' && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 0.5

  const hasActiveAnomalyAlert = await db.hasActiveAlertForNode(roomId, nodeId, 'anomaly')

  if (anomaly.isAnomaly && !hasActiveAnomalyAlert) {
    const score = safeScore(anomaly.anomalyScore)
    await db.createAlert({
      roomId,
      nodeId,
      type: 'anomaly',
      severity: score > 0.9 ? 'critical' : 'warning',
      message: th.alert.anomalyDetected(score * 100),
      data: { anomalyScore: score },
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
    })
  }
}

// ─── Power anomaly detection ──────────────────────────────────────────────────

/**
 * Run ML anomaly detection for a power sensor reading.
 * Throttled per nodeId — skips if called within ANOMALY_DEBOUNCE_MS of the last run.
 * Creates or auto-resolves DB alerts based on detection result.
 */
export async function checkPowerAnomaly(
  saved: SensorData,
  nodeId: string,
  roomId: string,
  deviceExpectedOn = false
): Promise<void> {
  if (!shouldRunAnomalyDetection(nodeId)) return

  const historicalData = await db.getSensorDataByRoom(roomId, 288)
  const powerHistory = historicalData.filter(
    (d): d is PowerSensorData => d.type === 'power' && d.nodeId === nodeId
  )

  const powerAnomaly = detectPowerAnomaly(saved as PowerSensorData, powerHistory, {
    useHistoricalRange: true,
    deviceExpectedOn,
  })

  const hasActivePowerAnomalyAlert = await db.hasActiveAlertForNode(roomId, nodeId, 'anomaly')

  if (powerAnomaly.isAnomaly && !hasActivePowerAnomalyAlert) {
    const safeNum = (v: number | undefined) =>
      typeof v === 'number' && !Number.isNaN(v) ? v : 0
    const safeScore = (v: number) =>
      typeof v === 'number' && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 0.5

    await db.createAlert({
      roomId,
      nodeId,
      type: 'anomaly',
      severity: safeScore(powerAnomaly.anomalyScore) >= 0.9 ? 'critical' : 'warning',
      message: powerAnomaly.message,
      data: {
        value: safeNum(powerAnomaly.current),
        threshold: safeNum(powerAnomaly.expectedRange?.max),
        anomalyScore: safeScore(powerAnomaly.anomalyScore),
      },
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
    })
  } else if (!powerAnomaly.isAnomaly) {
    await db.resolvePowerAnomalyAlertsForNode(roomId, nodeId, 'system')
  }
}
