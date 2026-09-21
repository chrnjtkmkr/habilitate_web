import WebSocket from "ws";

const DEVICE_TOKEN = process.env.DEVICE_TOKEN;
if (!DEVICE_TOKEN) {
  console.error("ERROR: DEVICE_TOKEN environment variable is required");
  process.exit(1);
}

const url = new URL(
  "wss://sqjuracvmmuyrdcapehk.supabase.co/functions/v1/wearable-ws"
);

url.searchParams.set("band_id", "HAB-001");
url.searchParams.set("token", DEVICE_TOKEN);

console.log("Connecting to Supabase WSS...");

const ws = new WebSocket(url.toString());

ws.on("open", () => {
  console.log("WSS CONNECTED");

  ws.send(
    JSON.stringify({
      type: "device_hello",
      band_id: "HAB-001",
    })
  );

  setTimeout(() => {
    console.log("Sending test sensor packet...");

    ws.send(
      JSON.stringify({
        type: "sensor_data",
        data: {
          band_id: "HAB-001",
          seq: 1,
          t: Date.now(),

          ax: 0.12,
          ay: 0.05,
          az: 0.98,

          gx: 1.2,
          gy: -0.4,
          gz: 0.8,

          temp: 33.5,
          hr: 82,
          spo2: 98,
          gsr: 42.5,
        },
      })
    );
  }, 500);
});

ws.on("message", (message) => {
  console.log("SERVER:", message.toString());

  const data = JSON.parse(message.toString());

  if (data.type === "ack" && data.accepted === true) {
    console.log("");
    console.log("SENSOR DATA ACCEPTED BY SUPABASE");

    setTimeout(() => {
      ws.close();
    }, 500);
  }
});

ws.on("error", (error) => {
  console.error("WSS ERROR:", error.message);
});

ws.on("close", (code, reason) => {
  console.log(
    `WSS CLOSED — code=${code}, reason=${reason.toString()}`
  );
});
