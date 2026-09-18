// ============================================================
// HABILITATE WEARABLE BAND - ESP32-S3 FIRMWARE
// ============================================================
//
// ARCHITECTURE (Option B):
//   ESP32-S3
//     ├── BLE  → Dashboard (device setup & Wi-Fi provisioning)
//     └── WiFi → Supabase Edge Function (sensor streaming)
//
// BLE CHARACTERISTICS:
//   0x0002  Band ID          (read)
//   0x0003  Sensor Data      (notify)  [legacy / reserved]
//   0x0004  WiFi Config      (write)   {ssid, password}
//   0x0005  WiFi Status      (read)    CONNECTED|CONNECTING|FAILED|...
//   0x0006  WiFi Scan Req    (write)   "SCAN"
//   0x0007  WiFi Scan Result (notify)  JSON network / end / error
//
// BOARD: ESP32S3 Dev Module (select in Arduino IDE)
//   Tools → USB CDC On Boot: Enabled  (for Serial over USB)
//
// I2C PINS (ESP32-S3 DevKitC-1):
//   SDA = GPIO 8   SCL = GPIO 9
//
// REQUIRED LIBRARIES (install via Arduino Library Manager):
//   - WebSockets           (by Markus Sattler)
//   - ArduinoJson          (by Benoit Blanchon)
//   - SparkFun STTS22H     (by SparkFun Electronics)
//   - SparkFun MAX3010x    (by SparkFun Electronics)
//   - Wire                 (built-in)
// ============================================================

#include <Arduino.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <WiFi.h>
#include <WebSocketsClient.h>

// Disable unused features to save flash space
#define ARDUINOJSON_USE_LONG_LONG 0
#define ARDUINOJSON_USE_DOUBLE 0
#define ARDUINOJSON_ENABLE_PROGMEM 0
#include <ArduinoJson.h>
#include <SparkFun_STTS22H.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <spo2_algorithm.h>

// ============================================================
// CONFIGURATION — edit these
// ============================================================

#define BAND_ID      "HAB-001"
#define DEVICE_NAME  "Habilitate-HAB-001"

// Device token — loaded from secrets.h (gitignored).
// Copy secrets.example.h → secrets.h and set the real value.
#include "secrets.h"

#ifdef DEVICE_TOKEN_IS_PLACEHOLDER
  #error "Set a real DEVICE_TOKEN in secrets.h and delete DEVICE_TOKEN_IS_PLACEHOLDER"
#endif

// Supabase WebSocket endpoint
#define WS_HOST  "sqjuracvmmuyrdcapehk.supabase.co"
#define WS_PATH  "/functions/v1/wearable-ws?band_id=" BAND_ID "&token=" DEVICE_TOKEN

// Sensor streaming rate
#define SENSOR_INTERVAL_MS       40    // 25 Hz

// WiFi connection timeout
#define WIFI_CONNECT_TIMEOUT_MS  15000

// WebSocket reconnect interval
#define WS_RECONNECT_INTERVAL_MS 5000

// BLE MTU (must handle WiFi scan JSON chunks)
#define BLE_MTU 512

// ============================================================
// I2C PINS  (ESP32-S3 DevKitC-1)
// ============================================================
#define I2C_SDA  8
#define I2C_SCL  9

// ============================================================
// GSR PIN
// ============================================================
// GPIO34 does not exist on ESP32-S3; use GPIO1 (ADC1_CH0).
#define GSR_PIN  1

// ============================================================
// LED PINS & SETTINGS
// ============================================================
// Orange  (#FF5A00) → WiFi state
// Purple  (#7B2FFF) → Session state
//
// Two separate RGB LEDs (or two WS2812 pixels) wired to:
//   LED_R_PIN, LED_G_PIN, LED_B_PIN  — the single RGB LED
// If you have a single common-anode RGB LED invert the PWM
// duty by setting LED_COMMON_ANODE 1.
//
// For battery saving, maximum duty is capped at LED_MAX_DUTY
// (0–255).  50/255 ≈ 20 % duty cycle keeps the LED clearly
// visible while drawing ~80 % less current than full bright.
// ============================================================
#define LED_R_PIN       15
#define LED_G_PIN       16
#define LED_B_PIN       17

