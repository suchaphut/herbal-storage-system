// MongoDB Schema Types for IoT Monitoring System

export type SensorNodeType = 'environmental' | 'power'

export interface RoomNotificationSettings {
  discord: {
    enabled: boolean
    webhookUrl: string
  }
  line: {
    enabled: boolean
    accessToken: string
  }
  alertOnThreshold: boolean
  alertOnAnomaly: boolean
  alertOnOffline: boolean
}

export interface Room {
  _id: string
  name: string
  description: string
  location: string
  thresholds: {
    temperature: { min: number; max: number }
    humidity: { min: number; max: number }
  }
  notifications: RoomNotificationSettings
  externalWeather?: {
    enabled: boolean
    location: string // e.g., "ปราจีนบุรี"
    coordinates?: {
      lat: number
      lon: number
    }
  }
  acOptimization?: {
    enabled: boolean
    autoAdjust: boolean // true = ปรับอัตโนมัติ, false = แค่แนะนำ
    energySavingMode: boolean
    targetEfficiency: number // 0-100 (%)
  }
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface SensorNode {
  _id: string
  nodeId: string // Primary identifier - set on ESP32 via WiFiManager
  name: string
  type: SensorNodeType
  roomId: string | null // Reference to Room
  status: 'online' | 'offline' | 'warning'
  lastSeen: Date | null
  config: {
    reportInterval: number // seconds
    firmware: string
  }
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

// Base sensor data interface
export interface BaseSensorData {
  _id: string
  nodeId: string // Reference to SensorNode.nodeId
  roomId: string | null // Denormalized for query performance
  timestamp: Date
  metadata?: Record<string, unknown>
}

// Environmental sensor data (Temperature/Humidity)
export interface EnvironmentalSensorData extends BaseSensorData {
  type: 'environmental'
  readings: {
    temperature: number // Celsius
    humidity: number // Percentage
  }
}

// Power/Current sensor data
export interface PowerSensorData extends BaseSensorData {
  type: 'power'
  readings: {
    voltage: number // Volts
    current: number // Amperes
    power: number // Watts
    energy: number // kWh
  }
}

export type SensorData = EnvironmentalSensorData | PowerSensorData

// External Weather Data (from Thai Meteorological Department / OpenWeatherMap)
export interface ExternalWeatherData {
  location: string // e.g., "ปราจีนบุรี"
  timestamp: Date
  temperature: number // Celsius
  humidity: number // Percentage
  pressure: number // hPa
  feelsLike?: number // Celsius
  weatherCondition: string // e.g., "ท้องฟ้าแจ่มใส", "ฝนตก"
  weatherMain: string // e.g., "Clear", "Rain", "Clouds"
  windSpeed?: number // m/s
  cloudiness?: number // Percentage
  source: 'TMD' | 'OpenWeatherMap'
  coordinates?: {
    lat: number
    lon: number
  }
}

// User Role Type
export type UserRole = 'admin' | 'operator' | 'viewer'

// Permission definitions for RBAC
export interface RolePermissions {
  // User Management
  canManageUsers: boolean
  canViewUsers: boolean
  // Room Management
  canCreateRoom: boolean
  canEditRoom: boolean
  canDeleteRoom: boolean
  canViewRooms: boolean
  // Sensor Management
  canCreateSensor: boolean
  canEditSensor: boolean
  canDeleteSensor: boolean
  canViewSensors: boolean
  canManageAssignedSensorsOnly: boolean
  // Data & Reports
  canViewRealtimeData: boolean
  canViewHistoricalData: boolean
  canViewReports: boolean
  canExportData: boolean
  // Settings
  canEditSettings: boolean
  canViewSettings: boolean
  // Alerts
  canResolveAlert: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canViewUsers: true,
    canCreateRoom: true,
    canEditRoom: true,
    canDeleteRoom: true,
    canViewRooms: true,
    canCreateSensor: true,
    canEditSensor: true,
    canDeleteSensor: true,
    canViewSensors: true,
    canManageAssignedSensorsOnly: false,
    canViewRealtimeData: true,
    canViewHistoricalData: true,
    canViewReports: true,
    canExportData: true,
    canEditSettings: true,
    canViewSettings: true,
    canResolveAlert: true,
  },
  operator: {
    canManageUsers: false,
    canViewUsers: false,
    canCreateRoom: false,
    canEditRoom: false,
    canDeleteRoom: false,
    canViewRooms: true,
    canCreateSensor: false,
    canEditSensor: true,
    canDeleteSensor: false,
    canViewSensors: true,
    canManageAssignedSensorsOnly: true,
    canViewRealtimeData: true,
    canViewHistoricalData: true,
    canViewReports: true,
    canExportData: false,
    canEditSettings: false,
    canViewSettings: true,
    canResolveAlert: true,
  },
  viewer: {
    canManageUsers: false,
    canViewUsers: false,
    canCreateRoom: false,
    canEditRoom: false,
    canDeleteRoom: false,
    canViewRooms: true,
    canCreateSensor: false,
    canEditSensor: false,
    canDeleteSensor: false,
    canViewSensors: true,
    canManageAssignedSensorsOnly: false,
    canViewRealtimeData: true,
    canViewHistoricalData: true,
    canViewReports: true,
    canExportData: false,
    canEditSettings: false,
    canViewSettings: false,
    canResolveAlert: false,
  },
}

export interface User {
  _id: string
  email: string
  passwordHash: string
  name: string
  role: UserRole
  assignedRooms: string[] // For Operator role - room IDs they can manage
  notificationPreferences: {
    discord: boolean
    discordWebhookUrl: string
    line: boolean
    lineAccessToken: string
    email: boolean
  }
  lastLogin: Date | null
  loginAttempts: number
  lockedUntil: Date | null
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

// User without sensitive data (for client-side)
export interface SafeUser {
  _id: string
  email: string
  name: string
  role: UserRole
  assignedRooms: string[]
  notificationPreferences: {
    discord: boolean
    hasDiscordWebhook: boolean  // true if webhook URL is configured (URL itself is not sent to client)
    line: boolean
    hasLineToken: boolean       // true if LINE token is configured (token itself is not sent to client)
    email: boolean
  }
  lastLogin: Date | null
  createdAt: Date
  isActive: boolean
}

// Session/JWT Payload
export interface AuthSession {
  userId: string
  email: string
  name: string
  role: UserRole
  assignedRooms: string[]
  permissions: RolePermissions
  iat: number
  exp: number
}

// Login Request/Response
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  user?: SafeUser
  token?: string
  error?: string
}

// User Management Types
export interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: UserRole
  assignedRooms?: string[]
}

