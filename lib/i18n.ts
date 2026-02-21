/**
 * Localization strings (Thai) for IoT Herbal Storage Monitoring System
 *
 * Centralizes all user-facing Thai text so that:
 * - Strings can be updated in one place
 * - Future i18n support (e.g. English) requires only adding a new locale object
 */

export const th = {
  // ─── Alert messages (ingest route / AlertService) ───────────────────────────
  alert: {
    temperatureHigh: (value: number) =>
      `อุณหภูมิสูงเกินค่าที่กำหนด (${value.toFixed(1)}°C)`,
    temperatureLow: (value: number) =>
      `อุณหภูมิต่ำกว่าค่าที่กำหนด (${value.toFixed(1)}°C)`,
    humidityHigh: (value: number) =>
      `ความชื้นสูงเกินค่าที่กำหนด (${value.toFixed(1)}%)`,
    humidityLow: (value: number) =>
      `ความชื้นต่ำกว่าค่าที่กำหนด (${value.toFixed(1)}%)`,
    anomalyDetected: (scorePct: number) =>
      `ตรวจพบค่าผิดปกติ (คะแนน: ${scorePct.toFixed(0)}%)`,
  },

  // ─── Anomaly type descriptions ───────────────────────────────────────────────
  anomaly: {
    thresholdExceeded: 'ค่าเกินขีดจำกัดที่กำหนด',
    rapidChange: 'อุณหภูมิ/ความชื้นเปลี่ยนแปลงเร็วผิดปกติ',
    sensorMalfunction: 'เซ็นเซอร์อาจทำงานผิดปกติ',
    statisticalOutlier: 'ค่าที่วัดได้ผิดปกติจากรูปแบบปกติ',
    generic: 'ตรวจพบค่าผิดปกติ',
    description: (type: string, scorePct: number) =>
      `ตรวจพบความผิดปกติ: ${type} (คะแนน ${scorePct.toFixed(0)}%)`,
  },

  // ─── Anomaly possible causes ─────────────────────────────────────────────────
  cause: {
    hvacMalfunction: 'ระบบควบคุมสภาพแวดล้อมทำงานผิดปกติ',
    doorLeftOpen: 'มีการเปิดประตูค้างเป็นเวลานาน',
    doorOpen: 'อาจมีการเปิดประตูค้าง',
    coolingSystemToggle: 'ระบบทำความเย็นเปิด/ปิดกะทันหัน',
    sensorDamaged: 'เซ็นเซอร์ชำรุดหรือต้องการการบำรุงรักษา',
    sensorConnection: 'การเชื่อมต่อเซ็นเซอร์มีปัญหา',
    externalFactor: 'มีปัจจัยภายนอกที่ส่งผลต่อสภาพแวดล้อม',
  },

  // ─── Anomaly recommendations ─────────────────────────────────────────────────
  recommendation: {
    checkHvac: 'ตรวจสอบระบบปรับอากาศและเครื่องลดความชื้น',
    checkDoor: 'ตรวจสอบว่าประตูปิดสนิท',
    checkCooling: 'ตรวจสอบการทำงานของระบบควบคุมอุณหภูมิ',
    checkSensor: 'ตรวจสอบสภาพเซ็นเซอร์และการเชื่อมต่อ',
    replaceSensor: 'พิจารณาเปลี่ยนเซ็นเซอร์หากจำเป็น',
    checkExternal: 'ตรวจสอบปัจจัยภายนอกที่อาจส่งผลกระทบ',
    checkRoom: 'ตรวจสอบสภาพแวดล้อมในห้องเก็บยา',
    contactAdmin: 'ติดต่อผู้ดูแลระบบหากปัญหายังคงอยู่',
  },

  // ─── Prediction summaries ────────────────────────────────────────────────────
  prediction: {
    increasing: (tempC: number, hum: number, hours: number) =>
      `คาดการณ์ว่าอุณหภูมิจะเพิ่มขึ้นถึง ${tempC.toFixed(1)}°C และความชื้น ${hum.toFixed(0)}% ภายใน ${hours} ชั่วโมง`,
    decreasing: (tempC: number, hum: number, hours: number) =>
      `คาดการณ์ว่าอุณหภูมิจะลดลงถึง ${tempC.toFixed(1)}°C และความชื้น ${hum.toFixed(0)}% ภายใน ${hours} ชั่วโมง`,
    stable: (tempC: number, hum: number) =>
      `สภาพแวดล้อมคาดว่าจะคงที่ที่อุณหภูมิ ${tempC.toFixed(1)}°C และความชื้น ${hum.toFixed(0)}%`,
  },

  // ─── Prediction recommendations ──────────────────────────────────────────────
  predictionRec: {
    tempHigh: 'แนะนำให้เปิดเครื่องปรับอากาศเพิ่มหรือตรวจสอบระบบทำความเย็น',
    humHigh: 'แนะนำให้เปิดเครื่องลดความชื้นหรือระบายอากาศ',
    danger: 'ตรวจสอบระบบควบคุมสภาพแวดล้อมโดยเร่งด่วน',
    caution: 'เฝ้าระวังและเตรียมพร้อมปรับระบบควบคุมสภาพแวดล้อม',
    safe: 'สภาพแวดล้อมอยู่ในเกณฑ์ปกติ ไม่จำเป็นต้องดำเนินการใด',
  },

  // ─── Power anomaly messages ───────────────────────────────────────────────────
  power: {
    deviceOff: 'ตรวจพบกระแสไฟ = 0 ทั้งที่อุปกรณ์ควรทำงาน (แอร์/เครื่องปรับอากาศอาจดับ)',
    currentHigh: (current: number) =>
      `แอร์มีการกินกระแสไฟมากกว่าปกติ (${current.toFixed(2)} A) - แอร์อาจจะชำรุดหรือคอมเพรสเซอร์มีปัญหา`,
    currentLow: (current: number) =>
      `กระแสไฟต่ำผิดปกติ (${current.toFixed(2)} A)`,
    ifAnomaly: 'ตรวจพบรูปแบบกระแส/กำลังไฟผิดปกติจากประวัติ (Isolation Forest)',
    normal: 'ปกติ',
    anomalyGeneric: 'ตรวจพบความผิดปกติของกระแสไฟ',
  },

  // ─── Notification channel labels ─────────────────────────────────────────────
  notification: {
    alertTypes: {
      threshold: 'ค่าเกินกำหนด',
      anomaly: 'ตรวจพบค่าผิดปกติ',
      offline: 'เซ็นเซอร์ออฟไลน์',
      system: 'แจ้งเตือนระบบ',
    },
    footer: 'ระบบติดตามห้องเก็บยาสมุนไพร | Herbal Storage Monitor',
    footerML: 'ระบบติดตามห้องเก็บยาสมุนไพร | ML Anomaly Detection',
    footerPrediction: 'ระบบติดตามห้องเก็บยาสมุนไพร | ML Prediction',
    testMessage: 'ทดสอบการแจ้งเตือน - Test Notification',
    trendUp: 'เพิ่มขึ้น ↑',
    trendDown: 'ลดลง ↓',
    trendStable: 'คงที่ →',
    confidenceHigh: 'สูง',
    confidenceMedium: 'ปานกลาง',
    confidenceLow: 'ต่ำ',
    fieldRoom: '📍 ห้อง',
    fieldSensor: '📡 เซ็นเซอร์',
    fieldTime: '⏰ เวลา',
    fieldValue: '📊 ค่าที่วัดได้',
    fieldThreshold: '📏 ค่ากำหนด',
    fieldAnomalyScore: '🎯 คะแนนความผิดปกติ',
    fieldTemp: '🌡️ อุณหภูมิ',
    fieldHumidity: '💧 ความชื้น',
    fieldAnomalyType: '📋 ประเภทความผิดปกติ',
    fieldCauses: '❓ สาเหตุที่เป็นไปได้',
    fieldRecommendation: '💡 คำแนะนำ',
    fieldTrend: '📈 แนวโน้ม',
    fieldConfidence: '🎯 ความเชื่อมั่น',
    fieldWarningTime: '⏰ เวลาที่คาดว่าจะเกินขีดจำกัด',
    unknown: 'ไม่ระบุ',
    unspecified: 'ไม่ทราบ',
    checkSystem: 'ตรวจสอบระบบ',
    predictionAlert: 'การพยากรณ์แจ้งเตือน',
    expectedThreshold: 'คาดว่าจะเกินขีดจำกัด',
    expectedValue: (expected: number) => `คาดหวัง: ${expected.toFixed(1)}°C`,
    expectedHumidity: (expected: number) => `คาดหวัง: ${expected.toFixed(0)}%`,
  },

  // ─── API / ingest messages ────────────────────────────────────────────────────
  api: {
    ingestHint: 'ส่ง POST กับ body: { nodeId, type, readings }',
    noSensors: 'ยังไม่มีเซ็นเซอร์ - รัน seed หรือเพิ่มจาก Dashboard',
    unknownNodeHint:
      'เรียก GET /api/data/ingest เพื่อดู nodeId ที่ลงทะเบียนแล้ว หรือรัน node scripts/seed-mongodb.js',
  },
} as const

export type Locale = typeof th