#define LED_COMMON_ANODE  0       // 0 = common cathode, 1 = common anode
#define LED_MAX_DUTY      15      // 0-255; 15 ≈ 6% duty for high battery saving (still clearly visible)

// PWM settings
#define PWM_FREQ  1000   // Hz
#define PWM_RES   8      // bits (0-255)

// Colour presets — scaled to LED_MAX_DUTY at definition time
// Orange #FF5A00  → R=255 G=90  B=0
// Purple #7B2FFF  → R=123 G=47  B=255
#define ORANGE_R  (uint8_t)(255 * LED_MAX_DUTY / 255)
#define ORANGE_G  (uint8_t)( 90 * LED_MAX_DUTY / 255)
#define ORANGE_B  0

#define PURPLE_R  (uint8_t)(123 * LED_MAX_DUTY / 255)
#define PURPLE_G  (uint8_t)( 47 * LED_MAX_DUTY / 255)
#define PURPLE_B  (uint8_t)(255 * LED_MAX_DUTY / 255)

// ============================================================
// BLE UUIDs — must match frontend bleService.ts exactly
// ============================================================
#define SERVICE_UUID              "7b7a0001-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define BAND_ID_UUID              "7b7a0002-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define SENSOR_UUID               "7b7a0003-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_CONFIG_UUID          "7b7a0004-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_STATUS_UUID          "7b7a0005-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_SCAN_REQUEST_UUID    "7b7a0006-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_SCAN_RESULTS_UUID    "7b7a0007-5a7d-4f4c-9f5e-7a3d6b9e1001"

// ============================================================
// GLOBAL STATE
// ============================================================

// --- BLE ---
BLEServer*           pServer              = nullptr;
BLECharacteristic*   pBandIdChar          = nullptr;
BLECharacteristic*   pSensorChar          = nullptr;
BLECharacteristic*   pWifiConfigChar      = nullptr;
BLECharacteristic*   pWifiStatusChar      = nullptr;
BLECharacteristic*   pWifiScanRequestChar = nullptr;
BLECharacteristic*   pWifiScanResultChar  = nullptr;

volatile bool        bleClientConnected   = false;
volatile bool        wifiScanRequested    = false;

// --- WiFi / Credentials ---
String savedSSID     = "";
String savedPassword = "";
String wifiStatus    = "NO_CREDENTIALS";

// --- WebSocket ---
WebSocketsClient     wsClient;
volatile bool        wsConnected          = false;
volatile bool        wsAuthenticated      = false;
unsigned long        wsLastConnectAttempt = 0;

// --- Session state (drives LED) ---
volatile bool        sessionActive        = false;
volatile bool        sessionPaused        = false;

// --- Sensor ---
unsigned long        lastSensorSend       = 0;
uint32_t             sensorSeq            = 0;

// ============================================================
// SENSOR READING STRUCT
// ============================================================

struct SensorReading {
  float ax, ay, az;   // Accelerometer (g)      — MPU6050
  float gx, gy, gz;   // Gyroscope (dps)        — MPU6050
  float temp;          // Temperature (°C)       — STTS22H
  float hr;            // Heart rate (BPM)       — MAX30102, -1 if no finger
  float hrv;           // HRV / not computed here (-1 always; DB trigger computes SDNN)
  float spo2;          // SpO2 (%)               — MAX30102, -1 if no finger
  float gsr;           // GSR (raw ADC counts)   — GPIO1
};

// ============================================================
// LED HELPERS
// ============================================================

void ledSetRGB(uint8_t r, uint8_t g, uint8_t b) {
  if (LED_COMMON_ANODE) {
    // Common anode: invert so 0 duty = full on, 255 = off
    ledcWrite(LED_R_PIN, 255 - r);
    ledcWrite(LED_G_PIN, 255 - g);
    ledcWrite(LED_B_PIN, 255 - b);
  } else {
    ledcWrite(LED_R_PIN, r);
    ledcWrite(LED_G_PIN, g);
    ledcWrite(LED_B_PIN, b);
  }
}

void ledOff() {
  ledSetRGB(0, 0, 0);
}

