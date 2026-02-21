# Monthly Export Setup Guide

ระบบ Export ข้อมูลเซ็นเซอร์รายเดือน → Google Drive → ลบจาก MongoDB อัตโนมัติ

---

## ขั้นตอนที่ 1: ติดตั้ง Dependencies

```bash
npm install googleapis dotenv
```

---

## ขั้นตอนที่ 2: สร้าง Google Drive Service Account

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่ (หรือใช้อันเดิม)
3. เปิดใช้ **Google Drive API**:
   - ไปที่ **APIs & Services → Library**
   - ค้นหา "Google Drive API" → **Enable**
4. สร้าง Service Account:
   - ไปที่ **APIs & Services → Credentials**
   - คลิก **Create Credentials → Service Account**
   - ตั้งชื่อ เช่น `herbal-storage-export`
   - คลิก **Done**
5. ดาวน์โหลด Key JSON:
   - คลิกที่ Service Account ที่สร้าง
   - ไปที่ tab **Keys → Add Key → Create new key → JSON**
   - บันทึกไฟล์ไว้ที่ปลอดภัย เช่น `C:\keys\gdrive-key.json`

---

## ขั้นตอนที่ 3: แชร์ Google Drive Folder

1. เปิด Google Drive → สร้างโฟลเดอร์ เช่น `Herbal Storage Exports`
2. คลิกขวาที่โฟลเดอร์ → **Share**
3. ใส่ email ของ Service Account (ดูได้จากไฟล์ JSON ที่ field `client_email`)
   - ตัวอย่าง: `herbal-storage-export@your-project.iam.gserviceaccount.com`
4. ให้สิทธิ์ **Editor**
5. คัดลอก **Folder ID** จาก URL:
   - URL ตัวอย่าง: `https://drive.google.com/drive/folders/1ABC123xyz`
   - Folder ID คือ `1ABC123xyz`

---

## ขั้นตอนที่ 4: ตั้งค่า Environment Variables

เพิ่มใน `.env.local`:

```env
MONGODB_URI=mongodb://localhost:27017/herbal_storage
GDRIVE_FOLDER_ID=1ABC123xyz
GDRIVE_KEY_FILE=C:\keys\gdrive-key.json
```

---

## ขั้นตอนที่ 5: ทดสอบรัน Script

```bash
node scripts/monthly-export.js
```

ถ้าต้องการทดสอบโดยไม่ลบข้อมูลจริง ให้ comment บรรทัด `deleteMany` ใน script ก่อน

---

## ขั้นตอนที่ 6: ตั้ง Windows Task Scheduler

### วิธีที่ 1: ใช้ PowerShell Script (แนะนำ)

รัน PowerShell ในฐานะ Administrator:

```powershell
# แก้ path ให้ตรงกับเครื่องของคุณ
$scriptPath = "C:\Users\perap\Documents\GitHub\v0-io-t-herbal-storage-system\scripts\monthly-export.js"
$nodePath   = (Get-Command node).Source
$logPath    = "C:\Users\perap\Documents\GitHub\v0-io-t-herbal-storage-system\scripts\export.log"

$action  = New-ScheduledTaskAction -Execute $nodePath -Argument $scriptPath -WorkingDirectory (Split-Path $scriptPath)
$trigger = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 1 -At "02:00AM"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
  -TaskName "HerbalStorageMonthlyExport" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Export sensor data monthly to Google Drive" `
  -RunLevel Highest `
  -Force
```

### วิธีที่ 2: ใช้ Task Scheduler GUI

1. เปิด **Task Scheduler** (พิมพ์ใน Start Menu)
2. คลิก **Create Basic Task**
3. ตั้งชื่อ: `HerbalStorageMonthlyExport`
4. Trigger: **Monthly** → วันที่ 1 ของทุกเดือน เวลา 02:00
5. Action: **Start a program**
   - Program: `node`
   - Arguments: `C:\Users\perap\Documents\GitHub\v0-io-t-herbal-storage-system\scripts\monthly-export.js`
   - Start in: `C:\Users\perap\Documents\GitHub\v0-io-t-herbal-storage-system`

---

## ดู Log การทำงาน

ดูประวัติการ export ได้จาก MongoDB collection `export_logs`:

```js
db.export_logs.find().sort({ runAt: -1 })
```

หรือดูใน Dashboard → Audit Log (ถ้าเพิ่ม integration ในอนาคต)

---

## หมายเหตุ

- Script จะ **ไม่ลบข้อมูล** ถ้าอัปโหลด Google Drive ล้มเหลว (ป้องกันข้อมูลสูญหาย)
- ถ้าไม่ตั้งค่า `GDRIVE_FOLDER_ID` / `GDRIVE_KEY_FILE` จะ export CSV แต่ข้ามการอัปโหลด และยังลบข้อมูลตามปกติ
- ไฟล์ CSV ใช้ BOM UTF-8 เพื่อให้เปิดใน Excel ภาษาไทยได้ถูกต้อง
