# IoT Device Integration Guide

This document provides instructions for connecting ESP32-based IoT devices to the Herbal Storage Monitoring System.

## API Endpoint
- **URL:** `http://<server-ip>:3000/api/data/ingest`
- **Method:** `POST`
- **Content-Type:** `application/json`

## Data Format (JSON)
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

## ESP32 Arduino Example
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