// ============================================================
// LED STATE MACHINE
// ============================================================
// Called every loop iteration.  Drives LED based on WiFi +
// session state without using delay().
//
// Priority (highest first):
//   Purple constant  → session active
//   Purple blinking  → session paused / resumed
//   Orange constant  → WiFi connected, no active session
//   Orange blinking  → waiting for WiFi
//   Off              → no credentials / BLE-only mode
// ============================================================

void updateLED() {
  static unsigned long lastBlink = 0;
  static bool          blinkOn   = false;

  unsigned long now = millis();

  // Blink toggle at ~1 Hz
  if (now - lastBlink >= 500) {
    lastBlink = now;
    blinkOn   = !blinkOn;
  }

  if (sessionActive && !sessionPaused) {
    // Purple constant — session running
    ledSetRGB(PURPLE_R, PURPLE_G, PURPLE_B);
    return;
  }

  if (sessionPaused) {
    // Purple blinking — session paused
    if (blinkOn) ledSetRGB(PURPLE_R, PURPLE_G, PURPLE_B);
    else         ledOff();
    return;
  }

  if (wifiStatus == "CONNECTED") {
    // Orange constant — WiFi up, no active session
    ledSetRGB(ORANGE_R, ORANGE_G, ORANGE_B);
    return;
  }

  if (wifiStatus == "CONNECTING") {
    // Orange blinking — waiting for WiFi
    if (blinkOn) ledSetRGB(ORANGE_R, ORANGE_G, ORANGE_B);
    else         ledOff();
    return;
  }

  // No credentials / error
  ledOff();
}

// ============================================================
// MPU6050
// ============================================================

const int MPU_ADDR = 0x68;
bool      mpuFound = false;

bool initMPU6050() {
  // WHO_AM_I is read for diagnostics only.  Different MPU6050
  // revisions / clones report various values (0x68–0x98) so we
  // do not gate on an exact match; presence on the bus is enough.
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x75); // WHO_AM_I register
  uint8_t txStatus = Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 1, true);

  if (txStatus != 0 || Wire.available() != 1) return false;

  Wire.read(); // Read WHO_AM_I but don't print (save flash)

  // Wake up
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); Wire.write(0x00);
  Wire.endTransmission(true);

  // Accelerometer: ±8 g  →  4096 LSB/g
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C); Wire.write(0x10);
  Wire.endTransmission(true);

  // Gyroscope: ±500 °/s  →  65.5 LSB/(°/s)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1B); Wire.write(0x08);
  Wire.endTransmission(true);

  return true;
}

void readMPU6050(float &ax, float &ay, float &az,
                 float &gx, float &gy, float &gz) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 14, true);

  int16_t rawAx = (Wire.read() << 8) | Wire.read();
  int16_t rawAy = (Wire.read() << 8) | Wire.read();
  int16_t rawAz = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read(); // skip internal temperature
  int16_t rawGx = (Wire.read() << 8) | Wire.read();
  int16_t rawGy = (Wire.read() << 8) | Wire.read();
  int16_t rawGz = (Wire.read() << 8) | Wire.read();

  // Scale factors match the register config above
  ax = rawAx / 4096.0f;   // ±8 g
  ay = rawAy / 4096.0f;
  az = rawAz / 4096.0f;
  gx = rawGx / 65.5f;     // ±500 °/s
  gy = rawGy / 65.5f;
  gz = rawGz / 65.5f;
}

// ============================================================
// STTS22H (temperature)
// ============================================================

SparkFun_STTS22H temperatureSensor;
bool             sttsFound            = false;
float            lastValidTemperature = 25.0f;  // safe physical default
unsigned long    lastTempReadTime     = 0;
const unsigned long TEMP_POLL_MS      = 200;    // poll faster than 1 Hz ODR

bool initSTTS22H() {
  if (!temperatureSensor.begin()) return false;

  temperatureSensor.setDataRate(STTS22H_POWER_DOWN);
  delay(10);
  temperatureSensor.setDataRate(STTS22H_1Hz);
  temperatureSensor.enableAutoIncrement();

  // Seed a first valid reading (bounded so setup() cannot hang)
  for (int i = 0; i < 10; i++) {
    if (temperatureSensor.dataReady()) {
      float t = NAN;
      temperatureSensor.getTemperatureC(&t);
      if (!isnan(t) && t > -40.0f && t < 125.0f) {
        lastValidTemperature = t;
        return true;
      }
    }
    delay(100);
  }
  return true; // sensor present but hasn't output yet — that's fine
}

