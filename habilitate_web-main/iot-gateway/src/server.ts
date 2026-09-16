import 'dotenv/config';

import { createServer } from 'node:http';

import { WebSocketServer, WebSocket } from 'ws';

// ============================================================
// CONFIGURATION
// ============================================================

const PORT = Number(
  process.env.PORT ?? 8080,
);

const HOST =
  process.env.HOST ?? '0.0.0.0';

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

const connectedBands =
  new Map<string, WebSocket>();

// ============================================================
// BASIC VALIDATION
// ============================================================

function isNumber(
  value: unknown,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  );
}

function isSensorPacket(
  value: unknown,
): value is SensorPacket {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const packet =
    value as Record<string, unknown>;

  return (
    typeof packet.band_id ===
      'string' &&
    packet.band_id.length > 0 &&

    isNumber(packet.seq) &&
    isNumber(packet.t) &&

    isNumber(packet.ax) &&
    isNumber(packet.ay) &&
    isNumber(packet.az) &&

    isNumber(packet.gx) &&
    isNumber(packet.gy) &&
    isNumber(packet.gz) &&

    isNumber(packet.temp) &&
    isNumber(packet.hr) &&
    isNumber(packet.spo2) &&
    isNumber(packet.gsr)
  );
}

// ============================================================
// RANGE VALIDATION
// ============================================================

function validateSensorRanges(
  packet: SensorPacket,
): string | null {
  if (
    packet.hr !== -1 &&
    (packet.hr < 0 ||
      packet.hr > 250)
  ) {
    return 'Invalid heart rate.';
  }

  if (
    packet.spo2 !== -1 &&
    (packet.spo2 < 0 ||
      packet.spo2 > 100)
  ) {
    return 'Invalid SpO2 value.';
  }

  if (
    packet.temp < -20 ||
    packet.temp > 60
  ) {
    return 'Invalid temperature.';
  }

  if (
    packet.gsr < 0 ||
    packet.gsr > 1000000
  ) {
    return 'Invalid GSR value.';
  }

  return null;
}

// ============================================================
// SAFE JSON PARSING
// ============================================================

function parseMessage(
  raw: Buffer,
): unknown | null {
  try {
    return JSON.parse(
      raw.toString('utf8'),
    );
  } catch {
    return null;
  }
}

// ============================================================
// SEND JSON
// ============================================================

function sendJson(
  socket: WebSocket,
  message: GatewayMessage,
) {
  if (
    socket.readyState !==
    WebSocket.OPEN
  ) {
    return;
  }

  socket.send(
    JSON.stringify(message),
  );
}

// ============================================================
// HTTP SERVER
// ============================================================

const httpServer =
  createServer(
    (_request, response) => {
      response.writeHead(200, {
        'Content-Type':
          'application/json',
      });

      response.end(
        JSON.stringify({
          service:
            'habilitate-iot-gateway',
          status: 'running',
          websocket:
            `ws://localhost:${PORT}/ws`,
        }),
      );
    },
  );

// ============================================================
// WEBSOCKET SERVER
// ============================================================

const wss =
  new WebSocketServer({
    server: httpServer,
    path: '/ws',
  });

// ============================================================
// WEBSOCKET CONNECTION
// ============================================================

