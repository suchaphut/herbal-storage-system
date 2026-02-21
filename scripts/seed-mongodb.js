/**
 * MongoDB Seed Script
 * สร้างข้อมูลเริ่มต้น: Users, Rooms, Sensors, Alerts
 * รัน: node scripts/seed-mongodb.js
 *
 * ต้องตั้งค่า MONGODB_URI ใน .env.local หรือใช้ default mongodb://localhost:27017/herbal_storage
 */

const fs = require('fs')
const path = require('path')

// Load .env.local (no dotenv needed)
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  })
}

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/herbal_storage'

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'))

    const db = mongoose.connection.db

    // 1. Clear existing data (optional - comment out to preserve data)
    const collections = ['users', 'rooms', 'sensornodes', 'sensordatas', 'alerts', 'mlresults']
    for (const name of collections) {
      try {
        await db.collection(name).deleteMany({})
        console.log(`  Cleared ${name}`)
      } catch {
        // Collection may not exist
      }
    }

    // 2. Create Rooms
    const roomsCol = db.collection('rooms')
    const roomDocs = [
      {
        name: 'ห้องเก็บยาสมุนไพรแห้ง A',
        description: 'ห้องเก็บสมุนไพรแห้ง ต้องการอุณหภูมิคงที่',
        location: 'อาคาร 1 ชั้น 2',
        thresholds: { temperature: { min: 20, max: 28 }, humidity: { min: 40, max: 60 } },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'ห้องเก็บยาสมุนไพรสด B',
        description: 'ห้องเก็บสมุนไพรสด ต้องการความชื้นสูง',
        location: 'อาคาร 1 ชั้น 1',
        thresholds: { temperature: { min: 15, max: 22 }, humidity: { min: 70, max: 85 } },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'ห้องเก็บยาสำเร็จรูป C',
        description: 'ห้องเก็บยาที่ผ่านการแปรรูปแล้ว',
        location: 'อาคาร 2 ชั้น 1',
        thresholds: { temperature: { min: 18, max: 25 }, humidity: { min: 45, max: 65 } },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    const roomResult = await roomsCol.insertMany(roomDocs)
    const roomIds = Object.values(roomResult.insertedIds).map((id) => id.toString())
    console.log('  Created rooms:', roomIds.length)

    // 3. Create Users (passwords: admin123, operator123, viewer123)
    const usersCol = db.collection('users')
    const userDocs = [
      {
        email: 'admin@herbal.local',
        passwordHash: await bcrypt.hash('admin123', 10),
        name: 'ผู้ดูแลระบบ',
        role: 'admin',
        assignedRooms: [],
        notificationPreferences: { discord: true, line: true, email: true },
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'operator@herbal.local',
        passwordHash: await bcrypt.hash('operator123', 10),
        name: 'เจ้าหน้าที่ดูแลห้อง',
        role: 'operator',
        assignedRooms: roomIds.slice(0, 2),
        notificationPreferences: { discord: true, line: false, email: true },
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'viewer@herbal.local',
        passwordHash: await bcrypt.hash('viewer123', 10),
        name: 'ผู้ตรวจสอบ',
        role: 'viewer',
        assignedRooms: [],
        notificationPreferences: { discord: false, line: false, email: true },
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    await usersCol.insertMany(userDocs)
    console.log('  Created users: 3 (admin, operator, viewer)')

    // 4. Create Sensor Nodes (Mongoose model "SensorNode" -> collection "sensornodes")
    const sensorsCol = db.collection('sensornodes')
    const sensorDocs = [
      {
        nodeId: 'ESP32-ENV-001',
        name: 'เซ็นเซอร์หลัก A1',
        type: 'environmental',
        roomId: new mongoose.Types.ObjectId(roomIds[0]),
        status: 'online',
        lastSeen: new Date(),
        config: { reportInterval: 60, firmware: 'v1.2.3' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        nodeId: 'ESP32-ENV-002',
        name: 'เซ็นเซอร์หลัก A2',
        type: 'environmental',
        roomId: new mongoose.Types.ObjectId(roomIds[0]),
        status: 'online',
        lastSeen: new Date(),
        config: { reportInterval: 60, firmware: 'v1.2.3' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        nodeId: 'ESP32-ENV-003',
        name: 'เซ็นเซอร์ห้อง B',
        type: 'environmental',
        roomId: new mongoose.Types.ObjectId(roomIds[1]),
        status: 'offline',
        lastSeen: new Date(Date.now() - 3600000),
        config: { reportInterval: 60, firmware: 'v1.2.3' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        nodeId: 'ESP32-POWER-001',
        name: 'เซ็นเซอร์กระแสแอร์ ห้อง A',
        type: 'power',
        roomId: new mongoose.Types.ObjectId(roomIds[0]),
        status: 'online',
        lastSeen: new Date(),
        config: { reportInterval: 60, firmware: 'v1.0' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    await sensorsCol.insertMany(sensorDocs)
    console.log('  Created sensors: 4 (3 environmental, 1 power)')

    // 4b. สร้างข้อมูล environmental ตัวอย่างสำหรับ ML (ห้อง A มี 2 เซนเซอร์)
    const sensorDataCol = db.collection('sensordatas')
    const roomAId = new mongoose.Types.ObjectId(roomIds[0])
    const now = Date.now()
    const envDataDocs = []
    for (let i = 0; i < 120; i++) {
      const t = new Date(now - (120 - i) * 60 * 1000)
      const temp = 24 + Math.sin(i / 20) * 2 + (Math.random() - 0.5)
      const hum = 50 + Math.cos(i / 15) * 10 + (Math.random() - 0.5) * 5
      envDataDocs.push({
        nodeId: 'ESP32-ENV-001',
        roomId: roomAId,
        timestamp: t,
        type: 'environmental',
        readings: { temperature: Math.round(temp * 10) / 10, humidity: Math.round(hum * 10) / 10 },
      })
      envDataDocs.push({
        nodeId: 'ESP32-ENV-002',
        roomId: roomAId,
        timestamp: t,
        type: 'environmental',
        readings: { temperature: Math.round((temp + 0.3) * 10) / 10, humidity: Math.round((hum + 2) * 10) / 10 },
      })
    }
    await sensorDataCol.insertMany(envDataDocs)
    console.log('  Created sensor data: 240 docs (120 min × 2 nodes for Room A)')

    // 5. Create sample Alerts
    const alertsCol = db.collection('alerts')
    const alertDocs = [
      {
        roomId: new mongoose.Types.ObjectId(roomIds[0]),
        nodeId: 'ESP32-ENV-001',
        type: 'threshold',
        severity: 'warning',
        message: 'อุณหภูมิสูงเกินเกณฑ์',
        data: { value: 29, threshold: 28 },
        isResolved: false,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    await alertsCol.insertMany(alertDocs)
    console.log('  Created alerts: 1')

    console.log('\nSeed completed successfully!')
    console.log('\nDemo accounts:')
    console.log('  Admin:    admin@herbal.local / admin123')
    console.log('  Operator: operator@herbal.local / operator123')
    console.log('  Viewer:   viewer@herbal.local / viewer123')
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\nDisconnected from MongoDB')
    process.exit(0)
  }
}

seed()