void updateTemperature() {
  if (!sttsFound) return;

  unsigned long now = millis();
  if (now - lastTempReadTime < TEMP_POLL_MS) return;
  lastTempReadTime = now;

  if (!temperatureSensor.dataReady()) return;

  float t = NAN;
  temperatureSensor.getTemperatureC(&t);

  if (!isnan(t) && t > -40.0f && t < 125.0f) {
    lastValidTemperature = t;
  }
}

// ============================================================
// MAX30102 (heart rate + SpO2)
// ============================================================

MAX30105     particleSensor;
bool         max30102Found = false;

// Analysis window
#define MAX_BUF_LEN      100
#define SHIFT_AMOUNT      25
#define HISTORY_SIZE       5
#define NO_FINGER_HOLD_MS 2000
#define MAX_HR_STEP        8    // max BPM change accepted per update
#define MAX_SPO2_STEP      3    // max % SpO2 change accepted per update
#define MIN_PERFUSION_IDX  0.30f

uint32_t irBuffer[MAX_BUF_LEN];
uint32_t redBuffer[MAX_BUF_LEN];
int32_t  bufferIndex = 0;

int32_t spo2Value      = -1;
int8_t  spo2Valid      = 0;
int32_t heartRateValue = -1;
int8_t  heartRateValid = 0;

int hrHistory[HISTORY_SIZE];
int spo2History[HISTORY_SIZE];
int historyCount = 0;
int historyIndex = 0;

int lastValidHR   = -1;
int lastValidSpO2 = -1;
volatile int currentHR   = -1;
volatile int currentSpO2 = -1;

// Adaptive finger detection
uint32_t     ambientIR         = 2000;
const uint32_t FINGER_MARGIN   = 8000;
bool         fingerPresent     = false;
unsigned long lastFingerSeenMs = 0;

// 4-tap moving-average pre-filter (reduces HF noise before analysis)
uint32_t irTaps[4]  = {0, 0, 0, 0};
uint32_t redTaps[4] = {0, 0, 0, 0};
int      tapIdx     = 0;

bool initMAX30102() {
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) return false;

  byte ledBrightness = 0x3F;  // tuned for finger tissue penetration
  byte sampleAverage  = 8;    // hardware averaging
  byte ledMode        = 2;    // Red + IR (SpO2 mode)
  int  sampleRate     = 100;  // Hz
  int  pulseWidth     = 411;  // µs → 18-bit ADC
  int  adcRange       = 16384;

  particleSensor.setup(ledBrightness, sampleAverage, ledMode,
                       sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(ledBrightness);
  particleSensor.setPulseAmplitudeIR(ledBrightness);

  bufferIndex = 0;
  return true;
}

float computePerfusionIndex() {
  uint32_t minIR = irBuffer[0], maxIR = irBuffer[0];
  uint64_t sum   = 0;
  for (int i = 0; i < MAX_BUF_LEN; i++) {
    if (irBuffer[i] < minIR) minIR = irBuffer[i];
    if (irBuffer[i] > maxIR) maxIR = irBuffer[i];
    sum += irBuffer[i];
  }
  float mean = (float)sum / MAX_BUF_LEN;
  if (mean <= 0.0f) return 0.0f;
  return ((float)(maxIR - minIR) / mean) * 100.0f;
}

int medianOfHistory(int* arr, int count) {
  int sorted[HISTORY_SIZE];
  for (int i = 0; i < count; i++) sorted[i] = arr[i];
  // Insertion sort (tiny array)
  for (int i = 1; i < count; i++) {
    int key = sorted[i], j = i - 1;
    while (j >= 0 && sorted[j] > key) { sorted[j+1] = sorted[j]; j--; }
    sorted[j+1] = key;
  }
  return sorted[count / 2];
}