wss.on(
  'connection',
  (socket, request) => {
    const remoteAddress =
      request.socket.remoteAddress ??
      'unknown';

    console.log(
      `[WS] Connection from ${remoteAddress}`,
    );

    let authenticatedBandId:
      | string
      | null = null;

    // --------------------------------------------------------
    // CONNECTION MESSAGE
    // --------------------------------------------------------

    sendJson(socket, {
      type: 'gateway_connected',
      timestamp: Date.now(),
    });

    // --------------------------------------------------------
    // MESSAGE HANDLER
    // --------------------------------------------------------

    socket.on(
      'message',
      (raw) => {
      const rawBuffer = Array.isArray(raw)
     ? Buffer.concat(raw)
     : raw instanceof ArrayBuffer
     ? Buffer.from(new Uint8Array(raw))
    : raw;

    const parsed =
     parseMessage(rawBuffer);

        if (
          parsed === null
        ) {
          console.warn(
            '[WS] Invalid JSON received.',
          );

          sendJson(socket, {
            type: 'error',
            code: 'INVALID_JSON',
          });

          return;
        }

        // ----------------------------------------------------
        // GENERIC MESSAGE
        // ----------------------------------------------------

        if (
          typeof parsed !==
          'object' ||
          parsed === null
        ) {
          sendJson(socket, {
            type: 'error',
            code: 'INVALID_MESSAGE',
          });

          return;
        }

        const message =
          parsed as Record<
            string,
            unknown
          >;

        // ----------------------------------------------------
        // AUTHENTICATION
        // ----------------------------------------------------

        if (
          message.type ===
          'device_hello'
        ) {
          const bandId =
            message.band_id;

          if (
            typeof bandId !==
              'string' ||
            !bandId.trim()
          ) {
            sendJson(socket, {
              type: 'auth_error',
              code: 'INVALID_BAND_ID',
            });

            return;
          }

          authenticatedBandId =
            bandId.trim();

          connectedBands.set(
            authenticatedBandId,
            socket,
          );

          console.log(
            `[DEVICE] ${authenticatedBandId} authenticated`,
          );

          sendJson(socket, {
            type: 'device_authenticated',
            band_id:
              authenticatedBandId,
          });

          return;
        }

        // ----------------------------------------------------
        // SENSOR DATA
        // ----------------------------------------------------

        if (
          message.type ===
          'sensor_data'
        ) {
          if (
            !authenticatedBandId
          ) {
            sendJson(socket, {
              type: 'error',
              code: 'DEVICE_NOT_AUTHENTICATED',
            });

            return;
          }

          const packet =
            message.data;

          if (
            !isSensorPacket(packet)
          ) {
            sendJson(socket, {
              type: 'error',
              code: 'INVALID_SENSOR_PACKET',
            });

            return;
          }

          if (
            packet.band_id !==
            authenticatedBandId
          ) {
            sendJson(socket, {
              type: 'error',
              code: 'BAND_ID_MISMATCH',
            });

            return;
          }

          const rangeError =
            validateSensorRanges(
              packet,
            );

          if (rangeError) {
            console.warn(
              `[DEVICE] ${authenticatedBandId}: ${rangeError}`,
            );

            sendJson(socket, {
              type: 'error',
              code: 'INVALID_SENSOR_RANGE',
              message:
                rangeError,
            });

            return;
          }

          console.log(
            `[SENSOR] ${authenticatedBandId}`,
            {
              seq: packet.seq,
              hr: packet.hr,
              spo2: packet.spo2,
              temp: packet.temp,
              gsr: packet.gsr,
            },
          );

          // --------------------------------------------------
          // FUTURE:
          //
          // 1. Find active therapy session
          // 2. Attach session_id
          // 3. Run ML processing
          // 4. Broadcast to therapist browser
          // 5. Store sampled data in Supabase
          // --------------------------------------------------

          return;
        }

        // ----------------------------------------------------
        // PING
        // ----------------------------------------------------

        if (
          message.type ===
          'ping'
        ) {
          sendJson(socket, {
            type: 'pong',
            timestamp: Date.now(),
          });

          return;
        }

        // ----------------------------------------------------
        // UNKNOWN MESSAGE
        // ----------------------------------------------------

        sendJson(socket, {
          type: 'error',
          code: 'UNKNOWN_MESSAGE_TYPE',
        });
      },
    );

    // --------------------------------------------------------
    // CLOSE
    // --------------------------------------------------------

    socket.on(
      'close',
      () => {
        if (
          authenticatedBandId
        ) {
          const current =
            connectedBands.get(
              authenticatedBandId,
            );

          if (
            current === socket
          ) {
            connectedBands.delete(
              authenticatedBandId,
            );
          }

          console.log(
            `[DEVICE] ${authenticatedBandId} disconnected`,
          );
        } else {
          console.log(
            '[WS] Unauthenticated connection closed',
          );
        }
      },
    );

    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    socket.on(
      'error',
      (error) => {
        console.error(
          '[WS] Socket error:',
          error,
        );
      },
    );
  },
);

// ============================================================
// START SERVER
// ============================================================

httpServer.listen(
  PORT,
  HOST,
  () => {
    console.log('');
    console.log(
      '==========================================',
    );
    console.log(
      ' HABILITATE IoT GATEWAY',
    );
    console.log(
      '==========================================',
    );
    console.log(
      `HTTP  : http://localhost:${PORT}`,
    );
    console.log(
      `WS    : ws://localhost:${PORT}/ws`,
    );
    console.log(
      `HOST  : ${HOST}`,
    );
    console.log(
      `PORT  : ${PORT}`,
    );
    console.log(
      '==========================================',
    );
    console.log(
      'Waiting for ESP32 devices...',
    );
    console.log('');
  },
);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(
  signal: string,
) {
  console.log(
    `\n[SERVER] ${signal} received. Shutting down...`,
  );

  for (
    const socket of connectedBands.values()
  ) {
    try {
      socket.close();
    } catch {
      // Ignore close errors.
    }
  }

  wss.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT'),
);

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM'),
);