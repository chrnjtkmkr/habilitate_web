# Band hardware test plan: connectivity

Run with the band on USB and the Arduino serial monitor open at 115200
baud. The serial log is the evidence: every status change prints
`[WIFI] Status -> <STATUS>`, and every failed join prints its reason
code. Record the full log for each test, starting from the `[BOOT]`
lines.

Every recorded run must include the identity line printed at boot:

```
[BOOT] HAB-001 firmware 0.4.6 mac 24:58:7C:XX:XX:XX
[BOOT] Reset reason: POWERON
[BOOT] Previous boot: no record (first boot after power-on)
```

After any restart that was not a power cycle, the third line instead
reads e.g. `Previous boot: ran 289 s, last step websocket, network
Online (boot #3 since power-on)`. It records where the band was when it
died, so a crash can be diagnosed from the next boot even if the crash
itself scrolled away. Always copy all three lines.

A hang anywhere in the firmware now triggers the watchdog within 20 s:
the log shows `task_wdt` and a backtrace, and the band restarts with
reset reason `TASK_WDT`. Copy the backtrace block if you see one.

Reset reason `POWERON`, `USB` or `EXTERNAL_PIN` is expected after a power
cycle, a flash or the reset button. `PANIC`, anything ending in `_WDT`,
`BROWNOUT` or `POWER_GLITCH` means the band crashed, hung or lost power:
record the log and report it, even if the band recovered on its own.

A run without it doesn't count: we can't tell which band or firmware
produced it. The MAC is burned into the chip, so it identifies the
physical band even if two bands were flashed with the same `BAND_ID`.
The same MAC is printed on every server connect
(`[WS] Connected to Supabase Edge Function as HAB-001 (mac ...)`).

## LED reference

Check the LED at every step marked **LED:** below. A wrong LED state
fails the step, even if the log looks right.

At every boot the LED shows red, green, then blue (250 ms each), and the
log prints `[LED] Self-test on GPIO 48: red, green, blue`. If that
sequence does not appear, stop: the LED pin or hardware is wrong, and
none of the LED checks below mean anything until it is fixed.

| Band state | LED |
|---|---|
| No Wi-Fi credentials stored | Off |
| Waiting for Wi-Fi: joining, retrying, or joined but the server is not reachable yet | Orange blinking (1 Hz) |
| Wi-Fi connected and streaming (`CONNECTED`) | Orange solid |
| Session active and streaming (dashboard sent ACTIVE or RESUME) | Purple solid |
| Session active but NOT streaming (Wi-Fi or server lost) | Purple/orange alternating (1 Hz, never off) |
| Session paused | Purple blinking (1 Hz) |

Session colours take priority over plain Wi-Fi colours. But an active
session that stops streaming alternates purple and orange, so a therapist
can see that data is not being recorded.

Setup: flash from this repo (see PROVISIONING.md), open the dashboard in
Chrome, and connect to the band from Session → Therapy band.

Networks needed: **A** and **B** (two different 2.4 GHz networks, e.g. a
phone hotspot and the office Wi-Fi), plus one wrong password.

## C1. Switch networks without a power cycle (required)

1. Power-cycle the band. **LED:** red, green, blue self-test. Record
   the full `[BOOT] HAB-XXX firmware x.x.x mac XX:XX:XX:XX:XX:XX` line
   and the `Reset reason` line. The band
   ID must match the band's label, the version must match
   `FIRMWARE_VERSION` in the source you flashed, and write the MAC down
   next to the band ID. Then provision **A**. Expect `CONNECTING` →
   `CLOUD_CONNECTING` → `CONNECTED`, and the dashboard shows Connected.
   **LED:** orange blinking while connecting, orange solid at `CONNECTED`.
2. Confirm data is flowing: `[WS] Sent seq ...` lines appear, and new
   `device_telemetry` rows arrive for this band.
3. Start a session from the dashboard. **LED:** purple solid within
   10 s. Pause it: purple blinking. Resume: purple solid. End it: back to
   orange solid. The session header must not show "Band not receiving
   session state"; if it does, copy the browser console lines starting
   with `[Wearable]`.
4. Without unplugging the band, click **Change Wi-Fi network**, scan,
   pick **B**, enter its password and connect.
5. Expect in the log, in order:
   `New credentials for "B" saved` → `Status -> CONNECTING` →
   `Joined "B" ...` → `Status -> CLOUD_CONNECTING` → `Status -> CONNECTED`.
   There must be no `Joined "A"`, and no failure status in between.
   **LED:** orange blinking during the switch, orange solid on B.
6. Power-cycle the band. It must come back on **B**
   (`Stored credentials for "B"`), not A, with the same MAC as step 1.

Pass: the band streams on B within about 30 s of step 4, and reconnects
to B after the reboot.

## C2. Switch away from a failing network

1. Provision **A** with a wrong password. Expect `FAILED_AUTH`, then
   retries every 2, 4, 8 ... up to 30 s (`retry in ... ms`).
   **LED:** orange blinking throughout (never solid).
2. While it is retrying, provision **B** correctly.
3. Expect an immediate `CONNECTING` for B and then `CONNECTED`. No
   further retries against A may appear in the log.

Repeat step 2 with timing varied: once during a backoff wait, and once
in the middle of a join attempt (right after a `CONNECTING`).

## C3. Network disappears and comes back

1. Online on a phone hotspot, turn the hotspot off.
   Expect `Link to ... lost` → `CONNECTING` → `NO_NETWORK` with retries.
   **LED:** orange solid → orange blinking within a few seconds.
2. After 2+ minutes, turn it back on. Expect `CONNECTED` within about
   30 s, with no power cycle. **LED:** back to orange solid.
3. Repeat step 1 during an active session. **LED:** purple solid →
   purple/orange alternating within a few seconds of the hotspot going
   off, and back to purple solid within about 30 s of it returning. The
   session itself must not end. Also record how the loss shows up on the
   dashboard.

## C4. Failure reporting

| Scenario | Expected status |
|---|---|
| Wrong password | `FAILED_AUTH` |
| SSID out of range, or a 5 GHz-only network | `NO_NETWORK` |
| Hotspot with mobile data off (Wi-Fi joins, no internet) | `CLOUD_CONNECTING`, then `NO_INTERNET` after 20 s; **LED:** orange blinking, never solid |

In each case the dashboard shows the matching message, and the band
keeps retrying (visible in the log).

**Enterprise (802.1X) Wi-Fi is out of scope.** These are networks that
ask for a username as well as a password, common in offices. The band
cannot join them, because there is no way to give it a username or
certificates. Test that it fails clearly:

| Scenario | Expected |
|---|---|
| Scan near an 802.1X network | Listed but greyed out, marked "Not supported: this network needs a username sign-in", and cannot be selected |

If the office network is 802.1X, the band needs a separate network there:
a PSK guest/IoT SSID, or a phone hotspot.

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

**LED:** purple solid, except during each WebSocket drop, when it
alternates purple/orange until `CONNECTED` returns (normally under
10 s), then goes back to purple solid. A drop must never end the session
or leave the LED off, orange, or purple-blinking; before 0.4.0 every
drop reset the session LED. Record the number and length of the
alternating episodes: they should match the `[WS] Disconnected` count.

If the band restarts during the soak, that is a failure to report (copy
the three `[BOOT]` lines and any backtrace), but the session must
recover on its own: the dashboard re-sends the session state every 10 s,
so the LED returns to purple solid within about 20 s of the reboot.