void processBuffer() {
  float pi  = computePerfusionIndex();

  if (pi < MIN_PERFUSION_IDX) {
    return;
  }

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, MAX_BUF_LEN, redBuffer,
    &spo2Value, &spo2Valid, &heartRateValue, &heartRateValid);

  bool hrOk   = heartRateValid  && heartRateValue >= 30 && heartRateValue <= 220;
  bool spo2Ok = spo2Valid       && spo2Value       >= 70 && spo2Value       <= 100;

  if (hrOk)   hrHistory  [historyIndex % HISTORY_SIZE] = heartRateValue;
  if (spo2Ok) spo2History[historyIndex % HISTORY_SIZE] = spo2Value;
  if (hrOk || spo2Ok) {
    historyIndex++;
    if (historyCount < HISTORY_SIZE) historyCount++;
  }

  if (historyCount == 0) return;

  int hrCand   = hrOk   ? medianOfHistory(hrHistory,   historyCount) : lastValidHR;
  int spo2Cand = spo2Ok ? medianOfHistory(spo2History, historyCount) : lastValidSpO2;

  // Rate-limit large jumps
  auto clamp = [](int cand, int last, int step) -> int {
    if (last <= 0 || cand <= 0) return cand;
    int d = cand - last;
    if (d >  step) return last + step;
    if (d < -step) return last - step;
    return cand;
  };

  hrCand   = clamp(hrCand,   lastValidHR,   MAX_HR_STEP);
  spo2Cand = clamp(spo2Cand, lastValidSpO2, MAX_SPO2_STEP);

  if (hrCand   > 0) { lastValidHR   = hrCand;   currentHR   = lastValidHR;   }
  if (spo2Cand > 0) { lastValidSpO2 = spo2Cand; currentSpO2 = lastValidSpO2; }
}

void updateMAX30102() {
  if (!max30102Found) return;
  particleSensor.check();

  while (particleSensor.available()) {
    uint32_t irRaw  = particleSensor.getFIFOIR();
    uint32_t redRaw = particleSensor.getFIFORed();
    particleSensor.nextSample();

    unsigned long now = millis();

    // Adaptive finger detection (on raw sample, before filtering)
    uint32_t threshold = ambientIR + FINGER_MARGIN;
    bool     hasFinger = irRaw > threshold;

    if (hasFinger) {
      lastFingerSeenMs = now;
    } else {
      ambientIR = (ambientIR * 15 + irRaw) / 16; // slow adaptive baseline
    }

    if (hasFinger && !fingerPresent) {
      fingerPresent = true;
      bufferIndex = historyCount = historyIndex = 0;
    }

    if (!hasFinger && fingerPresent) {
      if (now - lastFingerSeenMs >= NO_FINGER_HOLD_MS) {
        fingerPresent  = false;
        currentHR      = lastValidHR   = -1;
        currentSpO2    = lastValidSpO2 = -1;
        bufferIndex    = historyCount  = 0;
      }
    }

    if (!fingerPresent) continue;

    // 4-tap moving-average filter
    irTaps [tapIdx] = irRaw;
    redTaps[tapIdx] = redRaw;
    tapIdx = (tapIdx + 1) % 4;

    uint32_t irF  = (irTaps[0]  + irTaps[1]  + irTaps[2]  + irTaps[3])  / 4;
    uint32_t redF = (redTaps[0] + redTaps[1] + redTaps[2] + redTaps[3]) / 4;

    irBuffer [bufferIndex] = irF;
    redBuffer[bufferIndex] = redF;
    bufferIndex++;

    if (bufferIndex >= MAX_BUF_LEN) {
      processBuffer();
      // Sliding window — keep the last (MAX_BUF_LEN - SHIFT_AMOUNT) samples
      for (int i = 0; i < MAX_BUF_LEN - SHIFT_AMOUNT; i++) {
        irBuffer [i] = irBuffer [i + SHIFT_AMOUNT];
        redBuffer[i] = redBuffer[i + SHIFT_AMOUNT];
      }
      bufferIndex = MAX_BUF_LEN - SHIFT_AMOUNT;
    }
  }
}

// ============================================================
// GSR
// ============================================================

int readGSR() {
  // Raw ADC — no scaling.  Consistent with the old BLE sketch.
  return analogRead(GSR_PIN);
}

// ============================================================
// READ ALL SENSORS → SensorReading
// ============================================================

