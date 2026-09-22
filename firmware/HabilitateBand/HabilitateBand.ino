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
//   0x0004  WiFi Config      (write)   {"ssid","password"} or {"forget":true}
//   0x0005  WiFi Status      (read + notify)  see WIFI STATUS VALUES below
//   0x0006  WiFi Scan Req    (write)   "SCAN"
//   0x0007  WiFi Scan Result (notify)  JSON network / end / error
//   0x0008  Session State    (write)   ACTIVE|PAUSE|RESUME|STOPPED
//
// CONNECTIVITY MODEL
//   One set of Wi-Fi credentials is stored in NVS (namespace "wifi").
//   Every write to 0x0004 replaces it completely and restarts the
//   connection from scratch, whatever state the previous network left
//   behind. The band never gives up: failed attempts back off (2 s up
//   to 30 s) and retry until new credentials arrive or a forget.
//   Joining Wi-Fi and authenticating with the server are separate
//   stages, and a slow server never tears down a working Wi-Fi link.
//
// WIFI STATUS VALUES (0x0005)
//   NO_CREDENTIALS       nothing stored
//   CONNECTING           joining the Wi-Fi network
//   CLOUD_CONNECTING     joined Wi-Fi; authenticating with the server
//   CONNECTED            streaming to the server
//   NO_INTERNET          joined Wi-Fi but the server is unreachable
//                        (captive portal / firewall); still retrying
//   FAILED_AUTH          network rejected the password; still retrying
//   NO_NETWORK           SSID not found (out of range or 5 GHz-only);
//                        still retrying
//   FAILED               other join failure; still retrying
//   INVALID_CREDENTIALS  malformed BLE write ignored (only reported when
//                        no credentials are stored; otherwise the
//                        current network is kept and the write logged)
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
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <esp_mac.h>
#include <esp_task_wdt.h>
#include <esp_attr.h>

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

#define FIRMWARE_VERSION "0.4.6"

// Beat-detector trace (~3 lines/s plus one per beat). Keep 0 in normal
// use: at that rate it pushes crash output out of the serial monitor.
#define DEBUG_HRV 0

// Per-band identity (BAND_ID + DEVICE_TOKEN) comes from secrets.h
// (gitignored). Every physical band needs its own values; see
// secrets.example.h and firmware/PROVISIONING.md.
#include "secrets.h"

#ifndef BAND_ID
  #error "Define BAND_ID in secrets.h (see secrets.example.h)"
#endif
#ifndef DEVICE_TOKEN
  #error "Define DEVICE_TOKEN in secrets.h (see secrets.example.h)"
#endif
#ifdef DEVICE_TOKEN_IS_PLACEHOLDER
  #error "Set a real DEVICE_TOKEN in secrets.h and delete DEVICE_TOKEN_IS_PLACEHOLDER"
#endif

// The dashboard finds the band by this advertised name.
#define DEVICE_NAME  "Habilitate-" BAND_ID

// Factory base MAC from eFuse, unique per chip. BAND_ID is set by hand,
// so this is logged at boot and sent on every server connect: two bands
// flashed with the same BAND_ID show up as one ID with two MACs.
// Filled in by readChipMac() in setup().
char chipMac[18] = "00:00:00:00:00:00";

// ---- Crash breadcrumbs ----
// Kept in RTC memory that is not cleared by a panic, watchdog or
// software reset (only by power-on). loop() records its uptime and the
// section it is in; the next boot prints where the previous one died,
// so a crash can be diagnosed without catching it on the serial monitor.
enum class LoopStep : uint8_t {
  Boot, Sensors, Led, Scan, Provisioning, Network, WsLoop, Send, Idle,
};

struct CrashCrumbs {
  uint32_t magic;
  uint32_t bootCount;   // boots since the last power-on
  uint32_t uptimeS;
  uint8_t  step;        // LoopStep
  uint8_t  netState;    // NetState
};

#define CRUMB_MAGIC 0x48414231u  // "HAB1"
RTC_NOINIT_ATTR CrashCrumbs crumbs;
CrashCrumbs previousBoot     = {};
bool        previousBootSeen = false;

// A hang anywhere in setup() or loop() panics after this long and the
// band restarts, instead of freezing (it once sat frozen for 11 min).
// Longer than the slowest blocking call, a TLS handshake on a poor link.
#define LOOP_WDT_TIMEOUT_MS 20000

// Supabase WebSocket endpoint
#define WS_HOST  "sqjuracvmmuyrdcapehk.functions.supabase.co"
// Supabase Edge Functions also expose the function on the dedicated functions host.
// Use that host for WSS; the standard /functions/v1 gateway URL is HTTP-oriented.
// WS path is built at runtime so the device token is URL-encoded safely.

// Sensor streaming rate
#define SENSOR_INTERVAL_MS       40    // 25 Hz

// Wi-Fi join: per-attempt timeout, then exponential backoff between attempts
#define WIFI_CONNECT_TIMEOUT_MS  20000
#define WIFI_BACKOFF_MIN_MS       2000
#define WIFI_BACKOFF_MAX_MS      30000
// Fast-fail statuses (wrong password, SSID missing) are ignored for this
// long after WiFi.begin() so a stale status from the previous attempt
// cannot fail the new one.
#define WIFI_STATUS_GRACE_MS      1500

// Server stage: report NO_INTERNET after this long on Wi-Fi without
// authenticating, and cycle the Wi-Fi link if it lasts this long.
#define CLOUD_NO_INTERNET_MS     20000
#define CLOUD_STALL_RESET_MS    120000

#define WIFI_SCAN_TIMEOUT_MS     15000

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
// LED (single onboard WS2812, driven through the core's RMT API)
// ============================================================
// Orange (#FF5A00) → connectivity state
// Purple (#7B2FFF) → therapy session state
//
// Colours are full scale; ledSetRGB() scales them by LED_MAX_DUTY, which caps
// the output to save battery while keeping the LED visible.
// ============================================================
// The LED pin comes from the board selected in the Arduino IDE
// ("ESP32S3 Dev Module" defines PIN_RGB_LED as 48). A board that wires
// its LED elsewhere (Espressif's DevKitC-1 v1.1 uses 38) can override
// it by defining LED_PIN above this line.
#ifndef LED_PIN
  #ifdef PIN_RGB_LED
    #define LED_PIN PIN_RGB_LED
  #else
    #define LED_PIN 48
  #endif
