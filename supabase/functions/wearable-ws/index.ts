import { createClient } from "@supabase/supabase-js";

import { ClockMap, SecondAggregator } from "./aggregate.ts";

// Rebuilt on 2026-09-22 from the version actually deployed at the time
// (downloaded with `supabase functions download`), not from the older
// repo copy, which queried sensor_devices.is_online, a column that does
// not exist in production.

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

// One beat-to-beat interval from the band: [seq, chain, t_ms, ibi_ms, clean].
type BeatTuple = [number, number, number, number, number | boolean];

type SensorPayload = {
  band_id: string;
  seq: number;
  t: number;
  boot?: number;        // random per band boot (firmware 0.6.0+)
  // null means the sensor is missing or gave no valid reading (0.6.2+);
  // it is stored as NULL, never replaced with a stand-in value.
  ax?: number | null;
  ay?: number | null;
  az?: number | null;
  gx?: number | null;
  gy?: number | null;
  gz?: number | null;
  temp?: number | null;
  hr?: number | null;
  hrv?: number | null;  // RMSSD computed on the band; stored as hrv_device
  spo2?: number | null;
  gsr?: number | null;
  beats?: BeatTuple[];  // firmware 0.6.0+; Postgres computes hrv from these
};

const MAX_BEATS_PER_PACKET = 64;

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

// Background work that must actually run. supabase-js queries are lazy
// thenables: handing one to waitUntil() without awaiting it never sends
// it, which is why device_credentials.last_used_at was never written.
function runInBackground(label: string, work: () => PromiseLike<{ error: { message: string } | null }>) {
  // @ts-ignore EdgeRuntime is provided by the Supabase runtime
  EdgeRuntime.waitUntil((async () => {
    const { error } = await work();
    if (error) console.warn(`[DB] ${label} failed:`, error.message);
  })());
}

function extractSensorPayload(
  message: Record<string, unknown>,
): SensorPayload | null {
  if (
    message.data !== undefined &&
    typeof message.data === "object" &&
    message.data !== null
  ) {
    return message.data as SensorPayload;
  }

  if (typeof message.band_id === "string") {
    return message as unknown as SensorPayload;
  }

  return null;
}

function validateBeats(beats: unknown): string | null {
  if (!Array.isArray(beats)) return "beats must be an array";
  if (beats.length > MAX_BEATS_PER_PACKET) return "too many beats";
  for (const b of beats) {
    if (!Array.isArray(b) || b.length !== 5) return "beat must be [seq, chain, t_ms, ibi_ms, clean]";
    const [seq, chain, tMs, ibi, clean] = b;
    if (!Number.isInteger(seq) || seq < 0) return "invalid beat seq";
    if (!Number.isInteger(chain) || chain < 0) return "invalid beat chain";
    if (!Number.isInteger(tMs) || tMs < 0) return "invalid beat t_ms";
    if (!isFiniteNum(ibi) || ibi <= 0 || ibi >= 5000) return "invalid beat ibi_ms";
    if (clean !== 0 && clean !== 1 && clean !== true && clean !== false) return "invalid beat clean flag";
  }
  return null;
}

function validatePayload(p: SensorPayload): string | null {
  if (typeof p.band_id !== "string" || p.band_id.length === 0 || p.band_id.length > 64) {
    return "invalid band_id";
  }
  if (!Number.isInteger(p.seq) || p.seq < 0) return "invalid seq";
  if (!Number.isFinite(p.t)) return "invalid t";
  if (p.boot !== undefined && (!Number.isInteger(p.boot) || p.boot <= 0)) return "invalid boot";
  if (p.beats !== undefined) {
    const beatsError = validateBeats(p.beats);
    if (beatsError) return beatsError;
  }

  for (const [key, val] of Object.entries(p)) {
    if (key === "band_id" || key === "beats") continue;
    if (val !== undefined && val !== null && !isFiniteNum(val)) {
      return `non-finite value for field '${key}'`;
    }
  }
  return null;
}

function sensorOrNull(v: number | undefined | null): number | null {
  if (v === undefined || v === null || v < 0) return null;
  return v;
}

