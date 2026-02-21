# เอกสารประกอบระบบ Web Application สำหรับติดตามและพยากรณ์อุณหภูมิและความชื้นในห้องเก็บยาสมุนไพร

**ผู้จัดทำ:** Manus AI
**วันที่:** 1 กุมภาพันธ์ 2569

## 1. บทนำ

เอกสารนี้ให้รายละเอียดเกี่ยวกับการออกแบบและพัฒนา Web Application แบบครบวงจร สำหรับระบบติดตามและพยากรณ์แนวโน้มของอุณหภูมิและความชื้นในห้องเก็บยาสมุนไพร ระบบนี้ถูกพัฒนาขึ้นเพื่อช่วยให้ผู้ดูแลสามารถเฝ้าระวังและจัดการสภาพแวดล้อมในห้องเก็บยาสมุนไพรได้อย่างมีประสิทธิภาพ โดยใช้เทคโนโลยี Full-Stack Development, IoT และ Machine Learning เข้ามาช่วยในการทำงาน

## 2. สถาปัตยกรรมระบบ

ระบบถูกออกแบบมาในรูปแบบ Monolithic Application โดยใช้ Next.js Framework ซึ่งรวมทั้งส่วน Frontend และ Backend ไว้ในโปรเจกต์เดียวกัน สถาปัตยกรรมหลักประกอบด้วย:

- **Frontend (Next.js/React):** ส่วนติดต่อผู้ใช้ที่แสดงข้อมูลแบบ Real-time, กราฟข้อมูลย้อนหลัง, การพยากรณ์ และการแจ้งเตือนต่างๆ
- **Backend (Next.js API Routes):** API สำหรับจัดการข้อมูลห้อง, เซ็นเซอร์, ข้อมูลเซ็นเซอร์, การแจ้งเตือน และการเชื่อมต่อกับบริการ Machine Learning
- **Database (MongoDB):** ฐานข้อมูล NoSQL สำหรับจัดเก็บข้อมูลทั้งหมดของระบบ รวมถึงข้อมูลห้อง, เซ็นเซอร์, ข้อมูลเซ็นเซอร์ย้อนหลัง, การแจ้งเตือน และข้อมูลผู้ใช้งาน
- **Machine Learning Service:** โมดูลที่รับผิดชอบในการพยากรณ์แนวโน้มอุณหภูมิและความชื้น (Holt-Winters Triple Exponential Smoothing) และการตรวจจับความผิดปกติ (Anomaly Detection) จากข้อมูลเซ็นเซอร์
- **IoT Integration:** ส่วนที่รองรับการรับข้อมูลจากอุปกรณ์ IoT (เช่น ESP32) ผ่าน API Endpoint เฉพาะ

## 3. เทคโนโลยีที่ใช้

ระบบนี้ถูกพัฒนาโดยใช้เทคโนโลยีหลักดังต่อไปนี้:

- **Frontend:** Next.js, React, TypeScript, TailwindCSS, Recharts (สำหรับกราฟ)
- **Backend:** Next.js API Routes, TypeScript
- **Database:** MongoDB (ผ่าน Mongoose ODM)
- **Machine Learning:** Holt-Winters (Prediction) + Z-Score, IQR, Rate of Change, Isolation Forest แบบง่าย (Anomaly Detection) พัฒนาด้วย TypeScript; ตัวเลือกใช้ Prophet และ scikit-learn Isolation Forest ผ่าน Python scripts ใน `scripts/`
- **Real-time:** ใช้ `useSWR` สำหรับการดึงข้อมูลแบบ Polling เพื่ออัปเดตข้อมูลแบบ Real-time บน Dashboard

## 4. คุณสมบัติหลักของระบบ

ระบบ Web Application นี้มีคุณสมบัติหลักดังต่อไปนี้:

- **การติดตามแบบ Real-time:** แสดงข้อมูลอุณหภูมิและความชื้นล่าสุดจากเซ็นเซอร์ในแต่ละห้อง
- **การแจ้งเตือนตามเกณฑ์ที่กำหนด:** ระบบจะสร้างการแจ้งเตือนโดยอัตโนมัติเมื่ออุณหภูมิหรือความชื้นเกินกว่าช่วงที่กำหนดไว้สำหรับแต่ละห้อง
- **การตรวจจับความผิดปกติ (Anomaly Detection):** ใช้เทคนิค Machine Learning เพื่อระบุค่าข้อมูลที่ผิดปกติ ซึ่งอาจบ่งชี้ถึงปัญหาของเซ็นเซอร์หรือสภาพแวดล้อม
- **การพยากรณ์แนวโน้ม (Time-series Prediction):** พยากรณ์แนวโน้มของอุณหภูมิและความชื้นล่วงหน้า 6 ชั่วโมง เพื่อให้ผู้ดูแลสามารถเตรียมการรับมือได้ทันท่วงที
- **การจัดการผู้ใช้งานและบทบาท:** รองรับบทบาทผู้ใช้งานที่แตกต่างกัน (Admin, Operator, Viewer) พร้อมสิทธิ์การเข้าถึงที่เหมาะสม
- **การจัดการห้องและเซ็นเซอร์:** ผู้ดูแลสามารถเพิ่ม, แก้ไข, ลบข้อมูลห้องและเซ็นเซอร์ได้
- **Dashboard ที่ใช้งานง่าย:** แสดงภาพรวมสถานะของห้องเก็บยาทั้งหมด พร้อมกราฟข้อมูลย้อนหลังและการแจ้งเตือนที่ชัดเจน

## 5. การตั้งค่าและการติดตั้งระบบ

### 5.1. การโคลนโปรเจกต์

```bash
gh repo clone suchaphut/v0-io-t-herbal-storage-system /home/ubuntu/v0-io-t-herbal-storage-system
cd /home/ubuntu/v0-io-t-herbal-storage-system
```

### 5.2. การติดตั้ง Dependencies

```bash
pnpm install
```

### 5.3. การตั้งค่าฐานข้อมูล MongoDB

ระบบใช้ MongoDB เป็นฐานข้อมูล คุณจะต้องมี MongoDB instance ที่สามารถเข้าถึงได้ (เช่น Local MongoDB หรือ MongoDB Atlas)

สร้างไฟล์ `.env.local` ใน root directory ของโปรเจกต์ และเพิ่ม Connection String ของ MongoDB:

```
MONGODB_URI=mongodb://localhost:27017/herbal_storage
```

หรือหากใช้ MongoDB Atlas:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/herbal_storage?retryWrites=true&w=majority
```

### 5.4. การรัน Web Application

```bash
pnpm dev
```

Web Application จะรันอยู่ที่ `http://localhost:3000`

### 5.5. การคำนวณเมื่อห้องมีหลายเซ็นเซอร์ (Multi-sensor per room)

เมื่อหนึ่งห้องมี environmental sensor มากกว่า 1 ตัว ระบบคำนวณดังนี้:

| จุดที่ใช้ | วิธีคำนวณ |
|-----------|------------|
| **การ์ดห้อง (Dashboard)** / ค่าล่าสุดต่อห้อง | หาค่าล่าสุดของ**แต่ละ node** ในห้อง แล้วนำมา**เฉลี่ย** (ค่าเฉลี่ยอุณหภูมิ + ค่าเฉลี่ยความชื้น) เวลาที่แสดงเป็น timestamp ล่าสุดจากเซ็นเซอร์ใดก็ได้ในห้อง |
| **กราฟในหน้ารายละเอียดห้อง** | จัดกลุ่มตามช่วงเวลา (เช่น รายชั่วโมง) แล้ว**เฉลี่ย**อุณหภูมิและความชื้นของทุกจุดข้อมูลในช่วงนั้น (หลายเซ็นเซอร์จะถูกนำมาเฉลี่ยต่อช่วงเวลา) |
| **ML / การพยากรณ์** | ใช้ข้อมูลจากเซ็นเซอร์ environmental **ตัวแรก**ที่พบในห้องเท่านั้น (ยังไม่มีการรวมหลายเซ็นเซอร์ในโมเดลพยากรณ์) |
| **Power sensor (แอร์)** | แสดงทุกหน่วยในห้อง (เปิด/ปิดกี่เครื่อง กำลังรวมกี่วัตต์) ไม่มีการเฉลี่ย |

ดังนั้นถ้าห้อง A มี ESP32-ENV-001 และ ESP32-ENV-002 ค่าที่แสดงบนการ์ดห้องจะเป็น**ค่าเฉลี่ย**ของค่าล่าสุดจากทั้งสองตัว

## 6. การเชื่อมต่ออุปกรณ์ IoT

อุปกรณ์ IoT (เช่น ESP32) สามารถส่งข้อมูลอุณหภูมิและความชื้นมายังระบบได้ผ่าน API Endpoint ที่กำหนดไว้

### 6.1. API Endpoint

- **URL:** `http://<server-ip>:3000/api/data/ingest`
- **Method:** `POST`
- **Content-Type:** `application/json`

### 6.2. รูปแบบข้อมูล (JSON)

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