#endif
#define LED_MAX_DUTY      48      // 0-255; ~19% duty: visible while still battery-conscious

// A frame takes ~30 us; anything slower means the RMT peripheral is
// stuck, and the write is abandoned rather than blocking the band.
#define LED_WRITE_TIMEOUT_MS 10

#define ORANGE_R  255
#define ORANGE_G   90
#define ORANGE_B    0

#define PURPLE_R  123
#define PURPLE_G   47
#define PURPLE_B  255

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
#define SESSION_STATE_UUID        "7b7a0008-5a7d-4f4c-9f5e-7a3d6b9e1001"

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
BLECharacteristic*   pSessionStateChar    = nullptr;


// --- BLE → loop() handoff ---
// BLE callbacks run on the Bluetooth task, not the loop() task. They
// only set these flags (and pendingCreds under provisionMux); all Wi-Fi,
// NVS and status work happens in loop().
volatile bool          bleClientConnected    = false;
volatile bool          bleRestartAdvertising = false;
volatile unsigned long bleDisconnectedAt     = 0;
volatile bool          wifiScanRequested     = false;

struct WifiCredentials {
  char ssid[33];       // 802.11 SSID: 1–32 bytes
  char password[65];   // WPA passphrase 8–63 chars, 64-hex PSK, or empty (open)
};

portMUX_TYPE           provisionMux          = portMUX_INITIALIZER_UNLOCKED;
WifiCredentials        pendingCreds;                   // guarded by provisionMux
volatile bool          pendingCredsReady     = false;  // guarded by provisionMux
volatile bool          pendingForget         = false;  // guarded by provisionMux
volatile bool          pendingRejected       = false;

// --- Connectivity (loop() task only) ---
enum class NetState : uint8_t {
  NoCredentials,
  WifiConnecting,    // WiFi.begin() issued, waiting to join
  WifiBackoff,       // last join failed; waiting before the next attempt
  CloudConnecting,   // joined Wi-Fi; WebSocket not yet authenticated
  Online,            // authenticated; streaming
};

WifiCredentials activeCreds          = {};
bool            hasCredentials       = false;
NetState        netState             = NetState::NoCredentials;
unsigned long   netStateSince        = 0;
unsigned long   wifiAttemptStartedAt = 0;
unsigned long   wifiNextAttemptAt    = 0;
uint32_t        wifiBackoffMs        = WIFI_BACKOFF_MIN_MS;
bool            cloudStallReported   = false;
bool            cloudStarted         = false;
bool            wifiScanActive       = false;
unsigned long   wifiScanStartedAt    = 0;
const char*     wifiStatus           = "NO_CREDENTIALS";  // always a string literal

// Last Wi-Fi disconnect reason (wifi_err_reason_t), written by the
// Wi-Fi event task. Single byte, so reads and writes are atomic.
volatile uint8_t lastDisconnectReason = 0;

// --- WebSocket ---
WebSocketsClient     wsClient;
String               wsPath;
bool                 wsConnected          = false;
bool                 wsAuthenticated      = false;

// --- Session state (drives LED) ---
// Set only by the dashboard over BLE. Transport drops (Wi-Fi or
// WebSocket) do not change it: the therapy session is still running.
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

// The Adafruit NeoPixel driver was replaced: every show() ended in an
// RMT write with no timeout, and it could return from a failed RMT init
// still holding its internal mutex. A status LED must never be able to
// block the band, so frames are sent here with LED_WRITE_TIMEOUT_MS.
bool     ledReady         = false;
uint32_t ledWriteFailures = 0;

void ledInit() {
  // 10 MHz: one tick = 100 ns, matching the WS2812 timing below.
  ledReady = rmtInit(LED_PIN, RMT_TX_MODE, RMT_MEM_NUM_BLOCKS_1, 10000000);
  if (!ledReady) Serial.printf("[LED] RMT init failed on GPIO %d; LED disabled\n", LED_PIN);
}

void ledWriteFrame(uint8_t r, uint8_t g, uint8_t b) {
  if (!ledReady) return;

  // WS2812 takes GRB, MSB first. 0 bit: 400 ns high, 800 ns low;
  // 1 bit: 800 ns high, 400 ns low.
  const uint8_t bytes[3] = {g, r, b};
  rmt_data_t symbols[24];
  for (int i = 0; i < 24; i++) {
    const bool one = bytes[i / 8] & (0x80 >> (i % 8));
    symbols[i].level0    = 1;
    symbols[i].duration0 = one ? 8 : 4;
    symbols[i].level1    = 0;
    symbols[i].duration1 = one ? 4 : 8;
  }

  if (!rmtWrite(LED_PIN, symbols, 24, LED_WRITE_TIMEOUT_MS)) {
    if (ledWriteFailures++ == 0) Serial.println("[LED] Write timed out; continuing without it");
  }
}

// updateLED() runs every loop iteration, so the LED is written when the
// colour changes, plus once a second so a single corrupted frame can
// never leave it stuck wrong or dark.
#define LED_REFRESH_MS 1000

void ledSetRGB(uint8_t r, uint8_t g, uint8_t b) {
  static uint32_t      shown       = 0xFFFFFFFF;  // forces the first write
  static unsigned long lastWriteMs = 0;
  const uint32_t colour = ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
  const unsigned long now = millis();
  if (colour == shown && now - lastWriteMs < LED_REFRESH_MS) return;
  shown       = colour;
  lastWriteMs = now;
  ledWriteFrame((uint16_t)r * LED_MAX_DUTY / 255,
                (uint16_t)g * LED_MAX_DUTY / 255,
                (uint16_t)b * LED_MAX_DUTY / 255);
}

void ledOff() {
  ledSetRGB(0, 0, 0);
}

