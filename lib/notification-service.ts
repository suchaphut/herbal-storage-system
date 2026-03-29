/**
 * Notification Service for IoT Herbal Storage Monitoring System
 *
 * Supports:
 * - Discord Webhook notifications with rich embeds
 * - LINE Notify notifications
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
  line?: {
    enabled: boolean
    accessToken: string
  }
}

// Get notification config from environment (global fallback)
function getConfig(): NotificationConfig {
  return {
    discord: {
      enabled: !!process.env.DISCORD_WEBHOOK_URL,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    },
    line: {
      enabled: !!process.env.LINE_NOTIFY_TOKEN,
      accessToken: process.env.LINE_NOTIFY_TOKEN || '',
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
 * Internal: send a LINE Notify message with an explicit access token.
 */
async function sendLineNotificationWithConfig(
  accessToken: string,
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<boolean> {
  const emoji = severityEmojis[alert.severity]
  const roomName = room?.name || th.notification.unknown
  const nodeName = node?.name || alert.nodeId || th.notification.unknown
  const time = new Date(alert.createdAt).toLocaleString('th-TH')

  const sourceLabelsLine: Record<string, string> = {
    threshold: '📏 ค่าเกินขีดจำกัดจริง (Threshold)',
    ml_environmental: '🤖 ML ตรวจพบค่าผิดปกติ (Environmental)',
    ml_power: '🤖 ML ตรวจพบค่าผิดปกติ (Power)',
  }
  const sourceLine = alert.data.source ? (sourceLabelsLine[alert.data.source] ?? alert.data.source) : null

  let message = `\n${emoji} แจ้งเตือน: ${alert.message}\n`
  message += `${th.notification.fieldRoom}: ${roomName}\n`
  message += `${th.notification.fieldSensor}: ${nodeName}\n`
  message += `${th.notification.fieldTime}: ${time}`

  if (sourceLine) {
    message += `\n🔍 แหล่งที่มา: ${sourceLine}`
  }
  if (alert.data.value !== undefined) {
    message += `\n${th.notification.fieldValue}: ${alert.data.value}`
  }
  if (alert.data.threshold !== undefined) {
    message += `\n${th.notification.fieldThreshold}: ${alert.data.threshold}`
  }
  if (alert.data.anomalyScore !== undefined) {
    message += `\n${th.notification.fieldAnomalyScore}: ${(alert.data.anomalyScore * 100).toFixed(0)}%`
  }
  if (alert.data.offlineMinutes !== undefined) {
    message += `\n⏱️ ออฟไลน์: ${alert.data.offlineMinutes} นาที`
  }
  if (alert.data.lastSeen != null) {
    message += `\n📡 ส่งข้อมูลล่าสุด: ${new Date(String(alert.data.lastSeen)).toLocaleString('th-TH')}`
  }

  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${accessToken}`,
      },
      body: new URLSearchParams({ message }),
    })
    if (!response.ok) {
      console.error('[LINE] Failed to send notification:', response.status)
      return false
    }
    console.log('[LINE] Notification sent successfully')
    return true
  } catch (error) {
    console.error('[LINE] Error sending notification:', error)
    return false
  }
}

/**
 * Send notification to LINE via LINE Notify API
 */
export async function sendLineNotification(
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<boolean> {
  const config = getConfig()
  if (!config.line?.enabled) {
    console.log('[Notification] LINE Notify is not configured')
    return false
  }
  return sendLineNotificationWithConfig(config.line.accessToken, alert, room, node)
}

/**
 * Send ML anomaly notification to LINE
 */
export async function sendLineAnomalyAlert(
  anomaly: AnomalyDetectionResult,
  userFriendly: UserFriendlyAnomaly,
  room?: Room | null,
  node?: SensorNode | null
): Promise<boolean> {
  const config = getConfig()

  if (!config.line?.enabled) {
    console.log('[Notification] LINE Notify is not configured')
    return false
  }

  const emoji = severityEmojis[userFriendly.severity]
  const roomName = room?.name || th.notification.unknown
  const nodeName = node?.name || anomaly.nodeId || th.notification.unknown

  let message = `\n${emoji} ${userFriendly.type}\n`
  message += `${th.notification.fieldRoom}: ${roomName}\n`
  message += `${th.notification.fieldSensor}: ${nodeName}\n`
  message += `${th.notification.fieldTemp}: ${anomaly.actualValues.temperature.toFixed(1)}°C\n`
  message += `${th.notification.fieldHumidity}: ${anomaly.actualValues.humidity.toFixed(0)}%\n`
  message += `${th.notification.fieldAnomalyScore}: ${(anomaly.anomalyScore * 100).toFixed(0)}%\n\n`
  message += `${th.notification.fieldCauses}:\n`
  message += userFriendly.possibleCauses.slice(0, 2).map((c) => `• ${c}`).join('\n')
  message += `\n\n${th.notification.fieldRecommendation}:\n`
  message += userFriendly.recommendations.slice(0, 2).map((r) => `• ${r}`).join('\n')

  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${config.line.accessToken}`,
      },
      body: new URLSearchParams({ message }),
    })

    if (!response.ok) {
      console.error('[LINE] Failed to send anomaly alert:', response.status)
      return false
    }

    console.log('[LINE] Anomaly alert sent successfully')
    return true
  } catch (error) {
    console.error('[LINE] Error sending anomaly alert:', error)
    return false
  }
}

/**
 * Send ML prediction warning to LINE
 */