SensorReading readSensors() {
  SensorReading r = {};

  if (mpuFound) {
    readMPU6050(r.ax, r.ay, r.az, r.gx, r.gy, r.gz);
  }

  r.temp = lastValidTemperature;       // STTS22H — updated by updateTemperature()
  r.hr   = (float)currentHR;          // MAX30102 — -1 if no finger
  r.spo2 = (float)currentSpO2;        // MAX30102 — -1 if no finger
  r.gsr  = (float)readGSR();
  r.hrv  = -1.0f;                     // DB trigger computes SDNN; no sensor-side HRV

  return r;
}

// ============================================================
// BLE SERVER CALLBACKS
// ============================================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pSrv) override {
    bleClientConnected = true;
  }
  void onDisconnect(BLEServer* pSrv) override {
    bleClientConnected = false;
    delay(500);
    pSrv->startAdvertising();
  }
};

// ============================================================
// WIFI STATUS HELPER
// ============================================================

void setWifiStatus(const String& status) {
  wifiStatus = status;
  if (pWifiStatusChar) {
    pWifiStatusChar->setValue(status.c_str());
    if (bleClientConnected) pWifiStatusChar->notify();
  }
}

// ============================================================
// WIFI SCAN RESULTS — helper to push one JSON chunk over BLE
// ============================================================

void sendScanResult(const String& json) {
  if (!pWifiScanResultChar) return;
  pWifiScanResultChar->setValue(json.c_str());
  pWifiScanResultChar->notify();
  delay(20); // breathing room between BLE notifications
}

// ============================================================
// PERFORM WIFI SCAN (called from main loop)
// ============================================================

void performWifiScan() {
  if (WiFi.getMode() == WIFI_OFF) {
    WiFi.mode(WIFI_STA);
    delay(200);
  }

  int n = WiFi.scanNetworks(false, false);

  if (n == WIFI_SCAN_FAILED || n < 0) {
    sendScanResult("{\"type\":\"error\",\"message\":\"SCAN_FAILED\"}");
    return;
  }
  if (n == 0) {
    sendScanResult("{\"type\":\"end\",\"count\":0}");
    return;
  }

  for (int i = 0; i < n; i++) {
    StaticJsonDocument<256> doc;
    doc["type"]    = "network";
    doc["ssid"]    = WiFi.SSID(i);
    doc["rssi"]    = WiFi.RSSI(i);
    doc["secure"]  = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
    doc["channel"] = WiFi.channel(i);
    String json;
    serializeJson(doc, json);
    sendScanResult(json);
  }

  WiFi.scanDelete();

  StaticJsonDocument<64> endDoc;
  endDoc["type"]  = "end";
  endDoc["count"] = n;
  String endJson;
  serializeJson(endDoc, endJson);
  sendScanResult(endJson);
}

// ============================================================
// WIFI CONFIG CALLBACK
// ============================================================
// Credentials are stored and a flag set; the actual WiFi.begin()
// call happens in loop() on the main stack to avoid running WiFi
// SDK calls inside a BLE interrupt context (race-condition fix).

struct PendingWifiConnect {
  bool   requested = false;
  String ssid;
  String password;
  int    retryCount = 0;
};
static PendingWifiConnect pendingWifi;
static bool wifiScanInProgress = false;

class WifiConfigCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String payload = pChar->getValue();
    payload.trim();

    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload) != DeserializationError::Ok) {
      return;
    }

    pendingWifi.ssid       = doc["ssid"].as<String>();
    pendingWifi.password   = doc["password"].as<String>();
    pendingWifi.requested  = true;
    pendingWifi.retryCount = 0;
    setWifiStatus("CONNECTING");
  }
};

// ============================================================
// WIFI SCAN REQUEST CALLBACK
// ============================================================

class WifiScanRequestCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String cmd = pChar->getValue();
    cmd.trim();
    cmd.toUpperCase();
    if (cmd == "SCAN") wifiScanRequested = true;
  }
};

// ============================================================
// WEBSOCKET EVENT HANDLER
// ============================================================

