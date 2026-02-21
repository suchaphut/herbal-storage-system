# IoT Herbal Storage Monitoring System

ระบบติดตามและพยากรณ์สภาพแวดล้อมในห้องเก็บยาสมุนไพร ด้วย IoT, Next.js และ Machine Learning

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-green?style=for-the-badge&logo=mongodb)](https://mongodb.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org)

---

## วัตถุประสงค์

ระบบนี้ถูกพัฒนาเพื่อช่วยให้ผู้ดูแลห้องเก็บยาสมุนไพรสามารถ:

- **ติดตามแบบ Real-time** — อุณหภูมิและความชื้นจากเซ็นเซอร์ ESP32 ในแต่ละห้อง
- **แจ้งเตือนอัตโนมัติ** — เมื่อค่าเกินเกณฑ์ที่กำหนด ผ่าน Discord และ LINE Notify
- **ตรวจจับความผิดปกติ** — ด้วย Anomaly Detection (Z-Score, IQR, Isolation Forest)
- **พยากรณ์แนวโน้ม** — อุณหภูมิและความชื้นล่วงหน้า 6 ชั่วโมง (Holt-Winters / Prophet)
- **ติดตามสถานะแอร์** — ผ่าน Current Sensor (Power Sensor) พร้อม Anomaly Detection

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        IoT Devices                          │
│              ESP32 (Environmental + Power Sensor)           │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP POST /api/data/ingest
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Application                       │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐   │
│  │   Frontend   │   │  API Routes  │   │  ML Service   │   │
│  │  (React/SWR) │◄──│  (Next.js)   │──►│  (TS + Python)│   │
│  └──────────────┘   └──────┬───────┘   └───────────────┘   │
│                            │                                │
│                     ┌──────▼───────┐                        │
│                     │   MongoDB    │                        │
│                     │  (Mongoose)  │                        │
│                     └──────────────┘                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Notification Service                       │   │
│  │         Discord Webhook  │  LINE Notify              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS, Recharts, SWR |
| Backend | Next.js API Routes, TypeScript |
| Database | MongoDB 7 (via Mongoose) |
| ML (built-in) | Holt-Winters, Z-Score, IQR, Isolation Forest (TypeScript) |
| ML (optional) | Prophet, scikit-learn Isolation Forest (Python) |
| Auth | JWT (jose), bcryptjs, RBAC (Admin / Operator / Viewer) |
| Notifications | Discord Webhook, LINE Notify |

---

## การติดตั้ง (Installation)

### ความต้องการของระบบ

- **Node.js** 20+
- **pnpm** (แนะนำ) หรือ npm / yarn
- **MongoDB** 6+ (local หรือ MongoDB Atlas)
- **Python** 3.9+ *(ไม่บังคับ — สำหรับ Prophet ML)*

### 1. Clone โปรเจกต์

```bash
git clone https://github.com/suchaphut/v0-io-t-herbal-storage-system.git
cd v0-io-t-herbal-storage-system
```

### 2. ติดตั้ง Node.js Dependencies

```bash
pnpm install
```

### 3. ติดตั้ง Python Dependencies *(ไม่บังคับ)*

ใช้เฉพาะเมื่อต้องการเปิดใช้ Prophet + scikit-learn Isolation Forest:

```bash
pip install -r scripts/requirements-ml.txt
```

Python packages ที่ต้องการ:

| Package | Version |
|---------|---------|
| pandas | ≥ 2.0.0 |
| prophet | ≥ 1.1.0 |
| numpy | ≥ 1.24.0 |
| scikit-learn | ≥ 1.3.0 |
| joblib | ≥ 1.3.0 |

---

## การตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```env
# ─── Database ──────────────────────────────────────────────
# MongoDB local
MONGODB_URI=mongodb://localhost:27017/herbal_storage

# หรือ MongoDB Atlas
# MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/herbal_storage?retryWrites=true&w=majority

# ─── Authentication ────────────────────────────────────────
JWT_SECRET=your-secret-key-min-32-chars

# ─── Notifications (ไม่บังคับ) ────────────────────────────
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
LINE_NOTIFY_TOKEN=your-line-notify-token

# ─── Python ML (ไม่บังคับ) ────────────────────────────────
# เปิดใช้ Prophet + scikit-learn แทน Holt-Winters ใน TypeScript
ENABLE_PYTHON_ML=1

# ระบุ path ของ Python ถ้าไม่ได้อยู่ใน PATH (Windows)
# PYTHON_PATH=C:\Python311\python.exe
```

### ตารางสรุป Environment Variables

| ตัวแปร | บังคับ | ค่าตัวอย่าง | คำอธิบาย |
|--------|--------|------------|---------|
| `MONGODB_URI` | ✅ | `mongodb://localhost:27017/herbal_storage` | MongoDB connection string |
| `JWT_SECRET` | ✅ | `supersecretkey...` | Secret สำหรับ sign JWT (≥ 32 ตัวอักษร) |
| `DISCORD_WEBHOOK_URL` | ❌ | `https://discord.com/api/webhooks/...` | Discord Webhook URL สำหรับแจ้งเตือน |
| `LINE_NOTIFY_TOKEN` | ❌ | `xxxxxx` | LINE Notify Access Token |
| `ENABLE_PYTHON_ML` | ❌ | `1` | เปิดใช้ Prophet + Python Isolation Forest |
| `PYTHON_PATH` | ❌ | `C:\Python311\python.exe` | Path ของ Python executable |

---

## การรันโปรเจกต์

### Development

```bash
pnpm dev
```

เปิด [http://localhost:3000](http://localhost:3000) ในเบราว์เซอร์

### Seed ข้อมูลเริ่มต้น

```bash
# Seed ห้อง, เซ็นเซอร์ และข้อมูลตัวอย่าง
node scripts/seed-mongodb.js

# Seed ผู้ใช้งานตัวอย่าง (admin, operator, viewer)
node scripts/seed-users.js
```

### Production Build

```bash
pnpm build
pnpm start
```

### ทดสอบการส่งข้อมูลเซ็นเซอร์

```bash
# จำลอง Environmental Sensor (อุณหภูมิ + ความชื้น)
node scripts/test-sensor-environmental.js

# จำลอง Power Sensor (กระแสไฟ/แอร์)
node scripts/test-sensor-power.js

# จำลอง IoT Device แบบ loop
node scripts/mock-iot-device.js
```

---

## API Documentation

### Authentication

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `POST` | `/api/auth/login` | เข้าสู่ระบบ รับ JWT token | ❌ |
| `POST` | `/api/auth/logout` | ออกจากระบบ | ✅ |
| `GET` | `/api/auth/me` | ดึงข้อมูลผู้ใช้ปัจจุบัน | ✅ |

### IoT Data Ingestion

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `POST` | `/api/data/ingest` | รับข้อมูลจาก IoT device (environmental / power) | ❌ |

**Request Body — Environmental Sensor:**
```json
{
  "nodeId": "ESP32-ENV-001",
  "type": "environmental",
  "readings": {
    "temperature": 25.4,
    "humidity": 60.2
  }
}
```

**Request Body — Power Sensor:**
```json
{
  "nodeId": "ESP32-PWR-001",
  "type": "power",
  "readings": {
    "voltage": 220.0,
    "current": 3.5,
    "power": 770.0,
    "energy": 0.21
  }
}
```

### Rooms & Sensors

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/rooms` | ดึงรายการห้องทั้งหมด | ✅ |
| `POST` | `/api/rooms` | สร้างห้องใหม่ | ✅ Admin |
| `GET` | `/api/rooms/[id]` | ดึงข้อมูลห้อง + ข้อมูลเซ็นเซอร์ล่าสุด | ✅ |
| `PUT` | `/api/rooms/[id]` | แก้ไขข้อมูลห้อง | ✅ Admin |
| `DELETE` | `/api/rooms/[id]` | ลบห้อง | ✅ Admin |
| `GET` | `/api/sensors` | ดึงรายการเซ็นเซอร์ทั้งหมด | ✅ |
| `POST` | `/api/sensors` | ลงทะเบียนเซ็นเซอร์ใหม่ | ✅ Admin |
| `PUT` | `/api/sensors/[id]` | แก้ไขข้อมูลเซ็นเซอร์ | ✅ Admin/Operator |
| `DELETE` | `/api/sensors/[id]` | ลบเซ็นเซอร์ | ✅ Admin |

### Alerts

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/alerts` | ดึงรายการ Alert (รองรับ filter) | ✅ |
| `PUT` | `/api/alerts/[id]` | Resolve Alert | ✅ Admin/Operator |

### Machine Learning

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/ml/analyze?roomId=<id>` | วิเคราะห์ ML เต็ม (Prediction + Anomaly) | ✅ |
| `GET` | `/api/predictions/[roomId]` | ดึงผลพยากรณ์อย่างเดียว | ✅ |

### Dashboard & Stats

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/stats` | ดึงสถิติ Dashboard (จำนวนห้อง, เซ็นเซอร์, Alert, สถานะแอร์) | ✅ |

### Users & Audit Logs

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/users` | ดึงรายการผู้ใช้ | ✅ Admin |
| `POST` | `/api/users` | สร้างผู้ใช้ใหม่ | ✅ Admin |
| `PUT` | `/api/users/[id]` | แก้ไขผู้ใช้ | ✅ Admin |
| `DELETE` | `/api/users/[id]` | ลบผู้ใช้ | ✅ Admin |
| `GET` | `/api/audit-logs` | ดึง Audit Log | ✅ Admin |

---

## Role-Based Access Control (RBAC)

| สิทธิ์ | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| จัดการผู้ใช้ | ✅ | ❌ | ❌ |
| สร้าง/ลบห้อง | ✅ | ❌ | ❌ |
| แก้ไขเซ็นเซอร์ | ✅ | ✅ (เฉพาะที่ได้รับมอบหมาย) | ❌ |
| ดูข้อมูล Real-time | ✅ | ✅ | ✅ |
| ดูข้อมูลย้อนหลัง | ✅ | ✅ | ✅ |
| Resolve Alert | ✅ | ✅ | ❌ |
| Export ข้อมูล | ✅ | ❌ | ❌ |
| ดู Audit Log | ✅ | ❌ | ❌ |

---

## Machine Learning

### Built-in (TypeScript) — ทำงานได้ทันทีโดยไม่ต้องติดตั้ง Python

| ฟีเจอร์ | วิธี |
|---------|------|
| Time Series Prediction | Holt-Winters Triple Exponential Smoothing |
| Anomaly Detection | Z-Score + IQR + Rate of Change + Isolation Forest (TS) |
| Power Anomaly | Current threshold + Statistical outlier |

### Optional Python ML — เปิดด้วย `ENABLE_PYTHON_ML=1`

| ฟีเจอร์ | วิธี | Script |
|---------|------|--------|
| Time Series Prediction | Prophet (Facebook) | `scripts/ml_prophet.py` |
| Anomaly Detection | scikit-learn Isolation Forest | `scripts/ml_isolation_forest.py` |

ระบบจะ **fallback กลับไปใช้ TypeScript โดยอัตโนมัติ** ถ้า Python ล้มเหลวหรือ timeout

### การคำนวณเมื่อมีหลายเซ็นเซอร์ต่อห้อง

| จุดที่ใช้ | วิธีคำนวณ |
|-----------|----------|
| Dashboard card | ค่าเฉลี่ยของค่าล่าสุดจากทุก node ในห้อง |
| กราฟรายละเอียดห้อง | เฉลี่ยต่อช่วงเวลา (hourly aggregation) |
| ML Prediction | ใช้ข้อมูลจาก environmental node แรกที่พบในห้อง |
| Power sensor | แสดงทุกหน่วย ไม่มีการเฉลี่ย |

---

## โครงสร้างโปรเจกต์

```
├── app/
│   ├── api/                  # Next.js API Routes
│   │   ├── auth/             # Login, logout, me
│   │   ├── data/ingest/      # IoT data ingestion endpoint
│   │   ├── rooms/            # Room CRUD
│   │   ├── sensors/          # Sensor CRUD
│   │   ├── alerts/           # Alert management
│   │   ├── ml/               # ML analysis endpoint
│   │   ├── predictions/      # Prediction results
│   │   ├── stats/            # Dashboard statistics
│   │   ├── users/            # User management
│   │   └── audit-logs/       # Audit log
│   └── login/                # Login page
├── components/
│   ├── dashboard/            # Dashboard UI components
│   ├── auth/                 # Auth context & login form
│   └── ui/                   # shadcn/ui base components
├── lib/
│   ├── types.ts              # TypeScript type definitions
│   ├── db-service.ts         # MongoDB data access layer
│   ├── ml-service.ts         # ML engine (Holt-Winters, Anomaly)
│   ├── ml-python-bridge.ts   # Python ML bridge (Prophet, IF)
│   ├── auth-service.ts       # JWT authentication
│   ├── auth-middleware.ts    # RBAC middleware
│   ├── notification-service.ts # Discord & LINE notifications
│   └── audit-log-service.ts  # Audit logging
├── scripts/
│   ├── ml_prophet.py         # Prophet prediction script
│   ├── ml_isolation_forest.py# Isolation Forest script
│   ├── requirements-ml.txt   # Python dependencies
│   ├── seed-mongodb.js       # Database seeder
│   └── test-sensor-*.js      # IoT simulation scripts
├── ml_models/                # Pre-trained Prophet model cache
└── docs/
    ├── README_IOT.md         # ESP32 integration guide
    ├── README_ML.md          # ML models & Python setup
    ├── documentation.md      # Full system documentation (TH)
    ├── walkthrough.md        # Prophet ML improvement notes
    ├── implementation_plan.md# Docker/Render deployment plan
    └── task.md               # Deploy to Render checklist
```

---

## การเชื่อมต่อ ESP32

ดูรายละเอียดและตัวอย่างโค้ด Arduino ได้ที่ [README_IOT.md](./docs/README_IOT.md)

**Endpoint:** `POST http://<server-ip>:3000/api/data/ingest`

---

## การ Deploy

### Docker (แนะนำสำหรับ Production)

โปรเจกต์รองรับ Docker สำหรับ deploy บน Render.com หรือ platform ที่รองรับ Docker ดูรายละเอียดใน [implementation_plan.md](./docs/implementation_plan.md)

### Vercel

```bash
vercel deploy
```

> **หมายเหตุ:** Vercel ไม่รองรับ Python runtime ดังนั้น `ENABLE_PYTHON_ML` ต้องปิด (ระบบจะใช้ TypeScript ML โดยอัตโนมัติ)

---

## เอกสารเพิ่มเติม

- [docs/README_IOT.md](./docs/README_IOT.md) — คู่มือเชื่อมต่อ ESP32 พร้อมตัวอย่างโค้ด Arduino
- [docs/README_ML.md](./docs/README_ML.md) — รายละเอียด ML models และการเปิดใช้ Python
- [docs/documentation.md](./docs/documentation.md) — เอกสารระบบฉบับเต็ม (ภาษาไทย)
- [docs/walkthrough.md](./docs/walkthrough.md) — บันทึกการปรับปรุง Prophet ML
- [docs/implementation_plan.md](./docs/implementation_plan.md) — แผนการ Deploy ด้วย Docker
- [docs/task.md](./docs/task.md) — Checklist การ Deploy to Render