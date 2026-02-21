/**
 * Monthly Data Export Script
 * - Export sensor data from last month to CSV
 * - Upload CSV to Google Drive
 * - Delete exported data from MongoDB
 *
 * Setup: see scripts/MONTHLY_EXPORT_SETUP.md
 * Run:   node scripts/monthly-export.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const { MongoClient, ObjectId } = require('mongodb')
const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')
const os = require('os')

// ─── Config ────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/herbal_storage'
const GDRIVE_FOLDER_ID = process.env.GDRIVE_FOLDER_ID // Google Drive folder ID
const GDRIVE_KEY_FILE = process.env.GDRIVE_KEY_FILE   // path to service account JSON key

// ─── Date range: last month ─────────────────────────────────────────────────
function getLastMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
  const end   = new Date(now.getFullYear(), now.getMonth(),     1, 0, 0, 0, 0)
  const label = start.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
  const fileTag = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
  return { start, end, label, fileTag }
}

// ─── Convert records to CSV ─────────────────────────────────────────────────
function toCSV(records) {
  const BOM = '\uFEFF'
  const header = 'เวลา,roomId,nodeId,ประเภท,อุณหภูมิ (°C),ความชื้น (%),แรงดัน (V),กระแส (A),กำลังไฟ (W),พลังงาน (kWh)'
  const rows = records.map((r) => {
    const time = new Date(r.timestamp).toLocaleString('th-TH')
    const room = r.roomId ? String(r.roomId) : ''
    const node = r.nodeId || ''
    if (r.type === 'environmental') {
      const { temperature = '', humidity = '' } = r.readings || {}
      return `${time},${room},${node},สิ่งแวดล้อม,${temperature},${humidity},,,, `
    } else if (r.type === 'power') {
      const { voltage = '', current = '', power = '', energy = '' } = r.readings || {}
      return `${time},${room},${node},ไฟฟ้า,,,${voltage},${current},${power},${energy}`
    }
    return `${time},${room},${node},อื่นๆ,,,,,,`
  })
  return BOM + [header, ...rows].join('\n')
}

// ─── Upload to Google Drive ─────────────────────────────────────────────────
async function uploadToDrive(filePath, fileName) {
  if (!GDRIVE_KEY_FILE || !GDRIVE_FOLDER_ID) {
    console.warn('[Drive] GDRIVE_KEY_FILE หรือ GDRIVE_FOLDER_ID ไม่ได้ตั้งค่า — ข้ามการอัปโหลด')
    return null
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: GDRIVE_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })

  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [GDRIVE_FOLDER_ID],
    },
    media: {
      mimeType: 'text/csv',
      body: fs.createReadStream(filePath),
    },
    fields: 'id, name, webViewLink',
  })

  return res.data
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const { start, end, label, fileTag } = getLastMonthRange()
  console.log(`\n📦 เริ่มต้น Export ข้อมูลประจำเดือน: ${label}`)
  console.log(`   ช่วงเวลา: ${start.toISOString()} → ${end.toISOString()}`)

  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  console.log('✅ เชื่อมต่อ MongoDB สำเร็จ')

  const db = client.db()
  const collection = db.collection('sensordatas')

  // 1. ดึงข้อมูลเดือนที่แล้ว
  const query = { timestamp: { $gte: start, $lt: end } }
  const records = await collection.find(query).sort({ timestamp: 1 }).toArray()
  console.log(`📊 พบข้อมูล ${records.length.toLocaleString()} รายการ`)

  if (records.length === 0) {
    console.log('⚠️  ไม่มีข้อมูลในช่วงเวลานี้ — จบการทำงาน')
    await client.close()
    return
  }

  // 2. บันทึก CSV ชั่วคราว
  const fileName = `sensor-data-${fileTag}.csv`
  const tmpPath = path.join(os.tmpdir(), fileName)
  fs.writeFileSync(tmpPath, toCSV(records), 'utf8')
  const fileSizeKB = (fs.statSync(tmpPath).size / 1024).toFixed(1)
  console.log(`💾 บันทึกไฟล์ชั่วคราว: ${tmpPath} (${fileSizeKB} KB)`)

  // 3. อัปโหลดขึ้น Google Drive
  console.log('☁️  กำลังอัปโหลดขึ้น Google Drive...')
  let driveFile = null
  try {
    driveFile = await uploadToDrive(tmpPath, fileName)
    if (driveFile) {
      console.log(`✅ อัปโหลดสำเร็จ: ${driveFile.name}`)
      console.log(`   ลิงก์: ${driveFile.webViewLink}`)
    }
  } catch (err) {
    console.error('❌ อัปโหลด Google Drive ล้มเหลว:', err.message)
    console.log('⚠️  ข้อมูลยังไม่ถูกลบ — กรุณาตรวจสอบและรันใหม่')
    fs.unlinkSync(tmpPath)
    await client.close()
    process.exit(1)
  }

  // 4. ลบข้อมูลจาก MongoDB (เฉพาะเมื่ออัปโหลดสำเร็จหรือไม่ได้ตั้งค่า Drive)
  console.log('🗑️  กำลังลบข้อมูลจาก MongoDB...')
  const deleteResult = await collection.deleteMany(query)
  console.log(`✅ ลบข้อมูลแล้ว ${deleteResult.deletedCount.toLocaleString()} รายการ`)

  // 5. ลบไฟล์ชั่วคราว
  fs.unlinkSync(tmpPath)

  // 6. บันทึก log
  const logEntry = {
    runAt: new Date(),
    month: fileTag,
    label,
    exportedCount: records.length,
    deletedCount: deleteResult.deletedCount,
    driveFileId: driveFile?.id || null,
    driveFileName: driveFile?.name || null,
    driveLink: driveFile?.webViewLink || null,
  }
  await db.collection('export_logs').insertOne(logEntry)
  console.log('📝 บันทึก log เรียบร้อย')

  await client.close()
  console.log(`\n🎉 เสร็จสิ้น! Export ข้อมูลเดือน ${label} สำเร็จ\n`)
}

main().catch((err) => {
  console.error('❌ เกิดข้อผิดพลาด:', err)
  process.exit(1)
})
