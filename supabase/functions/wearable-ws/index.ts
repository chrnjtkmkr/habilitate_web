import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const encoder = new TextEncoder();

// ============================================================
// Types
// ============================================================

type SensorPayload = {
  band_id: string;
  seq: number;
  t: number;
  ax?: number;
  ay?: number;
  az?: number;
  gx?: number;
  gy?: number;
  gz?: number;
  temp?: number;
  hr?: number;
  hrv?: number;
  spo2?: number;
  gsr?: number;
};

// ============================================================
// Helpers
// ============================================================

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Accepts the sensor payload regardless of whether the firmware
 * sent it flat  { type, band_id, seq, ... }
 * or nested     { type, data: { band_id, seq, ... } }
 *
 * Both shapes are valid; the nested shape is current firmware.
 */
function extractSensorPayload(
  message: Record<string, unknown>,
): SensorPayload | null {
  // Nested shape (current firmware + test-wss.mjs)
  if (
    message.data !== undefined &&
    typeof message.data === "object" &&
    message.data !== null
  ) {
    return message.data as SensorPayload;
  }

  // Flat shape (legacy firmware — band_id present at top level)
  if (typeof message.band_id === "string") {
    return message as unknown as SensorPayload;
  }

  return null;
}

function validatePayload(p: SensorPayload): string | null {
  if (typeof p.band_id !== "string" || p.band_id.length === 0 || p.band_id.length > 64) {
    return "invalid band_id";
  }
  if (!Number.isInteger(p.seq) || p.seq < 0) return "invalid seq";
  if (!Number.isFinite(p.t)) return "invalid t";

  for (const [key, val] of Object.entries(p)) {
    if (key === "band_id") continue;
    if (val !== undefined && val !== null && !isFiniteNum(val)) {
      return `non-finite value for field '${key}'`;
    }
  }
  return null;
}

// ============================================================
// Device online / offline — fire-and-forget
// ============================================================

async function markDeviceOnline(deviceId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sensor_devices")
    .update({ is_online: true, online_since: now, last_online_at: now })
    .eq("id", deviceId);
  if (error) console.error("[DB] markDeviceOnline failed:", error.message, error.details ?? "");
}

async function markDeviceOffline(deviceId: string): Promise<void> {
  const { error } = await supabase
    .from("sensor_devices")
    .update({
      is_online: false,
      last_online_at: new Date().toISOString(),
      online_since: null,
    })
    .eq("id", deviceId);
  if (error) console.error("[DB] markDeviceOffline failed:", error.message, error.details ?? "");
}

// Heartbeat: update last_online_at so the staleness guard knows
// this device is still alive.
async function heartbeatOnline(deviceId: string): Promise<void> {
  const { error } = await supabase
    .from("sensor_devices")
    .update({ last_online_at: new Date().toISOString() })
    .eq("id", deviceId);
  if (error) console.warn("[DB] heartbeat update failed:", error.message);
}

// Expire devices that appear online but haven't sent a heartbeat
// in over 2 minutes.  Called once per new connection so stale
// flags are cleared promptly.
async function expireStaleDevices(): Promise<void> {
  const { error } = await supabase.rpc("expire_stale_online_devices");
  if (error) console.warn("[DB] expire_stale_online_devices failed:", error.message);
}

// Convert sensor value: store -1 "no reading" as null.
function sensorOrNull(v: number | undefined | null): number | null {
  if (v === undefined || v === null || v < 0) return null;
  return v;
}

// ============================================================
// Write raw telemetry to device_telemetry
// ============================================================
// device_telemetry stores raw sensor readings.  Columns hr and
// spo2 are now nullable (migration 0065) so -1 "no finger"
// values are stored as NULL rather than 0.
// ============================================================

