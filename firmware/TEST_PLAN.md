# Band hardware test plan: connectivity

Run with the band on USB and the Arduino serial monitor open at 115200
baud. The serial log is the evidence: every status change prints
`[WIFI] Status -> <STATUS>`, and every failed join prints its reason
code. Record the log for each test.

Setup: flash from this repo (see PROVISIONING.md), open the dashboard in
Chrome, and connect to the band from Session → Therapy band.

Networks needed: **A** and **B** (two different 2.4 GHz networks, e.g. a
phone hotspot and the office Wi-Fi), plus one wrong password.

## C1. Switch networks without a power cycle (required)

1. Provision **A**. Expect `CONNECTING` → `CLOUD_CONNECTING` →
   `CONNECTED`, and the dashboard shows Connected.
2. Confirm data is flowing: `[WS] Sent seq ...` lines appear, and new
   `device_telemetry` rows arrive for this band.
3. Without unplugging the band, click **Change Wi-Fi network**, scan,
   pick **B**, enter its password and connect.
4. Expect in the log, in order:
   `New credentials for "B" saved` → `Status -> CONNECTING` →
   `Joined "B" ...` → `Status -> CLOUD_CONNECTING` → `Status -> CONNECTED`.
   There must be no `Joined "A"`, and no failure status in between.
5. Power-cycle the band. It must come back on **B**
   (`Stored credentials for "B"`), not A.

Pass: the band streams on B within about 30 s of step 3, and reconnects
to B after the reboot.

## C2. Switch away from a failing network

1. Provision **A** with a wrong password. Expect `FAILED_AUTH`, then
   retries every 2, 4, 8 ... up to 30 s (`retry in ... ms`).
2. While it is retrying, provision **B** correctly.
3. Expect an immediate `CONNECTING` for B and then `CONNECTED`. No
   further retries against A may appear in the log.

Repeat step 2 with timing varied: once during a backoff wait, and once
in the middle of a join attempt (right after a `CONNECTING`).

## C3. Network disappears and comes back

1. Online on a phone hotspot, turn the hotspot off.
   Expect `Link to ... lost` → `CONNECTING` → `NO_NETWORK` with retries.
2. After 2+ minutes, turn it back on. Expect `CONNECTED` within about
   30 s, with no power cycle.

## C4. Failure reporting

| Scenario | Expected status |
|---|---|
| Wrong password | `FAILED_AUTH` |
| SSID out of range, or a 5 GHz-only network | `NO_NETWORK` |
| Hotspot with mobile data off (Wi-Fi joins, no internet) | `CLOUD_CONNECTING`, then `NO_INTERNET` after 20 s |

In each case the dashboard shows the matching message, and the band
keeps retrying (visible in the log).

## C5. Scan while retrying

While the band is retrying a bad network (C2 step 1), scan from the
dashboard. The network list must appear (no `SCAN_FAILED`), and the
retries resume afterwards.

## C6. Soak

Leave the band streaming for 1 hour during a mock session. Note every
`[WS] Disconnected` and how long each takes to return to `CONNECTED`,
and confirm there are no reboots (`[BOOT]` must appear only once).
Expect periodic WebSocket drops caused by the Supabase Edge Function
time limit; these are addressed by the transport work, not by this
change.