void onWsEvent(WStype_t type, uint8_t* payload, size_t /*length*/) {
  switch (type) {

    case WStype_DISCONNECTED:
      wsConnected     = false;
      wsAuthenticated = false;
      Serial.printf("[WS] Disconnected\n");
      break;

    case WStype_CONNECTED:
      wsConnected = true;
      Serial.printf("[WS] Connected\n");
      break;

    case WStype_TEXT: {
      String raw = String((char*)payload);

      StaticJsonDocument<512> doc;
      if (deserializeJson(doc, raw) != DeserializationError::Ok) break;

      const char* msgType = doc["type"];
      if (!msgType) break;

      if (strcmp(msgType, "authenticated") == 0) {
        wsAuthenticated = true;
        break;
      }
      if (strcmp(msgType, "device_ready") == 0) {
        wsAuthenticated = true;
        break;
      }
      if (strcmp(msgType, "pong") == 0)  break; // heartbeat — no action
      if (strcmp(msgType, "ack")  == 0)  break; // data ack  — no action
      if (strcmp(msgType, "error") == 0) {
        Serial.printf("[WS] Server error: %s\n", raw.c_str());
        break;
      }
      break;
    }

    case WStype_PING:
      // Library auto-responds with pong
      break;

    default:
      break;
  }
}

// ============================================================
// CONNECT WEBSOCKET
// ============================================================

void connectWebSocket() {
  if (WiFi.status() != WL_CONNECTED) return;

  wsClient.onEvent(onWsEvent);
  wsClient.beginSSL(WS_HOST, 443, WS_PATH);
  wsClient.setReconnectInterval(WS_RECONNECT_INTERVAL_MS);
  wsClient.enableHeartbeat(15000, 3000, 2);
  wsLastConnectAttempt = millis();
}

// ============================================================
// SEND SENSOR PACKET OVER WEBSOCKET
// ============================================================

void sendSensorPacket() {
  if (!wsConnected || !wsAuthenticated) return;

  SensorReading s = readSensors();

  // Edge function expects: { "type": "sensor_data", "data": { ... } }
  StaticJsonDocument<768> doc;
  doc["type"] = "sensor_data";

  JsonObject data = doc.createNestedObject("data");
  data["band_id"] = BAND_ID;
  data["seq"]     = sensorSeq++;
  data["t"]       = (double)millis();
  data["ax"]      = s.ax;
  data["ay"]      = s.ay;
  data["az"]      = s.az;
  data["gx"]      = s.gx;
  data["gy"]      = s.gy;
  data["gz"]      = s.gz;
  data["temp"]    = s.temp;
  data["hr"]      = s.hr;
  data["spo2"]    = s.spo2;
  data["gsr"]     = s.gsr;
  // hrv omitted when -1 so the DB trigger can compute SDNN instead
  if (s.hrv >= 0.0f) data["hrv"] = s.hrv;

  String json;
  serializeJson(doc, json);
  wsClient.sendTXT(json);

  // sensorSeq was post-incremented above, so the seq we just sent
  // is (sensorSeq - 1).  Log every 100th packet.
  if ((sensorSeq - 1) % 100 == 0) {
    Serial.printf("[WS] Sent seq %u\n", (unsigned)(sensorSeq - 1));
  }
}

// ============================================================
// SETUP BLE
// ============================================================

