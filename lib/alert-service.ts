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
import { sendNotification, sendNotificationToRoomUsers } from './notification-service'
import { th } from './i18n'
import type {
  EnvironmentalSensorData,
  PowerSensorData,
  SensorData,
  SensorNode,
  Room,
} from './types'

// ─── Throttle state: track last anomaly-detection run per nodeId ──────────────
// Key: nodeId, Value: timestamp of last ML anomaly detection run (ms)
const lastAnomalyRunMs = new Map<string, number>()

/** Minimum interval between ML anomaly detection runs for the same node (ms) */
const ANOMALY_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Returns true if enough time has passed since the last anomaly detection run
 * for this node+type, and records the current time if so.
 * Key includes sensor type to prevent cross-type debounce collision.
 */
function shouldRunAnomalyDetection(nodeId: string, sensorType: string): boolean {
  const key = `${nodeId}:${sensorType}`
  const now = Date.now()
  const last = lastAnomalyRunMs.get(key) ?? 0
  if (now - last < ANOMALY_DEBOUNCE_MS) return false
  lastAnomalyRunMs.set(key, now)
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
  thresholds: Room['thresholds'],
  room?: Room | null
): Promise<void> {
  const { temperature, humidity } = readings

  if (temperature < thresholds.temperature.min || temperature > thresholds.temperature.max) {
    const hasActive = await db.hasActiveAlertForNode(roomId, nodeId, 'threshold', 'อุณหภูมิ')
    if (!hasActive) {
      const isHigh = temperature > thresholds.temperature.max
      const isCritical =
        temperature > thresholds.temperature.max + 5 ||
        temperature < thresholds.temperature.min - 5
      const alert = await db.createAlert({
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
          source: 'threshold',
        },
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
      })
      db.getAllUsers().then(async (users) => {
        const node = await db.getSensorNodeByNodeId(nodeId).catch(() => null)
        return sendNotificationToRoomUsers(users, roomId, alert, room, node)
      }).catch((err) =>
        console.error('[AlertService] Failed to send threshold notification:', err)
      )
    }
  }

  if (humidity < thresholds.humidity.min || humidity > thresholds.humidity.max) {
    const hasActive = await db.hasActiveAlertForNode(roomId, nodeId, 'threshold', 'ความชื้น')
    if (!hasActive) {
      const isHigh = humidity > thresholds.humidity.max
      const isCritical =
        humidity > thresholds.humidity.max + 10 ||
        humidity < thresholds.humidity.min - 10
      const alert = await db.createAlert({
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
          source: 'threshold',
        },
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
      })
      db.getAllUsers().then(async (users) => {
        const node = await db.getSensorNodeByNodeId(nodeId).catch(() => null)
        return sendNotificationToRoomUsers(users, roomId, alert, room, node)
      }).catch((err) =>
        console.error('[AlertService] Failed to send threshold notification:', err)
      )
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
  roomId: string,
  room?: Room | null
): Promise<void> {
  if (!shouldRunAnomalyDetection(nodeId, 'environmental')) return

  const historicalData = await db.getSensorDataByRoomAndType(roomId, 'environmental', 288)
  const nodeHistoricalData = historicalData.filter(
    (d): d is EnvironmentalSensorData => (d as EnvironmentalSensorData).nodeId === nodeId
  )

  const anomaly = detectAnomaly(saved as EnvironmentalSensorData, nodeHistoricalData)

  const safeScore = (v: number) =>
    typeof v === 'number' && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 0.5

  const hasActiveAnomalyAlert = await db.hasActiveAlertForNode(roomId, nodeId, 'anomaly')

  if (anomaly.isAnomaly && !hasActiveAnomalyAlert) {
    const score = safeScore(anomaly.anomalyScore)
    const alert = await db.createAlert({
      roomId,
      nodeId,
      type: 'anomaly',
      severity: score > 0.9 ? 'critical' : 'warning',
      message: `[ML] ${th.alert.anomalyDetected(score * 100)}`,
      data: { anomalyScore: score, source: 'ml_environmental' },
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
    })
    db.getAllUsers().then(async (users) => {
      const node = await db.getSensorNodeByNodeId(nodeId).catch(() => null)
      return sendNotificationToRoomUsers(users, roomId, alert, room, node)
    }).catch((err) =>
      console.error('[AlertService] Failed to send anomaly notification:', err)
    )
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
  deviceExpectedOn = false,
  room?: Room | null
): Promise<void> {
  if (!shouldRunAnomalyDetection(nodeId, 'power')) return

  const historicalData = await db.getSensorDataByRoomAndType(roomId, 'power', 288)
  const powerHistory = historicalData.filter(
    (d): d is PowerSensorData => (d as PowerSensorData).nodeId === nodeId
  )

  const powerAnomaly = await detectPowerAnomaly(saved as PowerSensorData, powerHistory, {
    useHistoricalRange: true,
    deviceExpectedOn,
  })

  const hasActivePowerAnomalyAlert = await db.hasActiveAlertForNode(roomId, nodeId, 'anomaly')

  if (powerAnomaly.isAnomaly && !hasActivePowerAnomalyAlert) {
    const safeNum = (v: number | undefined) =>
      typeof v === 'number' && !Number.isNaN(v) ? v : 0
    const safeScore = (v: number) =>
      typeof v === 'number' && !Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : 0.5

    const alert = await db.createAlert({
      roomId,
      nodeId,
      type: 'anomaly',
      severity: safeScore(powerAnomaly.anomalyScore) >= 0.9 ? 'critical' : 'warning',
      message: `[ML] ${powerAnomaly.message}`,
      data: {
        value: safeNum(powerAnomaly.current),
        threshold: safeNum(powerAnomaly.expectedRange?.max),
        anomalyScore: safeScore(powerAnomaly.anomalyScore),
        source: 'ml_power',
      },
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
    })
    db.getAllUsers().then(async (users) => {
      const node = await db.getSensorNodeByNodeId(nodeId).catch(() => null)
      return sendNotificationToRoomUsers(users, roomId, alert, room, node)
    }).catch((err) =>
      console.error('[AlertService] Failed to send power anomaly notification:', err)
    )
  } else if (!powerAnomaly.isAnomaly) {
    await db.resolvePowerAnomalyAlertsForNode(roomId, nodeId, 'system')
  }
}

// ─── Sensor heartbeat / offline detection ──────────────────────────────────

/** Default offline threshold: 10 minutes without data */
const OFFLINE_THRESHOLD_MS = 10 * 60 * 1000

/**
 * Check all active sensors for heartbeat timeout.
 * - Marks sensors as offline if lastSeen > OFFLINE_THRESHOLD_MS
 * - Creates a DB alert (type: 'offline') if none exists
 * - Sends Discord/LINE notifications to responsible room users
 * - Auto-resolves offline alerts when sensor comes back online
 *
 * Returns summary stats for logging / API response.
 */
export async function checkSensorHeartbeat(): Promise<{
  checkedNodes: number
  markedOffline: number
  alertsCreated: number
  notificationsSent: number
  autoResolved: number
}> {
  const nodes = await db.getSensorNodes()
  const now = Date.now()

  let markedOffline = 0
  let alertsCreated = 0
  let notificationsSent = 0
  let autoResolved = 0

  // Pre-fetch all users once (for notification fan-out)
  let allUsers: Awaited<ReturnType<typeof db.getAllUsers>> | null = null

  for (const node of nodes) {
    if (!node.lastSeen) continue

    const lastSeenMs =
      node.lastSeen instanceof Date
        ? node.lastSeen.getTime()
        : new Date(node.lastSeen).getTime()

    const offlineMinutes = Math.round((now - lastSeenMs) / 60000)
    const isOverdue = now - lastSeenMs > OFFLINE_THRESHOLD_MS

    // ── Sensor is overdue and was online → mark offline + alert + notify ──
    if (isOverdue && node.status === 'online') {
      await db.updateSensorNode(String(node._id), { status: 'offline' })
      markedOffline++

      const roomId = node.roomId ? String(node.roomId) : null
      const room = roomId ? await db.getRoomById(roomId) : null
      const roomName = room?.name ?? 'ไม่ระบุห้อง'

      // Build alert message with room name, node ID, and troubleshooting tips
      const message = roomId
        ? th.offline.alertMessage(node.name, node.nodeId, roomName, offlineMinutes)
        : th.offline.alertMessageNoRoom(node.name, node.nodeId, offlineMinutes)

      // Only create alert if no active offline alert already exists for this node
      if (roomId) {
        const hasActive = await db.hasActiveAlertForNode(roomId, node.nodeId, 'offline')
        if (!hasActive) {
          const alert = await db.createAlert({
            roomId,
            nodeId: node.nodeId,
            type: 'offline',
            severity: offlineMinutes >= 30 ? 'critical' : 'warning',
            message,
            data: {
              lastSeen: node.lastSeen,
              offlineMinutes,
            },
            isResolved: false,
            resolvedAt: null,
            resolvedBy: null,
          })
          alertsCreated++

          // Send notification to responsible room users
          try {
            if (!allUsers) allUsers = await db.getAllUsers()
            await sendNotificationToRoomUsers(allUsers, roomId, alert, room, node as SensorNode)
            notificationsSent++
          } catch (err) {
            console.error('[AlertService] Failed to send offline notification:', err)
          }
        }
      }
    }

    // ── Sensor is back online → auto-resolve any active offline alerts ──
    if (!isOverdue && node.status === 'offline') {
      await db.updateSensorNode(String(node._id), { status: 'online' })
      if (node.roomId) {
        const resolved = await db.resolveOfflineAlertsForNode(
          String(node.roomId),
          node.nodeId,
          'system'
        )
        autoResolved += resolved
      }
    }
  }

  return { checkedNodes: nodes.length, markedOffline, alertsCreated, notificationsSent, autoResolved }
}

// ─── System alert creation ──────────────────────────────────────────────────

/** Debounce: max one system alert per error key per 30 minutes */
const lastSystemAlertMs = new Map<string, number>()
const SYSTEM_ALERT_DEBOUNCE_MS = 30 * 60 * 1000

/**
 * Create a system alert for infrastructure errors (DB timeout, ML script error, etc.)
 * Debounced per errorKey so the same error doesn't spam alerts.
 * Sends notification via global webhooks (not room-specific).
 */
export async function createSystemAlert(
  errorKey: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const now = Date.now()
  const last = lastSystemAlertMs.get(errorKey) ?? 0
  if (now - last < SYSTEM_ALERT_DEBOUNCE_MS) return
  lastSystemAlertMs.set(errorKey, now)

  try {
    const alert = await db.createAlert({
      roomId: null as unknown as string,
      nodeId: null as unknown as string,
      type: 'system',
      severity: 'info',
      message,
      data: { errorKey, ...metadata },
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
    })

    // System alerts use global env webhooks (not room-specific)
    sendNotification(alert).catch((err) =>
      console.error('[AlertService] Failed to send system alert notification:', err)
    )
  } catch (err) {
    // Don't throw — system alert creation should never crash the caller
    console.error('[AlertService] Failed to create system alert:', err)
  }
}
