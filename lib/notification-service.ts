/**
 * Notification Service for IoT Herbal Storage Monitoring System
 *
 * Supports:
 * - Discord Webhook notifications with rich embeds
 * - ML-based intelligent alerting
 */

import type {
  Alert,
  Room,
  SensorNode,
  User,
  AnomalyDetectionResult,
  UserFriendlyAnomaly,
  UserFriendlyPrediction,
} from './types'
import { th } from './i18n'

interface NotificationConfig {
  discord?: {
    enabled: boolean
    webhookUrl: string
  }
}

// Get notification config from environment (global fallback)
function getConfig(): NotificationConfig {
  return {
    discord: {
      enabled: !!process.env.DISCORD_WEBHOOK_URL,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    },
  }
}

// Severity to color mapping for Discord embeds
const severityColors: Record<string, number> = {
  critical: 0xff0000, // Red
  warning: 0xffa500, // Orange
  info: 0x00bfff, // Blue
  success: 0x00ff00, // Green
}

// Severity to emoji mapping
const severityEmojis: Record<string, string> = {
  critical: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
}

// Risk level to color mapping
const riskColors: Record<string, number> = {
  safe: 0x00ff00,
  caution: 0xffa500,
  danger: 0xff0000,
}

/**
 * Internal: send a Discord alert embed to an explicit webhook URL.
 */
async function sendDiscordNotificationWithConfig(
  webhookUrl: string,
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<boolean> {
  const alertTypeLabel =
    th.notification.alertTypes[alert.type as keyof typeof th.notification.alertTypes] ??
    th.notification.alertTypes.system

  const sourceLabels: Record<string, string> = {
    threshold: '📏 ค่าเกินขีดจำกัดจริง (Threshold)',
    ml_environmental: '🤖 ML ตรวจพบค่าผิดปกติ (Environmental)',
    ml_power: '🤖 ML ตรวจพบค่าผิดปกติ (Power)',
  }
  const sourceLabel = alert.data.source ? (sourceLabels[alert.data.source] ?? alert.data.source) : null

  const embedFields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: th.notification.fieldRoom,
      value: room?.name || th.notification.unknown,
      inline: true,
    },
    {
      name: th.notification.fieldSensor,
      value: node?.name || alert.nodeId || th.notification.unknown,
      inline: true,
    },
    {
      name: th.notification.fieldTime,
      value: new Date(alert.createdAt).toLocaleString('th-TH'),
      inline: true,
    },
  ]

  if (sourceLabel) {
    embedFields.push({ name: '🔍 แหล่งที่มา', value: sourceLabel, inline: false })
  }

  const footerText = alert.data.source?.startsWith('ml_')
    ? th.notification.footerML
    : th.notification.footer

  const embed = {
    title: `${severityEmojis[alert.severity]} ${alertTypeLabel}`,
    description: alert.message,
    color: severityColors[alert.severity] || 0x808080,
    fields: embedFields,
    footer: { text: footerText },
    timestamp: new Date().toISOString(),
  }

  if (alert.data.value !== undefined) {
    embed.fields.push({ name: th.notification.fieldValue, value: `${alert.data.value}`, inline: true })
  }
  if (alert.data.threshold !== undefined) {
    embed.fields.push({ name: th.notification.fieldThreshold, value: `${alert.data.threshold}`, inline: true })
  }
  if (alert.data.anomalyScore !== undefined) {
    embed.fields.push({ name: th.notification.fieldAnomalyScore, value: `${(alert.data.anomalyScore * 100).toFixed(0)}%`, inline: true })
  }
  if (alert.data.offlineMinutes !== undefined) {
    embed.fields.push({ name: '⏱️ ออฟไลน์', value: `${alert.data.offlineMinutes} นาที`, inline: true })
  }
  if (alert.data.lastSeen != null) {
    embed.fields.push({ name: '📡 ส่งข้อมูลล่าสุด', value: new Date(String(alert.data.lastSeen)).toLocaleString('th-TH'), inline: true })
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })
    if (!response.ok) {
      console.error('[Discord] Failed to send notification:', response.status)
      return false
    }
    console.log('[Discord] Notification sent successfully')
    return true
  } catch (error) {
    console.error('[Discord] Error sending notification:', error)
    return false
  }
}

/**
 * Send notification to Discord via webhook
 */
