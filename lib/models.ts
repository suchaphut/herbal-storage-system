import mongoose, { Schema } from 'mongoose'

/**
 * 1. Users Collection
 * เก็บข้อมูลผู้ใช้งานและบทบาท (Role)
 */
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['admin', 'operator', 'viewer'], 
    default: 'viewer' 
  },
  assignedRooms: [{ type: String }],
  notificationPreferences: {
    discord: { type: Boolean, default: false },
    discordWebhookUrl: { type: String, default: '' },
    line: { type: Boolean, default: false },
    lineAccessToken: { type: String, default: '' },
    email: { type: Boolean, default: true }
  },
  lastLogin: { type: Date, default: null },
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

/**
 * 2. Rooms Collection
 * ห้องเก็บยาสมุนไพรและการตั้งค่าเกณฑ์ (Thresholds)
 */
const RoomSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  location: { type: String },
  thresholds: {
    temperature: {
      min: { type: Number, default: 20 },
      max: { type: Number, default: 30 }
    },
    humidity: {
      min: { type: Number, default: 40 },
      max: { type: Number, default: 60 }
    }
  },
  notifications: {
    discord: {
      enabled: { type: Boolean, default: false },
      webhookUrl: { type: String, default: '' },
    },
    line: {
      enabled: { type: Boolean, default: false },
      accessToken: { type: String, default: '' },
    },
    alertOnThreshold: { type: Boolean, default: true },
    alertOnAnomaly: { type: Boolean, default: true },
    alertOnOffline: { type: Boolean, default: true },
  },
  externalWeather: {
    enabled: { type: Boolean, default: false },
    location: { type: String, default: 'ปราจีนบุรี' },
    coordinates: {
      lat: { type: Number, default: 14.0583 },
      lon: { type: Number, default: 101.3711 }
    }
  },
  acOptimization: {
    enabled: { type: Boolean, default: false },
    autoAdjust: { type: Boolean, default: false },
    energySavingMode: { type: Boolean, default: true },
    targetEfficiency: { type: Number, default: 80 }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

/**
 * 3. Sensor Nodes Collection
 * ข้อมูลอุปกรณ์ IoT โดยใช้ nodeId จาก WiFiManager เป็นหลัก
 */
const SensorNodeSchema = new Schema({
  nodeId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['environmental', 'power'], 
    default: 'environmental' 
  },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
  status: { 
    type: String, 
    enum: ['online', 'offline', 'warning'], 
    default: 'offline' 
  },
  lastSeen: { type: Date },
  config: {
    reportInterval: { type: Number, default: 60 }, // วินาที
    firmware: { type: String }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true })

/**
 * 4. Sensor Data Collection (Time Series)
 * ข้อมูลดิบจากเซ็นเซอร์
 */
const SensorDataSchema = new Schema({
  nodeId: { type: String, required: true, index: true },
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', index: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, required: true },
  readings: {
    // Environmental
    temperature: { type: Number },
    humidity: { type: Number },
    // Power
    voltage: { type: Number },
    current: { type: Number },
    power: { type: Number },
    energy: { type: Number }
  }
}, { timestamps: false })

SensorDataSchema.index({ roomId: 1, timestamp: -1 })
SensorDataSchema.index({ roomId: 1, type: 1, timestamp: -1 })
SensorDataSchema.index({ nodeId: 1, timestamp: -1 })
SensorDataSchema.index({ type: 1, nodeId: 1, timestamp: -1 })
SensorDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }) // Auto-delete after 90 days

/**
 * 5. Alerts Collection
 * เก็บข้อมูลการแจ้งเตือน
 */
const AlertSchema = new Schema({
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', index: true, default: null },
  nodeId: { type: String, default: null },
  type: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
  message: { type: String, required: true },
  data: {
    value: Number,
    threshold: Number,
    anomalyScore: Number,
    source: { type: String, enum: ['threshold', 'ml_environmental', 'ml_power'], default: null }
  },
  isResolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedBy: { type: String }
}, { timestamps: true })

// Export Models
export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema)
export const RoomModel = mongoose.models.Room || mongoose.model('Room', RoomSchema)
export const SensorNodeModel = mongoose.models.SensorNode || mongoose.model('SensorNode', SensorNodeSchema)
export const SensorDataModel = mongoose.models.SensorData || mongoose.model('SensorData', SensorDataSchema)
export const AlertModel = mongoose.models.Alert || mongoose.model('Alert', AlertSchema)

/**
 * 6b. ML Model Metrics Collection
 * เก็บประวัติความแม่นยำของ Model (MAE, RMSE, MAPE) ต่อ node
 * ใช้สำหรับ Model Drift Analysis ในระยะยาว
 */
const MLModelMetricsSchema = new Schema({
  nodeId: { type: String, required: true, index: true },
  roomId: { type: String, default: null, index: true },
  modelType: { type: String, required: true }, // e.g. 'HoltWinters-v2.0', 'Prophet-v1.0'
  mae: { type: Number, required: true },
  rmse: { type: Number, required: true },
  mape: { type: Number, required: true },
  trainingPoints: { type: Number, default: null },
  recordedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false })

MLModelMetricsSchema.index({ nodeId: 1, recordedAt: -1 })
MLModelMetricsSchema.index({ roomId: 1, recordedAt: -1 })

export const MLModelMetricsModel =
  mongoose.models.MLModelMetrics ||
  mongoose.model('MLModelMetrics', MLModelMetricsSchema)

/**
 * 6. Audit Logs Collection
 * บันทึกการกระทำของผู้ใช้ (login, CRUD ต่างๆ) สำหรับตรวจสอบและ compliance
 */
const AuditActionEnum = [
  'login', 'logout', 'login_failed',
  'user_create', 'user_update', 'user_delete', 'user_password_change',
  'room_create', 'room_update', 'room_delete',
  'sensor_create', 'sensor_update', 'sensor_delete',
  'alert_resolve', 'settings_update', 'data_export'
] as const

const AuditResourceEnum = ['auth', 'user', 'room', 'sensor', 'alert', 'settings', 'data'] as const

const AuditLogSchema = new Schema({
  userId: { type: String, default: null, index: true },
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  userRole: { type: String, enum: ['admin', 'operator', 'viewer'], default: null },
  action: { type: String, required: true, enum: AuditActionEnum, index: true },
  resource: { type: String, required: true, enum: AuditResourceEnum, index: true },
  resourceId: { type: String, default: null },
  details: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  success: { type: Boolean, required: true, index: true },
}, { timestamps: true })

AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 }) // Auto-delete after 1 year
AuditLogSchema.index({ userId: 1, createdAt: -1 })

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)

/**
 * 7. External Weather Data Collection
 * เก็บข้อมูลอากาศภายนอกจาก OpenWeatherMap / TMD
 */
const ExternalWeatherDataSchema = new Schema({
  location: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  pressure: { type: Number, required: true },
  feelsLike: { type: Number },
  weatherCondition: { type: String },
  weatherMain: { type: String },
  windSpeed: { type: Number },
  cloudiness: { type: Number },
  source: { type: String, enum: ['TMD', 'OpenWeatherMap'], required: true },
  coordinates: {
    lat: { type: Number },
    lon: { type: Number }
  }
}, { timestamps: false })

ExternalWeatherDataSchema.index({ location: 1, timestamp: -1 })
ExternalWeatherDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }) // Auto-delete after 30 days

export const ExternalWeatherDataModel = 
  mongoose.models.ExternalWeatherData || 
  mongoose.model('ExternalWeatherData', ExternalWeatherDataSchema)