// ============================================================
// LED STATE MACHINE
// ============================================================
// Called every loop iteration.  Drives LED based on connectivity +
// session state without using delay().
//
// Priority (highest first):
//   Purple/orange    → session active but NOT streaming (Wi-Fi or
//   alternating        server lost): data is not being recorded
//   Purple solid     → session active and streaming (also after RESUME)
//   Purple blinking  → session paused
//   Orange solid     → Wi-Fi connected: joined and streaming to the
//                      server (NetState::Online)
//   Orange blinking  → waiting for Wi-Fi: joining, retrying, or joined
//                      but the server is not reachable yet
//   Off              → no Wi-Fi credentials stored
//
// Orange is solid only once data can actually flow. On a network that
// joins but blocks the server (captive portal, firewall) it keeps
// blinking, so a band that is not recording never looks ready.
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
    if (netState == NetState::Online) {
      ledSetRGB(PURPLE_R, PURPLE_G, PURPLE_B);
    } else if (blinkOn) {
      // Never off, so it can't be mistaken for either blink pattern.
      ledSetRGB(PURPLE_R, PURPLE_G, PURPLE_B);
    } else {
      ledSetRGB(ORANGE_R, ORANGE_G, ORANGE_B);
    }
    return;
  }

  if (sessionPaused) {
    if (blinkOn) ledSetRGB(PURPLE_R, PURPLE_G, PURPLE_B);
    else         ledOff();
    return;
  }

  if (netState == NetState::Online) {
    ledSetRGB(ORANGE_R, ORANGE_G, ORANGE_B);
    return;
  }

  if (netState != NetState::NoCredentials) {
    if (blinkOn) ledSetRGB(ORANGE_R, ORANGE_G, ORANGE_B);
    else         ledOff();
    return;
  }

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
unsigned long lastValidReadingMs = 0;
#define READING_STALE_MS 5000

// ---- Beat-to-beat interval tracking (for HRV / RMSSD) ----
#define IBI_HISTORY_SIZE   12
#define MIN_IBI_MS         270
#define MAX_IBI_MS         2000
#define PEAK_THRESHOLD_FRAC 0.35f

float         dcTracker        = 0.0f;
float         acEnvelope       = 50.0f;
float         prevAC1          = 0.0f;
float         prevAC2          = 0.0f;
unsigned long lastPeakMs       = 0;
unsigned long ibiHistory[IBI_HISTORY_SIZE];
int           ibiCount         = 0;
unsigned long detectorStartMs  = 0;
#define DC_SETTLE_MS 1000

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

// ============================================================
// PULSE PEAK DETECTION (for HRV)
// ============================================================

void resetPulseDetector() {
  dcTracker      = 0.0f;
  acEnvelope     = 50.0f;
  prevAC1        = 0.0f;
  prevAC2        = 0.0f;
  lastPeakMs     = 0;
  ibiCount       = 0;
  detectorStartMs = millis();
}

void detectPulsePeak(float irFiltered, unsigned long nowMs) {
  // Fast-lock the baseline for the first second after reset (so a fresh
  // finger-contact jump doesn't take 4-8+ seconds to settle), then
  // slow down to preserve the actual heartbeat waveform for detection.
  bool settling = (nowMs - detectorStartMs) < DC_SETTLE_MS;
  const float DC_ALPHA = settling ? 0.3f : 0.02f;
  if (dcTracker == 0.0f) dcTracker = irFiltered;
  dcTracker += DC_ALPHA * (irFiltered - dcTracker);

  float ac = irFiltered - dcTracker;

  float absAc = fabsf(ac);
  const float ENV_DECAY = 0.995f;
  const float MAX_AC_ENVELOPE = 500.0f;  // cap so one motion spike can't blind detection for 60-90+ seconds
  acEnvelope = (absAc > acEnvelope) ? absAc : (acEnvelope * ENV_DECAY);
  if (acEnvelope < 10.0f)  acEnvelope = 10.0f;
  if (acEnvelope > MAX_AC_ENVELOPE) acEnvelope = MAX_AC_ENVELOPE;

  bool isLocalMax = (prevAC1 > prevAC2) && (prevAC1 > ac);
  bool isBigEnough = prevAC1 > (acEnvelope * PEAK_THRESHOLD_FRAC);

#if DEBUG_HRV
  static unsigned long lastDebugMs = 0;
  if (nowMs - lastDebugMs >= 300) {
    lastDebugMs = nowMs;
    Serial.printf("[HRV-DBG] ac=%.1f prevAC1=%.1f env=%.1f thresh=%.1f localMax=%d bigEnough=%d ibiCount=%d\n",
                  ac, prevAC1, acEnvelope, acEnvelope * PEAK_THRESHOLD_FRAC,
                  isLocalMax, isBigEnough, ibiCount);
  }
#endif

  if (isLocalMax && isBigEnough) {
    if (lastPeakMs > 0) {
      unsigned long ibi = nowMs - lastPeakMs;
#if DEBUG_HRV
      Serial.printf("[HRV-DBG] PEAK FOUND: ibi=%lu ms (valid range %d-%d)\n", ibi, MIN_IBI_MS, MAX_IBI_MS);
#endif
      if (ibi >= MIN_IBI_MS && ibi <= MAX_IBI_MS) {
        if (ibiCount >= IBI_HISTORY_SIZE) {
          for (int i = 0; i < IBI_HISTORY_SIZE - 1; i++) {
            ibiHistory[i] = ibiHistory[i + 1];
          }
          ibiHistory[IBI_HISTORY_SIZE - 1] = ibi;
        } else {
          ibiHistory[ibiCount++] = ibi;
        }
      }
    }
    lastPeakMs = nowMs;
  }

  prevAC2 = prevAC1;
  prevAC1 = ac;
}

float computeRMSSD() {
  if (ibiCount < 4) return -1.0f;
  double sumSq = 0;
  int n = 0;
  for (int i = 1; i < ibiCount; i++) {
    float d = (float)ibiHistory[i] - (float)ibiHistory[i - 1];
    sumSq += (double)d * d;
    n++;
  }
  return (n > 0) ? sqrtf((float)(sumSq / n)) : -1.0f;
}

