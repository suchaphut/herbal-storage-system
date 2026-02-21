# Machine Learning ในโปรเจกต์ Herbal Storage

## สิ่งที่ระบบทำได้ (ใช้งานได้จริง)

### 1. Time Series Prediction (Environmental Sensor)
- **โมเดล:** Holt-Winters Triple Exponential Smoothing (ใน TypeScript)
- **พยากรณ์:** อุณหภูมิและความชื้นล่วงหน้า 6 ชั่วโมง
- **เมตริก:** MAE, RMSE, MAPE คำนวณจาก Backtest (จริง vs พยากรณ์)
- **กราฟ:** แสดงกราฟจริง vs พยากรณ์ (Validation) เมื่อมีข้อมูลย้อนหลังเพียงพอ

### 2. Anomaly Detection (Environmental Sensor)
- **วิธี:** Z-Score, IQR, Rate of Change + **Isolation Forest (แบบง่ายใน TS)**
- **คุณสมบัติ:** ตรวจจับ Outlier อัตโนมัติ, แสดง Anomaly Score, รองรับ Online/Batch
- **เคส:** Temp สูงผิดปกติทั้งที่แอร์เปิด, Humidity พุ่งผิดธรรมชาติ, เซ็นเซอร์ค้าง

### 3. Current Sensor (แอร์/เครื่องปรับอากาศ)
- **ตรวจจับ:**  
  - กระแสสูงผิดปกติ → แอร์กินไฟมากเกิน (คอมเพรสเซอร์อาจมีปัญหา)  
  - กระแสต่ำผิดปกติ  
  - กระแส = 0 ทั้งที่ควรทำงาน → อุปกรณ์ดับ
- **การแจ้งเตือน:** เชื่อมกับระบบ Alert อัตโนมัติเมื่อ ingest ข้อมูล power

---

## การเปิดใช้ Python ML (Prophet + scikit-learn Isolation Forest)

เมื่อเปิดใช้ ระบบจะเรียกสคริปต์ Python ผ่าน `lib/ml-python-bridge.ts` แทนโมเดล TypeScript (Holt-Winters / Isolation Forest แบบย่อ) โดยมี fallback กลับไปใช้ TS อัตโนมัติถ้า Python ล้มเหลวหรือไม่ได้ติดตั้ง

### ขั้นตอน

1. **ติดตั้ง Python** (3.9+) และให้คำสั่ง `python` หรือ `python3` ใช้ได้ใน PATH  
   - Windows: มักใช้ `python`  
   - Linux/macOS: มักใช้ `python3`

2. **ติดตั้ง dependencies ของ Python**

   ```bash
   pip install -r scripts/requirements-ml.txt
   ```

3. **ตั้งค่า environment**

   ใน `.env.local` หรือ environment ที่รัน Next.js:

   ```env
   ENABLE_PYTHON_ML=1
   ```

   ถ้าใช้คำสั่ง Python ไม่ใช่ `python`/`python3` (เช่น path เต็ม):

   ```env
   ENABLE_PYTHON_ML=1
   PYTHON_PATH=C:\Python311\python.exe
   ```

4. **รีสตาร์ทเซิร์ฟเวอร์** (เช่น `pnpm dev`) แล้วเปิดหน้า ML พยากรณ์หรือเรียก `GET /api/ml/analyze?roomId=...`  
   - **Prediction:** ใช้ Prophet (สคริปต์ `scripts/ml_prophet.py`)  
   - **Anomaly (Isolation Forest):** ใช้ scikit-learn (สคริปต์ `scripts/ml_isolation_forest.py`)  
   - ถ้า Python error หรือ timeout ระบบจะ fallback ไปใช้ Holt-Winters / Isolation Forest แบบ TypeScript โดยไม่แจ้ง error ไปที่ผู้ใช้

### สรุปตัวแปร environment

| ตัวแปร | ค่า | ความหมาย |
|--------|-----|----------|
| `ENABLE_PYTHON_ML` | `1` หรือ `true` | เปิดใช้ Prophet + Python Isolation Forest |
| `PYTHON_PATH` | (ไม่บังคับ) | คำสั่งรัน Python ถ้าไม่ใช้ `python`/`python3` ใน PATH |

### สคริปต์ที่ถูกเรียกจาก bridge

| สคริปต์ | อินพุต (stdin) | เอาต์พุต (stdout) |
|--------|----------------|-------------------|
| `scripts/ml_prophet.py` | JSON: `timestamps`, `temperature`, `humidity`, `horizon_hours`, `freq_minutes` | JSON: `predictions`, `metrics`, `actuals`, `backtest_predicted` |
| `scripts/ml_isolation_forest.py` | JSON: `data` (array of [temp, humidity]), `contamination` | JSON: `scores`, `labels` |

### ตัวอย่างเรียกสคริปต์ด้วยมือ (ทดสอบ)

```bash
echo '{"timestamps":["2024-01-01T00:00:00Z"],"temperature":[25],"humidity":[55],"horizon_hours":6,"freq_minutes":30}' | python scripts/ml_prophet.py
echo '{"data":[[25,55],[26,56],[30,80]],"contamination":0.05}' | python scripts/ml_isolation_forest.py
```

---

## API ที่เกี่ยวข้อง

- `GET /api/ml/analyze?roomId=...` – วิเคราะห์ ML เต็ม (Prediction + Anomaly) สำหรับห้อง
- `GET /api/predictions/[roomId]` – ดึงผลพยากรณ์อย่างเดียว
- `POST /api/data/ingest` – รับข้อมูลเซ็นเซอร์ (environmental + power); รัน Anomaly และสร้าง Alert อัตโนมัติ
