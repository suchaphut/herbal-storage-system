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
- **แจ้งเตือนอัตโนมัติ** — ผ่าน Discord และ LINE Notify เมื่อค่าเกินเกณฑ์
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
│  │        Discord Webhook  ·  LINE Notify               │   │
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
| Notifications | Discord Webhook, LINE Notify |
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
| `LINE_NOTIFY_TOKEN` | ❌ | LINE Notify token |
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