export async function sendDiscordNotification(
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<boolean> {
  const config = getConfig()
  if (!config.discord?.enabled) {
    console.log('[Notification] Discord is not configured')
    return false
  }
  return sendDiscordNotificationWithConfig(config.discord.webhookUrl, alert, room, node)
}

/**
 * Send ML anomaly notification to Discord with rich details
 */
export async function sendDiscordAnomalyAlert(
  anomaly: AnomalyDetectionResult,
  userFriendly: UserFriendlyAnomaly,
  room?: Room | null,
  node?: SensorNode | null
): Promise<boolean> {
  const config = getConfig()

  if (!config.discord?.enabled) {
    console.log('[Notification] Discord is not configured')
    return false
  }

  const embed = {
    title: `${severityEmojis[userFriendly.severity]} ${userFriendly.type}`,
    description: userFriendly.description,
    color: severityColors[userFriendly.severity] || 0xffa500,
    fields: [
      {
        name: th.notification.fieldRoom,
        value: room?.name || th.notification.unknown,
        inline: true,
      },
      {
        name: th.notification.fieldSensor,
        value: node?.name || anomaly.nodeId || th.notification.unknown,
        inline: true,
      },
      {
        name: th.notification.fieldTemp,
        value: `${anomaly.actualValues.temperature.toFixed(1)}°C (${th.notification.expectedValue(anomaly.expectedValues.temperature)})`,
        inline: true,
      },
      {
        name: th.notification.fieldHumidity,
        value: `${anomaly.actualValues.humidity.toFixed(0)}% (${th.notification.expectedHumidity(anomaly.expectedValues.humidity)})`,
        inline: true,
      },
      {
        name: th.notification.fieldAnomalyScore,
        value: `${(anomaly.anomalyScore * 100).toFixed(0)}%`,
        inline: true,
      },
      {
        name: th.notification.fieldAnomalyType,
        value: anomaly.anomalyType.join(', ') || th.notification.unknown,
        inline: true,
      },
      {
        name: th.notification.fieldCauses,
        value: userFriendly.possibleCauses.slice(0, 3).join('\n') || th.notification.unspecified,
        inline: false,
      },
      {
        name: th.notification.fieldRecommendation,
        value: userFriendly.recommendations.slice(0, 3).join('\n') || th.notification.checkSystem,
        inline: false,
      },
    ],
    footer: {
      text: th.notification.footerML,
    },
    timestamp: new Date().toISOString(),
  }

  try {
    const response = await fetch(config.discord.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!response.ok) {
      console.error('[Discord] Failed to send anomaly alert:', response.status)
      return false
    }

    console.log('[Discord] Anomaly alert sent successfully')
    return true
  } catch (error) {
    console.error('[Discord] Error sending anomaly alert:', error)
    return false
  }
}

/**
 * Send ML prediction warning to Discord
 */
export async function sendDiscordPredictionWarning(
  prediction: UserFriendlyPrediction,
  room?: Room | null
): Promise<boolean> {
  const config = getConfig()

  if (!config.discord?.enabled || prediction.riskLevel === 'safe') {
    return false
  }

  const trendLabel =
    prediction.trend === 'increasing'
      ? th.notification.trendUp
      : prediction.trend === 'decreasing'
        ? th.notification.trendDown
        : th.notification.trendStable

  const confidenceLabel =
    prediction.confidence === 'high'
      ? th.notification.confidenceHigh
      : prediction.confidence === 'medium'
        ? th.notification.confidenceMedium
        : th.notification.confidenceLow

  const predFields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: th.notification.fieldRoom,
      value: room?.name || th.notification.unknown,
      inline: true,
    },
    {
      name: th.notification.fieldTrend,
      value: trendLabel,
      inline: true,
    },
    {
      name: th.notification.fieldConfidence,
      value: confidenceLabel,
      inline: true,
    },
    {
      name: th.notification.fieldRecommendation,
      value: prediction.recommendation,
      inline: false,
    },
  ]

  const embed = {
    title: `${prediction.riskLevel === 'danger' ? '🚨' : '⚠️'} ${th.notification.predictionAlert}`,
    description: prediction.summary,
    color: riskColors[prediction.riskLevel] || 0xffa500,
    fields: predFields,
    footer: {
      text: th.notification.footerPrediction,
    },
    timestamp: new Date().toISOString(),
  }

  if (prediction.warningTime) {
    embed.fields.push({
      name: th.notification.fieldWarningTime,
      value: new Date(prediction.warningTime).toLocaleString('th-TH'),
      inline: true,
    })
  }

  try {
    const response = await fetch(config.discord.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!response.ok) {
      console.error('[Discord] Failed to send prediction warning:', response.status)
      return false
    }

    console.log('[Discord] Prediction warning sent successfully')
    return true
  } catch (error) {
    console.error('[Discord] Error sending prediction warning:', error)
    return false
  }
}

/**
 * Send notification to a single user via their personal webhook settings.
 */
