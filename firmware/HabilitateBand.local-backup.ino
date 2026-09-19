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
//   0x0008  Session State    (write)   ACTIVE|RESUME|PAUSE|STOPPED
//
// BOARD: ESP32S3 Dev Module
//   Tools → USB CDC On Boot: Enabled
//
// I2C PINS:
//   SDA = GPIO 8
//   SCL = GPIO 9
//
// REQUIRED LIBRARIES:
//   - WebSockets (by Markus Sattler)
//   - ArduinoJson (by Benoit Blanchon)
//   - SparkFun STTS22H
//   - SparkFun MAX3010x
//   - Wire
// ============================================================

#include <Arduino.h>
#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <WiFi.h>
#include <Preferences.h>
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
// CONFIGURATION
// ============================================================

#define BAND_ID      "HAB-001"
#define DEVICE_NAME  "Habilitate-HAB-001"

// Device token is kept in secrets.h.
// DO NOT commit secrets.h to GitHub.
#include "secrets.h"

#ifdef DEVICE_TOKEN_IS_PLACEHOLDER
  #error "Set a real DEVICE_TOKEN in secrets.h and delete DEVICE_TOKEN_IS_PLACEHOLDER"
#endif

// Supabase project
#define WS_HOST  "sqjuracvmmuyrdcapehk.supabase.co"

// Sensor streaming rate
#define SENSOR_INTERVAL_MS       40    // 25 Hz

// WiFi connection timeout
#define WIFI_CONNECT_TIMEOUT_MS  15000

// WebSocket reconnect interval
#define WS_RECONNECT_INTERVAL_MS 5000

// BLE MTU
#define BLE_MTU 512

// ============================================================
// I2C PINS
// ============================================================

#define I2C_SDA  8
#define I2C_SCL  9

// ============================================================
// GSR PIN
// ============================================================

#define GSR_PIN  1

// ============================================================
// LED PINS & SETTINGS
// ============================================================
//
// Orange  (#FF5A00) → WiFi state
// Purple  (#7B2FFF) → Session state
//
// LED pins:
//   R = GPIO15
//   G = GPIO16
//   B = GPIO17
//
// Battery optimization:
//   Maximum PWM duty = 48 / 255 ≈ 19%
// ============================================================

#define LED_R_PIN       15
#define LED_G_PIN       16
#define LED_B_PIN       17

#define LED_COMMON_ANODE  0
#define LED_MAX_DUTY      48

#define PWM_FREQ  1000
#define PWM_RES   8

// Orange #FF5A00
#define ORANGE_R  (uint8_t)(255 * LED_MAX_DUTY / 255)
#define ORANGE_G  (uint8_t)( 90 * LED_MAX_DUTY / 255)
#define ORANGE_B  0

// Purple #7B2FFF
#define PURPLE_R  (uint8_t)(123 * LED_MAX_DUTY / 255)
#define PURPLE_G  (uint8_t)( 47 * LED_MAX_DUTY / 255)
#define PURPLE_B  (uint8_t)(255 * LED_MAX_DUTY / 255)

// ============================================================
// BLE UUIDs
// Must match frontend bleService.ts
// ============================================================

#define SERVICE_UUID              "7b7a0001-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define BAND_ID_UUID              "7b7a0002-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define SENSOR_UUID               "7b7a0003-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_CONFIG_UUID          "7b7a0004-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_STATUS_UUID          "7b7a0005-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_SCAN_REQUEST_UUID    "7b7a0006-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define WIFI_SCAN_RESULTS_UUID    "7b7a0007-5a7d-4f4c-9f5e-7a3d6b9e1001"
#define SESSION_STATE_UUID        "7b7a0008-5a7d-4f4c-9f5e-7a3d6b9e1001"

// ============================================================
// GLOBAL STATE
// ============================================================

// ---------------- BLE ----------------

BLEServer*           pServer              = nullptr;
BLECharacteristic*   pBandIdChar          = nullptr;
BLECharacteristic*   pSensorChar          = nullptr;
BLECharacteristic*   pWifiConfigChar      = nullptr;
BLECharacteristic*   pWifiStatusChar      = nullptr;
BLECharacteristic*   pWifiScanRequestChar = nullptr;
BLECharacteristic*   pWifiScanResultChar  = nullptr;
BLECharacteristic*   pSessionStateChar    = nullptr;

volatile bool        bleClientConnected   = false;
volatile bool        wifiScanRequested    = false;

// ---------------- WiFi ----------------

Preferences wifiPreferences;

String savedSSID     = "";
String savedPassword = "";
String wifiStatus    = "NO_CREDENTIALS";

int savedWifiRetryCount = 0;

// ---------------- WebSocket ----------------

WebSocketsClient wsClient;

String wsPath;

volatile bool wsConnected     = false;
volatile bool wsAuthenticated = false;

unsigned long wsLastConnectAttempt = 0;

// ---------------- Session ----------------

volatile bool sessionActive = false;
volatile bool sessionPaused = false;