void processBuffer() {
  float pi  = computePerfusionIndex();

  if (pi < MIN_PERFUSION_IDX) {
    return;
  }

  lastValidReadingMs = millis();

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
      resetPulseDetector();
    }

    if (!hasFinger && fingerPresent) {
      if (now - lastFingerSeenMs >= NO_FINGER_HOLD_MS) {
        fingerPresent  = false;
        currentHR      = lastValidHR   = -1;
        currentSpO2    = lastValidSpO2 = -1;
        bufferIndex    = historyCount  = 0;
        resetPulseDetector();
      }
    }

    if (!fingerPresent) continue;

    // If we haven't had a good-quality reading in a while, treat as
    // stale rather than continuing to show a frozen old value.
    if (lastValidReadingMs > 0 && now - lastValidReadingMs > READING_STALE_MS) {
      currentHR   = lastValidHR   = -1;
      currentSpO2 = lastValidSpO2 = -1;
      resetPulseDetector();
    }

    // 4-tap moving-average filter
    irTaps [tapIdx] = irRaw;
    redTaps[tapIdx] = redRaw;
    tapIdx = (tapIdx + 1) % 4;

    uint32_t irF  = (irTaps[0]  + irTaps[1]  + irTaps[2]  + irTaps[3])  / 4;
    uint32_t redF = (redTaps[0] + redTaps[1] + redTaps[2] + redTaps[3]) / 4;

    detectPulsePeak((float)irF, now);

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
  r.hrv  = (fingerPresent && currentHR > 0) ? computeRMSSD() : -1.0f;  // RMSSD from real beat-to-beat intervals

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
    // Advertising restarts from loop() after a short pause so this
    // callback never blocks the Bluetooth task.
    bleClientConnected    = false;
    bleDisconnectedAt     = millis();
    bleRestartAdvertising = true;
  }
};

// ============================================================
// WIFI STATUS (loop() task only)
// ============================================================

void setWifiStatus(const char* status) {
  if (strcmp(wifiStatus, status) == 0) return;
  wifiStatus = status;
  Serial.printf("[WIFI] Status -> %s\n", status);
  if (pWifiStatusChar) {
    pWifiStatusChar->setValue(status);
    if (bleClientConnected) pWifiStatusChar->notify();
  }
}

void setNetState(NetState state, unsigned long now) {
  netState      = state;
  netStateSince = now;
}

// ============================================================
// WIFI CREDENTIALS (NVS namespace "wifi")
// ============================================================

// Validates and copies into a zeroed struct, so no bytes from a
// previous (longer) SSID or password can survive.
bool copyCredentials(WifiCredentials& out, const char* ssid, const char* password) {
  const size_t ssidLen = strlen(ssid);
  const size_t passLen = strlen(password);
  if (ssidLen == 0 || ssidLen > 32) return false;
  if (passLen > 64 || (passLen > 0 && passLen < 8)) return false;
  if (passLen == 64) {  // a raw PSK must be hex
    for (size_t i = 0; i < passLen; i++) {
      if (!isxdigit(static_cast<unsigned char>(password[i]))) return false;
    }
  }

  memset(&out, 0, sizeof(out));
  memcpy(out.ssid, ssid, ssidLen);
  memcpy(out.password, password, passLen);
  return true;
}

bool loadStoredCredentials(WifiCredentials& out) {
  Preferences prefs;
  if (!prefs.begin("wifi", true)) return false;  // namespace absent on first boot
  String ssid     = prefs.getString("ssid", "");
  String password = prefs.getString("password", "");
  prefs.end();
  return copyCredentials(out, ssid.c_str(), password.c_str());
}

// clear() first so nothing from the previous network is left in the
// namespace, then read back to confirm the write actually landed.
bool storeCredentials(const WifiCredentials& creds) {
  Preferences prefs;
  if (!prefs.begin("wifi", false)) return false;
  prefs.clear();
  prefs.putString("ssid", creds.ssid);
  prefs.putString("password", creds.password);
  const bool ok = prefs.getString("ssid", "") == creds.ssid &&
                  prefs.getString("password", "") == creds.password;
  prefs.end();
  return ok;
}

void clearStoredCredentials() {
  Preferences prefs;
  if (!prefs.begin("wifi", false)) return;
  prefs.clear();
  prefs.end();
}

// ============================================================
// WIFI EVENTS (runs on the Wi-Fi event task)
// ============================================================

void onWifiEvent(arduino_event_id_t event, arduino_event_info_t info) {
  if (event != ARDUINO_EVENT_WIFI_STA_DISCONNECTED) return;
  const uint8_t reason = info.wifi_sta_disconnected.reason;
  // ASSOC_LEAVE is our own WiFi.disconnect(); it says nothing about
  // why the network rejected us, so never let it mask a real reason.
  if (reason != WIFI_REASON_ASSOC_LEAVE) lastDisconnectReason = reason;
}