async function insertTelemetryOnce(
  bandId: string,
  seq: number,
  p: SensorPayload,
): Promise<string | null> {
  const { error } = await supabase.from("device_telemetry").insert({
    band_id: bandId,
    seq: seq,
    t: p.t,
    ax: p.ax ?? 0,
    ay: p.ay ?? 0,
    az: p.az ?? 0,
    gx: p.gx ?? 0,
    gy: p.gy ?? 0,
    gz: p.gz ?? 0,
    temp: p.temp ?? 0,
    hr: sensorOrNull(p.hr),
    hrv: sensorOrNull(p.hrv),
    spo2: sensorOrNull(p.spo2),
    gsr: p.gsr ?? 0,
  });

  if (error) {
    console.error(
      `[DB] device_telemetry insert failed — band=${bandId} seq=${seq}:`,
      error.message,
      error.details ?? "",
      error.hint ?? "",
    );
    return error.message;
  }

  console.info(`[DB] device_telemetry OK — band=${bandId} seq=${seq}`);
  return null;
}

// Retry wrapper: 1 retry with 500ms delay for transient failures
async function insertTelemetry(
  bandId: string,
  seq: number,
  p: SensorPayload,
): Promise<string | null> {
  const firstError = await insertTelemetryOnce(bandId, seq, p);
  if (!firstError) return null;

  // Wait 500ms and retry once
  await new Promise((r) => setTimeout(r, 500));
  console.info(`[DB] Retrying device_telemetry — band=${bandId} seq=${seq}`);
  return insertTelemetryOnce(bandId, seq, p);
}

// ============================================================
// Write to wearable_samples (derived / ML table)
// ============================================================

async function insertWearableSample(
  deviceId: string,
  bandId: string,
  seq: number,
  p: SensorPayload,
): Promise<void> {
  const { error } = await supabase.from("wearable_samples").insert({
    device_id: deviceId,
    session_id: null,
    band_id: bandId,
    sequence_number: seq,
    device_timestamp: p.t,
    accelerometer_x: p.ax ?? null,
    accelerometer_y: p.ay ?? null,
    accelerometer_z: p.az ?? null,
    gyroscope_x: p.gx ?? null,
    gyroscope_y: p.gy ?? null,
    gyroscope_z: p.gz ?? null,
    skin_temperature: p.temp ?? null,
    heart_rate: sensorOrNull(p.hr),
    hrv: sensorOrNull(p.hrv),
    spo2: sensorOrNull(p.spo2),
    gsr: p.gsr ?? null,
    captured_at: new Date().toISOString(),
  });

  if (error) {
    console.warn(
      `[DB] wearable_samples insert failed — band=${bandId} seq=${seq}:`,
      error.message,
    );
  }
}