// ---------------- Sensor ----------------

unsigned long lastSensorSend = 0;

uint32_t sensorSeq = 0;

// ============================================================
// SENSOR READING STRUCT
// ============================================================

struct SensorReading {

  float ax;
  float ay;
  float az;

  float gx;
  float gy;
  float gz;

  float temp;

  float hr;

  float hrv;

  float spo2;

  float gsr;
};

// ============================================================
// LED HELPERS
// ============================================================

void ledSetRGB(uint8_t r, uint8_t g, uint8_t b) {

  if (LED_COMMON_ANODE) {

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
//
// Purple constant  → Session active
// Purple blinking  → Session paused
// Orange constant  → WiFi connected
// Orange blinking  → Waiting for WiFi
// Off              → No credentials / error
// ============================================================

void updateLED() {

  static unsigned long lastBlink = 0;
  static bool blinkOn = false;

  unsigned long now = millis();

  if (now - lastBlink >= 500) {

    lastBlink = now;
    blinkOn = !blinkOn;
  }

  // Session active
  if (sessionActive && !sessionPaused) {

    ledSetRGB(
      PURPLE_R,
      PURPLE_G,
      PURPLE_B
    );

    return;
  }

  // Session paused
  if (sessionPaused) {

    if (blinkOn) {

      ledSetRGB(
        PURPLE_R,
        PURPLE_G,
        PURPLE_B
      );

    } else {

      ledOff();
    }

    return;
  }

  // WiFi connected
  if (wifiStatus == "CONNECTED") {

    ledSetRGB(
      ORANGE_R,
      ORANGE_G,
      ORANGE_B
    );

    return;
  }

  // WiFi connecting
  if (wifiStatus == "CONNECTING") {

    if (blinkOn) {

      ledSetRGB(
        ORANGE_R,
        ORANGE_G,
        ORANGE_B
      );

    } else {

      ledOff();
    }

    return;
  }

  ledOff();
}

// ============================================================
// MPU6050
// ============================================================

const int MPU_ADDR = 0x68;

bool mpuFound = false;

bool initMPU6050() {

  Wire.beginTransmission(MPU_ADDR);

  Wire.write(0x75);

  uint8_t txStatus =
    Wire.endTransmission(false);

  Wire.requestFrom(
    MPU_ADDR,
    1,
    true
  );

  if (
    txStatus != 0 ||
    Wire.available() != 1
  ) {

    return false;
  }

  Wire.read();

  // Wake MPU6050
  Wire.beginTransmission(MPU_ADDR);

  Wire.write(0x6B);
  Wire.write(0x00);

  Wire.endTransmission(true);

  // Accelerometer ±8g
  Wire.beginTransmission(MPU_ADDR);

  Wire.write(0x1C);
  Wire.write(0x10);

  Wire.endTransmission(true);

  // Gyroscope ±500°/s
  Wire.beginTransmission(MPU_ADDR);

  Wire.write(0x1B);
  Wire.write(0x08);

  Wire.endTransmission(true);

  return true;
}

void readMPU6050(
  float &ax,
  float &ay,
  float &az,
  float &gx,
  float &gy,
  float &gz
) {

  Wire.beginTransmission(MPU_ADDR);

  Wire.write(0x3B);

  Wire.endTransmission(false);

  Wire.requestFrom(
    MPU_ADDR,
    14,
    true
  );

  int16_t rawAx =
    (Wire.read() << 8) | Wire.read();

  int16_t rawAy =
    (Wire.read() << 8) | Wire.read();

  int16_t rawAz =
    (Wire.read() << 8) | Wire.read();

  // Skip MPU internal temperature
  Wire.read();
  Wire.read();

  int16_t rawGx =
    (Wire.read() << 8) | Wire.read();

  int16_t rawGy =
    (Wire.read() << 8) | Wire.read();

  int16_t rawGz =
    (Wire.read() << 8) | Wire.read();

  // ±8g
  ax = rawAx / 4096.0f;
  ay = rawAy / 4096.0f;
  az = rawAz / 4096.0f;

  // ±500°/s
  gx = rawGx / 65.5f;
  gy = rawGy / 65.5f;
  gz = rawGz / 65.5f;
}

// ============================================================
// STTS22H TEMPERATURE
// ============================================================

SparkFun_STTS22H temperatureSensor;

bool sttsFound = false;

float lastValidTemperature = 25.0f;

unsigned long lastTempReadTime = 0;

const unsigned long TEMP_POLL_MS = 200;

bool initSTTS22H() {

  if (!temperatureSensor.begin()) {

    return false;
  }

  temperatureSensor.setDataRate(
    STTS22H_POWER_DOWN
  );

  delay(10);

  temperatureSensor.setDataRate(
    STTS22H_1Hz
  );

  temperatureSensor.enableAutoIncrement();

  for (int i = 0; i < 10; i++) {

    if (temperatureSensor.dataReady()) {

      float t = NAN;

      temperatureSensor.getTemperatureC(&t);

      if (
        !isnan(t) &&
        t > -40.0f &&
        t < 125.0f
      ) {

        lastValidTemperature = t;

        return true;
      }
    }

    delay(100);
  }

  return true;
}

void updateTemperature() {

  if (!sttsFound) return;

  unsigned long now = millis();

  if (
    now - lastTempReadTime <
    TEMP_POLL_MS
  ) {

    return;
  }

  lastTempReadTime = now;

  if (!temperatureSensor.dataReady()) {

    return;
  }

  float t = NAN;

  temperatureSensor.getTemperatureC(&t);

  if (
    !isnan(t) &&
    t > -40.0f &&
    t < 125.0f
  ) {

    lastValidTemperature = t;
  }
}

// ============================================================
// MAX30102 HEART RATE + SPO2
// ============================================================

MAX30105 particleSensor;

bool max30102Found = false;

#define MAX_BUF_LEN       100
#define SHIFT_AMOUNT       25
#define HISTORY_SIZE        5
#define NO_FINGER_HOLD_MS 2000
#define MAX_HR_STEP          8
#define MAX_SPO2_STEP        3
#define MIN_PERFUSION_IDX 0.30f

uint32_t irBuffer[MAX_BUF_LEN];
uint32_t redBuffer[MAX_BUF_LEN];

int32_t bufferIndex = 0;

int32_t spo2Value = -1;
int8_t  spo2Valid = 0;

int32_t heartRateValue = -1;
int8_t  heartRateValid = 0;

int hrHistory[HISTORY_SIZE];
int spo2History[HISTORY_SIZE];

int historyCount = 0;
int historyIndex = 0;

int lastValidHR = -1;
int lastValidSpO2 = -1;

volatile int currentHR = -1;
volatile int currentSpO2 = -1;

// Finger detection
uint32_t ambientIR = 2000;

const uint32_t FINGER_MARGIN = 8000;

bool fingerPresent = false;

unsigned long lastFingerSeenMs = 0;

// 4-tap moving average
uint32_t irTaps[4] = {
  0, 0, 0, 0
};

uint32_t redTaps[4] = {
  0, 0, 0, 0
};

int tapIdx = 0;

// ============================================================
// INIT MAX30102
// ============================================================

bool initMAX30102() {

  if (
    !particleSensor.begin(
      Wire,
      I2C_SPEED_FAST
    )
  ) {

    return false;
  }

  byte ledBrightness = 0x3F;

  byte sampleAverage = 8;

  byte ledMode = 2;

  int sampleRate = 100;

  int pulseWidth = 411;

  int adcRange = 16384;

  particleSensor.setup(
    ledBrightness,
    sampleAverage,
    ledMode,
    sampleRate,
    pulseWidth,
    adcRange
  );

  particleSensor.setPulseAmplitudeRed(
    ledBrightness
  );

  particleSensor.setPulseAmplitudeIR(
    ledBrightness
  );

  bufferIndex = 0;

  return true;
}

// ============================================================
// PERFUSION INDEX
// ============================================================

float computePerfusionIndex() {

  uint32_t minIR = irBuffer[0];

  uint32_t maxIR = irBuffer[0];

  uint64_t sum = 0;

  for (
    int i = 0;
    i < MAX_BUF_LEN;
    i++
  ) {

    if (irBuffer[i] < minIR)
      minIR = irBuffer[i];

    if (irBuffer[i] > maxIR)
      maxIR = irBuffer[i];

    sum += irBuffer[i];
  }

  float mean =
    (float)sum / MAX_BUF_LEN;

  if (mean <= 0.0f)
    return 0.0f;

  return (
    ((float)(maxIR - minIR) / mean)
    * 100.0f
  );
}

// ============================================================
// MEDIAN FILTER
// ============================================================

int medianOfHistory(
  int* arr,
  int count
) {

  int sorted[HISTORY_SIZE];

  for (int i = 0; i < count; i++) {

    sorted[i] = arr[i];
  }

  for (
    int i = 1;
    i < count;
    i++
  ) {

    int key = sorted[i];

    int j = i - 1;

    while (
      j >= 0 &&
      sorted[j] > key
    ) {

      sorted[j + 1] =
        sorted[j];

      j--;
    }

    sorted[j + 1] = key;
  }

  return sorted[count / 2];
}

// ============================================================
// PROCESS MAX30102 BUFFER
// ============================================================

void processBuffer() {

  float pi =
    computePerfusionIndex();

  if (
    pi < MIN_PERFUSION_IDX
  ) {

    return;
  }

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer,
    MAX_BUF_LEN,
    redBuffer,
    &spo2Value,
    &spo2Valid,
    &heartRateValue,
    &heartRateValid
  );

  bool hrOk =
    heartRateValid &&
    heartRateValue >= 30 &&
    heartRateValue <= 220;

  bool spo2Ok =
    spo2Valid &&
    spo2Value >= 70 &&
    spo2Value <= 100;

  if (hrOk) {

    hrHistory[
      historyIndex % HISTORY_SIZE
    ] = heartRateValue;
  }

  if (spo2Ok) {

    spo2History[
      historyIndex % HISTORY_SIZE
    ] = spo2Value;
  }

  if (hrOk || spo2Ok) {

    historyIndex++;

    if (
      historyCount <
      HISTORY_SIZE
    ) {

      historyCount++;
    }
  }

  if (historyCount == 0)
    return;

  int hrCand =
    hrOk
      ? medianOfHistory(
          hrHistory,
          historyCount
        )
      : lastValidHR;

  int spo2Cand =
    spo2Ok
      ? medianOfHistory(
          spo2History,
          historyCount
        )
      : lastValidSpO2;

  auto clamp =
    [](int cand, int last, int step)
    -> int {

      if (
        last <= 0 ||
        cand <= 0
      ) {

        return cand;
      }

      int d = cand - last;

      if (d > step)
        return last + step;

      if (d < -step)
        return last - step;

      return cand;
    };

  hrCand =
    clamp(
      hrCand,
      lastValidHR,
      MAX_HR_STEP
    );

  spo2Cand =
    clamp(
      spo2Cand,
      lastValidSpO2,
      MAX_SPO2_STEP
    );

  if (hrCand > 0) {

    lastValidHR = hrCand;

    currentHR = lastValidHR;
  }

  if (spo2Cand > 0) {

    lastValidSpO2 = spo2Cand;

    currentSpO2 =
      lastValidSpO2;
  }
}

// ============================================================
// UPDATE MAX30102
// ============================================================

void updateMAX30102() {

  if (!max30102Found)
    return;

  particleSensor.check();

  while (
    particleSensor.available()
  ) {

    uint32_t irRaw =
      particleSensor.getFIFOIR();

    uint32_t redRaw =
      particleSensor.getFIFORed();

    particleSensor.nextSample();

    unsigned long now =
      millis();

    // Adaptive finger detection
    uint32_t threshold =
      ambientIR + FINGER_MARGIN;

    bool hasFinger =
      irRaw > threshold;

    if (hasFinger) {

      lastFingerSeenMs = now;

    } else {

      ambientIR =
        (
          ambientIR * 15 +
          irRaw
        ) / 16;
    }

    if (
      hasFinger &&
      !fingerPresent
    ) {

      fingerPresent = true;

      bufferIndex = 0;
      historyCount = 0;
      historyIndex = 0;
    }

    if (
      !hasFinger &&
      fingerPresent
    ) {

      if (
        now -
        lastFingerSeenMs >=
        NO_FINGER_HOLD_MS
      ) {

        fingerPresent = false;

        currentHR =
          lastValidHR = -1;

        currentSpO2 =
          lastValidSpO2 = -1;

        bufferIndex = 0;

        historyCount = 0;
      }
    }

    if (!fingerPresent)
      continue;

    // 4-tap moving average
    irTaps[tapIdx] = irRaw;

    redTaps[tapIdx] = redRaw;

    tapIdx =
      (tapIdx + 1) % 4;

    uint32_t irF =
      (
        irTaps[0] +
        irTaps[1] +
        irTaps[2] +
        irTaps[3]
      ) / 4;

    uint32_t redF =
      (
        redTaps[0] +
        redTaps[1] +
        redTaps[2] +
        redTaps[3]
      ) / 4;

    irBuffer[bufferIndex] = irF;

    redBuffer[bufferIndex] = redF;

    bufferIndex++;

    if (
      bufferIndex >=
      MAX_BUF_LEN
    ) {

      processBuffer();

      // Sliding window
      for (
        int i = 0;
        i <
        MAX_BUF_LEN -
        SHIFT_AMOUNT;
        i++
      ) {

        irBuffer[i] =
          irBuffer[
            i + SHIFT_AMOUNT
          ];

        redBuffer[i] =
          redBuffer[
            i + SHIFT_AMOUNT
          ];
      }

      bufferIndex =
        MAX_BUF_LEN -
        SHIFT_AMOUNT;
    }
  }
}

// ============================================================
// GSR
// ============================================================

int readGSR() {

  return analogRead(GSR_PIN);
}

// ============================================================
// READ ALL SENSORS
// ============================================================

SensorReading readSensors() {

  SensorReading r = {};

  if (mpuFound) {

    readMPU6050(
      r.ax,
      r.ay,
      r.az,
      r.gx,
      r.gy,
      r.gz
    );
  }

  r.temp =
    lastValidTemperature;

  r.hr =
    (float)currentHR;

  r.spo2 =
    (float)currentSpO2;

  r.gsr =
    (float)readGSR();

  // HRV is calculated by DB trigger
  r.hrv = -1.0f;

  return r;
}

// ============================================================
// BLE SERVER CALLBACKS
// ============================================================

class ServerCallbacks
  : public BLEServerCallbacks {

  void onConnect(
    BLEServer* pSrv
  ) override {

    bleClientConnected = true;
  }

  void onDisconnect(
    BLEServer* pSrv
  ) override {

    bleClientConnected = false;

    delay(500);

    pSrv->startAdvertising();
  }
};

// ============================================================
// WIFI STATUS
// ============================================================

void setWifiStatus(
  const String& status
) {

  wifiStatus = status;

  if (pWifiStatusChar) {

    pWifiStatusChar->setValue(
      status.c_str()
    );

    if (bleClientConnected) {

      pWifiStatusChar->notify();
    }
  }
}

// ============================================================
// LOAD SAVED WIFI
// ============================================================

void loadSavedWiFiCredentials() {

  wifiPreferences.begin(
    "wifi",
    true
  );

  savedSSID =
    wifiPreferences.getString(
      "ssid",
      ""
    );

  savedPassword =
    wifiPreferences.getString(
      "password",
      ""
    );

  wifiPreferences.end();

  if (savedSSID.isEmpty()) {

    setWifiStatus(
      "NO_CREDENTIALS"
    );

    return;
  }

  savedWifiRetryCount = 0;

  setWifiStatus(
    "CONNECTING"
  );

  WiFi.begin(
    savedSSID.c_str(),
    savedPassword.c_str()
  );

  wsLastConnectAttempt =
    millis();

  Serial.println(
    "[WIFI] Saved credentials found; reconnecting automatically"
  );
}

// ============================================================
// SAVE WIFI CREDENTIALS
// ============================================================

void saveWiFiCredentials(
  const String& ssid,
  const String& password
) {

  wifiPreferences.begin(
    "wifi",
    false
  );

  wifiPreferences.putString(
    "ssid",
    ssid
  );

  wifiPreferences.putString(
    "password",
    password
  );

  wifiPreferences.end();

  Serial.println(
    "[WIFI] Credentials saved to NVS"
  );
}

// ============================================================
// WIFI SCAN RESULT
// ============================================================

void sendScanResult(
  const String& json
) {

  if (!pWifiScanResultChar)
    return;

  pWifiScanResultChar->setValue(
    json.c_str()
  );

  pWifiScanResultChar->notify();

  delay(20);
}

// ============================================================
// WIFI SCAN
// ============================================================

void performWifiScan() {

  if (
    WiFi.getMode() ==
    WIFI_OFF
  ) {

    WiFi.mode(WIFI_STA);

    delay(200);
  }

  int n =
    WiFi.scanNetworks(
      false,
      false
    );

  if (
    n == WIFI_SCAN_FAILED ||
    n < 0
  ) {

    sendScanResult(
      "{\"type\":\"error\",\"message\":\"SCAN_FAILED\"}"
    );

    return;
  }

  if (n == 0) {

    sendScanResult(
      "{\"type\":\"end\",\"count\":0}"
    );

    return;
  }

  for (
    int i = 0;
    i < n;
    i++
  ) {

    StaticJsonDocument<256> doc;

    doc["type"] =
      "network";

    doc["ssid"] =
      WiFi.SSID(i);

    doc["rssi"] =
      WiFi.RSSI(i);

    doc["secure"] =
      (
        WiFi.encryptionType(i) !=
        WIFI_AUTH_OPEN
      );

    doc["channel"] =
      WiFi.channel(i);

    String json;

    serializeJson(
      doc,
      json
    );

    sendScanResult(json);
  }

  WiFi.scanDelete();

  StaticJsonDocument<64> endDoc;

  endDoc["type"] =
    "end";

  endDoc["count"] =
    n;

  String endJson;

  serializeJson(
    endDoc,
    endJson
  );

  sendScanResult(endJson);
}

// ============================================================
// WIFI CONFIG CALLBACK
// ============================================================

struct PendingWifiConnect {

  bool requested = false;

  String ssid;

  String password;

  int retryCount = 0;
};

static PendingWifiConnect pendingWifi;

static bool wifiScanInProgress = false;

class WifiConfigCallback
  : public BLECharacteristicCallbacks {

  void onWrite(
    BLECharacteristic* pChar
  ) override {

    String payload =
      pChar->getValue();

    payload.trim();

    StaticJsonDocument<256> doc;

    if (
      deserializeJson(
        doc,
        payload
      ) !=
      DeserializationError::Ok
    ) {

      return;
    }

    pendingWifi.ssid =
      doc["ssid"].as<String>();

    pendingWifi.password =
      doc["password"].as<String>();

    pendingWifi.requested =
      true;

    pendingWifi.retryCount =
      0;

    setWifiStatus(
      "CONNECTING"
    );
  }
};

// ============================================================
// WIFI SCAN REQUEST CALLBACK
// ============================================================

class WifiScanRequestCallback
  : public BLECharacteristicCallbacks {

  void onWrite(
    BLECharacteristic* pChar
  ) override {

    String cmd =
      pChar->getValue();

    cmd.trim();

    cmd.toUpperCase();

    if (
      cmd == "SCAN"
    ) {

      wifiScanRequested =
        true;
    }
  }
};

// ============================================================
// SESSION STATE CONTROL
// ============================================================
//
// ACTIVE / RESUME → Purple solid
// PAUSE           → Purple blinking
// STOPPED         → WiFi indication
//
// Dashboard controls this through BLE.
// ============================================================

void applySessionState(
  const String& command
) {

  String state =
    command;

  state.trim();

  state.toUpperCase();

  if (
    state == "ACTIVE" ||
    state == "RESUME" ||
    state == "RESUMED"
  ) {

    sessionActive = true;

    sessionPaused = false;

    Serial.println(
      "[SESSION] ACTIVE"
    );

    return;
  }

  if (
    state == "PAUSE" ||
    state == "PAUSED"
  ) {

    sessionActive = false;

    sessionPaused = true;

    Serial.println(
      "[SESSION] PAUSED"
    );

    return;
  }

  if (
    state == "STOP" ||
    state == "STOPPED" ||
    state == "IDLE"
  ) {

    sessionActive = false;

    sessionPaused = false;

    Serial.println(
      "[SESSION] STOPPED"
    );

    return;
  }
}

class SessionStateCallback
  : public BLECharacteristicCallbacks {

  void onWrite(
    BLECharacteristic* pChar
  ) override {

    String command =
      pChar->getValue();

    applySessionState(command);
  }
};

// ============================================================
// WEBSOCKET EVENT HANDLER
// ============================================================

void onWsEvent(
  WStype_t type,
  uint8_t* payload,
  size_t /*length*/
) {

  switch (type) {

    case WStype_DISCONNECTED:

      wsConnected = false;

      wsAuthenticated = false;

      sessionActive = false;

      sessionPaused = false;

      Serial.printf(
        "[WS] Disconnected\n"
      );

      break;

    case WStype_CONNECTED: {

      wsConnected = true;

      Serial.printf(
        "[WS] Connected to Supabase Edge Function\n"
      );

      // Tell Edge Function which device connected
      StaticJsonDocument<128> hello;

      hello["type"] =
        "device_hello";

      hello["band_id"] =
        BAND_ID;

      String helloJson;

      serializeJson(
        hello,
        helloJson
      );

      wsClient.sendTXT(
        helloJson
      );

      Serial.println(
        "[WS] device_hello sent"
      );

      break;
    }

    case WStype_TEXT: {

      String raw =
        String(
          (char*)payload
        );

      StaticJsonDocument<512> doc;

      if (
        deserializeJson(
          doc,
          raw
        ) !=
        DeserializationError::Ok
      ) {

        break;
      }

      const char* msgType =
        doc["type"];

      if (!msgType)
        break;

      if (
        strcmp(
          msgType,
          "authenticated"
        ) == 0
      ) {

        wsAuthenticated = true;

        Serial.println(
          "[WS] Supabase authentication accepted"
        );

        break;
      }

      if (
        strcmp(
          msgType,
          "device_ready"
        ) == 0
      ) {

        wsAuthenticated = true;

        Serial.println(
          "[WS] Device ready"
        );

        break;
      }

      if (
        strcmp(
          msgType,
          "pong"
        ) == 0
      ) {

        break;
      }

      if (
        strcmp(
          msgType,
          "ack"
        ) == 0
      ) {

        break;
      }

      if (
        strcmp(
          msgType,
          "error"
        ) == 0
      ) {

        Serial.printf(
          "[WS] Server error: %s\n",
          raw.c_str()
        );

        break;
      }

      break;
    }

    case WStype_PING:

      // Library automatically responds
      break;

    default:

      break;
  }
}

// ============================================================
// URL ENCODING
// ============================================================

String urlEncode(
  const String& input
) {

  const char hex[] =
    "0123456789ABCDEF";

  String encoded;

  encoded.reserve(
    input.length() + 16
  );

  for (
    size_t i = 0;
    i < input.length();
    ++i
  ) {

    const uint8_t c =
      static_cast<uint8_t>(
        input[i]
      );

    if (
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c == '-' ||
      c == '_' ||
      c == '.' ||
      c == '~'
    ) {

      encoded +=
        static_cast<char>(c);

    } else {

      encoded += '%';

      encoded +=
        hex[(c >> 4) & 0x0F];

      encoded +=
        hex[c & 0x0F];
    }
  }

  return encoded;
}

// ============================================================
// CONNECT WEBSOCKET
// ============================================================

void connectWebSocket() {

  if (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    return;
  }

  // Build WebSocket path at runtime
  // so token is safely URL encoded.
  wsPath =
    String(
      "/functions/v1/wearable-ws?band_id="
    ) +
    urlEncode(BAND_ID) +
    "&token=" +
    urlEncode(DEVICE_TOKEN);

  wsClient.onEvent(
    onWsEvent
  );

  wsClient.beginSSL(
    WS_HOST,
    443,
    wsPath.c_str()
  );

  wsClient.setReconnectInterval(
    WS_RECONNECT_INTERVAL_MS
  );

  wsClient.enableHeartbeat(
    15000,
    3000,
    2
  );

  wsLastConnectAttempt =
    millis();

  Serial.println(
    "[WS] Connecting to Supabase Edge Function..."
  );
}

// ============================================================
// SEND SENSOR PACKET
// ============================================================

void sendSensorPacket() {

  if (
    !wsConnected ||
    !wsAuthenticated
  ) {

    return;
  }

  SensorReading s =
    readSensors();

  // Edge Function expects:
  //
  // {
  //   "type": "sensor_data",
  //   "data": {
  //      ...
  //   }
  // }

  StaticJsonDocument<768> doc;

  doc["type"] =
    "sensor_data";

  JsonObject data =
    doc.createNestedObject(
      "data"
    );

  data["band_id"] =
    BAND_ID;

  data["seq"] =
    sensorSeq++;

  data["t"] =
    (double)millis();

  data["ax"] =
    s.ax;

  data["ay"] =
    s.ay;

  data["az"] =
    s.az;

  data["gx"] =
    s.gx;

  data["gy"] =
    s.gy;

  data["gz"] =
    s.gz;

  data["temp"] =
    s.temp;

  data["hr"] =
    s.hr;

  data["spo2"] =
    s.spo2;

  data["gsr"] =
    s.gsr;

  // HRV is calculated server-side
  if (
    s.hrv >= 0.0f
  ) {

    data["hrv"] =
      s.hrv;
  }

  String json;

  serializeJson(
    doc,
    json
  );

  wsClient.sendTXT(
    json
  );

  // Log every 100th packet
  if (
    (sensorSeq - 1) % 100 == 0
  ) {

    Serial.printf(
      "[WS] Sent seq %u\n",
      (unsigned)(
        sensorSeq - 1
      )
    );
  }
}

// ============================================================
// SETUP BLE
// ============================================================

void setupBLE() {

  BLEDevice::init(
    DEVICE_NAME
  );

  BLEDevice::setMTU(
    BLE_MTU
  );

  pServer =
    BLEDevice::createServer();

  pServer->setCallbacks(
    new ServerCallbacks()
  );

  BLEService* pService =
    pServer->createService(
      BLEUUID(SERVICE_UUID),
      30
    );

  // ----------------------------------------------------------
  // Band ID
  // ----------------------------------------------------------

  pBandIdChar =
    pService->createCharacteristic(
      BAND_ID_UUID,
      BLECharacteristic::PROPERTY_READ
    );

  pBandIdChar->setValue(
    BAND_ID
  );

  // ----------------------------------------------------------
  // Legacy sensor characteristic
  // ----------------------------------------------------------

  pSensorChar =
    pService->createCharacteristic(
      SENSOR_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );

  pSensorChar->addDescriptor(
    new BLE2902()
  );

  // ----------------------------------------------------------
  // WiFi config
  // ----------------------------------------------------------

  pWifiConfigChar =
    pService->createCharacteristic(
      WIFI_CONFIG_UUID,
      BLECharacteristic::PROPERTY_WRITE
    );

  pWifiConfigChar->setCallbacks(
    new WifiConfigCallback()
  );

  // ----------------------------------------------------------
  // WiFi status
  // ----------------------------------------------------------

  pWifiStatusChar =
    pService->createCharacteristic(
      WIFI_STATUS_UUID,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_NOTIFY
    );

  pWifiStatusChar->addDescriptor(
    new BLE2902()
  );

  pWifiStatusChar->setValue(
    wifiStatus.c_str()
  );

  // ----------------------------------------------------------
  // WiFi scan request
  // ----------------------------------------------------------

  pWifiScanRequestChar =
    pService->createCharacteristic(
      WIFI_SCAN_REQUEST_UUID,
      BLECharacteristic::PROPERTY_WRITE
    );

  pWifiScanRequestChar->setCallbacks(
    new WifiScanRequestCallback()
  );

  // ----------------------------------------------------------
  // WiFi scan results
  // ----------------------------------------------------------

  pWifiScanResultChar =
    pService->createCharacteristic(
      WIFI_SCAN_RESULTS_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
    );

  pWifiScanResultChar->addDescriptor(
    new BLE2902()
  );

  // ----------------------------------------------------------
  // Session state
  // ----------------------------------------------------------

  pSessionStateChar =
    pService->createCharacteristic(
      SESSION_STATE_UUID,
      BLECharacteristic::PROPERTY_WRITE
    );

  pSessionStateChar->setCallbacks(
    new SessionStateCallback()
  );

  pService->start();

  // Advertising
  BLEAdvertising* pAdv =
    BLEDevice::getAdvertising();

  pAdv->addServiceUUID(
    SERVICE_UUID
  );

  pAdv->setScanResponse(
    true
  );

  pAdv->setMinPreferred(
    0x06
  );

  pAdv->setMinPreferred(
    0x12
  );

  BLEDevice::startAdvertising();
}

// ============================================================
// SETUP LED PWM
// ============================================================
//
// ESP32 Arduino Core v3 uses:
//
//   ledcAttach(pin, frequency, resolution)
//
// instead of the older:
//
//   ledcSetup()
//   ledcAttachPin()
// ============================================================

void setupLED() {

  ledcAttach(
    LED_R_PIN,
    PWM_FREQ,
    PWM_RES
  );

  ledcAttach(
    LED_G_PIN,
    PWM_FREQ,
    PWM_RES
  );

  ledcAttach(
    LED_B_PIN,
    PWM_FREQ,
    PWM_RES
  );

  ledOff();
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(500);

  Serial.println(
    "[BOOT] HabilitateBand starting"
  );

  // LED first
  setupLED();

  // I2C
  Wire.begin(
    I2C_SDA,
    I2C_SCL
  );

  Wire.setClock(
    400000
  );

  // MPU6050
  mpuFound =
    initMPU6050();

  // STTS22H
  sttsFound =
    initSTTS22H();

  // MAX30102
  max30102Found =
    initMAX30102();

  // GSR
  pinMode(
    GSR_PIN,
    INPUT
  );

  // WiFi
  WiFi.mode(
    WIFI_STA
  );

  loadSavedWiFiCredentials();

  // BLE
  setupBLE();

  Serial.printf(
    "[BOOT] Sensors MPU=%s STTS22H=%s MAX30102=%s\n",
    mpuFound ? "OK" : "MISSING",
    sttsFound ? "OK" : "MISSING",
    max30102Found ? "OK" : "MISSING"
  );

  Serial.println(
    "[BOOT] BLE ready; Wi-Fi/WSS pipeline running"
  );
}

// ============================================================
// LOOP
// ============================================================

void loop() {

  unsigned long now =
    millis();

  // ----------------------------------------------------------
  // Sensors
  // ----------------------------------------------------------

  updateMAX30102();

  updateTemperature();

  // ----------------------------------------------------------
  // LED
  // ----------------------------------------------------------

  updateLED();

  // ----------------------------------------------------------
  // WiFi scan
  // ----------------------------------------------------------

  if (wifiScanRequested) {

    wifiScanRequested =
      false;

    wifiScanInProgress =
      true;

    performWifiScan();

    wifiScanInProgress =
      false;
  }

  // ----------------------------------------------------------
  // Pending WiFi connection
  // ----------------------------------------------------------

  if (
    pendingWifi.requested &&
    !wifiScanInProgress
  ) {

    pendingWifi.requested =
      false;

    savedSSID =
      pendingWifi.ssid;

    savedPassword =
      pendingWifi.password;

    saveWiFiCredentials(
      savedSSID,
      savedPassword
    );

    savedWifiRetryCount =
      0;

    // Keep credentials in NVS.
    WiFi.disconnect(false);

    delay(100);

    WiFi.mode(
      WIFI_STA
    );

    WiFi.begin(
      savedSSID.c_str(),
      savedPassword.c_str()
    );

    wsLastConnectAttempt =
      now;
  }

  // ----------------------------------------------------------
  // WiFi connection monitor
  // ----------------------------------------------------------

  if (
    !savedSSID.isEmpty() &&
    !wifiScanInProgress
  ) {

    wl_status_t wlStatus =
      WiFi.status();

    // Connected
    if (
      wlStatus == WL_CONNECTED &&
      wifiStatus != "CONNECTED"
    ) {

      setWifiStatus(
        "CONNECTED"
      );

      connectWebSocket();
    }

    // Connection timeout
    else if (
      wifiStatus == "CONNECTING" &&
      now -
      wsLastConnectAttempt >
      WIFI_CONNECT_TIMEOUT_MS
    ) {

      if (
        savedWifiRetryCount < 1
      ) {

        savedWifiRetryCount++;

        WiFi.disconnect(
          false
        );

        delay(100);

        WiFi.mode(
          WIFI_STA
        );

        WiFi.begin(
          savedSSID.c_str(),
          savedPassword.c_str()
        );

        wsLastConnectAttempt =
          now;

        setWifiStatus(
          "CONNECTING"
        );

      } else {

        setWifiStatus(
          "FAILED"
        );
      }
    }

    // SSID unavailable
    else if (
      wlStatus ==
        WL_NO_SSID_AVAIL &&
      wifiStatus !=
        "INVALID"
    ) {

      if (
        now -
        wsLastConnectAttempt >
        WIFI_CONNECT_TIMEOUT_MS
      ) {

        setWifiStatus(
          "INVALID"
        );
      }
    }
  }

  // ----------------------------------------------------------
  // WebSocket maintenance
  // ----------------------------------------------------------

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {

    wsClient.loop();

    if (
      wsConnected &&
      wsAuthenticated
    ) {

      if (
        now -
        lastSensorSend >=
        SENSOR_INTERVAL_MS
      ) {

        lastSensorSend =
          now;

        sendSensorPacket();
      }
    }
  }

  // ----------------------------------------------------------
  // Watchdog-safe yield
  // ----------------------------------------------------------

  delay(1);
}