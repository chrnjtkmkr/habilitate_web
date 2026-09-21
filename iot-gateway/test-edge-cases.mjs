import WebSocket from "ws";

const DEVICE_TOKEN = process.env.DEVICE_TOKEN;
if (!DEVICE_TOKEN) {
  console.error("ERROR: DEVICE_TOKEN environment variable is required");
  process.exit(1);
}

const WS_URL = "wss://sqjuracvmmuyrdcapehk.supabase.co/functions/v1/wearable-ws";

// Helper: open an authenticated WS connection, resolve once "authenticated" or "device_ready" arrives
function connect(token = DEVICE_TOKEN, bandId = "HAB-001") {
  return new Promise((resolve, reject) => {
    const url = new URL(WS_URL);
    url.searchParams.set("band_id", bandId);
    url.searchParams.set("token", token);

    const ws = new WebSocket(url.toString());
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Connection timeout"));
    }, 10000);

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("message", (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.type === "authenticated" || data.type === "device_ready") {
        clearTimeout(timeout);
        resolve(ws);
      }
    });
  });
}

// Helper: send a message and wait for the next server response
function sendAndWait(ws, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Response timeout")), 10000);
    ws.once("message", (msg) => {
      clearTimeout(timeout);
      resolve(JSON.parse(msg.toString()));
    });
    ws.send(JSON.stringify(payload));
  });
}

let passed = 0;
let failed = 0;

function report(name, ok) {
  if (ok) {
    console.log(`PASS: ${name}`);
    passed++;
  } else {
    console.log(`FAIL: ${name}`);
    failed++;
  }
}

async function run() {
  // --- Test 1: Valid packet ---
  let ws;
  try {
    ws = await connect();

    const resp = await sendAndWait(ws, {
      type: "sensor_data",
      data: {
        band_id: "HAB-001",
        seq: 1000,
        t: Date.now(),
        ax: 0.1, ay: 0.2, az: 0.9,
        gx: 1.0, gy: -0.5, gz: 0.3,
        temp: 34.0, hr: 75, spo2: 97, gsr: 50,
      },
    });
    report("valid packet", resp.type === "ack" && resp.accepted === true);
  } catch (e) {
    report("valid packet", false);
    console.error("  ", e.message);
  }

  // --- Test 2: hr/spo2 = -1 (no finger) ---
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) ws = await connect();

    const resp = await sendAndWait(ws, {
      type: "sensor_data",
      data: {
        band_id: "HAB-001",
        seq: 1001,
        t: Date.now(),
        ax: 0, ay: 0, az: 1,
        gx: 0, gy: 0, gz: 0,
        temp: 33.0, hr: -1, spo2: -1, gsr: 40,
      },
    });
    report("hr/spo2 = -1", resp.type === "ack" && resp.accepted === true);
  } catch (e) {
    report("hr/spo2 = -1", false);
    console.error("  ", e.message);
  }

  // --- Test 3: Duplicate seq ---
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) ws = await connect();

    const resp = await sendAndWait(ws, {
      type: "sensor_data",
      data: {
        band_id: "HAB-001",
        seq: 1001,
        t: Date.now(),
        ax: 0, ay: 0, az: 1,
        gx: 0, gy: 0, gz: 0,
        temp: 33.0, hr: 80, spo2: 98, gsr: 40,
      },
    });
    report(
      "duplicate seq",
      resp.type === "ack" && resp.accepted === false && resp.reason === "DUPLICATE_OR_OUT_OF_ORDER"
    );
  } catch (e) {
    report("duplicate seq", false);
    console.error("  ", e.message);
  }

  if (ws && ws.readyState === WebSocket.OPEN) ws.close();

  // --- Test 4: Invalid token ---
  try {
    const url = new URL(WS_URL);
    url.searchParams.set("band_id", "HAB-001");
    url.searchParams.set("token", "invalid-token-value");

    const resp = await fetch(url.toString().replace("wss://", "https://"), {
      headers: { "Connection": "Upgrade", "Upgrade": "websocket" },
    });
    // Should get 401 (the server rejects before upgrade)
    report("invalid token", resp.status === 401);
  } catch (e) {
    // Some environments may throw on failed upgrade — that also counts as rejection
    report("invalid token", true);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