async function broadcastTelemetry(
  bandId: string,
  payload: SensorPayload,
): Promise<void> {
  const channel = supabase.channel(`telemetry:${bandId}`);
  const result = await channel.send({
    type: "broadcast",
    event: "telemetry",
    payload: {
      band_id: bandId,
      seq: payload.seq,
      t: payload.t,
      ax: payload.ax ?? null,
      ay: payload.ay ?? null,
      az: payload.az ?? null,
      gx: payload.gx ?? null,
      gy: payload.gy ?? null,
      gz: payload.gz ?? null,
      temp: payload.temp ?? null,
      hr: sensorOrNull(payload.hr),
      hrv: sensorOrNull(payload.hrv),
      spo2: sensorOrNull(payload.spo2),
      gsr: payload.gsr ?? null,
      received_at: new Date().toISOString(),
    },
  });

  if (result !== "ok") {
    console.warn(`[RT] Broadcast failed for ${bandId}: ${result}`);
  }

  await supabase.removeChannel(channel);
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return jsonResponse({
      service: "Habilitate Wearable WebSocket",
      status: "ok",
      endpoint: "websocket",
    });
  }

  // ----------------------------------------------------------
  // Authentication via query parameters
  // ESP32 cannot set arbitrary HTTP headers during the WS
  // handshake, so credentials come as ?band_id=&token=
  // ----------------------------------------------------------

  const bandId = url.searchParams.get("band_id");
  const deviceToken = url.searchParams.get("token");

  if (!bandId || !deviceToken) {
    console.warn("[AUTH] Missing band_id or token in query params");
    return jsonResponse({ error: "MISSING_DEVICE_CREDENTIALS" }, 401);
  }

  if (bandId.length > 64 || deviceToken.length > 512) {
    return jsonResponse({ error: "INVALID_DEVICE_CREDENTIALS" }, 401);
  }

  const tokenHash = await sha256Hex(deviceToken);

  const { data: credential, error: credentialError } = await supabase
    .from("device_credentials")
    .select(
      `id, device_id, revoked_at,
       sensor_devices!inner (id, device_uid, device_name, status, is_online)`,
    )
    .eq("token_hash", tokenHash)
    .eq("sensor_devices.device_uid", bandId)
    .maybeSingle();

  if (credentialError) {
    console.error("[AUTH] Credential lookup failed:", credentialError.message);
    return jsonResponse({ error: "AUTHENTICATION_LOOKUP_FAILED" }, 500);
  }

  if (!credential) {
    console.warn(`[AUTH] No credential found for band_id=${bandId}`);
    return jsonResponse({ error: "INVALID_DEVICE_CREDENTIALS" }, 401);
  }

  if (credential.revoked_at) {
    console.warn(`[AUTH] Credential revoked for band_id=${bandId}`);
    return jsonResponse({ error: "DEVICE_CREDENTIAL_REVOKED" }, 401);
  }

  const device = Array.isArray(credential.sensor_devices)
    ? credential.sensor_devices[0]
    : credential.sensor_devices;

  if (!device) {
    return jsonResponse({ error: "DEVICE_NOT_FOUND" }, 404);
  }

  if (device.status !== "active") {
    console.warn(`[AUTH] Device inactive: band_id=${bandId} status=${device.status}`);
    return jsonResponse({ error: "DEVICE_INACTIVE" }, 403);
  }

  // ----------------------------------------------------------
  // Upgrade to WebSocket
  // ----------------------------------------------------------

  const { socket, response } = Deno.upgradeWebSocket(req, { idleTimeout: 0 });

  let resolveSocketClosed!: () => void;
  const socketClosed = new Promise<void>((r) => { resolveSocketClosed = r; });

  // @ts-ignore
  EdgeRuntime.waitUntil(socketClosed);

  let lastSequence = -1;

  // Update credential last-used timestamp (non-blocking)
  // @ts-ignore
  EdgeRuntime.waitUntil(
    supabase
      .from("device_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", credential.id),
  );

  // ----------------------------------------------------------
  // Socket open
  // ----------------------------------------------------------

  // Heartbeat interval handle — cleared on close
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  socket.onopen = () => {
    console.info(`[WS] Connection opened — band=${device.device_uid}`);

    // Expire any stale "online" flags from crashed sessions
    // @ts-ignore
    EdgeRuntime.waitUntil(expireStaleDevices());

    // @ts-ignore
    EdgeRuntime.waitUntil(markDeviceOnline(device.id));

    // Update last_online_at every 30 seconds so the staleness
    // guard knows this device is still alive.
    heartbeatTimer = setInterval(() => {
      heartbeatOnline(device.id).catch(() => {});
    }, 30_000);

    send(socket, {
      type: "authenticated",
      band_id: device.device_uid,
      device_id: device.id,
      server_time: Date.now(),
    });
  };

  // ----------------------------------------------------------
  // Message handler
  // ----------------------------------------------------------

  socket.onmessage = async (event) => {
    if (typeof event.data !== "string") {
      send(socket, { type: "error", code: "INVALID_MESSAGE_FORMAT" });
      return;
    }

    let message: Record<string, unknown>;
    try {
      message = JSON.parse(event.data);
    } catch {
      send(socket, { type: "error", code: "INVALID_JSON" });
      return;
    }

    if (!message || typeof message.type !== "string") {
      send(socket, { type: "error", code: "INVALID_MESSAGE" });
      return;
    }

    // ---- device_hello (backward-compatible) ------------------
    if (message.type === "device_hello") {
      if (message.band_id !== device.device_uid) {
        send(socket, { type: "error", code: "BAND_ID_MISMATCH" });
        socket.close(1008, "Band ID mismatch");
        return;
      }
      send(socket, {
        type: "device_ready",
        band_id: device.device_uid,
        device_id: device.id,
        server_time: Date.now(),
      });
      return;
    }

    // ---- ping ------------------------------------------------
    if (message.type === "ping") {
      send(socket, { type: "pong", server_time: Date.now() });
      return;
    }

    // ---- sensor_data -----------------------------------------
    if (message.type === "sensor_data") {
      // Accept both flat and nested (data:{}) shapes
      const payload = extractSensorPayload(message);

      if (!payload) {
        console.warn(
          `[MSG] sensor_data has no recognisable payload — band=${device.device_uid}`,
          JSON.stringify(message).slice(0, 200),
        );
        send(socket, { type: "error", code: "INVALID_SENSOR_DATA" });
        return;
      }

      const validationError = validatePayload(payload);
      if (validationError) {
        console.warn(
          `[MSG] Validation failed — band=${device.device_uid}: ${validationError}`,
        );
        send(socket, {
          type: "error",
          code: "INVALID_SENSOR_DATA",
          reason: validationError,
        });
        return;
      }

      // Always use the authenticated device's band_id — never trust the payload
      const safeBandId = device.device_uid;
      const seq = payload.seq;

      // Duplicate / out-of-order guard
      if (lastSequence >= 0 && seq <= lastSequence) {
        console.warn(
          `[MSG] Duplicate/OOO — band=${safeBandId} seq=${seq} last=${lastSequence}`,
        );
        send(socket, {
          type: "ack",
          seq,
          accepted: false,
          reason: "DUPLICATE_OR_OUT_OF_ORDER",
        });
        return;
      }

      // ---- Write to device_telemetry (primary / raw table) ----
      const insertError = await insertTelemetry(safeBandId, seq, payload);

      // ---- Write to wearable_samples (secondary; best-effort) -
      // Always attempt even if device_telemetry failed — one table
      // failing must never block the other.
      // @ts-ignore
      EdgeRuntime.waitUntil(
        insertWearableSample(device.id, safeBandId, seq, payload),
      );

      if (insertError) {
        send(socket, {
          type: "error",
          code: "DATABASE_INSERT_FAILED",
          seq,
          detail: insertError,
        });
        return;
      }

      lastSequence = seq;

      // Realtime fan-out is live transport for the dashboard; the
      // database insert above remains the durable source of record.
      // Fire it before the ACK so the device can keep streaming.
      EdgeRuntime.waitUntil(broadcastTelemetry(safeBandId, payload));

      send(socket, { type: "ack", seq, accepted: true, server_time: Date.now() });
      return;
    }

    send(socket, { type: "error", code: "UNKNOWN_MESSAGE_TYPE" });
  };

  // ----------------------------------------------------------
  // Socket error
  // ----------------------------------------------------------

  socket.onerror = (event) => {
    console.error(
      `[WS] Error — band=${device.device_uid}:`,
      (event as ErrorEvent).message ?? event,
    );
    // Ensure device is marked offline on error too
    // @ts-ignore
    EdgeRuntime.waitUntil(markDeviceOffline(device.id));
  };

  // ----------------------------------------------------------
  // Socket close
  // ----------------------------------------------------------

  socket.onclose = (event) => {
    console.info(
      `[WS] Connection closed — band=${device.device_uid}` +
      ` code=${event.code} reason=${event.reason || "(none)"}`,
    );

    // Stop heartbeat
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    // @ts-ignore
    EdgeRuntime.waitUntil(markDeviceOffline(device.id));

    resolveSocketClosed();
  };

  return response;
});
