import 'dotenv/config';

import { createServer } from 'node:http';

import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// CONFIGURATION
// ============================================================

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

// ============================================================
// SUPABASE CLIENT
// ============================================================
// Uses the service-role key so inserts bypass RLS.
// The service-role key must NEVER be exposed to the browser.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[CONFIG] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    '         Copy .env.example to .env and fill in the values.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================
// TYPES
// ============================================================

interface SensorPacket {
  band_id: string;
  seq: number;
  t: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  temp: number;
  hr: number;
  hrv?: number;
  spo2: number;
  gsr: number;
}

interface GatewayMessage {
  type: string;
  [key: string]: unknown;
}

// ============================================================
// DEVICE REGISTRY
// ============================================================

const connectedBands = new Map<string, WebSocket>();

// ============================================================
// VALIDATION HELPERS
// ============================================================

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSensorPacket(value: unknown): value is SensorPacket {
  if (typeof value !== 'object' || value === null) return false;

  const p = value as Record<string, unknown>;

  return (
    typeof p.band_id === 'string' &&
    p.band_id.length > 0 &&
    isFiniteNumber(p.seq) &&
    isFiniteNumber(p.t) &&
    isFiniteNumber(p.ax) &&
    isFiniteNumber(p.ay) &&
    isFiniteNumber(p.az) &&
    isFiniteNumber(p.gx) &&
    isFiniteNumber(p.gy) &&
    isFiniteNumber(p.gz) &&
    isFiniteNumber(p.temp) &&
    isFiniteNumber(p.hr) &&
    isFiniteNumber(p.spo2) &&
    isFiniteNumber(p.gsr)
  );
}

function validateSensorRanges(packet: SensorPacket): string | null {
  if (packet.hr !== -1 && (packet.hr < 0 || packet.hr > 250)) {
    return 'Invalid heart rate.';
  }
  if (packet.spo2 !== -1 && (packet.spo2 < 0 || packet.spo2 > 100)) {
    return 'Invalid SpO2 value.';
  }
  if (packet.temp < -20 || packet.temp > 60) {
    return 'Invalid temperature.';
  }
  if (packet.gsr < 0 || packet.gsr > 1_000_000) {
    return 'Invalid GSR value.';
  }
  return null;
}

// ============================================================
// EXTRACT PACKET — accepts flat or nested { data: {...} }
// ============================================================
// The edge function and the firmware both use the nested shape:
//   { type: "sensor_data", data: { band_id, seq, ... } }
//
// Some older test scripts send a flat shape where all fields
// are at the top level of the message.  We handle both.
// ============================================================

function extractPacket(
  message: Record<string, unknown>,
): unknown {
  if (
    message.data !== undefined &&
    typeof message.data === 'object' &&
    message.data !== null
  ) {
    return message.data;
  }
  // Flat shape: band_id at top level
  if (typeof message.band_id === 'string') {
    return message;
  }
  return null;
}

// ============================================================
// SAFE JSON PARSING
// ============================================================

function parseMessage(raw: Buffer): unknown | null {
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return null;
  }
}

// ============================================================
// SEND JSON
// ============================================================

function sendJson(socket: WebSocket, message: GatewayMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}

// ============================================================
// WRITE TO SUPABASE device_telemetry
// ============================================================

async function insertTelemetry(
  bandId: string,
  seq: number,
  packet: SensorPacket,
): Promise<void> {
  const hrVal = packet.hr === -1 ? null : packet.hr;
  const spo2Val = packet.spo2 === -1 ? null : packet.spo2;
  const hrvVal = packet.hrv === undefined || packet.hrv === -1 ? null : packet.hrv;

  const { error } = await supabase.from('device_telemetry').insert({
    band_id: bandId,
    seq: seq,
    t: packet.t,
    ax: packet.ax,
    ay: packet.ay,
    az: packet.az,
    gx: packet.gx,
    gy: packet.gy,
    gz: packet.gz,
    temp: packet.temp,
    hr: hrVal,
    // hrv is nullable (added in migration 0064); only include when present
    hrv: hrvVal,
    spo2: spo2Val,
    gsr: packet.gsr,
  });

  if (error) {
    console.error(
      `[DB] device_telemetry insert failed — band=${bandId} seq=${seq}:`,
      error.message,
      error.details ?? '',
    );
  } else {
    console.log(
      `[DB] device_telemetry OK — band=${bandId} seq=${seq}`,
    );
  }
}

// ============================================================
// HTTP SERVER
// ============================================================

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      service: 'habilitate-iot-gateway',
      status: 'running',
      websocket: `ws://localhost:${PORT}/ws`,
    }),
  );
});

