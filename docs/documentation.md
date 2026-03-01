# เอกสารประกอบระบบ IoT Herbal Storage Monitoring System

## 1. บทนำ

ระบบ IoT Herbal Storage Monitoring System เป็น Web Application แบบครบวงจร สำหรับติดตามและพยากรณ์แนวโน้มของอุณหภูมิและความชื้นในห้องเก็บยาสมุนไพร พัฒนาด้วย Full-Stack TypeScript (Next.js) ร่วมกับ IoT (ESP32) และ Machine Learning หลายระดับ

## 2. สถาปัตยกรรมระบบ

ระบบออกแบบเป็น Monolithic Application บน Next.js ประกอบด้วย:

- **Frontend** — React 19, SWR (polling), TailwindCSS v4, shadcn/ui, Recharts
- **Backend** — Next.js API Routes, JWT authentication, RBAC middleware
- **Database** — MongoDB 7+ ผ่าน Mongoose ODM
- **ML Service** — TypeScript (built-in) + Python (optional) ผ่าน child_process bridge
- **IoT Integration** — ESP32 ส่งข้อมูลผ่าน REST API `POST /api/data/ingest`
- **Notifications** — Discord Webhook + LINE Notify
- **Weather** — OpenWeatherMap API สำหรับข้อมูลอากาศภายนอก

## 3. เทคโนโลยีที่ใช้

| ด้าน | เทคโนโลยี |
|------|----------|
| Frontend | Next.js 15, React 19, TypeScript, TailwindCSS v4, shadcn/ui, Recharts, SWR |
| Backend | Next.js API Routes, TypeScript |
| Database | MongoDB 7+ (Mongoose ODM) |
| ML — Built-in | Holt-Winters, Z-Score, IQR, Isolation Forest (TypeScript) |
| ML — Python | Prophet, Prophet + Weather Regressors, Isolation Forest, LSTM Autoencoder, One-Class SVM, Ensemble, Q-Learning RL |
| Auth | JWT (jose), bcryptjs |
| Notifications | Discord Webhook, LINE Notify |
| Weather | OpenWeatherMap API |

## 4. คุณสมบัติหลัก

### 4.1 การติดตามแบบ Real-time
- แสดงอุณหภูมิและความชื้นล่าสุดจากทุกเซ็นเซอร์ในแต่ละห้อง
- กราฟข้อมูลย้อนหลัง (hourly aggregation)
- สถานะแอร์ (เปิด/ปิด, กำลังไฟ) จาก Power Sensor

### 4.2 การแจ้งเตือนอัตโนมัติ
- แจ้งเตือนเมื่อค่าเกินเกณฑ์ที่กำหนดของแต่ละห้อง
- ส่งผ่าน Discord Webhook และ LINE Notify
- Audit Log บันทึกทุก action

### 4.3 การตรวจจับความผิดปกติ (Anomaly Detection)
- **TypeScript:** Z-Score, IQR, Rate of Change, Simplified Isolation Forest
- **Python:** Isolation Forest, LSTM Autoencoder, One-Class SVM, Ensemble Detector
- **Power Sensor:** ตรวจจับกระแสสูง/ต่ำผิดปกติ, อุปกรณ์ดับ
- **Severity:** 5 ระดับ (Normal, Low, Medium, High, Critical)

### 4.4 การพยากรณ์แนวโน้ม (Time Series Prediction)
- **Holt-Winters** (TypeScript) — ทำงานทันที, α=0.2, β=0.1, γ=0.15
- **Prophet Ensemble** (Python) — Prophet + SMA + Exponential Smoothing
- **Prophet + Weather Regressors** (Python) — ใช้อุณหภูมิ/ความชื้นภายนอกเป็น regressor
- พยากรณ์ล่วงหน้า 6 ชั่วโมง
- เมตริก: MAE, RMSE, MAPE จาก backtest

### 4.5 วิเคราะห์สภาพอากาศ (Climate Analysis)
- เปรียบเทียบอุณหภูมิ/ความชื้นภายใน vs ภายนอก
- คำนวณ Heat Load, AC Efficiency Score, Dew Point, Heat Index
- ML-enhanced prediction (trend, confidence) เมื่อมี Python ML

### 4.6 คำแนะนำการปรับแอร์ (AC Recommendation)
- **Rule-based:** ตรรกะตามความต่างอุณหภูมิ, ความชื้น, พยากรณ์อากาศ
- **Reinforcement Learning:** Q-Learning เรียนรู้จากข้อมูลจริง + Thermal Model
- Merge อัตโนมัติ — RL override เมื่อ confidence ≥ 30%

### 4.7 การจัดการผู้ใช้งาน (RBAC)

| สิทธิ์ | Admin | Operator | Viewer |
|--------|:-----:|:--------:|:------:|
| จัดการผู้ใช้ | ✅ | ❌ | ❌ |
| สร้าง/ลบ ห้อง+เซ็นเซอร์ | ✅ | ❌ | ❌ |
| แก้ไขเซ็นเซอร์ | ✅ | ✅ | ❌ |
| ดูข้อมูล + กราฟ | ✅ | ✅ | ✅ |
| Resolve Alert | ✅ | ✅ | ❌ |
| ดู Audit Log | ✅ | ❌ | ❌ |

