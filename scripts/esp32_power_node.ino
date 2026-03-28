/*
 * ESP32 Power/Current Monitor - ADS1115 + SCT-013 + WiFiManager
 * วัดกระแสไฟฟ้าแอร์ ส่งข้อมูลไปยัง Next.js API
 * รองรับทั้ง HTTP (local) และ HTTPS (Railway / Cloud)
 *
 * API Endpoint: POST /api/data/ingest
 * Payload: { nodeId, type: "power", readings: { voltage, current, power, energy } }
 *
 * ตัวอย่าง Server URL ที่กรอกใน WiFiManager:
 *   - Local:   http://192.168.1.59:3000
 *   - Railway: https://your-app.up.railway.app
 *
 * Libraries ที่ต้องติดตั้ง (Arduino IDE → Library Manager):
 *   - WiFiManager by tzapu (>= 2.0.0)
 *   - Adafruit ADS1X15
 *   - ArduinoJson by Benoit Blanchon (v6+)
 *   - LiquidCrystal I2C
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <math.h>

// ===== Node Configuration =====
const char* nodeId = "ESP32-PWR-001";  // ต้องตรงกับที่ลงทะเบียนในระบบ
const char* acUnit = "AC1";

// ===== ADS1115 & SCT-013 Configuration =====
Adafruit_ADS1115 ads;
const int ADS_CHANNEL = 0;

const float VOLTAGE      = 220.0;
const float SENSITIVITY  = 0.02;      // 66mV/A → SCT-013-030 (30A)
const float CURRENT_THRESHOLD = 0.5;  // ต่ำกว่านี้ถือว่าแอร์ปิด

// ===== LCD Configuration (I2C 16x2) =====
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ===== WiFiManager & Preferences =====
WiFiManager wm;
Preferences preferences;

// ===== Server Configuration (ค่าเริ่มต้น) =====
// กรอก URL เต็ม เช่น:
//   http://192.168.1.59:3000  (local)
//   https://your-app.up.railway.app  (Railway)
String serverBaseUrl = "https://your-app.up.railway.app";
String apiKey        = "";
String serverUrl     = "";  // serverBaseUrl + /api/data/ingest
bool   useHTTPS      = false;

// ===== WiFiClientSecure for HTTPS =====
WiFiClientSecure secureClient;

// ===== Timing =====
unsigned long lastReadTime = 0;
unsigned long lastSendTime = 0;
const unsigned long READ_INTERVAL = 10000;   // อ่านค่าทุก 10 วินาที
const unsigned long SEND_INTERVAL = 120000;  // ส่งข้อมูลทุก 2 นาที

// ===== Data =====
float current    = 0.0;
float power      = 0.0;
float energy     = 0.0;  // สะสม kWh
bool  isRunning  = false;
int   sendCount  = 0;
int   errorCount = 0;
unsigned long lastEnergyCalcTime = 0;

// ===== Custom Parameters for WiFiManager =====
// ช่องกรอก Server URL แบบเต็ม (รองรับทั้ง http:// และ https://)
WiFiManagerParameter custom_server_url("server_url", "Server URL (e.g. https://xxx.up.railway.app)", "https://your-app.up.railway.app", 120);
WiFiManagerParameter custom_api_key("api_key", "API Key (SENSOR_API_KEY)", "", 64);
WiFiManagerParameter custom_header("<h3 style='color:#E64A19'>⚡ Herbal Storage - Power Node</h3>");
WiFiManagerParameter custom_node_info("<p>Node ID: <b>ESP32-PWR-001</b> | AC: <b>AC1</b></p>");
WiFiManagerParameter custom_sensor_info("<p style='color:#FF5722'>Sensors: Current (A), Power (W), Energy (kWh)</p>");
WiFiManagerParameter custom_url_hint("<p style='font-size:12px;color:#666'>Local: <b>http://192.168.1.59:3000</b><br>Railway: <b>https://xxx.up.railway.app</b></p>");

// ===== Reset Button =====
#define RESET_BUTTON 0  // ปุ่ม Boot บน ESP32

void setup() {
  Serial.begin(115200);
  Serial.println("\n=================================");
  Serial.println("⚡ Herbal Storage Power Node");
  Serial.println("   ADS1115 + SCT-013 + WiFiManager + HTTPS");
  Serial.println("=================================");
  Serial.print("Node ID: ");
  Serial.println(nodeId);
  Serial.print("AC Unit: ");
  Serial.println(acUnit);
  Serial.println("=================================\n");

  // ตั้งค่าปุ่ม Reset
  pinMode(RESET_BUTTON, INPUT_PULLUP);

  // ===== Initialize I2C =====
  Wire.begin();

  // ===== Initialize ADS1115 =====
  if (!ads.begin()) {
    Serial.println("❌ ADS1115 not found! Check wiring.");
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("ADS1115 ERROR!");
    lcd.setCursor(0, 1);
    lcd.print("Check wiring");
    while (1) delay(1000);
  }
  ads.setGain(GAIN_TWOTHIRDS);  // +/- 6.144V range
  Serial.println("✅ ADS1115 Initialized");

  // ===== Initialize LCD =====
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Herbal Storage");
  lcd.setCursor(0, 1);
  lcd.print("PWR Starting...");
  delay(2000);

  // ===== Load Config from NVS =====
  preferences.begin("config", true);  // read-only
  serverBaseUrl = preferences.getString("serverUrl", "https://your-app.up.railway.app");
  apiKey        = preferences.getString("apiKey",    "");
  energy        = preferences.getFloat("energy",     0.0);  // โหลด kWh สะสม
  preferences.end();

  Serial.print("Saved Server URL: ");
  Serial.println(serverBaseUrl);
  Serial.print("Accumulated Energy: ");
  Serial.print(energy, 4);
  Serial.println(" kWh");

  // ===== Check Reset Button =====
  if (digitalRead(RESET_BUTTON) == LOW) {
    Serial.println("🔴 Reset button pressed - Clearing WiFi settings...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Resetting WiFi");
    lcd.setCursor(0, 1);
    lcd.print("Please wait...");
    wm.resetSettings();
    delay(2000);
    ESP.restart();
  }

  // ===== Setup WiFiManager =====
  setupWiFiManager();

  // ===== Setup HTTPS client =====
  secureClient.setInsecure();  // ข้าม certificate verification (เหมาะกับ Railway)

  // ===== Ready =====
  lastEnergyCalcTime = millis();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Ready!");
  lcd.setCursor(0, 1);
  lcd.print(useHTTPS ? "HTTPS" : "HTTP");
  lcd.print(" ");
  lcd.print(nodeId);
  delay(2000);
}

void setupWiFiManager() {
  wm.setConfigPortalTimeout(180);  // 3 นาที timeout

  // อัพเดทค่าจาก NVS
  custom_server_url.setValue(serverBaseUrl.c_str(), 120);
  custom_api_key.setValue(apiKey.c_str(), 64);

  // เพิ่ม Custom Parameters
  wm.addParameter(&custom_header);
  wm.addParameter(&custom_node_info);
  wm.addParameter(&custom_sensor_info);
  wm.addParameter(&custom_server_url);
  wm.addParameter(&custom_api_key);
  wm.addParameter(&custom_url_hint);

  // Callback เมื่อบันทึก
  wm.setSaveConfigCallback(saveConfigCallback);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  lcd.setCursor(0, 1);
  lcd.print("...");

  // Auto Connect - ถ้าไม่เคยตั้งค่าจะเปิด AP
  bool connected = wm.autoConnect("HerbalPWR_Setup", "12345678");

  if (connected) {
    Serial.println("✅ WiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(3000);

    updateServerUrl();
  } else {
    Serial.println("❌ WiFi Failed!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed!");
    lcd.setCursor(0, 1);
    lcd.print("Restarting...");
    delay(3000);
    ESP.restart();
  }
}

void saveConfigCallback() {
  Serial.println("📝 Saving configuration...");

  String newUrl = custom_server_url.getValue();
  String newKey = custom_api_key.getValue();

  // ลบ / ท้าย URL (ถ้ามี)
  newUrl.trim();
  while (newUrl.endsWith("/")) {
    newUrl.remove(newUrl.length() - 1);
  }

  if (newUrl.length() > 0) serverBaseUrl = newUrl;
  apiKey = newKey;

  // บันทึกลง NVS
  preferences.begin("config", false);
  preferences.putString("serverUrl", serverBaseUrl);
  preferences.putString("apiKey",    apiKey);
  preferences.end();

  Serial.print("✅ Config saved → ");
  Serial.println(serverBaseUrl);

  updateServerUrl();
}

void updateServerUrl() {
  // ตรวจสอบว่าเป็น HTTPS หรือไม่
  useHTTPS = serverBaseUrl.startsWith("https://");

  // สร้าง Full URL
  serverUrl = serverBaseUrl + "/api/data/ingest";

  Serial.print("Server URL: ");
  Serial.println(serverUrl);
  Serial.print("Protocol: ");
  Serial.println(useHTTPS ? "HTTPS (secure)" : "HTTP (local)");
}

void loop() {
  unsigned long currentMillis = millis();

  // ===== Long-press Reset (3 วินาที) =====
  static unsigned long buttonPressTime = 0;
  if (digitalRead(RESET_BUTTON) == LOW) {
    if (buttonPressTime == 0) {
      buttonPressTime = millis();
    } else if (millis() - buttonPressTime > 3000) {
      Serial.println("🔴 Long press - Resetting WiFi...");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Resetting WiFi");
      wm.resetSettings();
      delay(1000);
      ESP.restart();
    }
  } else {
    buttonPressTime = 0;
  }

  // ===== อ่านค่ากระแส =====
  if (currentMillis - lastReadTime >= READ_INTERVAL) {
    lastReadTime = currentMillis;
    readCurrent();
    calculateEnergy();
    displayOnLCD();
    printToSerial();
  }

  // ===== ส่งข้อมูลไป Server =====
  if (currentMillis - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = currentMillis;

    if (WiFi.status() == WL_CONNECTED) {
      sendDataToServer();
    } else {
      Serial.println("❌ WiFi Disconnected! Reconnecting...");
      errorCount++;
      WiFi.reconnect();
      delay(5000);
    }
  }

  // ===== บันทึก energy ทุก 5 นาที (ป้องกันข้อมูลหายถ้าไฟดับ) =====
  static unsigned long lastEnergySave = 0;
  if (currentMillis - lastEnergySave >= 300000) {
    lastEnergySave = currentMillis;
    preferences.begin("config", false);
    preferences.putFloat("energy", energy);
    preferences.end();
  }
}

void readCurrent() {
  const int sampleCount = 500;
  long sum = 0;
  long sumSquared = 0;

  for (int i = 0; i < sampleCount; i++) {
    int16_t raw = ads.readADC_SingleEnded(ADS_CHANNEL);
    sum += raw;
    sumSquared += (long)raw * raw;
    delayMicroseconds(200);
  }

  float average = (float)sum / sampleCount;
  float rms = sqrt((float)sumSquared / sampleCount - average * average);

  // แปลง ADC → แรงดัน → กระแส
  // ADS1115 GAIN_TWOTHIRDS: 0.1875 mV per bit
  float voltage_rms = rms * 0.0001875;
  current = voltage_rms / SENSITIVITY;

  // ตัด noise ต่ำ
  if (current < 0.1) current = 0.0;

  power = VOLTAGE * current;
  isRunning = (current >= CURRENT_THRESHOLD);
}

void calculateEnergy() {
  unsigned long now = millis();
  unsigned long elapsed = now - lastEnergyCalcTime;
  lastEnergyCalcTime = now;

  // สะสมพลังงาน: kWh = W × hours
  if (power > 0) {
    float hours = (float)elapsed / 3600000.0;
    energy += (power / 1000.0) * hours;
  }
}

void displayOnLCD() {
  lcd.clear();

  // บรรทัด 1: AC unit + สถานะ + จำนวนส่งสำเร็จ
  lcd.setCursor(0, 0);
  lcd.print(acUnit);
  lcd.print(" ");
  lcd.print(isRunning ? "ON " : "OFF");

  if (sendCount > 0) {
    lcd.setCursor(10, 0);
    lcd.print("OK:");
    lcd.print(sendCount);
  }

  // บรรทัด 2: กระแส + กำลังไฟ + HTTPS indicator
  lcd.setCursor(0, 1);
  lcd.print(current, 2);
  lcd.print("A ");
  lcd.print((int)power);
  lcd.print("W");

  if (useHTTPS) {
    lcd.setCursor(13, 1);
    lcd.print("SSL");
  }
}

void printToSerial() {
  Serial.println("--- Power Reading ---");
  Serial.print("Current: ");
  Serial.print(current, 3);
  Serial.println(" A");
  Serial.print("Power: ");
  Serial.print(power, 1);
  Serial.println(" W");
  Serial.print("Energy: ");
  Serial.print(energy, 4);
  Serial.println(" kWh");
  Serial.print("AC Status: ");
  Serial.println(isRunning ? "RUNNING" : "OFF");
  Serial.println("---------------------");
}

void sendDataToServer() {
  HTTPClient http;

  Serial.println("\n>>> Sending power data...");
  Serial.print("URL: ");
  Serial.println(serverUrl);
  Serial.print("Mode: ");
  Serial.println(useHTTPS ? "HTTPS" : "HTTP");

  // เลือก HTTP หรือ HTTPS ตาม URL
  if (useHTTPS) {
    http.begin(secureClient, serverUrl);
  } else {
    http.begin(serverUrl);
  }
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000);  // 15 วินาที timeout (HTTPS อาจช้ากว่า)

  // เพิ่ม API Key header (ถ้ามี)
  if (apiKey.length() > 0) {
    http.addHeader("x-api-key", apiKey);
  }

  // สร้าง JSON ตาม API schema
  StaticJsonDocument<256> doc;
  doc["nodeId"] = nodeId;
  doc["type"]   = "power";

  JsonObject readings = doc.createNestedObject("readings");
  readings["voltage"] = VOLTAGE;
  readings["current"] = round(current * 1000.0) / 1000.0;  // 3 ทศนิยม
  readings["power"]   = round(power * 100.0) / 100.0;      // 2 ทศนิยม
  readings["energy"]  = round(energy * 10000.0) / 10000.0;  // 4 ทศนิยม

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.print("Payload: ");
  Serial.println(jsonPayload);

  int httpCode = http.POST(jsonPayload);

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("Response: ");
    Serial.println(response);

    if (httpCode == 200 || httpCode == 201) {
      sendCount++;
      Serial.println("✅ Data sent successfully!");

      lcd.setCursor(15, 1);
      lcd.print("*");
    } else if (httpCode == 401) {
      Serial.println("🔑 Unauthorized - ตรวจสอบ API Key");
      errorCount++;
    } else if (httpCode == 404) {
      Serial.println("🔍 Node not found - ลงทะเบียน nodeId ในระบบก่อน");
      errorCount++;
    } else if (httpCode == 429) {
      Serial.println("⏳ Rate limited - ส่งข้อมูลถี่เกินไป");
      errorCount++;
    } else {
      Serial.print("⚠️ HTTP ");
      Serial.println(httpCode);
      errorCount++;
    }
  } else {
    Serial.print("❌ Connection Error: ");
    Serial.println(httpCode);
    Serial.println("ตรวจสอบ: URL ถูกต้อง? WiFi เชื่อมต่ออยู่? Server ทำงานอยู่?");
    errorCount++;
  }

  http.end();

  Serial.print("Send: ");
  Serial.print(sendCount);
  Serial.print(" | Error: ");
  Serial.println(errorCount);
  Serial.println("========================\n");
}