const char* classifyWifiFailure(uint8_t reason, wl_status_t status) {
  switch (reason) {
    case WIFI_REASON_AUTH_FAIL:
    case WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT:
    case WIFI_REASON_HANDSHAKE_TIMEOUT:
      return "FAILED_AUTH";
    case WIFI_REASON_NO_AP_FOUND:
      return "NO_NETWORK";
    default:
      break;
  }
  // 210-212: NO_AP_FOUND_W_COMPATIBLE_SECURITY / _IN_AUTHMODE_THRESHOLD /
  // _IN_RSSI_THRESHOLD (ESP-IDF 5.x). Numeric so older cores still build.
  if (reason >= 210 && reason <= 212) return "NO_NETWORK";
  if (status == WL_NO_SSID_AVAIL) return "NO_NETWORK";
  return "FAILED";
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
// SEND WIFI SCAN RESULTS (n = completed async scan count)
// ============================================================

// 802.1X networks need a username (and often certificates), which the
// band cannot be given, so the dashboard marks them as unsupported.
bool isEnterpriseAuth(wifi_auth_mode_t mode) {
  switch (mode) {
    case WIFI_AUTH_WPA_ENTERPRISE:
    case WIFI_AUTH_WPA2_ENTERPRISE:
    case WIFI_AUTH_WPA3_ENTERPRISE:
    case WIFI_AUTH_WPA2_WPA3_ENTERPRISE:
    case WIFI_AUTH_WPA3_ENT_192:
      return true;
    default:
      return false;
  }
}

void sendScanResults(int n) {
  for (int i = 0; i < n; i++) {
    const wifi_auth_mode_t auth = WiFi.encryptionType(i);
    StaticJsonDocument<256> doc;
    doc["type"]    = "network";
    doc["ssid"]    = WiFi.SSID(i);
    doc["rssi"]    = WiFi.RSSI(i);
    doc["secure"]  = (auth != WIFI_AUTH_OPEN);
    doc["channel"] = WiFi.channel(i);
    if (isEnterpriseAuth(auth)) doc["enterprise"] = true;
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
// WIFI CONFIG CALLBACK (Bluetooth task)
// ============================================================
// Only validates and hands the request to loop(). The newest write
// always wins: new credentials cancel a pending forget and vice versa.

class WifiConfigCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String payload = pChar->getValue();

    StaticJsonDocument<384> doc;
    if (deserializeJson(doc, payload) != DeserializationError::Ok) {
      pendingRejected = true;
      return;
    }

    if (doc["forget"] | false) {
      portENTER_CRITICAL(&provisionMux);
      pendingForget     = true;
      pendingCredsReady = false;
      portEXIT_CRITICAL(&provisionMux);
      return;
    }

    WifiCredentials creds;
    if (!copyCredentials(creds, doc["ssid"] | "", doc["password"] | "")) {
      pendingRejected = true;
      return;
    }

    portENTER_CRITICAL(&provisionMux);
    pendingCreds      = creds;
    pendingCredsReady = true;
    pendingForget     = false;
    portEXIT_CRITICAL(&provisionMux);
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
// SESSION STATE CONTROL
// ============================================================
// BLE command values:
//   ACTIVE / RESUME  -> purple solid
//   PAUSED / PAUSE   -> purple blinking
//   STOPPED          -> return to connectivity indication
//
// Session state is controlled explicitly by the dashboard over BLE.
// Wi-Fi and WebSocket events never change it.

// The dashboard re-sends the current state every few seconds while a
// session is live (the band forgets it on reboot), so only changes are
// logged.
void setSessionState(bool active, bool paused, const char* name) {
  if (sessionActive == active && sessionPaused == paused) return;
  sessionActive = active;
  sessionPaused = paused;
  Serial.printf("[SESSION] %s\n", name);
}

void applySessionState(const String& command) {
  String state = command;
  state.trim();
  state.toUpperCase();

  if (state == "ACTIVE" || state == "RESUME" || state == "RESUMED") {
    setSessionState(true, false, "ACTIVE");
  } else if (state == "PAUSE" || state == "PAUSED") {
    setSessionState(false, true, "PAUSED");
  } else if (state == "STOP" || state == "STOPPED" || state == "IDLE") {
    setSessionState(false, false, "STOPPED");
  }
}

class SessionStateCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String command = pChar->getValue();
    applySessionState(command);
  }
};

// ============================================================
// WEBSOCKET EVENT HANDLER
// ============================================================

void onWsEvent(WStype_t type, uint8_t* payload, size_t /*length*/) {
  switch (type) {

    case WStype_ERROR:
      Serial.printf("[WS] WebSocket/TLS error");
      if (payload) {
        Serial.printf(": %s", (char*)payload);
      }
      Serial.println();
      wsConnected     = false;
      wsAuthenticated = false;
      break;

    case WStype_DISCONNECTED:
      if (wsConnected) Serial.println("[WS] Disconnected");
      wsConnected     = false;
      wsAuthenticated = false;
      break;

    case WStype_CONNECTED: {
      wsConnected = true;
      Serial.printf("[WS] Connected to Supabase Edge Function as %s (mac %s)\n",
                    BAND_ID, chipMac);

      StaticJsonDocument<128> hello;
      hello["type"] = "device_hello";
      hello["band_id"] = BAND_ID;
      hello["fw"] = FIRMWARE_VERSION;
      hello["mac"] = chipMac;
      hello["reset"] = resetReasonName();
      hello["uptime_ms"] = millis();
      hello["boot_count"] = crumbs.bootCount;
      if (previousBootSeen) {
        hello["prev_uptime_s"] = previousBoot.uptimeS;
        hello["prev_step"]     = loopStepName(previousBoot.step);
      }
      String helloJson;
      serializeJson(hello, helloJson);
      wsClient.sendTXT(helloJson);
      Serial.println("[WS] device_hello sent");
      break;
    }

    case WStype_TEXT: {
      String raw = String((char*)payload);

      StaticJsonDocument<512> doc;
      if (deserializeJson(doc, raw) != DeserializationError::Ok) break;

      const char* msgType = doc["type"];
      if (!msgType) break;

      if (strcmp(msgType, "authenticated") == 0) {
        wsAuthenticated = true;
        Serial.println("[WS] Supabase authentication accepted");
        break;
      }
      if (strcmp(msgType, "device_ready") == 0) {
        wsAuthenticated = true;
        Serial.println("[WS] Device ready");
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

String urlEncode(const String& input) {
  const char hex[] = "0123456789ABCDEF";
  String encoded;
  encoded.reserve(input.length() + 16);

  for (size_t i = 0; i < input.length(); ++i) {
    const uint8_t c = static_cast<uint8_t>(input[i]);

    if ((c >= 'a' && c <= 'z') ||
        (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') ||
        c == '-' || c == '_' || c == '.' || c == '~') {
      encoded += static_cast<char>(c);
    } else {
      encoded += '%';
      encoded += hex[(c >> 4) & 0x0F];
      encoded += hex[c & 0x0F];
    }
  }

  return encoded;
}

// Opens the WebSocket once Wi-Fi is up. After this the library
// reconnects on its own (WS_RECONNECT_INTERVAL_MS) for as long as
// wsClient.loop() keeps being called.
void startCloud(unsigned long now) {
  wsConnected     = false;
  wsAuthenticated = false;
  // Supabase Edge Functions supports the dedicated functions host for function endpoints.
  // Keep the WSS connection on the functions host so the WebSocket upgrade reaches
  // the Edge Function runtime directly.
  wsClient.beginSSL(WS_HOST, 443, wsPath.c_str(), nullptr, "");
  wsClient.setReconnectInterval(WS_RECONNECT_INTERVAL_MS);
  wsClient.enableHeartbeat(25000, 8000, 3);
  cloudStarted       = true;
  cloudStallReported = false;

  setNetState(NetState::CloudConnecting, now);
  setWifiStatus("CLOUD_CONNECTING");
  // The path carries the device token, so log only the host.
  Serial.printf("[WIFI] Joined \"%s\" (IP %s, RSSI %d dBm, ch %d); connecting to %s\n",
                activeCreds.ssid, WiFi.localIP().toString().c_str(),
                WiFi.RSSI(), WiFi.channel(), WS_HOST);
}

void stopCloud() {
  if (cloudStarted) wsClient.disconnect();
  cloudStarted    = false;
  wsConnected     = false;
  wsAuthenticated = false;
}

// ============================================================
// CONNECTIVITY STATE MACHINE (loop() task only)
// ============================================================

void startWifiAttempt(unsigned long now) {
  lastDisconnectReason = 0;
  WiFi.begin(activeCreds.ssid,
             activeCreds.password[0] ? activeCreds.password : nullptr);
  wifiAttemptStartedAt = now;
  setNetState(NetState::WifiConnecting, now);
}

void enterBackoff(unsigned long now, const char* failureStatus) {
  Serial.printf("[WIFI] Join failed for \"%s\" (reason %u, status %d); retry in %lu ms\n",
                activeCreds.ssid, lastDisconnectReason, (int)WiFi.status(),
                (unsigned long)wifiBackoffMs);
  WiFi.disconnect(false);
  setWifiStatus(failureStatus);
  wifiNextAttemptAt = now + wifiBackoffMs;
  wifiBackoffMs = (wifiBackoffMs * 2 > WIFI_BACKOFF_MAX_MS) ? WIFI_BACKOFF_MAX_MS
                                                            : wifiBackoffMs * 2;
  setNetState(NetState::WifiBackoff, now);
}

// Drops the link and starts a fresh join to activeCreds.
void restartWifi(unsigned long now) {
  stopCloud();
  WiFi.disconnect(false);  // waits up to 100 ms for the old link to drop
  wifiBackoffMs = WIFI_BACKOFF_MIN_MS;
  setWifiStatus("CONNECTING");
  startWifiAttempt(now);
}

// New credentials from BLE. Everything left over from the previous
// network (backoff delay, failure status, disconnect reason, cloud
// session) is discarded before the first attempt on the new one.
void applyNewCredentials(const WifiCredentials& creds, unsigned long now) {
  activeCreds    = creds;
  hasCredentials = true;
  if (storeCredentials(activeCreds)) {
    Serial.printf("[WIFI] New credentials for \"%s\" saved\n", activeCreds.ssid);
  } else {
    // Still connect with the in-RAM copy; only a reboot would lose them.
    Serial.println("[WIFI] ERROR: credentials could not be written to NVS");
  }
  restartWifi(now);
}

void forgetCredentials(unsigned long now) {
  stopCloud();
  WiFi.disconnect(false);
  clearStoredCredentials();
  memset(&activeCreds, 0, sizeof(activeCreds));
  hasCredentials = false;
  wifiBackoffMs  = WIFI_BACKOFF_MIN_MS;
  setNetState(NetState::NoCredentials, now);
  setWifiStatus("NO_CREDENTIALS");
  Serial.println("[WIFI] Credentials forgotten");
}

// Picks up anything the BLE callbacks handed over. Forget is handled
// before credentials; the callback already guarantees only the newest
// of the two is pending.
void serviceProvisioning(unsigned long now) {
  // A malformed write never disturbs an existing network. The status is
  // only surfaced when there is no network to report on instead.
  if (pendingRejected) {
    pendingRejected = false;
    Serial.println("[WIFI] Ignored malformed Wi-Fi config write");
    if (!hasCredentials) setWifiStatus("INVALID_CREDENTIALS");
  }

  // An async scan owns the radio; apply changes once it finishes.
  if (wifiScanActive) return;

  bool forget = false;
  bool haveCreds = false;
  WifiCredentials creds;

  portENTER_CRITICAL(&provisionMux);
  if (pendingForget) {
    forget = true;
    pendingForget = false;
  } else if (pendingCredsReady) {
    creds = pendingCreds;
    haveCreds = true;
    pendingCredsReady = false;
  }
  portEXIT_CRITICAL(&provisionMux);

  if (forget)    forgetCredentials(now);
  if (haveCreds) applyNewCredentials(creds, now);
}

void serviceNetwork(unsigned long now) {
  if (!hasCredentials) return;

  // While scanning, pause join attempts (they would make the scan fail),
  // but keep an established link and its WebSocket serviced.
  if (wifiScanActive &&
      netState != NetState::CloudConnecting && netState != NetState::Online) {
    return;
  }

  const wl_status_t wl = WiFi.status();

  switch (netState) {
    case NetState::NoCredentials:
      break;

    case NetState::WifiConnecting: {
      // Right after switching networks the driver can briefly still
      // report the previous association (the disconnect is async), so
      // only accept a join to the SSID we actually asked for.
      if (wl == WL_CONNECTED && WiFi.SSID() == activeCreds.ssid) {
        wifiBackoffMs = WIFI_BACKOFF_MIN_MS;
        startCloud(now);
        break;
      }
      const unsigned long elapsed = now - wifiAttemptStartedAt;
      const bool fastFail = elapsed > WIFI_STATUS_GRACE_MS &&
                            (wl == WL_CONNECT_FAILED || wl == WL_NO_SSID_AVAIL);
      if (fastFail || elapsed > WIFI_CONNECT_TIMEOUT_MS) {
        enterBackoff(now, classifyWifiFailure(lastDisconnectReason, wl));
      }
      break;
    }

    case NetState::WifiBackoff:
      if ((long)(now - wifiNextAttemptAt) >= 0) startWifiAttempt(now);
      break;

    case NetState::CloudConnecting:
    case NetState::Online: {
      if (wl != WL_CONNECTED) {
        Serial.printf("[WIFI] Link to \"%s\" lost (reason %u); re-joining\n",
                      activeCreds.ssid, lastDisconnectReason);
        restartWifi(now);
        break;
      }

      crumb(LoopStep::WsLoop);
      wsClient.loop();
      crumb(LoopStep::Network);

      if (wsConnected && wsAuthenticated) {
        if (netState != NetState::Online) {
          setNetState(NetState::Online, now);
          cloudStallReported = false;
          setWifiStatus("CONNECTED");
        }
        break;
      }

      if (netState == NetState::Online) {
        setNetState(NetState::CloudConnecting, now);
        setWifiStatus("CLOUD_CONNECTING");
      }

      const unsigned long waited = now - netStateSince;
      if (!cloudStallReported && waited > CLOUD_NO_INTERNET_MS) {
        cloudStallReported = true;
        Serial.println("[WIFI] On Wi-Fi but the server is unreachable (captive portal or firewall?)");
        setWifiStatus("NO_INTERNET");
      }
      if (waited > CLOUD_STALL_RESET_MS) {
        Serial.println("[WIFI] Server unreachable for too long; cycling the Wi-Fi link");
        restartWifi(now);
      }
      break;
    }
  }
}

// ============================================================
// WIFI SCAN (async; requested over BLE)
// ============================================================

void startWifiScan(unsigned long now) {
  if (wifiScanActive) return;

  // A join in progress makes the scan fail. Drop it; it restarts,
  // with fresh backoff, as soon as the scan completes.
  if (netState == NetState::WifiConnecting || netState == NetState::WifiBackoff) {
    WiFi.disconnect(false);
  }

  if (WiFi.scanNetworks(true /* async */, false /* hidden */) == WIFI_SCAN_FAILED) {
    sendScanResult("{\"type\":\"error\",\"message\":\"SCAN_FAILED\"}");
    if (hasCredentials && netState != NetState::CloudConnecting &&
        netState != NetState::Online) {
      startWifiAttempt(now);
    }
    return;
  }

  wifiScanActive    = true;
  wifiScanStartedAt = now;
}

void serviceWifiScan(unsigned long now) {
  if (!wifiScanActive) return;

  const int16_t n = WiFi.scanComplete();
  if (n == WIFI_SCAN_RUNNING) {
    if (now - wifiScanStartedAt <= WIFI_SCAN_TIMEOUT_MS) return;
    WiFi.scanDelete();
    sendScanResult("{\"type\":\"error\",\"message\":\"SCAN_TIMEOUT\"}");
  } else if (n < 0) {
    sendScanResult("{\"type\":\"error\",\"message\":\"SCAN_FAILED\"}");
  } else {
    sendScanResults(n);
  }

  wifiScanActive = false;
  // Resume the interrupted join, unless new credentials or a forget are
  // already waiting; serviceProvisioning() applies those next loop.
  const bool provisioningPending = pendingCredsReady || pendingForget;
  if (hasCredentials && !provisioningPending &&
      (netState == NetState::WifiConnecting || netState == NetState::WifiBackoff)) {
    wifiBackoffMs = WIFI_BACKOFF_MIN_MS;
    startWifiAttempt(now);
  }
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
  pWifiStatusChar->setValue(wifiStatus);

  // 0x0006 WiFi Scan Request (write)
  pWifiScanRequestChar = pService->createCharacteristic(
    WIFI_SCAN_REQUEST_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiScanRequestChar->setCallbacks(new WifiScanRequestCallback());

  // 0x0007 WiFi Scan Results (notify)
  pWifiScanResultChar = pService->createCharacteristic(
    WIFI_SCAN_RESULTS_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pWifiScanResultChar->addDescriptor(new BLE2902());

  // 0x0008 Session State (write)
  // Dashboard can send: ACTIVE, RESUME, PAUSE, STOPPED
  pSessionStateChar = pService->createCharacteristic(
    SESSION_STATE_UUID, BLECharacteristic::PROPERTY_WRITE);
  pSessionStateChar->setCallbacks(new SessionStateCallback());

  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  pAdv->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
}

// ============================================================
// SETUP LED
// ============================================================

// Red, green, blue at boot, before anything else can affect the LED.
// If this is not visible, the problem is the pin or the hardware, not
// the state logic: check LED_PIN against the board, and on some clones
// the RGB solder jumper must be closed.
void setupLED() {
  ledInit();
  Serial.printf("[LED] Self-test on GPIO %d: red, green, blue\n", LED_PIN);
  const uint8_t steps[3][3] = {{255, 0, 0}, {0, 255, 0}, {0, 0, 255}};
  for (const auto& c : steps) {
    ledSetRGB(c[0], c[1], c[2]);
    delay(250);
  }
  ledOff();
}

// ============================================================
// CHIP MAC (see chipMac)
// ============================================================

// Why the chip last restarted. POWERON / USB are expected after a
// power cycle or flash; PANIC, *_WDT and BROWNOUT mean a crash, hang or
// power problem and must be investigated.
const char* resetReasonName() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON:    return "POWERON";
    case ESP_RST_EXT:        return "EXTERNAL_PIN";
    case ESP_RST_SW:         return "SOFTWARE";
    case ESP_RST_PANIC:      return "PANIC";
    case ESP_RST_INT_WDT:    return "INT_WDT";
    case ESP_RST_TASK_WDT:   return "TASK_WDT";
    case ESP_RST_WDT:        return "OTHER_WDT";
    case ESP_RST_DEEPSLEEP:  return "DEEPSLEEP";
    case ESP_RST_BROWNOUT:   return "BROWNOUT";
    case ESP_RST_SDIO:       return "SDIO";
    case ESP_RST_USB:        return "USB";
    case ESP_RST_JTAG:       return "JTAG";
    case ESP_RST_EFUSE:      return "EFUSE";
    case ESP_RST_PWR_GLITCH: return "POWER_GLITCH";
    case ESP_RST_CPU_LOCKUP: return "CPU_LOCKUP";
    default:                 return "UNKNOWN";
  }
}

const char* loopStepName(uint8_t step) {
  switch (static_cast<LoopStep>(step)) {
    case LoopStep::Boot:         return "setup";
    case LoopStep::Sensors:      return "sensors";
    case LoopStep::Led:          return "led";
    case LoopStep::Scan:         return "wifi-scan";
    case LoopStep::Provisioning: return "provisioning";
    case LoopStep::Network:      return "network";
    case LoopStep::WsLoop:       return "websocket";
    case LoopStep::Send:         return "send";
    case LoopStep::Idle:         return "idle";
    default:                     return "unknown";
  }
}

const char* netStateName(uint8_t state) {
  switch (static_cast<NetState>(state)) {
    case NetState::NoCredentials:   return "NoCredentials";
    case NetState::WifiConnecting:  return "WifiConnecting";
    case NetState::WifiBackoff:     return "WifiBackoff";
    case NetState::CloudConnecting: return "CloudConnecting";
    case NetState::Online:          return "Online";
    default:                        return "unknown";
  }
}

inline void crumb(LoopStep step) {
  crumbs.step = static_cast<uint8_t>(step);
}

// Saves what the previous boot left behind, then starts this boot's record.
void startCrashCrumbs() {
  previousBootSeen = (crumbs.magic == CRUMB_MAGIC);
  if (previousBootSeen) previousBoot = crumbs;
  crumbs.magic     = CRUMB_MAGIC;
  crumbs.bootCount = previousBootSeen ? previousBoot.bootCount + 1 : 1;
  crumbs.uptimeS   = 0;
  crumbs.step      = static_cast<uint8_t>(LoopStep::Boot);
  crumbs.netState  = 0;
}

void startLoopWatchdog() {
  esp_task_wdt_config_t config = {};
  config.timeout_ms     = LOOP_WDT_TIMEOUT_MS;
  config.idle_core_mask = 1 << 0;  // keep the core's default idle check
  config.trigger_panic  = true;    // panic prints a backtrace, then restarts
  esp_task_wdt_reconfigure(&config);
  enableLoopWDT();  // the core resets it after every loop() iteration
}

void readChipMac() {
  uint8_t mac[6];
  if (esp_efuse_mac_get_default(mac) != ESP_OK) return;
  snprintf(chipMac, sizeof(chipMac), "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

// ============================================================
// SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[BOOT] HabilitateBand starting");
  readChipMac();
  startCrashCrumbs();
  startLoopWatchdog();

  // LED — initialise first so the user gets visual feedback immediately
  setupLED();

  // I2C — ESP32-S3 standard pins
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);

  mpuFound = initMPU6050();

  sttsFound = initSTTS22H();

  max30102Found = initMAX30102();

  pinMode(GSR_PIN, INPUT);

  // Our NVS namespace is the only credential store, and every reconnect
  // is driven by serviceNetwork(); both must be set before WiFi starts.
  WiFi.persistent(false);
  WiFi.setAutoReconnect(false);
  WiFi.onEvent(onWifiEvent);

  // WiFi radio in STA mode before BLE starts — required so that
  // WiFi.scanNetworks() works without coexistence conflicts.
  WiFi.mode(WIFI_STA);

  wsPath = String("/functions/v1/wearable-ws?band_id=") +
           urlEncode(BAND_ID) +
           "&token=" +
           urlEncode(DEVICE_TOKEN);
  wsClient.onEvent(onWsEvent);

  setupBLE();

  if (loadStoredCredentials(activeCreds)) {
    hasCredentials = true;
    Serial.printf("[WIFI] Stored credentials for \"%s\"; connecting\n", activeCreds.ssid);
    setWifiStatus("CONNECTING");
    startWifiAttempt(millis());
  } else {
    setWifiStatus("NO_CREDENTIALS");
  }

  Serial.printf("[BOOT] %s firmware %s mac %s\n", BAND_ID, FIRMWARE_VERSION, chipMac);
  Serial.printf("[BOOT] Reset reason: %s\n", resetReasonName());
  if (previousBootSeen) {
    Serial.printf("[BOOT] Previous boot: ran %lu s, last step %s, network %s (boot #%lu since power-on)\n",
                  (unsigned long)previousBoot.uptimeS, loopStepName(previousBoot.step),
                  netStateName(previousBoot.netState), (unsigned long)crumbs.bootCount);
  } else {
    Serial.println("[BOOT] Previous boot: no record (first boot after power-on)");
  }
  Serial.printf("[BOOT] Sensors MPU=%s STTS22H=%s MAX30102=%s\n",
                mpuFound ? "OK" : "MISSING",
                sttsFound ? "OK" : "MISSING",
                max30102Found ? "OK" : "MISSING");
  Serial.println("[BOOT] BLE ready; Wi-Fi/WSS pipeline running");
}

// ============================================================
// LOOP (fully non-blocking)
// ============================================================

void loop() {
  unsigned long now = millis();
  crumbs.uptimeS  = now / 1000;
  crumbs.netState = static_cast<uint8_t>(netState);

  // ── High-frequency sensor servicing ───────────────────────
  crumb(LoopStep::Sensors);
  updateMAX30102();   // drains FIFO, runs analysis when window is full
  updateTemperature(); // polls STTS22H at TEMP_POLL_MS interval

  // ── LED state machine ──────────────────────────────────────
  crumb(LoopStep::Led);
  updateLED();

  // ── BLE housekeeping ───────────────────────────────────────
  if (bleRestartAdvertising && now - bleDisconnectedAt >= 500) {
    bleRestartAdvertising = false;
    BLEDevice::startAdvertising();
  }

  // ── Scan, provisioning and connectivity ────────────────────
  // Order matters. A scan that just finished releases the radio first;
  // new credentials are then applied before the state machine runs, so
  // an old retry or timeout can never act on (or report against) them.
  crumb(LoopStep::Scan);
  serviceWifiScan(now);
  crumb(LoopStep::Provisioning);
  serviceProvisioning(now);

  if (wifiScanRequested) {
    wifiScanRequested = false;
    crumb(LoopStep::Scan);
    startWifiScan(now);
  }

  crumb(LoopStep::Network);
  serviceNetwork(now);

  // ── Telemetry ──────────────────────────────────────────────
  if (netState == NetState::Online && now - lastSensorSend >= SENSOR_INTERVAL_MS) {
    lastSensorSend = now;
    crumb(LoopStep::Send);
    sendSensorPacket();
  }

  // ── Watchdog-safe yield ────────────────────────────────────
  crumb(LoopStep::Idle);
  delay(1);
}
