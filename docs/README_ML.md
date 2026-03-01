# Machine Learning — คู่มือฉบับเต็ม

ระบบ ML ของ IoT Herbal Storage แบ่งเป็น 3 ชั้น:

1. **TypeScript Built-in** — ทำงานทันทีไม่ต้องติดตั้งอะไรเพิ่ม
2. **Python ML** — Prophet, Isolation Forest, LSTM, SVM, Ensemble (ต้อง `ENABLE_PYTHON_ML=1`)
3. **RL & Climate Intelligence** — Q-Learning AC Optimizer, Prophet + Weather Regressors

ทุกชั้นมี **fallback อัตโนมัติ** — ถ้า Python ล้มเหลว จะใช้ TypeScript แทนทันที

---

## 1. Time Series Prediction (พยากรณ์อุณหภูมิ/ความชื้น)

### 1.1 Holt-Winters (TypeScript — ทำงานทันที)

- **วิธี:** Triple Exponential Smoothing (Level + Trend + Seasonality)
- **พยากรณ์:** 6 ชั่วโมงล่วงหน้า
- **Hyperparameters:** α=0.2, β=0.1, γ=0.15, season=24
- **เมตริก:** MAE, RMSE, MAPE จาก backtest (80/20 split)
- **ไฟล์:** `lib/ml-service.ts` → `predictTimeSeries()`

### 1.2 Prophet Ensemble (Python)

- **วิธี:** Facebook Prophet + SMA + Exponential Smoothing (weighted ensemble)
- **น้ำหนัก:** ปรับตามจำนวนข้อมูล (<48: Prophet 45%, <200: 60%, ≥200: 75%)
- **Smart Fallback:**
  - < 6 จุด → Persistence Model (ใช้ค่าล่าสุด)
  - 6–23 จุด → Damped Linear Trend
  - ≥ 24 จุด → Full Prophet + Ensemble
- **ไฟล์:** `scripts/ml_prophet.py`

### 1.3 Prophet + External Weather Regressors (Python)

- **วิธี:** Prophet ที่ใช้อุณหภูมิและความชื้นภายนอกเป็น additional regressor
- **ประโยชน์:** แม่นยำขึ้นเมื่อสภาพอากาศภายนอกเปลี่ยนแปลง (ร้อน/ฝน/หนาว)
- **น้ำหนัก:** เมื่อมี weather data Prophet ได้น้ำหนักสูงขึ้น (60–85%)
- **ใช้งาน:** `GET /api/climate/analyze?roomId=<id>` จะเรียกอัตโนมัติถ้ามีข้อมูล weather ใน DB
- **ไฟล์:** `scripts/ml_prophet_with_weather.py`

---

## 2. Anomaly Detection (ตรวจจับความผิดปกติ)

### 2.1 TypeScript Built-in

| วิธี | หลักการ | จุดแข็ง |
|------|---------|---------|
| Z-Score | ค่าเบี่ยงเบนจากค่าเฉลี่ย (threshold: 3σ) | เร็ว, เข้าใจง่าย |
| IQR | ช่วง Interquartile Range (Q1-1.5·IQR ถึง Q3+1.5·IQR) | ทนทานต่อ outlier |
| Rate of Change | การเปลี่ยนแปลงเร็วผิดปกติ (>3°C/5min, >10%/5min) | ตรวจจับเซ็นเซอร์เสีย |
| Simplified IF | Isolation Forest แบบง่าย (20 trees, max depth 10) | ตรวจจับ multivariate |

### 2.2 Python — Isolation Forest

- **วิธี:** scikit-learn `IsolationForest` (contamination 2%)
- **Feature sets:** `environmental` (temp, humidity) หรือ `power` (current, power)
- **Output:** scores (0–1), labels (1=normal, -1=anomaly), severities (5 ระดับ)
- **ไฟล์:** `scripts/ml_isolation_forest.py`

### 2.3 Python — LSTM Autoencoder

- **วิธี:** TensorFlow LSTM Autoencoder (reconstruction error)
- **จุดแข็ง:** ตรวจจับ pattern ที่ซับซ้อน, sequence-aware
- **ต้องการ:** TensorFlow (`pip install tensorflow`)
- **ไฟล์:** `scripts/ml_lstm_autoencoder.py`

### 2.4 Python — One-Class SVM

- **วิธี:** scikit-learn `OneClassSVM` (RBF kernel, auto-tune γ)
- **จุดแข็ง:** robust, hyperparameter tuning อัตโนมัติ
- **ไฟล์:** `scripts/ml_ocsvm.py`

### 2.5 Python — Ensemble Detector (แนะนำ)

- **วิธี:** รวม IF + LSTM + SVM ด้วย weighted voting
- **Default weights:** IF 40%, LSTM 35%, SVM 25%
- **Severity:** 5 ระดับ — Normal, Low, Medium, High, Critical
- **เปิดใช้:** `USE_ENSEMBLE_ANOMALY=1`
- **ไฟล์:** `scripts/ml_ensemble_anomaly.py`