export async function sendLinePredictionWarning(
  prediction: UserFriendlyPrediction,
  room?: Room | null
): Promise<boolean> {
  const config = getConfig()

  if (!config.line?.enabled || prediction.riskLevel === 'safe') {
    return false
  }

  const emoji = prediction.riskLevel === 'danger' ? '🚨' : '⚠️'
  const roomName = room?.name || th.notification.unknown
  const trendText =
    prediction.trend === 'increasing'
      ? th.notification.trendUp
      : prediction.trend === 'decreasing'
        ? th.notification.trendDown
        : th.notification.trendStable

  let message = `\n${emoji} ${th.notification.predictionAlert}\n`
  message += `${th.notification.fieldRoom}: ${roomName}\n`
  message += `${th.notification.fieldTrend}: ${trendText}\n`
  message += `📊 ${prediction.summary}\n`
  message += `${th.notification.fieldRecommendation}: ${prediction.recommendation}`

  if (prediction.warningTime) {
    message += `\n${th.notification.expectedThreshold}: ${new Date(prediction.warningTime).toLocaleString('th-TH')}`
  }

  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${config.line.accessToken}`,
      },
      body: new URLSearchParams({ message }),
    })

    if (!response.ok) {
      console.error('[LINE] Failed to send prediction warning:', response.status)
      return false
    }

    console.log('[LINE] Prediction warning sent successfully')
    return true
  } catch (error) {
    console.error('[LINE] Error sending prediction warning:', error)
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
): Promise<{ discord: boolean; line: boolean }> {
  const prefs = user.notificationPreferences
  const tasks: [Promise<boolean>, Promise<boolean>] = [
    Promise.resolve(false),
    Promise.resolve(false),
  ]

  if (prefs?.discord && prefs.discordWebhookUrl) {
    tasks[0] = sendDiscordNotificationWithConfig(prefs.discordWebhookUrl, alert, room, node)
  }
  if (prefs?.line && prefs.lineAccessToken) {
    tasks[1] = sendLineNotificationWithConfig(prefs.lineAccessToken, alert, room, node)
  }

  const [discord, line] = await Promise.all(tasks)
  return { discord, line }
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
 * 1. Per-user webhooks (users with personal Discord/LINE configured)
 * 2. Per-room webhooks (room-level Discord/LINE configured in room settings)
 * 3. Global env webhooks (DISCORD_WEBHOOK_URL / LINE_NOTIFY_TOKEN)
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
    (u) =>
      (u.notificationPreferences?.discord && u.notificationPreferences?.discordWebhookUrl) ||
      (u.notificationPreferences?.line && u.notificationPreferences?.lineAccessToken)
  )
  const withoutWebhook = responsible.filter(
    (u) =>
      !(u.notificationPreferences?.discord && u.notificationPreferences?.discordWebhookUrl) &&
      !(u.notificationPreferences?.line && u.notificationPreferences?.lineAccessToken)
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
    if (roomNotif.line?.enabled && roomNotif.line?.accessToken) {
      console.log(`[Notification] Using room-level LINE token for ${room?.name}`)
      const ok = await sendLineNotificationWithConfig(roomNotif.line.accessToken, alert, room, node)
      if (ok) sentViaRoom = true
    }
    if (sentViaRoom) return
  }

  // 3. Fallback: global env webhooks
  console.log('[Notification] No room webhooks — trying global env fallback')
  const globalResult = await sendNotification(alert, room, node)
  if (!globalResult.discord && !globalResult.line) {
    console.log('[Notification] No global webhooks configured either — notification not sent')
  }
}

/**
 * Send notification via global env webhook (used for /api/notify and testNotifications).
 */
export async function sendNotification(
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<{ discord: boolean; line: boolean }> {
  const config = getConfig()
  const tasks: [Promise<boolean>, Promise<boolean>] = [
    Promise.resolve(false),
    Promise.resolve(false),
  ]

  if (config.discord?.enabled) {
    tasks[0] = sendDiscordNotificationWithConfig(config.discord.webhookUrl, alert, room, node)
  }
  if (config.line?.enabled) {
    tasks[1] = sendLineNotificationWithConfig(config.line.accessToken, alert, room, node)
  }

  const [discord, line] = await Promise.all(tasks)
  return { discord, line }
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
): Promise<{ discord: boolean; line: boolean }> {
  const config = getConfig()
  const results = { discord: false, line: false }

  // Send anomaly alerts if anomaly detected
  if (anomaly.isAnomaly && userFriendlyAnomaly) {
    const promises: Promise<boolean>[] = [
      config.discord?.enabled ? sendDiscordAnomalyAlert(anomaly, userFriendlyAnomaly, room, node) : Promise.resolve(false),
      config.line?.enabled ? sendLineAnomalyAlert(anomaly, userFriendlyAnomaly, room, node) : Promise.resolve(false),
    ]
    const [discordAnomaly, lineAnomaly] = await Promise.all(promises)
    results.discord = discordAnomaly
    results.line = lineAnomaly
  }

  // Send prediction warnings if risk level is not safe
  if (userFriendlyPrediction.riskLevel !== 'safe') {
    const promises: Promise<boolean>[] = [
      config.discord?.enabled ? sendDiscordPredictionWarning(userFriendlyPrediction, room) : Promise.resolve(false),
      config.line?.enabled ? sendLinePredictionWarning(userFriendlyPrediction, room) : Promise.resolve(false),
    ]
    const [discordPred, linePred] = await Promise.all(promises)
    results.discord = results.discord || discordPred
    results.line = results.line || linePred
  }

  return results
}

/**
 * Test notification configuration
 */
export async function testNotifications(): Promise<{
  discord: { configured: boolean; test: boolean }
  line: { configured: boolean; test: boolean }
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
    line: {
      configured: config.line?.enabled || false,
      test: false,
    },
  }

  if (config.discord?.enabled) {
    results.discord.test = await sendDiscordNotification(testAlert)
  }

  if (config.line?.enabled) {
    results.line.test = await sendLineNotification(testAlert)
  }

  return results
}
