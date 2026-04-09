# IoT Herbal Storage Monitoring System

ระบบติดตามและพยากรณ์สภาพแวดล้อมในห้องเก็บยาสมุนไพร ด้วย IoT, Next.js และ Machine Learning

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-green?style=for-the-badge&logo=mongodb)](https://mongodb.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.9+-yellow?style=for-the-badge&logo=python)](https://python.org)

---

## วัตถุประสงค์

ระบบนี้พัฒนาเพื่อช่วยผู้ดูแลห้องเก็บยาสมุนไพร:

- **ติดตาม Real-time** — อุณหภูมิและความชื้นจากเซ็นเซอร์ ESP32
- **แจ้งเตือนอัตโนมัติ** — ผ่าน Discord Webhook เมื่อค่าเกินเกณฑ์
- **ตรวจจับความผิดปกติ** — Anomaly Detection หลายชั้น (Z-Score, IQR, Isolation Forest, LSTM, SVM, Ensemble)
- **พยากรณ์แนวโน้ม** — ล่วงหน้า 6 ชม. ด้วย Holt-Winters / Prophet + External Weather Regressors
- **แนะนำการปรับแอร์** — Rule-based + Reinforcement Learning (Q-Learning)
- **วิเคราะห์สภาพอากาศ** — เปรียบเทียบภายใน-ภายนอก ด้วยข้อมูล OpenWeatherMap

---

## สถาปัตยกรรม

```
┌─────────────────────────────────────────────────────────────┐
│                    IoT Devices (ESP32)                       │
│            Environmental Sensor  +  Power Sensor             │
└──────────────────────┬──────────────────────────────────────┘
                       │  HTTP POST /api/data/ingest
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Application                       │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  Frontend  │  │ API Routes │  │     ML Service         │ │
│  │ React/SWR  │◄─│  (REST)    │─►│ TypeScript + Python    │ │
│  │ TailwindCSS│  │  JWT/RBAC  │  │ Prediction │ Anomaly  │ │
│  │ Recharts   │  │            │  │ RL AC Opt  │ Climate  │ │
│  └────────────┘  └─────┬──────┘  └────────────────────────┘ │
│                        │                                     │
│               ┌────────▼────────┐  ┌───────────────────┐    │
│               │    MongoDB      │  │  OpenWeatherMap   │    │
│               │   (Mongoose)    │  │  External Weather │    │
│               └─────────────────┘  └───────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Notification Service                        │   │
│  │              Discord Webhook                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS v4, shadcn/ui, Recharts, SWR |
| Backend | Next.js API Routes, TypeScript |
| Database | MongoDB 7+ (Mongoose ODM) |
| ML — Built-in | Holt-Winters, Z-Score, IQR, Isolation Forest (TypeScript) |
| ML — Python | Prophet, Prophet + Weather Regressors, Isolation Forest, LSTM Autoencoder, One-Class SVM, Ensemble Anomaly, Q-Learning RL |
| Auth | JWT (jose), bcryptjs, RBAC (Admin / Operator / Viewer) |
| Notifications | Discord Webhook |
| Weather | OpenWeatherMap API |

---

## การติดตั้ง

### ความต้องการ

- **Node.js** 20+
- **pnpm** (แนะนำ) หรือ npm
- **MongoDB** 6+ (local หรือ Atlas)
- **Python** 3.9+ *(ไม่บังคับ — สำหรับ ML ขั้นสูง)*

### 1. Clone & Install

```bash
git clone https://github.com/suchaphut/v0-io-t-herbal-storage-system.git
cd v0-io-t-herbal-storage-system
pnpm install
```

### 2. ตั้งค่า Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วแก้ค่า:

```bash
cp .env.example .env.local
```

| ตัวแปร | บังคับ | คำอธิบาย |
|--------|:------:|---------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret สำหรับ JWT (≥ 32 ตัวอักษร) |
| `SENSOR_API_KEY` | ✅ | API key สำหรับ IoT device ส่งข้อมูล |
| `ENABLE_PYTHON_ML` | ❌ | `1` เปิดใช้ Python ML (Prophet, RL, Anomaly) |
| `USE_ENSEMBLE_ANOMALY` | ❌ | `1` ใช้ Ensemble แทน IF เดี่ยว |
| `PYTHON_PATH` | ❌ | Path ของ Python executable |
| `OPENWEATHER_API_KEY` | ❌ | OpenWeatherMap API key |
| `DISCORD_WEBHOOK_URL` | ❌ | Discord Webhook สำหรับแจ้งเตือน |
| `ML_CACHE_TTL_MS` | ❌ | TTL ของ ML cache (default: 300000) |

### 3. ติดตั้ง Python ML *(ไม่บังคับ)*

```bash
pip install -r scripts/requirements-ml.txt
```

### 4. Seed ข้อมูลเริ่มต้น

```bash
node scripts/seed-mongodb.js    # ห้อง + เซ็นเซอร์ + ข้อมูลตัวอย่าง
node scripts/seed-users.js      # ผู้ใช้ (admin / operator / viewer)
```

### 5. รัน

```bash
pnpm dev                        # Development (http://localhost:3000)
pnpm build && pnpm start        # Production
```

---

## Machine Learning

ระบบ ML แบ่งเป็น 3 ชั้น — ทำงานได้ทันทีด้วย TypeScript และเพิ่มความสามารถด้วย Python:

### ชั้นที่ 1: Built-in TypeScript (ทำงานทันที)

| ฟีเจอร์ | วิธี |
|---------|------|
| Time Series Prediction | Holt-Winters Triple Exponential Smoothing |
| Anomaly Detection | Z-Score + IQR + Rate of Change + Simplified Isolation Forest |
| Power Anomaly | Current threshold + Statistical outlier |

### ชั้นที่ 2: Python ML — `ENABLE_PYTHON_ML=1`

| ฟีเจอร์ | วิธี | Script |
|---------|------|--------|
| Time Series Prediction | Prophet Ensemble (SMA + Exp Smoothing) | `ml_prophet.py` |
| Prophet + Weather | Prophet + External Temp/Humidity Regressors | `ml_prophet_with_weather.py` |
| Anomaly Detection | scikit-learn Isolation Forest | `ml_isolation_forest.py` |
| Anomaly Detection | LSTM Autoencoder (TensorFlow) | `ml_lstm_autoencoder.py` |
| Anomaly Detection | One-Class SVM | `ml_ocsvm.py` |
| Ensemble Anomaly | IF + LSTM + SVM รวมกัน (weighted voting) | `ml_ensemble_anomaly.py` |

### ชั้นที่ 3: Reinforcement Learning & Climate Intelligence

| ฟีเจอร์ | วิธี | Script / Module |
|---------|------|-----------------|
| AC Optimization | Q-Learning + Learned Thermal Model | `ml_ac_rl.py` |
| Climate Analysis | Physics-based + ML-enhanced (Prophet with Weather) | `climate-analyzer.ts` |
| AC Recommendation | Rule-based + RL merge (confidence threshold) | `ac-optimizer.ts` |

**Fallback อัตโนมัติ:** ถ้า Python ล้มเหลว/timeout → ใช้ TypeScript ทันที โดยไม่มี error ถึงผู้ใช้

> ดูรายละเอียดทั้งหมดที่ [docs/README_ML.md](./docs/README_ML.md)

---

## API Reference

### Authentication

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `POST` | `/api/auth/login` | เข้าสู่ระบบ รับ JWT | ❌ |
| `POST` | `/api/auth/logout` | ออกจากระบบ | ✅ |
| `GET` | `/api/auth/me` | ข้อมูลผู้ใช้ปัจจุบัน | ✅ |

### IoT Data

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `POST` | `/api/data/ingest` | รับข้อมูลจาก IoT device | API Key |

### Rooms & Sensors

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/rooms` | รายการห้อง | ✅ |
| `POST` | `/api/rooms` | สร้างห้อง | Admin |
| `GET/PUT/DELETE` | `/api/rooms/[id]` | CRUD ห้อง | ✅/Admin |
| `GET` | `/api/sensors` | รายการเซ็นเซอร์ | ✅ |
| `POST` | `/api/sensors` | ลงทะเบียนเซ็นเซอร์ | Admin |
| `PUT/DELETE` | `/api/sensors/[id]` | แก้ไข/ลบเซ็นเซอร์ | Admin |

### ML & Predictions

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/ml/analyze?roomId=<id>` | ML Analysis (Prediction + Anomaly) | ✅ |
| `GET` | `/api/predictions/[roomId]` | ผลพยากรณ์อย่างเดียว | ✅ |

### Weather & Climate

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/weather/current` | อากาศปัจจุบัน (OpenWeatherMap) | ✅ |
| `GET` | `/api/weather/forecast` | พยากรณ์อากาศ 5 วัน | ✅ |
| `GET` | `/api/climate/analyze?roomId=<id>` | วิเคราะห์อากาศภายใน-ภายนอก + ML Prediction | ✅ |

### AC Recommendations

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/recommendations/ac?roomId=<id>` | คำแนะนำปรับแอร์ (Rule-based + RL) | ✅ |
| `POST` | `/api/recommendations/ac/train` | Train RL model จากข้อมูลย้อนหลัง | ✅ |

### Alerts, Users & Audit

| Method | Endpoint | คำอธิบาย | Auth |
|--------|----------|---------|------|
| `GET` | `/api/alerts` | รายการ Alert | ✅ |
| `PUT` | `/api/alerts/[id]` | Resolve Alert | Admin/Operator |
| `GET` | `/api/stats` | สถิติ Dashboard | ✅ |
| `GET/POST/PUT/DELETE` | `/api/users[/id]` | จัดการผู้ใช้ | Admin |
| `GET` | `/api/audit-logs` | Audit Log | Admin |

---

## RBAC (Role-Based Access Control)

| สิทธิ์ | Admin | Operator | Viewer |
|--------|:-----:|:--------:|:------:|
| จัดการผู้ใช้ | ✅ | ❌ | ❌ |
| สร้าง/ลบ ห้อง+เซ็นเซอร์ | ✅ | ❌ | ❌ |
| แก้ไขเซ็นเซอร์ | ✅ | ✅ | ❌ |
| ดูข้อมูล + กราฟ | ✅ | ✅ | ✅ |
| Resolve Alert | ✅ | ✅ | ❌ |
| ดู Audit Log | ✅ | ❌ | ❌ |

---

## ฐานข้อมูล MongoDB

ระบบใช้ **MongoDB 7+** ผ่าน Mongoose ODM ชื่อฐานข้อมูล default คือ `herbal_storage`

### การเชื่อมต่อ

```
mongodb://localhost:27017/herbal_storage                              # Local
mongodb+srv://<user>:<pass>@cluster.mongodb.net/herbal_storage       # Atlas
```

Connection Pool ตั้งค่าไว้ที่ `maxPoolSize: 10` พร้อม timeout 5 วินาที (server selection) และ 45 วินาที (socket) เพื่อรองรับสภาพแวดล้อม Serverless ของ Next.js

---

### Collections

ระบบมีทั้งหมด **8 collections** ดังนี้:

#### 1. `users` — ผู้ใช้งานและบทบาท

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `_id` | ObjectId | Primary Key |
| `email` | String (unique) | อีเมล (lowercase) |
| `passwordHash` | String | bcrypt hash |
| `name` | String | ชื่อผู้ใช้ |
| `role` | `admin` \| `operator` \| `viewer` | บทบาท RBAC |
| `assignedRooms` | String[] | รายการ Room ID ที่ Operator รับผิดชอบ |
| `notificationPreferences` | Object | ตั้งค่าการแจ้งเตือน Discord / Email |
| `lastLogin` | Date | เวลา login ล่าสุด |
| `loginAttempts` | Number | จำนวนครั้งที่ login ผิดพลาด |
| `lockedUntil` | Date | เวลาที่ account ถูก lock |
| `isActive` | Boolean | สถานะบัญชี (Soft Delete) |
| `createdAt` / `updatedAt` | Date | Timestamp (auto) |

---

#### 2. `rooms` — ห้องเก็บยาสมุนไพร

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `_id` | ObjectId | Primary Key |
| `name` | String | ชื่อห้อง |
| `description` | String | รายละเอียด |
| `location` | String | สถานที่ตั้ง |
| `thresholds.temperature` | `{ min, max }` | ขอบเกณฑ์อุณหภูมิ (°C) ค่า default 20–30 |
| `thresholds.humidity` | `{ min, max }` | ขอบเกณฑ์ความชื้น (%) ค่า default 40–60 |
| `notifications` | Object | ตั้งค่าแจ้งเตือน Discord ต่อห้อง |
| `externalWeather` | Object | เปิดใช้อากาศภายนอก + พิกัด GPS |
| `acOptimization` | Object | ตั้งค่า AC Optimization (RL) |
| `isActive` | Boolean | Soft Delete |
| `createdAt` / `updatedAt` | Date | Timestamp (auto) |

---

#### 3. `sensornodes` — อุปกรณ์ IoT (ESP32)

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `_id` | ObjectId | Primary Key |
| `nodeId` | String (unique, indexed) | ID หลักที่ตั้งค่าบน ESP32 ผ่าน WiFiManager |
| `name` | String | ชื่อเซ็นเซอร์ |
| `type` | `environmental` \| `power` | ประเภทเซ็นเซอร์ |
| `roomId` | ObjectId → `rooms` | ห้องที่ติดตั้ง |
| `status` | `online` \| `offline` \| `warning` | สถานะปัจจุบัน |
| `lastSeen` | Date | เวลาส่งข้อมูลล่าสุด |
| `config.reportInterval` | Number | ความถี่ส่งข้อมูล (วินาที) default 60 |
| `config.firmware` | String | เวอร์ชัน Firmware |
| `isActive` | Boolean | Soft Delete |
| `createdAt` / `updatedAt` | Date | Timestamp (auto) |

---

#### 4. `sensordatas` — ข้อมูลดิบจากเซ็นเซอร์ (Time Series)

Collection หลักที่รับข้อมูลจาก ESP32 ต่อเนื่องตลอดเวลา รองรับ 2 ประเภท:

**Environmental** (DHT22 — อุณหภูมิ/ความชื้น):

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `nodeId` | String (indexed) | อ้างอิง `sensornodes.nodeId` |
| `roomId` | ObjectId (indexed) | อ้างอิง `rooms._id` (denormalized) |
| `timestamp` | Date | เวลาบันทึก |
| `type` | `"environmental"` | ประเภทข้อมูล |
| `readings.temperature` | Number | อุณหภูมิ (°C) |
| `readings.humidity` | Number | ความชื้นสัมพัทธ์ (%) |

**Power** (SCT-013 — ไฟฟ้า/แอร์):

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `type` | `"power"` | ประเภทข้อมูล |
| `readings.voltage` | Number | แรงดันไฟฟ้า (V) |
| `readings.current` | Number | กระแสไฟฟ้า (A) |
| `readings.power` | Number | กำลังไฟฟ้า (W) |
| `readings.energy` | Number | พลังงานสะสม (kWh) |

**Indexes:**

```
{ roomId: 1, timestamp: -1 }
{ roomId: 1, type: 1, timestamp: -1 }
{ nodeId: 1, timestamp: -1 }
{ type: 1, nodeId: 1, timestamp: -1 }
{ timestamp: 1 }  →  TTL: ลบอัตโนมัติหลัง 90 วัน
```

---

#### 5. `alerts` — การแจ้งเตือน

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `_id` | ObjectId | Primary Key |
| `roomId` | ObjectId (indexed) | ห้องที่เกิดเหตุ |
| `nodeId` | String | เซ็นเซอร์ที่เกิดเหตุ |
| `type` | `threshold` \| `anomaly` \| `offline` \| `system` | ประเภทการแจ้งเตือน |
| `severity` | `info` \| `warning` \| `critical` | ระดับความรุนแรง |
| `message` | String | ข้อความแจ้งเตือน |
| `data.value` | Number | ค่าที่วัดได้ |
| `data.threshold` | Number | ค่าเกณฑ์ที่กำหนด |
| `data.anomalyScore` | Number | คะแนนความผิดปกติจาก ML |
| `data.source` | `threshold` \| `ml_environmental` \| `ml_power` | แหล่งที่มาของ Alert |
| `isResolved` | Boolean | สถานะการแก้ไข |
| `resolvedAt` | Date | เวลา Resolve |
| `resolvedBy` | String | ผู้ Resolve |
| `createdAt` / `updatedAt` | Date | Timestamp (auto) |

---

#### 6. `auditlogs` — Audit Trail

บันทึกทุกการกระทำของผู้ใช้สำหรับ Compliance และการตรวจสอบย้อนหลัง

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `userId` | String (indexed) | ID ผู้กระทำ |
| `userEmail` | String | อีเมลผู้กระทำ |
| `userName` | String | ชื่อผู้กระทำ |
| `userRole` | String | บทบาทขณะนั้น |
| `action` | Enum | เช่น `login`, `room_create`, `alert_resolve` |
| `resource` | Enum | `auth` \| `user` \| `room` \| `sensor` \| `alert` \| `settings` \| `data` |
| `resourceId` | String | ID ของ resource ที่ถูกกระทำ |
| `details` | String | คำอธิบายเหตุการณ์ |
| `metadata` | Mixed | ข้อมูลเพิ่มเติม (JSON) |
| `ipAddress` | String | IP ของผู้กระทำ |
| `userAgent` | String | Browser / Device |
| `success` | Boolean | สำเร็จหรือไม่ |
| `createdAt` | Date | Timestamp (auto) |

**TTL:** ลบอัตโนมัติหลัง **1 ปี**

Action ที่บันทึก: `login`, `logout`, `login_failed`, `user_create`, `user_update`, `user_delete`, `user_password_change`, `room_create`, `room_update`, `room_delete`, `sensor_create`, `sensor_update`, `sensor_delete`, `alert_resolve`, `settings_update`, `data_export`

---

#### 7. `externalweatherdatas` — ข้อมูลอากาศภายนอก

เก็บข้อมูลอากาศจาก OpenWeatherMap เพื่อใช้เป็น Regressor ใน Prophet และวิเคราะห์ Climate

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `location` | String (indexed) | ชื่อสถานที่ เช่น `"ปราจีนบุรี"` |
| `timestamp` | Date | เวลาบันทึก |
| `temperature` | Number | อุณหภูมิภายนอก (°C) |
| `humidity` | Number | ความชื้นภายนอก (%) |
| `pressure` | Number | ความดันบรรยากาศ (hPa) |
| `feelsLike` | Number | อุณหภูมิที่รู้สึก (°C) |
| `weatherCondition` | String | สภาพอากาศ เช่น `"ท้องฟ้าแจ่มใส"` |
| `weatherMain` | String | หมวดหมู่ เช่น `"Clear"`, `"Rain"` |
| `windSpeed` | Number | ความเร็วลม (m/s) |
| `cloudiness` | Number | ปริมาณเมฆ (%) |
| `source` | `TMD` \| `OpenWeatherMap` | แหล่งข้อมูล |
| `coordinates` | `{ lat, lon }` | พิกัด GPS |

**TTL:** ลบอัตโนมัติหลัง **30 วัน**

---

#### 8. `mlmodelmetrics` — ประสิทธิภาพ ML Model

เก็บประวัติความแม่นยำของโมเดลต่อ node เพื่อใช้ทำ Model Drift Analysis ในระยะยาว

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `nodeId` | String (indexed) | เซ็นเซอร์ที่ใช้ train |
| `roomId` | String (indexed) | ห้อง |
| `modelType` | String | เช่น `"HoltWinters-v2.0"`, `"Prophet-v1.0"` |
| `mae` | Number | Mean Absolute Error |
| `rmse` | Number | Root Mean Square Error |
| `mape` | Number | Mean Absolute Percentage Error |
| `trainingPoints` | Number | จำนวนข้อมูลที่ใช้ train |
| `recordedAt` | Date | เวลาบันทึก |

---

### ER Diagram (สรุปความสัมพันธ์)

```
users ──────────────── (assignedRooms[]) ──────────────► rooms
                                                            │
                                                   ┌────────┴────────┐
                                                   │                 │
                                              sensornodes          alerts
                                                   │
                                              sensordatas
                                             (Time Series)

rooms ──────────────── (location) ─────────────────────► externalweatherdatas

sensornodes ──────────── (nodeId) ─────────────────────► mlmodelmetrics

auditlogs ──────────────────────────────────────── (standalone)
```

---

### Data Retention Policy

| Collection | นโยบาย |
|-----------|--------|
| `sensordatas` | TTL Index — ลบอัตโนมัติหลัง **90 วัน** |
| `externalweatherdatas` | TTL Index — ลบอัตโนมัติหลัง **30 วัน** |
| `auditlogs` | TTL Index — ลบอัตโนมัติหลัง **1 ปี** |
| `rooms`, `sensornodes`, `users` | **Soft Delete** (`isActive: false`) ไม่ลบจริง |
| `alerts` | เก็บถาวร — Resolve แต่ไม่ลบ |
| `mlmodelmetrics` | เก็บถาวร — ใช้วิเคราะห์ Model Drift |

---

## โครงสร้างโปรเจกต์

```
├── app/
│   ├── api/
│   │   ├── auth/                 # Login, Logout, Me
│   │   ├── data/ingest/          # IoT data ingestion
│   │   ├── rooms/                # Room CRUD
│   │   ├── sensors/              # Sensor CRUD
│   │   ├── alerts/               # Alert management
│   │   ├── ml/                   # ML analysis
│   │   ├── predictions/          # Prediction results
│   │   ├── climate/analyze/      # Climate analysis (ML-enhanced)
│   │   ├── recommendations/ac/   # AC recommendations (RL-enhanced)
│   │   ├── weather/              # External weather data
│   │   ├── stats/                # Dashboard statistics
│   │   ├── users/                # User management
│   │   ├── audit-logs/           # Audit log
│   │   └── notify/               # Notification management
│   ├── login/                    # Login page
│   └── globals.css               # Global styles
│
├── components/
│   ├── dashboard/                # Dashboard components (25 files)
│   ├── auth/                     # Auth context & login form
│   └── ui/                       # shadcn/ui base components
│
├── lib/
│   ├── types.ts                  # Type definitions
│   ├── db-service.ts             # MongoDB data access
│   ├── ml-service.ts             # ML engine (Holt-Winters, Anomaly)
│   ├── ml-python-bridge.ts       # Python ML bridge
│   ├── climate-analyzer.ts       # Climate analysis (rule + ML)
│   ├── ac-optimizer.ts           # AC recommendation (rule + RL)
│   ├── weather-service.ts        # OpenWeatherMap integration
│   ├── auth-service.ts           # JWT authentication
│   ├── auth-middleware.ts        # RBAC middleware
│   ├── notification-service.ts   # Discord & LINE
│   ├── alert-service.ts          # Alert logic
│   ├── audit-log-service.ts      # Audit logging
│   ├── ml-cache.ts               # Prediction caching
│   ├── ml-metrics.ts             # ML metrics calculation
│   ├── i18n.ts                   # Thai translations
│   ├── models.ts                 # Mongoose schemas
│   └── mongodb.ts                # DB connection
│
├── scripts/
│   ├── ml_prophet.py             # Prophet prediction
│   ├── ml_prophet_with_weather.py# Prophet + external weather regressors
│   ├── ml_ac_rl.py               # Q-Learning AC optimizer
│   ├── ml_isolation_forest.py    # Isolation Forest anomaly
│   ├── ml_lstm_autoencoder.py    # LSTM Autoencoder anomaly
│   ├── ml_ocsvm.py               # One-Class SVM anomaly
│   ├── ml_ensemble_anomaly.py    # Ensemble anomaly (IF+LSTM+SVM)
│   ├── ml_ensemble.py            # Ensemble utilities
│   ├── ml_model_manager.py       # Model caching & versioning
│   ├── requirements-ml.txt       # Python dependencies
│   ├── seed-mongodb.js           # Database seeder
│   ├── seed-users.js             # User seeder
│   └── test-sensor-*.js          # IoT simulation scripts
│
└── docs/
    ├── README_ML.md              # ML models & setup guide
    ├── README_IOT.md             # ESP32 integration guide
    └── ANOMALY_DETECTION_GUIDE.md# Anomaly detection details
```

---

## การเชื่อมต่อ ESP32

ดูคู่มือและตัวอย่าง Arduino ที่ [docs/README_IOT.md](./docs/README_IOT.md)

```bash
# ทดสอบส่งข้อมูลจำลอง
node scripts/test-sensor-environmental.js
node scripts/test-sensor-power.js
```

---

## เอกสารเพิ่มเติม

- [docs/README_ML.md](./docs/README_ML.md) — รายละเอียด ML ทั้งหมด (Prophet, RL, Anomaly Detection)
- [docs/README_IOT.md](./docs/README_IOT.md) — คู่มือเชื่อมต่อ ESP32 + ตัวอย่างโค้ด Arduino
- [docs/ANOMALY_DETECTION_GUIDE.md](./docs/ANOMALY_DETECTION_GUIDE.md) — รายละเอียด Anomaly Detection ทุกวิธี