export interface UpdateUserRequest {
  email?: string
  name?: string
  role?: UserRole
  assignedRooms?: string[]
  notificationPreferences?: {
    discord: boolean
    discordWebhookUrl?: string
    line: boolean
    lineAccessToken?: string
    email: boolean
  }
  isActive?: boolean
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertType = 'threshold' | 'anomaly' | 'offline' | 'system'

export interface Alert {
  _id: string
  roomId: string | null
  nodeId: string | null
  type: AlertType
  severity: AlertSeverity
  message: string
  data: {
    value?: number
    threshold?: number
    anomalyScore?: number
    source?: 'threshold' | 'ml_environmental' | 'ml_power'
    lastSeen?: Date | string | null
    offlineMinutes?: number
    errorKey?: string
    [key: string]: unknown
  }
  isResolved: boolean
  resolvedAt: Date | null
  resolvedBy: string | null
  createdAt: Date
}

export interface SystemLog {
  _id: string
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  message: string
  data?: Record<string, unknown>
  createdAt: Date
}

// Audit Log Types
export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_password_change'
  | 'room_create'
  | 'room_update'
  | 'room_delete'
  | 'sensor_create'
  | 'sensor_update'
  | 'sensor_delete'
  | 'alert_resolve'
  | 'settings_update'
  | 'data_export'

export interface AuditLog {
  _id: string
  userId: string | null // null for failed login attempts
  userEmail: string
  userName: string
  userRole: UserRole | null
  action: AuditAction
  resource: 'auth' | 'user' | 'room' | 'sensor' | 'alert' | 'settings' | 'data'
  resourceId: string | null // ID of affected resource
  details: string // Human-readable description
  metadata?: Record<string, unknown> // Additional data
  ipAddress: string | null
  userAgent: string | null
  success: boolean
  createdAt: Date
}

export interface AuditLogFilter {
  userId?: string
  action?: AuditAction
  resource?: string
  startDate?: Date
  endDate?: Date
  success?: boolean
}

// ML Configuration Types
export interface HoltWintersParams {
  alpha: number // Level smoothing (0.1-0.3)
  beta: number // Trend smoothing (0.1-0.2)
  gamma: number // Seasonal smoothing (0.1-0.3)
  seasonLength: number // 24 for hourly, 288 for 5-min intervals
}

export interface MLModelConfig {
  prediction: {
    alpha: number
    beta: number
    gamma: number
    seasonLength: number
    horizonHours: number
  }
  anomaly: {
    zScoreThreshold: number
    isolationForestContamination: number
    minSamplesForTraining: number
    rapidChangeThresholds: {
      temperature: number // Max change per interval
      humidity: number
    }
  }
}

// ML Prediction Types
export interface PredictionResult {
  roomId: string
  nodeId: string
  timestamp: Date
  predictions: {
    time: Date
    temperature: number
    humidity: number
    confidence: number
    upperBound: {
      temperature: number
      humidity: number
    }
    lowerBound: {
      temperature: number
      humidity: number
    }
  }[]
  /** ค่าจริงในช่วง validation (backtest) */
  actuals?: { time: Date; temperature: number; humidity: number }[]
  /** ค่าพยากรณ์ในช่วง validation (สำหรับแสดงกราฟจริง vs พยากรณ์) */
  backtestPredicted?: { time: Date; temperature: number; humidity: number }[]
  model: string
  generatedAt: Date
  metrics: PredictionMetrics
}

export interface PredictionMetrics {
  mae: number // Mean Absolute Error
  rmse: number // Root Mean Square Error
  mape: number // Mean Absolute Percentage Error (%)
}

export interface AnomalyDetectionResult {
  roomId: string
  nodeId: string
  timestamp: Date
  isAnomaly: boolean
  anomalyScore: number
  severity: 'normal' | 'warning' | 'critical'
  anomalyType: AnomalyType[]
  contributingFactors: {
    factor: string
    contribution: number
    zScore: number
  }[]
  expectedValues: {
    temperature: number
    humidity: number
  }
  actualValues: {
    temperature: number
    humidity: number
  }
  dynamicThresholds: {
    temperature: { min: number; max: number }
    humidity: { min: number; max: number }
  }
  /** ชื่อโมเดลที่ใช้ตรวจจับ anomaly เช่น 'Isolation Forest + Z-Score' หรือ 'Ensemble (IF+LSTM+SVM) + Z-Score' */
  modelName?: string
}

export type AnomalyType =
  | 'threshold_exceeded'
  | 'rapid_change'
  | 'statistical_outlier'
  | 'sensor_malfunction'
  | 'pattern_deviation'
  // Current/Power sensor
  | 'current_high'
  | 'current_low'
  | 'device_off_expected'

// User-Friendly Result Types
export interface UserFriendlyPrediction {
  summary: string
  confidence: 'high' | 'medium' | 'low'
  recommendation: string
  trend: 'increasing' | 'stable' | 'decreasing'
  warningTime?: Date // When threshold will be exceeded
  riskLevel: 'safe' | 'caution' | 'danger'
}

export interface UserFriendlyAnomaly {
  type: string
  severity: 'warning' | 'critical'
  description: string
  possibleCauses: string[]
  recommendations: string[]
}

/** ผลการตรวจจับความผิดปกติของ Current Sensor (แอร์/เครื่องปรับอากาศ) */
export interface PowerAnomalyResult {
  nodeId: string
  roomId: string | null
  timestamp: Date
  isAnomaly: boolean
  anomalyScore: number
  anomalyType: ('current_high' | 'current_low' | 'device_off_expected' | 'statistical_outlier')[]
  message: string
  current: number
  power: number
  expectedRange?: { min: number; max: number }
  deviceExpectedOn?: boolean
}

export interface MLAnalysisResult {
  prediction: PredictionResult
  anomaly: AnomalyDetectionResult
  userFriendly: {
    prediction: UserFriendlyPrediction
    anomaly?: UserFriendlyAnomaly
  }
  /** ผลวิเคราะห์แอร์/กระแสไฟ (Power Sensor) — การพยากรณ์และ Anomaly Detection */
  powerAnomaly?: PowerAnomalyResult
  /** สรุปการพยากรณ์กระแส/กำลังไฟ (ถ้ามี) */
  powerPredictionSummary?: string
  processedAt: Date
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// สถานะเครื่องปรับอากาศ (จาก sensor-power)
export interface ACUnitStatus {
  nodeId: string
  name?: string
  power: number // วัตต์
  current: number // แอมแปร์
  isOn: boolean
}

export interface ACRoomStatus {
  roomId: string
  roomName: string
  units: ACUnitStatus[]
  onCount: number
  offCount: number
  totalPowerWatts: number
}

export interface ACStatusSummary {
  totalUnits: number
  onCount: number
  offCount: number
  totalPowerWatts: number
}

export interface ACStatus {
  summary: ACStatusSummary
  byRoom: ACRoomStatus[]
}

// Dashboard Stats
export interface DashboardStats {
  totalRooms: number
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  activeAlerts: number
  criticalAlerts: number
  /** สถานะเครื่องปรับอากาศจาก power sensor (มีเมื่อมีโหนด type=power) */
  acStatus?: ACStatus
}

// ML Model Metrics (for drift analysis)
export interface MLModelMetrics {
  _id?: string
  nodeId: string
  roomId: string | null
  modelType: string
  mae: number
  rmse: number
  mape: number
  trainingPoints: number | null
  recordedAt: Date
}

// Time Series Aggregation
export interface TimeSeriesPoint {
  timestamp: Date
  avgTemperature: number
  avgHumidity: number
  minTemperature: number
  maxTemperature: number
  minHumidity: number
  maxHumidity: number
  count: number
}

// Climate Analysis (Inside vs Outside)
export interface ClimateAnalysis {
  roomId: string
  timestamp: Date
  inside: {
    temperature: number
    humidity: number
  }
  outside: {
    temperature: number
    humidity: number
    weatherCondition: string
  }
  delta: {
    temperature: number // inside - outside
    humidity: number
  }
  heatLoad: number // Estimated heat load (W/m²)
  efficiency: number // AC efficiency score (0-100)
  recommendation: string
  // ML-enhanced fields (optional — present when ENABLE_PYTHON_ML=1)
  mlPrediction?: {
    predictedIndoorTemp6h: number
    predictedIndoorHumidity6h: number
    trend: 'warming' | 'cooling' | 'stable'
    confidence: number // 0-1
    usesExternalWeather: boolean
  }
  mlModel?: {
    name: string
    version: string
    mae?: number
    rmse?: number
    mape?: number
    trainingPoints?: number
  }
}

// AC Optimization Recommendation
export interface ACRecommendation {
  roomId: string
  timestamp: Date
  currentStatus: {
    temperature: number
    humidity: number
    acPower: number // Current AC power consumption (W)
    acRunning: boolean
  }
  externalConditions: {
    temperature: number
    humidity: number
    weatherCondition: string
  }
  recommendation: {
    action: 'increase' | 'decrease' | 'maintain' | 'turn_off' | 'turn_on'
    targetTemperature?: number
    reason: string
    energySavingPotential: number // Percentage
    priority: 'low' | 'medium' | 'high'
  }
  forecast: {
    nextHourTrend: 'warming' | 'cooling' | 'stable'
    suggestedPreemptiveAction?: string
  }
  generatedAt: Date
  // ML-enhanced fields (optional — present when RL model is trained)
  rlRecommendation?: {
    action: string
    confidence: number // 0-1
    qValues?: Record<string, number>
    energySavingPotential?: number
    totalEpisodes?: number
  }
  mlModel?: {
    name: string
    totalEpisodes: number
    thermalModelMAE?: number | null
  }
}
