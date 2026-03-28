# คู่มือเชื่อมต่อ IoT Device (ESP32)

คู่มือสำหรับเชื่อมต่อ ESP32 กับระบบ IoT Herbal Storage Monitoring System  
**รองรับ WiFiManager** — ตั้งค่า WiFi, Server IP, Port และ API Key ผ่าน AP บนมือถือได้เลย

---

## สารบัญ

1. [API Endpoint & Authentication](#api-endpoint--authentication)
2. [รูปแบบข้อมูล (Payload)](#รูปแบบข้อมูล-payload)
3. [Response Codes](#response-codes)
4. [ขั้นตอนการเชื่อมต่อ](#ขั้นตอนการเชื่อมต่อ)
5. [การต่อวงจร (Wiring)](#การต่อวงจร-wiring)
6. [ไฟล์โค้ด Arduino (พร้อมอัปลง ESP32)](#ไฟล์โค้ด-arduino-พร้อมอัปลง-esp32)
7. [ฟีเจอร์ WiFiManager](#ฟีเจอร์-wifimanager)
8. [ทดสอบโดยไม่ใช้ ESP32](#ทดสอบโดยไม่ใช้-esp32)
9. [Libraries ที่ต้องติดตั้ง](#libraries-ที่ต้องติดตั้ง)

---

## API Endpoint & Authentication

```
POST https://<your-app>.up.railway.app/api/data/ingest
Content-Type: application/json
x-api-key: <SENSOR_API_KEY>
```

**ตัวอย่าง Server URL:**
| สถานการณ์ | Server URL |
|-----------|------------|
| **Railway (Production)** | `https://your-app.up.railway.app` |
| **Local Development** | `http://192.168.1.59:3000` |

> **วิธีหา URL จาก Railway:** เปิด [Railway Dashboard](https://railway.app/dashboard) → เลือก Project → คลิก Service → แท็บ **Settings** → หัวข้อ **Public Networking** → คัดลอก domain

**Authentication:** ทุก request ต้องมี header `x-api-key` ที่ตรงกับ `SENSOR_API_KEY` ใน `.env` ของ server  
(หรือใช้ `Authorization: Bearer <key>` แทนได้)

**Rate Limit:** 60 requests/นาที ต่อ nodeId

---

## รูปแบบข้อมูล (Payload)

### 1. Environmental Sensor (อุณหภูมิ + ความชื้น)

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

| Field | Type | ช่วงค่า | คำอธิบาย |
|-------|------|---------|---------|
| `nodeId` | string | — | ID ของเซ็นเซอร์ (ต้องลงทะเบียนในระบบก่อน) |
| `type` | `"environmental"` | — | ประเภทเซ็นเซอร์ |
| `readings.temperature` | number | -40 ถึง 80 | อุณหภูมิ (°C) |
| `readings.humidity` | number | 0 ถึง 100 | ความชื้นสัมพัทธ์ (%) |

### 2. Power Sensor (กระแสไฟ/แอร์)

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

| Field | Type | ช่วงค่า | คำอธิบาย |
|-------|------|---------|---------|
| `nodeId` | string | — | ID ของเซ็นเซอร์ |
| `type` | `"power"` | — | ประเภทเซ็นเซอร์ |
| `readings.voltage` | number | 0–500 | แรงดัน (V) |
| `readings.current` | number | 0–100 | กระแส (A) |
| `readings.power` | number | 0–50000 | กำลังไฟ (W) |
| `readings.energy` | number | >= 0 | พลังงานสะสม (kWh) |

---

## Response Codes

| HTTP Code | ความหมาย |
|-----------|----------|
| **200/201** | สำเร็จ — `{ "success": true, "data": {...}, "message": "Data received successfully" }` |
| **400** | Payload ไม่ถูกต้อง — ตรวจสอบ JSON format |
| **401** | API Key ไม่ถูกต้องหรือไม่ได้ส่ง |
| **404** | ไม่พบ nodeId — ต้องลงทะเบียนเซ็นเซอร์ก่อน |
| **429** | ส่งข้อมูลถี่เกินไป — รอ Retry-After แล้วส่งใหม่ |
| **500** | Server error |

---

## ขั้นตอนการเชื่อมต่อ

1. **ตั้งค่า `.env`** บน Server → ใส่ค่า `SENSOR_API_KEY=your-secret-key`
2. **หา Server URL** จาก Railway Dashboard (ดูวิธีด้านบน) หรือใช้ IP ถ้ารัน local
3. **ลงทะเบียนเซ็นเซอร์** ในระบบผ่าน Dashboard (Admin) หรือ API `POST /api/sensors`
4. **อัปโหลดโค้ด** ลง ESP32 (เลือกไฟล์ตามประเภทเซ็นเซอร์ ดูด้านล่าง)
5. **เปิด ESP32 ครั้งแรก** → จะสร้าง WiFi AP ให้ตั้งค่า:
   - เชื่อมต่อ WiFi AP: `HerbalENV_Setup` หรือ `HerbalPWR_Setup` (รหัส: `12345678`)
   - เปิดเบราว์เซอร์ไปที่ `192.168.4.1`
   - ใส่ WiFi SSID/Password
   - ใส่ **Server URL** เต็ม เช่น `https://your-app.up.railway.app`
   - ใส่ **API Key** (ค่าเดียวกับ `SENSOR_API_KEY` ใน `.env`)
   - กด Save → ESP32 จะเชื่อมต่อและเริ่มส่งข้อมูลอัตโนมัติ
6. **ตรวจสอบข้อมูล** บน Dashboard

---

## การต่อวงจร (Wiring)

### Environmental Node (DHT22 + LCD I2C)

```
ESP32           DHT22
─────           ─────
3.3V  ────────  VCC (pin 1)
GPIO4 ────────  DATA (pin 2)  + ตัวต้านทาน 10kΩ pull-up ไป 3.3V
GND   ────────  GND (pin 4)

ESP32           LCD I2C (16x2)
─────           ──────────────
3.3V  ────────  VCC
GND   ────────  GND
GPIO21 (SDA) ─  SDA
GPIO22 (SCL) ─  SCL
```

### Power Node (ADS1115 + SCT-013 + LCD I2C)

```
ESP32           ADS1115
─────           ───────
3.3V  ────────  VDD
GND   ────────  GND
GPIO21 (SDA) ─  SDA
GPIO22 (SCL) ─  SCL
               ADDR → GND (address 0x48)

ADS1115         SCT-013-030
───────         ───────────
A0    ────────  สาย output ข้างหนึ่ง
GND   ────────  สาย output อีกข้าง
               + ตัวต้านทาน burden 33Ω คร่อม A0-GND

ESP32           LCD I2C (16x2)
─────           ──────────────
3.3V  ────────  VCC
GND   ────────  GND
GPIO21 (SDA) ─  SDA  (ใช้ I2C bus เดียวกับ ADS1115)
GPIO22 (SCL) ─  SCL
```

> **หมายเหตุ:** LCD I2C address ปกติคือ `0x27` หรือ `0x3F` — ใช้ I2C Scanner ตรวจสอบ  
> ADS1115 address ปกติคือ `0x48` (ADDR → GND)

---

## ไฟล์โค้ด Arduino (พร้อมอัปลง ESP32)

ไฟล์โค้ดอยู่ในโฟลเดอร์ `scripts/`:

| ไฟล์ | ประเภท | เซ็นเซอร์ | WiFi AP Name |
|------|--------|----------|-------------|
| `scripts/esp32_environmental_node.ino` | Environmental | DHT22 + LCD I2C | `HerbalENV_Setup` |
| `scripts/esp32_power_node.ino` | Power | ADS1115 + SCT-013 + LCD I2C | `HerbalPWR_Setup` |

### วิธีอัปโหลด

1. เปิดไฟล์ `.ino` ใน Arduino IDE
2. เลือก Board: **ESP32 Dev Module**
3. เลือก Port ที่ต่อ ESP32
4. **แก้ไข `nodeId`** ในโค้ดให้ตรงกับที่ลงทะเบียนในระบบ
5. กด Upload
6. เปิด Serial Monitor (115200 baud) เพื่อดู log

### สิ่งที่ต้องแก้ไขก่อนอัปโหลด

```cpp
// ── ใน esp32_environmental_node.ino ──
const char* nodeId = "ESP32-ENV-001";  // เปลี่ยนให้ตรงกับระบบ

// ── ใน esp32_power_node.ino ──
const char* nodeId = "ESP32-PWR-001";  // เปลี่ยนให้ตรงกับระบบ
const char* acUnit = "AC1";            // ชื่อแอร์ที่ต้องการแสดงบน LCD
```

> **Server URL และ API Key ไม่ต้องแก้ในโค้ด** — ตั้งค่าผ่าน WiFiManager บนมือถือได้เลย  
> รองรับทั้ง **HTTP** (local) และ **HTTPS** (Railway / Cloud) อัตโนมัติ

---

## ฟีเจอร์ WiFiManager

ทั้ง 2 ไฟล์รองรับฟีเจอร์เหล่านี้:

- **Auto Connect** — ถ้าเคยตั้งค่า WiFi แล้ว จะเชื่อมต่ออัตโนมัติ
- **Config Portal** — ครั้งแรกหรือหลัง Reset จะเปิด AP ให้ตั้งค่าผ่านมือถือ
- **Custom Parameters** — ตั้งค่า Server URL, API Key ผ่านหน้า Config Portal
- **NVS Storage** — บันทึกค่า Config ลง Flash (ไม่หายเมื่อปิดเครื่อง)
- **Reset Button** — กดปุ่ม Boot ค้าง 3 วินาที เพื่อ reset WiFi settings
- **LCD Display** — แสดงสถานะ, ค่าเซ็นเซอร์, จำนวนส่งสำเร็จ
- **Auto Reconnect** — ถ้า WiFi หลุดจะเชื่อมต่อใหม่อัตโนมัติ
- **Error Handling** — จัดการ HTTP 401/404/429 พร้อมแสดงสาเหตุใน Serial Monitor
- **HTTPS Support** — รองรับ Railway / Cloud hosting ด้วย `WiFiClientSecure` (auto-detect จาก URL)
- **SSL Indicator** — แสดง "SSL" บน LCD เมื่อใช้ HTTPS
- **Energy Accumulation** (Power Node) — สะสม kWh + บันทึกลง NVS ทุก 5 นาที

### ตัวอย่างหน้า Config Portal

เมื่อเชื่อมต่อ WiFi AP แล้วเปิด `192.168.4.1`:

```
┌──────────────────────────────────────────────┐
│ 🌿 Herbal Storage - Environmental Node       │
│ Node ID: ESP32-ENV-001                       │
│ Sensors: Temperature (°C), Humidity (%)      │
│                                              │
│ WiFi SSID: [__________________________]      │
│ Password:  [__________________________]      │
│                                              │
│ Server URL: [https://xxx.up.railway.app]     │
│ API Key:    [____________________________]   │
│                                              │
│ Local: http://192.168.1.59:3000              │
│ Railway: https://xxx.up.railway.app          │
│                                              │
│              [ Save ]                        │
└──────────────────────────────────────────────┘
```

---

## ทดสอบโดยไม่ใช้ ESP32

ใช้ scripts จำลองที่มีในโปรเจค:

```bash
# จำลอง Environmental Sensor
node scripts/test-sensor-environmental.js

# จำลอง Power Sensor
node scripts/test-sensor-power.js

# จำลอง IoT Device แบบ loop
node scripts/mock-iot-device.js
```

---

## Libraries ที่ต้องติดตั้ง

ติดตั้งผ่าน Arduino IDE → **Sketch → Include Library → Manage Libraries...**

| Library | Version | ใช้สำหรับ | ใช้กับ Node |
|---------|---------|----------|------------|
| `WiFiManager` by tzapu | >= 2.0.0 | ตั้งค่า WiFi + Config Portal ผ่าน AP | ทั้ง 2 |
| `ArduinoJson` by Benoit Blanchon | v6+ | สร้าง JSON payload | ทั้ง 2 |
| `LiquidCrystal I2C` | >= 1.1.2 | แสดงผล LCD 16x2 | ทั้ง 2 |
| `DHT sensor library` by Adafruit | >= 1.4.0 | อ่านค่า DHT22 | Environmental |
| `Adafruit Unified Sensor` | >= 1.1.0 | dependency ของ DHT library | Environmental |
| `Adafruit ADS1X15` | >= 2.4.0 | อ่านค่า ADS1115 ADC | Power |
| `WiFi` (built-in ESP32) | — | เชื่อมต่อ WiFi | ทั้ง 2 |
| `Preferences` (built-in ESP32) | — | เก็บค่า Config ใน NVS Flash | ทั้ง 2 |

### ติดตั้ง ESP32 Board ใน Arduino IDE

1. ไปที่ **File → Preferences → Additional Board Manager URLs** เพิ่ม:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
2. ไปที่ **Tools → Board → Boards Manager** ค้นหา `esp32` แล้วติดตั้ง
3. เลือก Board: **ESP32 Dev Module**
