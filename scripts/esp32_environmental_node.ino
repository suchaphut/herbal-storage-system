/*
 * ESP32 Environmental Monitor - DHT22 + WiFiManager
 * วัดอุณหภูมิ + ความชื้น ส่งข้อมูลไปยัง Next.js API
 * รองรับทั้ง HTTP (local) และ HTTPS (Railway / Cloud)
 *
 * API Endpoint: POST /api/data/ingest
 * Payload: { nodeId, type: "environmental", readings: { temperature, humidity } }
 *
 * ตัวอย่าง Server URL ที่กรอกใน WiFiManager:
 *   - Local:   http://192.168.1.59:3000
 *   - Railway: https://your-app.up.railway.app
 *
 * Libraries ที่ต้องติดตั้ง (Arduino IDE → Library Manager):
 *   - WiFiManager by tzapu (>= 2.0.0)
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 *   - ArduinoJson by Benoit Blanchon (v6+)
 *   - LiquidCrystal I2C
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <math.h>

// ===== Node Configuration =====
const char* nodeId = "ESP32-ENV-001";  // ต้องตรงกับที่ลงทะเบียนในระบบ

// ===== DHT22 Configuration =====
#define DHTPIN  4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

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
const unsigned long SEND_INTERVAL = 60000;   // ส่งข้อมูลทุก 1 นาที

// ===== Data =====
float temperature = 0.0;
float humidity    = 0.0;
int sendCount     = 0;
int errorCount    = 0;
bool sensorOk     = true;

// ===== Custom Parameters for WiFiManager =====
// ช่องกรอก Server URL แบบเต็ม (รองรับทั้ง http:// และ https://)
WiFiManagerParameter custom_server_url("server_url", "Server URL (e.g. https://xxx.up.railway.app)", "https://your-app.up.railway.app", 120);
WiFiManagerParameter custom_api_key("api_key", "API Key (SENSOR_API_KEY)", "", 64);
WiFiManagerParameter custom_header("<h3 style='color:#2E7D32'>🌿 Herbal Storage - Environmental Node</h3>");
WiFiManagerParameter custom_node_info("<p>Node ID: <b>ESP32-ENV-001</b></p>");
WiFiManagerParameter custom_sensor_info("<p style='color:#009688'>Sensors: Temperature (°C), Humidity (%)</p>");
WiFiManagerParameter custom_url_hint("<p style='font-size:12px;color:#666'>Local: <b>http://192.168.1.59:3000</b><br>Railway: <b>https://xxx.up.railway.app</b></p>");

// ===== Reset Button =====
#define RESET_BUTTON 0  // ปุ่ม Boot บน ESP32

// ===== Custom Characters for LCD =====
byte degreeChar[8] = { 0x06, 0x09, 0x09, 0x06, 0x00, 0x00, 0x00, 0x00 };
byte wifiChar[8]   = { 0x00, 0x0E, 0x11, 0x04, 0x0A, 0x00, 0x04, 0x00 };

void setup() {
  Serial.begin(115200);
  Serial.println("\n=================================");
  Serial.println("🌿 Herbal Storage Environmental Node");
  Serial.println("   DHT22 + WiFiManager + HTTPS");
  Serial.println("=================================");
  Serial.print("Node ID: ");
  Serial.println(nodeId);
  Serial.println("=================================\n");

  // ตั้งค่าปุ่ม Reset
  pinMode(RESET_BUTTON, INPUT_PULLUP);

  // ===== Initialize I2C & LCD =====
  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.createChar(0, degreeChar);
  lcd.createChar(1, wifiChar);
  lcd.setCursor(0, 0);
  lcd.print("Herbal Storage");
  lcd.setCursor(0, 1);
  lcd.print("ENV Starting...");
  delay(2000);

  // ===== Initialize DHT22 =====
  dht.begin();
  Serial.println("✅ DHT22 Initialized");

  // ===== Load Config from NVS =====
  preferences.begin("config", true);  // read-only
  serverBaseUrl = preferences.getString("serverUrl", "https://your-app.up.railway.app");
  apiKey        = preferences.getString("apiKey",    "");
  preferences.end();

  Serial.print("Saved Server URL: ");
  Serial.println(serverBaseUrl);

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
  bool connected = wm.autoConnect("HerbalENV_Setup", "12345678");

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

  // ===== อ่านค่าเซ็นเซอร์ =====
  if (currentMillis - lastReadTime >= READ_INTERVAL) {
    lastReadTime = currentMillis;
    readSensors();
    displayOnLCD();
    printToSerial();
  }

  // ===== ส่งข้อมูลไป Server =====
  if (currentMillis - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = currentMillis;

    if (!sensorOk) {
      Serial.println("⚠️ Sensor error - skipping send");
      return;
    }

    if (WiFi.status() == WL_CONNECTED) {
      sendDataToServer();
    } else {
      Serial.println("❌ WiFi Disconnected! Reconnecting...");
      errorCount++;
      WiFi.reconnect();
      delay(5000);
    }
  }
}

void readSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (isnan(t) || isnan(h)) {
    Serial.println("⚠️ DHT22 read failed!");
    sensorOk = false;
    return;
  }

  temperature = t;
  humidity    = h;
  sensorOk   = true;
}

void displayOnLCD() {
  lcd.clear();

  // บรรทัด 1: อุณหภูมิ + สถานะ WiFi
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(temperature, 1);
  lcd.write(byte(0));  // °
  lcd.print("C");

  // แสดง WiFi icon + จำนวนส่งสำเร็จ
  lcd.setCursor(11, 0);
  if (WiFi.status() == WL_CONNECTED) {
    lcd.write(byte(1));
  } else {
    lcd.print("!");
  }
  if (sendCount > 0) {
    lcd.print(sendCount);
  }

  // บรรทัด 2: ความชื้น + HTTPS indicator
  lcd.setCursor(0, 1);
  lcd.print("H:");
  lcd.print(humidity, 1);
  lcd.print("%");

  if (!sensorOk) {
    lcd.setCursor(10, 1);
    lcd.print("ERR");
  } else if (useHTTPS) {
    lcd.setCursor(13, 1);
    lcd.print("SSL");
  }
}

void printToSerial() {
  Serial.println("--- Environmental Reading ---");
  Serial.print("Temperature: ");
  Serial.print(temperature, 1);
  Serial.println(" °C");
  Serial.print("Humidity: ");
  Serial.print(humidity, 1);
  Serial.println(" %");
  Serial.print("Sensor OK: ");
  Serial.println(sensorOk ? "YES" : "NO");
  Serial.println("-----------------------------");
}

void sendDataToServer() {
  HTTPClient http;

  Serial.println("\n>>> Sending environmental data...");
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
  doc["type"]   = "environmental";

  JsonObject readings = doc.createNestedObject("readings");
  readings["temperature"] = round(temperature * 10.0) / 10.0;
  readings["humidity"]    = round(humidity * 10.0) / 10.0;

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

      // แสดง * บน LCD
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
