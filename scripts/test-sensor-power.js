/**
 * Test script: ส่งข้อมูล Power/Current Sensor (แอร์ เครื่องปรับอากาศ) ไปที่ API
 * ใช้สำหรับทดสอบระบบก่อนต่อเซ็นเซอร์กระแสจริง
 *
 * วิธีใช้: node scripts/test-sensor-power.js
 * ต้องรันเซิร์ฟเวอร์ (pnpm dev) และมีเซ็นเซอร์ type: power กับ nodeId นี้ในระบบแล้ว
 * (ลงทะเบียนจาก Dashboard หรือรัน seed ที่มี power sensor)
 *
 * เมื่อใช้เซ็นเซอร์จริงแล้ว — ลบไฟล์นี้ออกได้
 */

const http = require('http')
const https = require('https')

const BASE_URL = process.env.API_BASE_URL || 'https://herbal-storage-system-production-a379.up.railway.app'
const NODE_ID = process.env.SENSOR_NODE_ID || 'ESP32-POWER-001'
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '5000', 10)
const API_KEY = process.env.SENSOR_API_KEY || ''

function sendData() {
  // จำลองแอร์ทำงาน: 220V, กระแสประมาณ 4–6 A, กำลังประมาณ 900–1300 W
  const voltage = 218 + (Math.random() * 8 - 2)
  const current = 4.2 + (Math.random() * 1.2 - 0.3)
  const power = voltage * current
  const energy = 0.1 + Math.random() * 0.05  // kWh สะสม (ตัวอย่าง)

  const body = JSON.stringify({
    nodeId: NODE_ID,
    type: 'power',
    readings: {
      voltage: Math.round(voltage * 100) / 100,
      current: Math.round(current * 100) / 100,
      power: Math.round(power),
      energy: Math.round(energy * 1000) / 1000,
    },
  })

  const url = new URL('/api/data/ingest', BASE_URL)
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
  }

  const client = url.protocol === 'https:' ? https : http
  const req = client.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => {
      const time = new Date().toLocaleTimeString('th-TH')
      if (res.statusCode === 200) {
        console.log(`[${time}] OK | ${voltage.toFixed(1)}V, ${current.toFixed(2)}A, ${power.toFixed(0)}W`)
      } else {
        console.error(`[${time}] HTTP ${res.statusCode}`, data)
        try {
          const j = JSON.parse(data)
          if (j.error) console.error('  error:', j.error)
          if (j.hint) console.error('  hint:', j.hint)
        } catch (_) {}
      }
    })
  })

  req.on('error', (err) => {
    console.error('Error (เซิร์ฟเวอร์ไม่รันหรือพอร์ตผิด?):', err.message)
    console.error('  รัน pnpm dev แล้วลองใหม่ หรือเปิด', BASE_URL + '/api/data/ingest', 'ในเบราว์เซอร์')
  })

  req.write(body)
  req.end()
}

console.log('Test Power/Current Sensor')
console.log('  API:', BASE_URL + '/api/data/ingest')
console.log('  nodeId:', NODE_ID)
console.log('  interval:', INTERVAL_MS, 'ms')
console.log('  หมายเหตุ: ต้องมีเซ็นเซอร์ power ลงทะเบียนในระบบ (Dashboard หรือ seed)')
console.log('  Ctrl+C to stop\n')

sendData()
setInterval(sendData, INTERVAL_MS)