// Beats go in before the telemetry row of the same packet, because the
// row's insert trigger computes hrv from them. Re-sent beats (same band,
// boot and seq) are ignored.
async function insertBeats(bandId: string, bootId: number, beats: BeatTuple[]): Promise<string | null> {
  if (beats.length === 0) return null;
  const { error } = await supabase.from("device_beats").upsert(
    beats.map(([seq, chain, tMs, ibi, clean]) => ({
      band_id: bandId,
      boot_id: bootId,
      beat_seq: seq,
      chain,
      t_ms: tMs,
      ibi_ms: ibi,
      clean: clean === true || clean === 1,
    })),
    { onConflict: "band_id,boot_id,beat_seq", ignoreDuplicates: true },
  );
  if (error) {
    console.error(`[DB] device_beats insert failed — band=${bandId}:`, error.message);
    return error.message;
  }
  return null;
}

type InsertResult = { error: string | null; hrv: number | null };

async function insertTelemetryOnce(
  bandId: string,
  seq: number,
  p: SensorPayload,
  sampleAt: number | null,
): Promise<InsertResult> {
  const hasBoot = p.boot !== undefined;
  const { data, error } = await supabase.from("device_telemetry").insert({
    band_id: bandId,
    seq: seq,
    t: p.t,
    sample_at: sampleAt === null ? null : new Date(sampleAt).toISOString(),
    // Missing sensors stay NULL. The old 0 defaults turned missing motion
    // into 1 g of movement and missing temperature into 0 degC.
    ax: p.ax ?? null,
    ay: p.ay ?? null,
    az: p.az ?? null,
    gx: p.gx ?? null,
    gy: p.gy ?? null,
    gz: p.gz ?? null,
    temp: p.temp ?? null,
    hr: sensorOrNull(p.hr),
    spo2: sensorOrNull(p.spo2),
    gsr: p.gsr ?? null,
    // With a boot id, the insert trigger computes hrv from device_beats and
    // the band's own figure is kept for comparison. Older firmware sends no
    // beats, so its figure is the only one and goes straight into hrv.
    boot_id: hasBoot ? p.boot : null,
    hrv_device: sensorOrNull(p.hrv),
    ...(hasBoot ? {} : { hrv: sensorOrNull(p.hrv) }),
  }).select("hrv").single();

  if (error) {
    console.error(
      `[DB] device_telemetry insert failed — band=${bandId} seq=${seq}:`,
      error.message,
      error.details ?? "",
      error.hint ?? "",
    );
    return { error: error.message, hrv: null };
  }
  return { error: null, hrv: (data?.hrv as number | null | undefined) ?? null };
}