export async function sendNotificationToUser(
  user: User,
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<{ discord: boolean }> {
  const prefs = user.notificationPreferences

  if (prefs?.discord && prefs.discordWebhookUrl) {
    const discord = await sendDiscordNotificationWithConfig(prefs.discordWebhookUrl, alert, room, node)
    return { discord }
  }

  return { discord: false }
}

/**
 * Check if a room's notification settings allow this alert type.
 * Returns true if: no room provided, no notification settings, or the alert type is enabled.
 */
function isAlertTypeEnabledForRoom(room: Room | null | undefined, alertType: string): boolean {
  if (!room?.notifications) return true // no room config → always send
  const n = room.notifications
  switch (alertType) {
    case 'threshold': return n.alertOnThreshold !== false
    case 'anomaly': return n.alertOnAnomaly !== false
    case 'offline': return n.alertOnOffline !== false
    default: return true // system alerts always send
  }
}

/**
 * Fan-out: send notification to all users responsible for the given room.
 * Admins receive alerts for all rooms. Operators/viewers only for assigned rooms.
 *
 * Priority order:
 * 1. Per-user webhooks (users with personal Discord webhook configured)
 * 2. Per-room webhooks (room-level Discord webhook configured in room settings)
 * 3. Global env webhook (DISCORD_WEBHOOK_URL)
 */
export async function sendNotificationToRoomUsers(
  users: User[],
  roomId: string,
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<void> {
  // Check if this alert type is enabled for the room
  if (!isAlertTypeEnabledForRoom(room, alert.type)) {
    console.log(
      `[Notification] Alert type "${alert.type}" is disabled for room ${room?.name ?? roomId} — skipping`
    )
    return
  }

  const responsible = users.filter((u) => {
    if (!u.isActive) return false
    if (u.role === 'admin') return true
    // assignedRooms may contain ObjectId objects from MongoDB lean() — stringify both sides
    return u.assignedRooms.some((r) => String(r) === String(roomId))
  })

  console.log(
    `[Notification] Alert "${alert.type}" (${alert.severity}) for room ${room?.name ?? roomId}` +
    ` → ${responsible.length}/${users.length} users responsible`
  )

  // 1. Send per-user webhooks to users who have them configured
  const withWebhook = responsible.filter(
    (u) => u.notificationPreferences?.discord && u.notificationPreferences?.discordWebhookUrl
  )
  const withoutWebhook = responsible.filter(
    (u) => !(u.notificationPreferences?.discord && u.notificationPreferences?.discordWebhookUrl)
  )

  if (withWebhook.length > 0) {
    await Promise.all(
      withWebhook.map((u) => {
        console.log(`[Notification] Sending to user (personal webhook): ${u.email}`)
        return sendNotificationToUser(u, alert, room, node)
      })
    )
  }

  // If all responsible users have personal webhooks, we're done
  if (withoutWebhook.length === 0) return

  // 2. For remaining users without personal webhooks, try per-room webhooks
  console.log(
    `[Notification] ${withoutWebhook.length} user(s) without personal webhook — trying room/global fallback`
  )
  const roomNotif = room?.notifications
  if (roomNotif) {
    let sentViaRoom = false
    if (roomNotif.discord?.enabled && roomNotif.discord?.webhookUrl) {
      console.log(`[Notification] Using room-level Discord webhook for ${room?.name}`)
      const ok = await sendDiscordNotificationWithConfig(roomNotif.discord.webhookUrl, alert, room, node)
      if (ok) sentViaRoom = true
    }
    if (sentViaRoom) return
  }

  // 3. Fallback: global env webhooks
  console.log('[Notification] No room webhooks — trying global env fallback')
  const globalResult = await sendNotification(alert, room, node)
  if (!globalResult.discord) {
    console.log('[Notification] No global webhook configured either — notification not sent')
  }
}

/**
 * Send notification via global env webhook (used for /api/notify and testNotifications).
 */
export async function sendNotification(
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<{ discord: boolean }> {
  const config = getConfig()

  if (config.discord?.enabled) {
    const discord = await sendDiscordNotificationWithConfig(config.discord.webhookUrl, alert, room, node)
    return { discord }
  }

  return { discord: false }
}

/**
 * Send ML alerts to all channels via global env webhook.
 */
export async function sendMLAlerts(
  anomaly: AnomalyDetectionResult,
  userFriendlyAnomaly: UserFriendlyAnomaly | undefined,
  userFriendlyPrediction: UserFriendlyPrediction,
  room?: Room | null,
  node?: SensorNode | null
): Promise<{ discord: boolean }> {
  const config = getConfig()
  const results = { discord: false }

  // Send anomaly alerts if anomaly detected
  if (anomaly.isAnomaly && userFriendlyAnomaly) {
    if (config.discord?.enabled) {
      results.discord = await sendDiscordAnomalyAlert(anomaly, userFriendlyAnomaly, room, node)
    }
  }

  // Send prediction warnings if risk level is not safe
  if (userFriendlyPrediction.riskLevel !== 'safe') {
    if (config.discord?.enabled) {
      results.discord = results.discord || await sendDiscordPredictionWarning(userFriendlyPrediction, room)
    }
  }

  return results
}

/**
 * Test notification configuration
 */
export async function testNotifications(): Promise<{
  discord: { configured: boolean; test: boolean }
}> {
  const config = getConfig()

  const testAlert: Alert = {
    _id: 'test',
    roomId: null,
    nodeId: null,
    type: 'system',
    severity: 'info',
    message: th.notification.testMessage,
    data: {},
    isResolved: false,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date(),
  }

  const results = {
    discord: {
      configured: config.discord?.enabled || false,
      test: false,
    },
  }

  if (config.discord?.enabled) {
    results.discord.test = await sendDiscordNotification(testAlert)
  }

  return results
}