void setupBLE() {
  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setMTU(BLE_MTU);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(BLEUUID(SERVICE_UUID), 30);

  // 0x0002 Band ID (read)
  pBandIdChar = pService->createCharacteristic(
    BAND_ID_UUID, BLECharacteristic::PROPERTY_READ);
  pBandIdChar->setValue(BAND_ID);

  // 0x0003 Sensor (notify — legacy / reserved)
  pSensorChar = pService->createCharacteristic(
    SENSOR_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pSensorChar->addDescriptor(new BLE2902());

  // 0x0004 WiFi Config (write)
  pWifiConfigChar = pService->createCharacteristic(
    WIFI_CONFIG_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiConfigChar->setCallbacks(new WifiConfigCallback());

  // 0x0005 WiFi Status (read + notify)
  pWifiStatusChar = pService->createCharacteristic(
    WIFI_STATUS_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pWifiStatusChar->addDescriptor(new BLE2902());
  pWifiStatusChar->setValue(wifiStatus.c_str());

  // 0x0006 WiFi Scan Request (write)
  pWifiScanRequestChar = pService->createCharacteristic(
    WIFI_SCAN_REQUEST_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiScanRequestChar->setCallbacks(new WifiScanRequestCallback());

  // 0x0007 WiFi Scan Results (notify)
  pWifiScanResultChar = pService->createCharacteristic(
    WIFI_SCAN_RESULTS_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pWifiScanResultChar->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  pAdv->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

// ============================================================
// SETUP LED PWM
// ============================================================
// ESP32 Arduino core v3 unified the old ledcSetup() +
// ledcAttachPin() pair into a single ledcAttach() call.
// ledcWrite() still takes a pin number (not a channel number)
// in v3, so ledSetRGB() is updated to match.
// ============================================================

void setupLED() {
  // ledcAttach(pin, freq_hz, resolution_bits)
  ledcAttach(LED_R_PIN, PWM_FREQ, PWM_RES);
  ledcAttach(LED_G_PIN, PWM_FREQ, PWM_RES);
  ledcAttach(LED_B_PIN, PWM_FREQ, PWM_RES);
  ledOff();
}

// ============================================================
// SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(500);

  // LED — initialise first so the user gets visual feedback immediately
  setupLED();

  // I2C — ESP32-S3 standard pins
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);

  mpuFound = initMPU6050();

  sttsFound = initSTTS22H();

  max30102Found = initMAX30102();

  pinMode(GSR_PIN, INPUT);

  // WiFi radio in STA mode before BLE starts — required so that
  // WiFi.scanNetworks() works without coexistence conflicts.
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(200);

  setupBLE();
}

// ============================================================
// LOOP (fully non-blocking)
// ============================================================

void loop() {
  unsigned long now = millis();

  // ── High-frequency sensor servicing ───────────────────────
  updateMAX30102();   // drains FIFO, runs analysis when window is full
  updateTemperature(); // polls STTS22H at TEMP_POLL_MS interval

  // ── LED state machine ──────────────────────────────────────
  updateLED();

  // ── WiFi scan (flag set from BLE callback) ─────────────────
  if (wifiScanRequested) {
    wifiScanRequested = false;
    wifiScanInProgress = true;
    performWifiScan();
    wifiScanInProgress = false;
  }

  // ── Pending WiFi connect (flag set from BLE callback) ──────
  // Execute on main-loop stack to avoid running WiFi SDK calls
  // inside a BLE interrupt context.
  if (pendingWifi.requested && !wifiScanInProgress) {
    pendingWifi.requested = false;
    savedSSID     = pendingWifi.ssid;
    savedPassword = pendingWifi.password;

    // Full reset clears any stale WL_CONNECT_FAILED from a prior
    // attempt or scan before the status monitor reads it.
    WiFi.disconnect(true);
    delay(500); // Increased delay for full radio reset
    WiFi.mode(WIFI_STA);
    WiFi.begin(savedSSID.c_str(), savedPassword.c_str());
    wsLastConnectAttempt = now;
  }

  // ── WiFi connection monitor ────────────────────────────────
  if (!savedSSID.isEmpty() && !wifiScanInProgress) {
    wl_status_t wlStatus = WiFi.status();

    if (wlStatus == WL_CONNECTED && wifiStatus != "CONNECTED") {
      setWifiStatus("CONNECTED");
      connectWebSocket();
    } else if (wifiStatus == "CONNECTING" && now - wsLastConnectAttempt > WIFI_CONNECT_TIMEOUT_MS) {
      if (pendingWifi.retryCount < 1) {
        // Auto-retry once
        pendingWifi.retryCount++;
        pendingWifi.requested = true;
        setWifiStatus("CONNECTING");
      } else {
        setWifiStatus("FAILED");
      }
    } else if (wlStatus == WL_NO_SSID_AVAIL && wifiStatus != "INVALID") {
      // Check timeout here as well before failing, in case of scan delay
      if (now - wsLastConnectAttempt > WIFI_CONNECT_TIMEOUT_MS) {
         setWifiStatus("INVALID");
      }
    }
  }

  // ── WebSocket maintenance ──────────────────────────────────
  if (WiFi.status() == WL_CONNECTED) {
    wsClient.loop();

    if (wsConnected && wsAuthenticated) {
      if (now - lastSensorSend >= SENSOR_INTERVAL_MS) {
        lastSensorSend = now;
        sendSensorPacket();
      }
    }
  }

  // ── Watchdog-safe yield ────────────────────────────────────
  delay(1);
}