async function insertTelemetry(
  bandId: string,
  seq: number,
  p: SensorPayload,
  sampleAt: number | null,
): Promise<InsertResult> {
  const first = await insertTelemetryOnce(bandId, seq, p, sampleAt);
  if (!first.error) return first;

  await new Promise((r) => setTimeout(r, 500));
  console.info(`[DB] Retrying device_telemetry — band=${bandId} seq=${seq}`);
  return insertTelemetryOnce(bandId, seq, p, sampleAt);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return jsonResponse({
      service: "Habilitate Wearable WebSocket",
      status: "ok",
      endpoint: "websocket",
    });
  }

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
       sensor_devices!inner (id, device_uid, device_name, status, metadata)`,
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

  const { socket, response } = Deno.upgradeWebSocket(req, { idleTimeout: 0 });

  let resolveSocketClosed!: () => void;
  const socketClosed = new Promise<void>((r) => { resolveSocketClosed = r; });

  // @ts-ignore EdgeRuntime is provided by the Supabase runtime
  EdgeRuntime.waitUntil(socketClosed);

  let lastSequence = -1;

  // Band clock -> real time, and one band_seconds row per second of
  // device time for the child-state engine (firmware 0.6.0+, which sends
  // a boot id). hrv is the database value returned by the latest insert.
  const clock = new ClockMap();
  let latestHrv: number | null = null;
  let aggregatorBoot: number | null = null;
  const aggregator = new SecondAggregator(clock, () => latestHrv, (row) => {
    const bootId = aggregatorBoot;
    if (bootId === null) return;
    runInBackground("band_seconds insert", () =>
      supabase.from("band_seconds").upsert(
        { band_id: device.device_uid, boot_id: bootId, ...row },
        { onConflict: "band_id,boot_id,device_second", ignoreDuplicates: true },
      )
    );
  });

  runInBackground("device_credentials.last_used_at", () =>
    supabase
      .from("device_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", credential.id)
  );

  socket.onopen = () => {
    console.info(`[WS] Connection opened — band=${device.device_uid}`);

    send(socket, {
      type: "authenticated",
      band_id: device.device_uid,
      device_id: device.id,
      server_time: Date.now(),
    });
  };

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

    if (message.type === "device_hello") {
      if (message.band_id !== device.device_uid) {
        send(socket, { type: "error", code: "BAND_ID_MISMATCH" });
        socket.close(1008, "Band ID mismatch");
        return;
      }

      // Firmware 0.4.2+ reports its version, chip MAC and boot diagnostics.
      // BAND_ID is set by hand, so a MAC that differs from the one first
      // seen for this band means two bands share one identity.
      const metadata = (device.metadata ?? {}) as Record<string, unknown>;
      const mac = typeof message.mac === "string" ? message.mac : null;
      const knownMac = typeof metadata.chip_mac === "string" ? metadata.chip_mac : null;
      if (mac && knownMac && mac !== knownMac) {
        console.error(
          `[AUTH] ${device.device_uid} connected from chip MAC ${mac}, but it is registered ` +
          `to ${knownMac}: two bands may share this BAND_ID`,
        );
      }
      const lastHello = {
        at: new Date().toISOString(),
        fw: message.fw ?? null,
        mac,
        reset: message.reset ?? null,
        boot: message.boot ?? null,
        boot_count: message.boot_count ?? null,
        uptime_ms: message.uptime_ms ?? null,
        prev_uptime_s: message.prev_uptime_s ?? null,
        prev_step: message.prev_step ?? null,
      };
      const nextMetadata = {
        ...metadata,
        ...(knownMac === null && mac ? { chip_mac: mac } : {}),
        ...(mac && knownMac && mac !== knownMac
          ? { mac_mismatch: { seen: mac, at: lastHello.at } }
          : {}),
        last_hello: lastHello,
      };
      device.metadata = nextMetadata;
      runInBackground("sensor_devices hello", () =>
        supabase
          .from("sensor_devices")
          .update({
            ...(typeof message.fw === "string" ? { firmware_version: message.fw } : {}),
            metadata: nextMetadata,
          })
          .eq("id", device.id)
      );

      send(socket, {
        type: "device_ready",
        band_id: device.device_uid,
        device_id: device.id,
        server_time: Date.now(),
      });
      return;
    }

    if (message.type === "ping") {
      send(socket, { type: "pong", server_time: Date.now() });
      return;
    }

    if (message.type === "sensor_data") {
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

      const safeBandId = device.device_uid;
      const seq = payload.seq;

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

      // Aggregate before any await, so packets are binned in arrival order.
      clock.observe(payload.t, Date.now());
      const sampleAt = clock.toWall(payload.t);
      if (payload.boot !== undefined) {
        if (aggregatorBoot !== null && aggregatorBoot !== payload.boot) aggregator.flush();
        aggregatorBoot = payload.boot;
        aggregator.add(payload);
      }

      // A failed beats insert must not cost the telemetry row: hrv is then
      // NULL (or computed from fewer beats) for a moment, nothing more.
      if (payload.boot !== undefined && payload.beats && payload.beats.length > 0) {
        await insertBeats(safeBandId, payload.boot, payload.beats);
      }

      const inserted = await insertTelemetry(safeBandId, seq, payload, sampleAt);
      const insertError = inserted.error;
      if (!insertError && payload.boot !== undefined) latestHrv = inserted.hrv;

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

      send(socket, { type: "ack", seq, accepted: true, server_time: Date.now() });
      return;
    }

    send(socket, { type: "error", code: "UNKNOWN_MESSAGE_TYPE" });
  };

  socket.onerror = (event) => {
    console.error(`[WS] Error — band=${device.device_uid}:`, (event as ErrorEvent).message ?? event);
  };

  socket.onclose = (event) => {
    console.info(
      `[WS] Connection closed — band=${device.device_uid}` +
      ` code=${event.code} reason=${event.reason || "(none)"}`,
    );
    aggregator.flush();  // the last, partial second
    resolveSocketClosed();
  };

  return response;
});