// ============================================================
// WEBSOCKET SERVER
// ============================================================

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (socket, request) => {
  const remoteAddress = request.socket.remoteAddress ?? 'unknown';
  console.log(`[WS] Connection from ${remoteAddress}`);

  let authenticatedBandId: string | null = null;

  sendJson(socket, { type: 'gateway_connected', timestamp: Date.now() });

  // ---- Message handler --------------------------------------

  socket.on('message', (raw) => {
    const rawBuffer = Array.isArray(raw)
      ? Buffer.concat(raw)
      : raw instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(raw))
        : raw;

    const parsed = parseMessage(rawBuffer);

    if (parsed === null) {
      console.warn('[WS] Invalid JSON received.');
      sendJson(socket, { type: 'error', code: 'INVALID_JSON' });
      return;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      sendJson(socket, { type: 'error', code: 'INVALID_MESSAGE' });
      return;
    }

    const message = parsed as Record<string, unknown>;

    // -- Authentication ---------------------------------------

    if (message.type === 'device_hello') {
      const bandId = message.band_id;

      if (typeof bandId !== 'string' || !bandId.trim()) {
        sendJson(socket, { type: 'auth_error', code: 'INVALID_BAND_ID' });
        return;
      }

      authenticatedBandId = bandId.trim();
      connectedBands.set(authenticatedBandId, socket);

      console.log(`[DEVICE] ${authenticatedBandId} authenticated`);

      sendJson(socket, {
        type: 'device_authenticated',
        band_id: authenticatedBandId,
      });
      return;
    }

    // -- Sensor data ------------------------------------------

    if (message.type === 'sensor_data') {
      if (!authenticatedBandId) {
        sendJson(socket, { type: 'error', code: 'DEVICE_NOT_AUTHENTICATED' });
        return;
      }

      const rawPacket = extractPacket(message);

      if (!isSensorPacket(rawPacket)) {
        console.warn(
          `[DEVICE] ${authenticatedBandId}: invalid sensor packet structure`,
          JSON.stringify(rawPacket).slice(0, 200),
        );
        sendJson(socket, { type: 'error', code: 'INVALID_SENSOR_PACKET' });
        return;
      }

      // Always use the authenticated band id — never trust the payload
      if (rawPacket.band_id !== authenticatedBandId) {
        sendJson(socket, { type: 'error', code: 'BAND_ID_MISMATCH' });
        return;
      }

      const rangeError = validateSensorRanges(rawPacket);
      if (rangeError) {
        console.warn(`[DEVICE] ${authenticatedBandId}: ${rangeError}`);
        sendJson(socket, {
          type: 'error',
          code: 'INVALID_SENSOR_RANGE',
          message: rangeError,
        });
        return;
      }

      console.log(`[SENSOR] ${authenticatedBandId}`, {
        seq: rawPacket.seq,
        hr: rawPacket.hr,
        spo2: rawPacket.spo2,
        temp: rawPacket.temp,
        gsr: rawPacket.gsr,
      });

      // Write to Supabase — fire-and-forget so the gateway
      // never blocks on a slow DB response.
      insertTelemetry(authenticatedBandId, rawPacket.seq, rawPacket).catch(
        (err: unknown) => {
          console.error('[DB] Unhandled insertTelemetry error:', err);
        },
      );

      sendJson(socket, {
        type: 'ack',
        seq: rawPacket.seq,
        accepted: true,
        server_time: Date.now(),
      });
      return;
    }

    // -- Ping -------------------------------------------------

    if (message.type === 'ping') {
      sendJson(socket, { type: 'pong', timestamp: Date.now() });
      return;
    }

    sendJson(socket, { type: 'error', code: 'UNKNOWN_MESSAGE_TYPE' });
  });

  // ---- Close ------------------------------------------------

  socket.on('close', () => {
    if (authenticatedBandId) {
      const current = connectedBands.get(authenticatedBandId);
      if (current === socket) {
        connectedBands.delete(authenticatedBandId);
      }
      console.log(`[DEVICE] ${authenticatedBandId} disconnected`);
    } else {
      console.log('[WS] Unauthenticated connection closed');
    }
  });

  // ---- Error ------------------------------------------------

  socket.on('error', (error) => {
    console.error('[WS] Socket error:', error);
  });
});

// ============================================================
// START SERVER
// ============================================================

httpServer.listen(PORT, HOST, () => {
  console.log('');
  console.log('==========================================');
  console.log(' HABILITATE IoT GATEWAY');
  console.log('==========================================');
  console.log(`HTTP  : http://localhost:${PORT}`);
  console.log(`WS    : ws://localhost:${PORT}/ws`);
  console.log(`HOST  : ${HOST}`);
  console.log(`PORT  : ${PORT}`);
  console.log(`DB    : ${SUPABASE_URL}`);
  console.log('==========================================');
  console.log('Waiting for ESP32 devices...');
  console.log('');
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(signal: string): void {
  console.log(`\n[SERVER] ${signal} received. Shutting down...`);

  for (const socket of connectedBands.values()) {
    try { socket.close(); } catch { /* ignore */ }
  }

  wss.close(() => {
    httpServer.close(() => { process.exit(0); });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