## 5. การติดตั้งและตั้งค่า

### 5.1 ติดตั้ง

```bash
git clone https://github.com/suchaphut/v0-io-t-herbal-storage-system.git
cd v0-io-t-herbal-storage-system
pnpm install
```

### 5.2 ตั้งค่า Environment

คัดลอก `.env.example` เป็น `.env.local`:

```bash
cp .env.example .env.local
```

ตัวแปรที่จำเป็น:

| ตัวแปร | บังคับ | คำอธิบาย |
|--------|:------:|---------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret สำหรับ JWT (≥ 32 ตัวอักษร) |
| `SENSOR_API_KEY` | ✅ | API key สำหรับ IoT sensors |
| `ENABLE_PYTHON_ML` | ❌ | `1` เปิดใช้ Python ML |
| `OPENWEATHER_API_KEY` | ❌ | OpenWeatherMap API key |
| `DISCORD_WEBHOOK_URL` | ❌ | Discord Webhook |
| `LINE_NOTIFY_TOKEN` | ❌ | LINE Notify token |

### 5.3 Seed ข้อมูลเริ่มต้น

```bash
node scripts/seed-mongodb.js    # ห้อง + เซ็นเซอร์ + ข้อมูลตัวอย่าง
node scripts/seed-users.js      # ผู้ใช้ (admin / operator / viewer)
```

### 5.4 รันระบบ

```bash
pnpm dev                        # Development
pnpm build && pnpm start        # Production
```

### 5.5 ติดตั้ง Python ML (ไม่บังคับ)

```bash
pip install -r scripts/requirements-ml.txt
```

## 6. การเชื่อมต่อ IoT

อุปกรณ์ ESP32 ส่งข้อมูลผ่าน `POST /api/data/ingest`:

- **Environmental:** `{ nodeId, type: "environmental", readings: { temperature, humidity } }`
- **Power:** `{ nodeId, type: "power", readings: { voltage, current, power, energy } }`

ดูรายละเอียดและตัวอย่าง Arduino ที่ [README_IOT.md](./README_IOT.md)

## 7. Machine Learning

ระบบ ML แบ่ง 3 ชั้น:

### ชั้น 1: TypeScript Built-in (ไม่ต้องติดตั้งเพิ่ม)
- Holt-Winters Triple Exponential Smoothing (Prediction)
- Z-Score + IQR + Rate of Change + Simplified Isolation Forest (Anomaly)

### ชั้น 2: Python ML (`ENABLE_PYTHON_ML=1`)
- Prophet Ensemble — `scripts/ml_prophet.py`
- Prophet + Weather Regressors — `scripts/ml_prophet_with_weather.py`
- Isolation Forest — `scripts/ml_isolation_forest.py`
- LSTM Autoencoder — `scripts/ml_lstm_autoencoder.py`
- One-Class SVM — `scripts/ml_ocsvm.py`
- Ensemble (IF+LSTM+SVM) — `scripts/ml_ensemble_anomaly.py`

### ชั้น 3: RL & Climate Intelligence
- Q-Learning AC Optimizer — `scripts/ml_ac_rl.py`
- Climate Analysis (Rule + ML) — `lib/climate-analyzer.ts`
- AC Recommendation (Rule + RL) — `lib/ac-optimizer.ts`

ทุกชั้นมี **fallback อัตโนมัติ** — ถ้า Python ล้มเหลว จะใช้ TypeScript ทันที

ดูรายละเอียดทั้งหมดที่ [README_ML.md](./README_ML.md)

## 8. การคำนวณเมื่อมีหลายเซ็นเซอร์ต่อห้อง

| จุดที่ใช้ | วิธีคำนวณ |
|-----------|----------|
| การ์ดห้อง (Dashboard) | ค่าเฉลี่ยของค่าล่าสุดจากทุก node ในห้อง |
| กราฟรายละเอียดห้อง | เฉลี่ยต่อช่วงเวลา (hourly aggregation) |
| ML Prediction | ใช้ข้อมูลจาก environmental node แรกที่พบ |
| Power Sensor | แสดงทุกหน่วย ไม่มีการเฉลี่ย |

## 9. References

[1] Hyndman, R. J., & Athanasopoulos, G. (2018). _Forecasting: principles and practice_ (2nd ed.). OTexts.
[2] Iglewicz, B., & Hoaglin, D. C. (1993). _How to Detect and Handle Outliers_. ASQC Quality Press.
[3] Tukey, J. W. (1977). _Exploratory Data Analysis_. Addison-Wesley.
[4] Watkins, C. J. C. H., & Dayan, P. (1992). _Q-learning_. Machine Learning, 8(3-4), 279-292.
[5] Taylor, S. J., & Letham, B. (2018). _Forecasting at scale_. The American Statistician, 72(1), 37-45.