### 2.6 Power Sensor Anomaly

ตรวจจับความผิดปกติของกระแสไฟ (แอร์/เครื่องปรับอากาศ):

| สถานการณ์ | ตรวจจับโดย |
|-----------|----------|
| กระแสสูงผิดปกติ (คอมเพรสเซอร์มีปัญหา) | Rule + IF |
| กระแสต่ำผิดปกติ | Rule + IF |
| กระแส = 0 ทั้งที่ควรทำงาน (อุปกรณ์ดับ) | Rule |
| Statistical outlier | Python IF (power feature set) |

---

## 3. Reinforcement Learning — AC Optimizer

### หลักการ

ใช้ **Q-Learning** เรียนรู้ว่าควรปรับแอร์อย่างไรให้ประหยัดพลังงานที่สุด โดยยังรักษาความสบาย:

- **State:** (temp_delta จากเป้า, outdoor_temp, ac_running, hour_bucket)
- **Actions:** `increase`, `decrease`, `maintain`, `turn_on`, `turn_off`
- **Reward:** `-(comfort_penalty + energy_cost)` — ยิ่งสบายและประหยัด = reward สูง

### การทำงาน

1. **Train** จากข้อมูลย้อนหลัง — สร้าง episodes จาก sensor + power + weather data
2. **Thermal Model** — GradientBoostingRegressor ทำนาย next_temp จาก (indoor, outdoor, power, hour)
3. **Synthetic Experience** — ใช้ thermal model จำลองผลของแต่ละ action เพื่อเพิ่มข้อมูลฝึก
4. **Recommend** — เลือก action ที่มี Q-value สูงสุด, merge กับ rule-based ตาม confidence

### API

```bash
# Train RL model จากข้อมูลย้อนหลัง
curl -X POST http://localhost:3000/api/recommendations/ac/train \
  -H "Content-Type: application/json" \
  -H "Cookie: token=<jwt>" \
  -d '{"roomId": "<room-id>"}'

# ขอคำแนะนำ (RL + Rule-based merge อัตโนมัติ)
curl "http://localhost:3000/api/recommendations/ac?roomId=<room-id>" \
  -H "Cookie: token=<jwt>"
```

### Confidence & Fallback

- **confidence ≥ 0.3** → RL override rule-based
- **confidence < 0.3** → ใช้ rule-based อย่างเดียว
- **ยังไม่ train** → ใช้ rule-based (ไม่มี error)

### ไฟล์

| ไฟล์ | หน้าที่ |
|------|---------|
| `scripts/ml_ac_rl.py` | Q-Learning agent + Thermal model |
| `lib/ac-optimizer.ts` | `generateWithRL()` — merge RL + rule-based |
| `lib/ml-python-bridge.ts` | `trainRLACOptimizer()`, `getRLACRecommendation()` |
| `app/api/recommendations/ac/train/route.ts` | Train API endpoint |

---

## 4. Climate Analysis (วิเคราะห์สภาพอากาศ)

### Rule-based (ทำงานทันที)

- คำนวณ Heat Load (W/m²), AC Efficiency Score (0-100)
- Dew Point, Heat Index
- คำแนะนำตามสูตรฟิสิกส์

### ML-enhanced (เมื่อ `ENABLE_PYTHON_ML=1`)

- ใช้ Prophet + External Weather Regressors ทำนายอุณหภูมิภายในล่วงหน้า 6 ชม.
- ข้อมูลอากาศภายนอก (จาก OpenWeatherMap) ใช้เป็น regressor เพิ่มความแม่นยำ
- แสดง trend (warming/cooling/stable), confidence, predicted temp

### API

```
GET /api/climate/analyze?roomId=<id>
```

Response จะมี `mlPrediction` และ `mlModel` เมื่อ Python ML พร้อม

---

## 5. การติดตั้ง Python ML

### ขั้นตอน

```bash
# 1. ติดตั้ง Python dependencies
pip install -r scripts/requirements-ml.txt

# 2. ตั้งค่า .env.local
ENABLE_PYTHON_ML=1
# PYTHON_PATH=python              # ถ้า python ไม่อยู่ใน PATH
# USE_ENSEMBLE_ANOMALY=1          # เปิด Ensemble Anomaly

# 3. รีสตาร์ทเซิร์ฟเวอร์
pnpm dev
```

### Python Dependencies

| Package | Version | ใช้โดย |
|---------|---------|--------|
| pandas | ≥ 2.0.0 | Prophet, data processing |
| prophet | ≥ 1.1.0 | Time series prediction |
| numpy | ≥ 1.24.0 | ทุก script |
| scikit-learn | ≥ 1.3.0 | IF, SVM, GradientBoosting (RL) |
| joblib | ≥ 1.3.0 | Model serialization |
| tensorflow | ≥ 2.13.0 | LSTM Autoencoder (ไม่บังคับ) |

