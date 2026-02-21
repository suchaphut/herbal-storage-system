/**
 * Test script: ส่งข้อมูล Environmental Sensor (อุณหภูมิ/ความชื้น) ไปที่ API
 * ใช้สำหรับทดสอบระบบก่อนต่อเซ็นเซอร์จริง
 *
 * วิธีใช้: node scripts/test-sensor-environmental.js
 * ต้องรันเซิร์ฟเวอร์ (pnpm dev) และมีเซ็นเซอร์ nodeId นี้ในระบบแล้ว (จาก seed: ESP32-ENV-001)
 *
 * เมื่อใช้เซ็นเซอร์จริงแล้ว — ลบไฟล์นี้ออกได้
 */

const http = require('http')

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const NODE_ID = process.env.SENSOR_NODE_ID || 'ESP32-ENV-001'
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '5000', 10)
const API_KEY = process.env.SENSOR_API_KEY || ''

function sendData() {
  const temperature = 22 + (Math.random() * 6 - 2)   // ประมาณ 20–28 °C
  const humidity = 48 + (Math.random() * 14 - 5)    // ประมาณ 43–57%

  const body = JSON.stringify({
    nodeId: NODE_ID,
    type: 'environmental',
    readings: {
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
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

  const req = http.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => {
      const time = new Date().toLocaleTimeString('th-TH')
      if (res.statusCode === 200) {
        console.log(`[${time}] OK | ${temperature.toFixed(1)}°C, ${humidity.toFixed(1)}%`)
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

console.log('Test Environmental Sensor')
console.log('  API:', BASE_URL + '/api/data/ingest')
console.log('  nodeId:', NODE_ID)
console.log('  interval:', INTERVAL_MS, 'ms')
console.log('  ตรวจสอบ nodeId ที่ใช้ได้: GET', BASE_URL + '/api/data/ingest')
console.log('  Ctrl+C to stop\n')

sendData()
setInterval(sendData, INTERVAL_MS)
