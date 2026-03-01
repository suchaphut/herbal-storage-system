# คู่มือเชื่อมต่อ IoT Device (ESP32)

คู่มือสำหรับเชื่อมต่อ ESP32 กับระบบ IoT Herbal Storage Monitoring System

---

## API Endpoint

```
POST http://<server-ip>:3000/api/data/ingest
Content-Type: application/json
```

---

## ประเภทเซ็นเซอร์

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

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `nodeId` | string | ID ของเซ็นเซอร์ (ต้องลงทะเบียนในระบบก่อน) |
| `type` | `"environmental"` | ประเภทเซ็นเซอร์ |
| `readings.temperature` | number | อุณหภูมิ (°C) |
| `readings.humidity` | number | ความชื้นสัมพัทธ์ (%) |

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

| Field | Type | คำอธิบาย |
|-------|------|---------|
| `nodeId` | string | ID ของเซ็นเซอร์ |
| `type` | `"power"` | ประเภทเซ็นเซอร์ |
| `readings.voltage` | number | แรงดัน (V) |
| `readings.current` | number | กระแส (A) |
| `readings.power` | number | กำลังไฟ (W) |
| `readings.energy` | number | พลังงานสะสม (kWh) |

---

## Response

**สำเร็จ (201):**
```json
{
  "success": true,
  "message": "Data ingested successfully",
  "dataId": "..."
}
```

**ข้อผิดพลาด (400/404):**
```json
{
  "success": false,
  "error": "Sensor node ESP32-ENV-999 not found"
}
```

---

## ขั้นตอนการเชื่อมต่อ

1. **ลงทะเบียนเซ็นเซอร์** ในระบบผ่าน Dashboard (Admin) หรือ API `POST /api/sensors`
2. **กำหนด nodeId** ให้ตรงกับที่ลงทะเบียน
3. **ส่งข้อมูล** ทุก 1–5 นาที ด้วย HTTP POST

---

## ตัวอย่างโค้ด ESP32 Arduino

### Environmental Sensor (DHT22)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ──── ตั้งค่า ────
const char* ssid       = "YOUR_WIFI_SSID";
const char* password   = "YOUR_WIFI_PASSWORD";
const char* serverUrl  = "http://YOUR_SERVER_IP:3000/api/data/ingest";
const char* nodeId     = "ESP32-ENV-001";

#define DHTPIN  4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ──── Setup ────
void setup() {
  Serial.begin(115200);
  dht.begin();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
}

// ──── Loop ────
void loop() {
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT read failed, retrying...");
    delay(5000);
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["nodeId"] = nodeId;
    doc["type"]   = "environmental";
    JsonObject readings = doc.createNestedObject("readings");
    readings["temperature"] = temperature;
    readings["humidity"]    = humidity;

    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("Sent: %.1f°C, %.1f%% → HTTP %d\n", temperature, humidity, code);
    http.end();
  }

  delay(60000);  // ส่งทุก 1 นาที
}
```

### Power Sensor (SCT-013 Current Sensor)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ──── ตั้งค่า ────
const char* ssid       = "YOUR_WIFI_SSID";
const char* password   = "YOUR_WIFI_PASSWORD";
const char* serverUrl  = "http://YOUR_SERVER_IP:3000/api/data/ingest";
const char* nodeId     = "ESP32-PWR-001";

#define CT_PIN      34
#define VOLTAGE     220.0
#define CT_RATIO    30.0    // SCT-013-030: 30A/1V
#define ADC_REF     3.3
#define ADC_COUNTS  4096

// ──── Setup ────
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  Serial.println("WiFi connected");
}

float readCurrent() {
  long sum = 0;
  int samples = 1000;
  for (int i = 0; i < samples; i++) {
    int raw = analogRead(CT_PIN) - (ADC_COUNTS / 2);
    sum += (long)raw * raw;
    delayMicroseconds(100);
  }
  float rms = sqrt((float)sum / samples);
  return (rms / ADC_COUNTS) * ADC_REF * CT_RATIO;
}

// ──── Loop ────
void loop() {
  float current = readCurrent();
  float power   = current * VOLTAGE;

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["nodeId"] = nodeId;
    doc["type"]   = "power";
    JsonObject readings = doc.createNestedObject("readings");
    readings["voltage"] = VOLTAGE;
    readings["current"] = current;
    readings["power"]   = power;
    readings["energy"]  = 0;

    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("Sent: %.2fA, %.0fW → HTTP %d\n", current, power, code);
    http.end();
  }

  delay(60000);  // ส่งทุก 1 นาที
}
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

## Libraries ที่ต้องติดตั้ง (Arduino IDE)

| Library | ใช้สำหรับ |
|---------|----------|
| `ArduinoJson` (v6+) | สร้าง JSON payload |
| `DHT sensor library` | อ่านค่าจาก DHT22 |
| `WiFi` (built-in ESP32) | เชื่อมต่อ WiFi |