### 6.3. ตัวอย่างโค้ด ESP32 Arduino

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://your-server-ip:3000/api/data/ingest";
const char* nodeId = "ESP32-ENV-001";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["nodeId"] = nodeId;
    doc["type"] = "environmental";
    JsonObject readings = doc.createNestedObject("readings");
    readings["temperature"] = 25.0 + random(-10, 10) / 10.0;
    readings["humidity"] = 60.0 + random(-20, 20) / 10.0;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    http.end();
  }
  delay(60000); // Send every 1 minute
}
```

## 7. รายละเอียดโมเดล Machine Learning

### 7.1. การพยากรณ์แนวโน้ม (Time Series Prediction)

ระบบใช้โมเดล **Holt-Winters Triple Exponential Smoothing** สำหรับการพยากรณ์อุณหภูมิและความชื้น โมเดลนี้เหมาะสำหรับข้อมูลอนุกรมเวลาที่มีทั้งแนวโน้ม (Trend) และฤดูกาล (Seasonality) ซึ่งพบได้บ่อยในข้อมูลสภาพแวดล้อม [1]

- **Alpha (α):** ค่า Smoothing สำหรับ Level (ระดับพื้นฐานของข้อมูล)
- **Beta (β):** ค่า Smoothing สำหรับ Trend (แนวโน้มของข้อมูล)
- **Gamma (γ):** ค่า Smoothing สำหรับ Seasonality (รูปแบบตามฤดูกาล)
- **Season Length:** ความยาวของรอบฤดูกาล (เช่น 24 สำหรับข้อมูลรายชั่วโมงที่มีรูปแบบรายวัน)

### 7.2. การตรวจจับความผิดปกติ (Anomaly Detection)

ระบบใช้การผสมผสานหลายเทคนิคในการตรวจจับความผิดปกติ เพื่อเพิ่มความแม่นยำและครอบคลุมสถานการณ์ต่างๆ:

- **Z-Score:** ตรวจจับค่าที่เบี่ยงเบนจากค่าเฉลี่ยอย่างมีนัยสำคัญ โดยพิจารณาจากค่าเบี่ยงเบนมาตรฐาน [2]
- **IQR (Interquartile Range):** ตรวจจับ Outlier โดยใช้ช่วงควอร์ไทล์ ซึ่งมีความทนทานต่อ Outlier สูงกว่า Z-Score [3]
- **Rate of Change:** ตรวจจับการเปลี่ยนแปลงของค่าที่รวดเร็วผิดปกติในช่วงเวลาสั้นๆ ซึ่งอาจบ่งชี้ถึงปัญหาของเซ็นเซอร์หรือเหตุการณ์ฉุกเฉิน
- **Dynamic Thresholds:** คำนวณเกณฑ์ขีดจำกัดแบบไดนามิกตามข้อมูลย้อนหลัง เพื่อปรับให้เข้ากับรูปแบบข้อมูลที่เปลี่ยนแปลงไปตามเวลา

## 8. การปรับปรุงในอนาคต

- **การปรับปรุงโมเดล ML:** ทดลองใช้โมเดล Machine Learning ที่ซับซ้อนมากขึ้น เช่น LSTM หรือ Prophet สำหรับการพยากรณ์ที่แม่นยำยิ่งขึ้น
- **ระบบแจ้งเตือนแบบ Real-time:** การใช้ WebSockets (เช่น Socket.IO) เพื่อส่งการแจ้งเตือนไปยัง Frontend ทันที แทนการ Polling
- **การจัดการผู้ใช้งานขั้นสูง:** เพิ่มฟังก์ชันการจัดการผู้ใช้งาน เช่น การรีเซ็ตรหัสผ่าน, การยืนยันอีเมล
- **การแสดงผลข้อมูลที่ยืดหยุ่น:** เพิ่มตัวเลือกในการแสดงกราฟข้อมูลย้อนหลังในช่วงเวลาที่แตกต่างกัน (เช่น รายวัน, รายสัปดาห์, รายเดือน)
- **การรองรับเซ็นเซอร์หลายประเภท:** ขยายระบบให้รองรับเซ็นเซอร์ประเภทอื่นๆ เช่น เซ็นเซอร์แสง, เซ็นเซอร์ก๊าซ

## 9. References

[1] Hyndman, R. J., & Athanasopoulos, G. (2018). _Forecasting: principles and practice_ (2nd ed.). OTexts. https://otexts.com/fpp2/holt-winters.html
[2] Iglewicz, B., & Hoaglin, D. C. (1993). _How to Detect and Handle Outliers_. ASQC Quality Press.
[3] Tukey, J. W. (1977). _Exploratory Data Analysis_. Addison-Wesley.
Wesley. Wesley.Wesley.Wesley.
