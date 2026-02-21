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

// Get notification config from environment
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

  const alertTypeLabel =
    th.notification.alertTypes[alert.type as keyof typeof th.notification.alertTypes] ??
    th.notification.alertTypes.system

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

  const embed = {
    title: `${severityEmojis[alert.severity]} ${alertTypeLabel}`,
    description: alert.message,
    color: severityColors[alert.severity] || 0x808080,
    fields: embedFields,
    footer: {
      text: th.notification.footer,
    },
    timestamp: new Date().toISOString(),
  }

  // Add data fields if available
  if (alert.data.value !== undefined) {
    embed.fields.push({
      name: th.notification.fieldValue,
      value: `${alert.data.value}`,
      inline: true,
    })
  }
  if (alert.data.threshold !== undefined) {
    embed.fields.push({
      name: th.notification.fieldThreshold,
      value: `${alert.data.threshold}`,
      inline: true,
    })
  }
  if (alert.data.anomalyScore !== undefined) {
    embed.fields.push({
      name: th.notification.fieldAnomalyScore,
      value: `${(alert.data.anomalyScore * 100).toFixed(0)}%`,
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

  const emoji = severityEmojis[alert.severity]
  const roomName = room?.name || th.notification.unknown
  const nodeName = node?.name || alert.nodeId || th.notification.unknown
  const time = new Date(alert.createdAt).toLocaleString('th-TH')

  let message = `\n${emoji} แจ้งเตือน: ${alert.message}\n`
  message += `${th.notification.fieldRoom}: ${roomName}\n`
  message += `${th.notification.fieldSensor}: ${nodeName}\n`
  message += `${th.notification.fieldTime}: ${time}`

  if (alert.data.value !== undefined) {
    message += `\n${th.notification.fieldValue}: ${alert.data.value}`
  }
  if (alert.data.threshold !== undefined) {
    message += `\n${th.notification.fieldThreshold}: ${alert.data.threshold}`
  }
  if (alert.data.anomalyScore !== undefined) {
    message += `\n${th.notification.fieldAnomalyScore}: ${(alert.data.anomalyScore * 100).toFixed(0)}%`
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
 * Send notification to all configured channels
 * getConfig() ถูกเรียกครั้งเดียวแล้วส่งต่อไปยัง channel functions
 */
export async function sendNotification(
  alert: Alert,
  room?: Room | null,
  node?: SensorNode | null
): Promise<{ discord: boolean; line: boolean }> {
  const config = getConfig()
  const tasks: Promise<boolean>[] = []

  if (config.discord?.enabled) {
    tasks.push(sendDiscordNotification(alert, room, node))
  } else {
    tasks.push(Promise.resolve(false))
  }

  if (config.line?.enabled) {
    tasks.push(sendLineNotification(alert, room, node))
  } else {
    tasks.push(Promise.resolve(false))
  }

  const [discordResult, lineResult] = await Promise.all(tasks)
  return { discord: discordResult, line: lineResult }
}

/**
 * Send ML alerts to all channels
 * getConfig() ถูกเรียกครั้งเดียวแล้วใช้ตลอดทั้งฟังก์ชัน
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
