import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const encoder = new TextEncoder();

type SensorData = {
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
  spo2?: number;
  gsr?: number;
};

type IncomingMessage =
  | {
      type: "device_hello";
      band_id: string;
    }
  | {
      type: "sensor_data";
      data: SensorData;
    }
  | {
      type: "ping";
    };

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function send(
  socket: WebSocket,
  payload: unknown,
) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function sha256Hex(value: string): Promise<string> {
  const data = encoder.encode(value);

  const digest = await crypto.subtle.digest(
    "SHA-256",
    data,
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isValidSensorData(
  data: SensorData,
): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (
    typeof data.band_id !== "string" ||
    data.band_id.length === 0 ||
    data.band_id.length > 64
  ) {
    return false;
  }

  if (!Number.isInteger(data.seq) || data.seq < 0) {
    return false;
  }

  if (!Number.isFinite(data.t)) {
    return false;
  }

  const numericFields = [
    data.ax,
    data.ay,
    data.az,
    data.gx,
    data.gy,
    data.gz,
    data.temp,
    data.hr,
    data.spo2,
    data.gsr,
  ];

  return numericFields.every(
    (value) =>
      value === undefined ||
      value === null ||
      isFiniteNumber(value),
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  /*
   * WebSocket clients such as ESP32 cannot reliably provide
   * arbitrary HTTP Authorization headers during the handshake.
   *
   * Therefore device authentication is performed using:
   *
   *   ?band_id=HAB-001&token=<device-secret>
   */

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
    return jsonResponse(
      {
        error: "MISSING_DEVICE_CREDENTIALS",
      },
      401,
    );
  }

  if (bandId.length > 64 || deviceToken.length > 512) {
    return jsonResponse(
      {
        error: "INVALID_DEVICE_CREDENTIALS",
      },
      401,
    );
  }

  /*
   * Never store or compare the plaintext device token.
   * Hash the received secret and compare it with the
   * token_hash stored in device_credentials.
   */

  const tokenHash = await sha256Hex(deviceToken);

  const {
    data: credential,
    error: credentialError,
  } = await supabase
    .from("device_credentials")
    .select(
      `
      id,
      device_id,
      revoked_at,
      sensor_devices!inner (
        id,
        device_uid,
        device_name,
        status
      )
      `,
    )
    .eq("token_hash", tokenHash)
    .eq("sensor_devices.device_uid", bandId)
    .maybeSingle();

  if (credentialError) {
    console.error(
      "Credential lookup failed:",
      credentialError,
    );

    return jsonResponse(
      {
        error: "AUTHENTICATION_LOOKUP_FAILED",
      },
      500,
    );
  }

  if (!credential) {
    return jsonResponse(
      {
        error: "INVALID_DEVICE_CREDENTIALS",
      },
      401,
    );
  }

  if (credential.revoked_at) {
    return jsonResponse(
      {
        error: "DEVICE_CREDENTIAL_REVOKED",
      },
      401,
    );
  }

  const device = Array.isArray(credential.sensor_devices)
    ? credential.sensor_devices[0]
    : credential.sensor_devices;

  if (!device) {
    return jsonResponse(
      {
        error: "DEVICE_NOT_FOUND",
      },
      404,
    );
  }

  if (device.status !== "active") {
    return jsonResponse(
      {
        error: "DEVICE_INACTIVE",
      },
      403,
    );
  }

  /*
   * Upgrade HTTP request to WebSocket.
   *
   * idleTimeout: 0 prevents the WebSocket itself from being
   * closed by an idle timeout. The ESP32 will later send
   * heartbeat messages as part of the firmware protocol.
   */

  const { socket, response } = Deno.upgradeWebSocket(
    req,
    {
      idleTimeout: 0,
    },
  );

  /*
   * Prevent Supabase Edge Runtime from considering the worker
   * idle while the WebSocket is still open.
   *
   * IMPORTANT:
   * waitUntil does NOT bypass the platform's hard runtime
   * limit. The ESP32 must reconnect automatically.
   */

  let resolveSocketClosed!: () => void;

  const socketClosed = new Promise<void>((resolve) => {
    resolveSocketClosed = resolve;
  });

  // EdgeRuntime is provided by the Supabase Edge Runtime.
  // @ts-ignore
  EdgeRuntime.waitUntil(socketClosed);

  let authenticated = true;
  let lastSequence = -1;

  /*
   * Update credential last-used timestamp.
   *
   * This is intentionally done asynchronously so it does
   * not delay the WebSocket handshake.
   */

  EdgeRuntime.waitUntil(
    supabase
      .from("device_credentials")
      .update({
        last_used_at: new Date().toISOString(),
      })
      .eq("id", credential.id),
  );

  socket.onopen = () => {
    console.log(
      `WebSocket connected: ${device.device_uid}`,
    );

    send(socket, {
      type: "authenticated",
      band_id: device.device_uid,
      device_id: device.id,
      server_time: Date.now(),
    });
  };

  socket.onmessage = async (event) => {
    try {
      if (!authenticated) {
        return;
      }

      if (typeof event.data !== "string") {
        send(socket, {
          type: "error",
          code: "INVALID_MESSAGE_FORMAT",
        });

        return;
      }

      let message: IncomingMessage;

      try {
        message = JSON.parse(event.data);
      } catch {
        send(socket, {
          type: "error",
          code: "INVALID_JSON",
        });

        return;
      }

      if (
        !message ||
        typeof message !== "object" ||
        typeof message.type !== "string"
      ) {
        send(socket, {
          type: "error",
          code: "INVALID_MESSAGE",
        });

        return;
      }

      /*
       * Device hello
       */

      if (message.type === "device_hello") {
        if (message.band_id !== device.device_uid) {
          send(socket, {
            type: "error",
            code: "BAND_ID_MISMATCH",
          });

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

      /*
       * Heartbeat
       */

      if (message.type === "ping") {
        send(socket, {
          type: "pong",
          server_time: Date.now(),
        });

        return;
      }

      /*
       * Sensor data
       */

      if (message.type === "sensor_data") {
        const data = message.data;

        if (!isValidSensorData(data)) {
          send(socket, {
            type: "error",
            code: "INVALID_SENSOR_DATA",
          });

          return;
        }

        /*
         * Never trust the band_id supplied inside the packet.
         * The authenticated device identity is authoritative.
         */

        if (data.band_id !== device.device_uid) {
          send(socket, {
            type: "error",
            code: "BAND_ID_MISMATCH",
          });

          return;
        }

        /*
         * Prevent duplicate/out-of-order packets.
         *
         * The first packet is accepted regardless of its
         * sequence number.
         */

        if (
          lastSequence >= 0 &&
          data.seq <= lastSequence
        ) {
          send(socket, {
            type: "ack",
            seq: data.seq,
            accepted: false,
            reason: "DUPLICATE_OR_OUT_OF_ORDER",
          });

          return;
        }

        /*
         * For this first backend stage, session_id remains
         * NULL. Session mapping will be added after we inspect
         * the actual session status enum and activation flow.
         */

        const { error: insertError } = await supabase
          .from("wearable_samples")
          .insert({
            device_id: device.id,
            session_id: null,
            band_id: device.device_uid,

            sequence_number: data.seq,
            device_timestamp: data.t,

            accelerometer_x: data.ax ?? null,
            accelerometer_y: data.ay ?? null,
            accelerometer_z: data.az ?? null,

            gyroscope_x: data.gx ?? null,
            gyroscope_y: data.gy ?? null,
            gyroscope_z: data.gz ?? null,

            skin_temperature: data.temp ?? null,
            heart_rate: data.hr ?? null,
            spo2: data.spo2 ?? null,
            gsr: data.gsr ?? null,

            captured_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(
            "wearable_samples insert failed:",
            insertError,
          );

          send(socket, {
            type: "error",
            code: "DATABASE_INSERT_FAILED",
            seq: data.seq,
          });

          return;
        }

        lastSequence = data.seq;

        send(socket, {
          type: "ack",
          seq: data.seq,
          accepted: true,
          server_time: Date.now(),
        });

        return;
      }

      send(socket, {
        type: "error",
        code: "UNKNOWN_MESSAGE_TYPE",
      });
    } catch (error) {
      console.error(
        "WebSocket message processing error:",
        error,
      );

      send(socket, {
        type: "error",
        code: "INTERNAL_MESSAGE_ERROR",
      });
    }
  };

  socket.onerror = (event) => {
    console.error(
      `WebSocket error for ${device.device_uid}:`,
      event,
    );
  };

  socket.onclose = () => {
    authenticated = false;

    console.log(
      `WebSocket disconnected: ${device.device_uid}`,
    );

    resolveSocketClosed();
  };

  return response;
});