### Environment Variables

| ตัวแปร | ค่า | คำอธิบาย |
|--------|-----|----------|
| `ENABLE_PYTHON_ML` | `1` | เปิดใช้ Python ML ทั้งหมด |
| `USE_ENSEMBLE_ANOMALY` | `1` | ใช้ Ensemble แทน IF เดี่ยว |
| `PYTHON_PATH` | path | คำสั่ง Python (ถ้าไม่อยู่ใน PATH) |

---

## 6. Python Scripts Reference

ทุก script รับ JSON ทาง stdin และส่ง JSON ทาง stdout:

| Script | Input | Output | Timeout |
|--------|-------|--------|---------|
| `ml_prophet.py` | timestamps, temperature, humidity, horizon_hours, freq_minutes | predictions, metrics, meta | 90s |
| `ml_prophet_with_weather.py` | + external_temperature, external_humidity | predictions, metrics, meta (uses_external_weather) | 90s |
| `ml_ac_rl.py` | mode=train: episodes, room_id / mode=recommend: current state | train result / action, confidence, q_values | 60s |
| `ml_isolation_forest.py` | data, contamination, feature_set | scores, labels, severities | 30s |
| `ml_lstm_autoencoder.py` | data, contamination, feature_set, sequence_length | scores, labels, severities | 120s |
| `ml_ocsvm.py` | data, contamination, feature_set, kernel | scores, labels, severities | 30s |
| `ml_ensemble_anomaly.py` | data, contamination, feature_set, weights | scores, labels, severities, meta | 180s |

### ทดสอบด้วยมือ

```bash
# Prophet
echo '{"timestamps":["2024-01-01T00:00:00Z","2024-01-01T01:00:00Z"],"temperature":[25,26],"humidity":[55,56],"horizon_hours":6}' | python scripts/ml_prophet.py

# RL AC — recommend
echo '{"mode":"recommend","room_id":"room1","indoor_temp":27,"indoor_humidity":60,"outdoor_temp":35,"outdoor_humidity":70,"ac_power":1200,"ac_running":true,"target_temp":25,"hour":14}' | python scripts/ml_ac_rl.py

# Isolation Forest
echo '{"data":[[25,55],[26,56],[30,80]],"contamination":0.05,"feature_set":"environmental"}' | python scripts/ml_isolation_forest.py

# Ensemble (แนะนำ)
echo '{"data":[[25,55],[26,56],[30,80]],"contamination":0.05,"feature_set":"environmental"}' | python scripts/ml_ensemble_anomaly.py
```

---

## 7. API ที่เกี่ยวข้อง

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| `GET` | `/api/ml/analyze?roomId=<id>` | ML Analysis เต็ม (Prediction + Anomaly) |
| `GET` | `/api/predictions/<roomId>` | ผลพยากรณ์อย่างเดียว |
| `GET` | `/api/climate/analyze?roomId=<id>` | Climate Analysis + ML Prediction |
| `GET` | `/api/recommendations/ac?roomId=<id>` | AC Recommendation (Rule + RL) |
| `POST` | `/api/recommendations/ac/train` | Train RL model |
| `POST` | `/api/data/ingest` | IoT data + auto Anomaly + Alert |

---

## 8. สถาปัตยกรรม ML

```
                    ┌──────────────────────────────────────┐
                    │         API Request (GET/POST)        │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │         ml-service.ts                 │
                    │  (Orchestrator — เลือก model ที่เหมาะ) │
                    └──┬────────────┬──────────────────┬───┘
                       │            │                  │
        ┌──────────────▼──┐  ┌─────▼──────────┐  ┌───▼────────────────┐
        │   TypeScript    │  │  Python Bridge  │  │  Climate / AC      │
        │  Holt-Winters   │  │  ml-python-     │  │  climate-analyzer  │
        │  Z-Score / IQR  │  │  bridge.ts      │  │  ac-optimizer      │
        │  IF (simplified)│  │                 │  │                    │
        └─────────────────┘  └──────┬──────────┘  └────────┬───────────┘
                                    │                      │
                    ┌───────────────▼──────────────────────▼──┐
                    │          Python Scripts (stdin/stdout)    │
                    │                                          │
                    │  ml_prophet.py          Prediction        │
                    │  ml_prophet_with_weather.py  + Weather    │
                    │  ml_ac_rl.py            RL Q-Learning     │
                    │  ml_isolation_forest.py  Anomaly          │
                    │  ml_lstm_autoencoder.py  Anomaly          │
                    │  ml_ocsvm.py            Anomaly           │
                    │  ml_ensemble_anomaly.py  Ensemble         │
                    └──────────────────────────────────────────┘
```
