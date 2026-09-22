# Band hardware test plan: connectivity

Run with the band on USB and the Arduino serial monitor open at 115200
baud. The serial log is the evidence: every status change prints
`[WIFI] Status -> <STATUS>`, and every failed join prints its reason
code. Record the full log for each test, starting from the `[BOOT]`
lines.

Every recorded run must include the identity line printed at boot:

```
[BOOT] HAB-001 firmware 0.6.2 mac 24:58:7C:XX:XX:XX
[BOOT] Reset reason: POWERON
[BOOT] Previous boot: no record (first boot after power-on)
```

Also record the chip line printed a few lines later. It confirms the
parts actually fitted:

```
[BOOT] Chip IDs: pulse part 0x15 rev 0x03, temp WHO_AM_I 0xA0, motion WHO_AM_I 0x68
```

Pulse part `0x15` = MAX30102/MAX30105 (a MAX30100 would read `0x11` and
the firmware would report it MISSING). Temp `0xA0` = STTS22H. Motion
`0x68` = MPU-6050 (`0x70` = MPU-6500, `0x71` = MPU-9250; other values
mean a clone, which is worth knowing for the noise figures).

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
   with `[Wearable]`. Then reload the page mid-session: the header shows
   "Band not receiving session state · Reconnect band" (the browser needs
   a click to hand the band back after a reload). Click it, pick the
   band, and the LED must return to purple.
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

## H1. Heart rate against a pulse oximeter (required before HRV is "done")

From firmware 0.6.1 heart rate comes from the beat detector: 60000 ÷ the
median of the last 8 clean beat intervals. (Up to 0.4.6 the Maxim routine
reported it at double the true rate; in 0.5.0 its perfusion check
rejected most wrist readings, so HR was always empty.) SpO2 still comes
from the Maxim routine; with `DEBUG_HRV 1` the log prints the perfusion
index every 5 s (`[SPO2-DBG] ...`), which shows why SpO2 is or is not
available.

1. Clip a pulse oximeter on one finger and place a finger of the other
   hand (or the wrist, as worn) on the band's sensor. Sit still.
2. After 30 s, note the time and both readings every 15 s for 2 minutes.
3. Send me the times. I compare them with `device_telemetry.hr` for the
   same seconds.

Pass: after the first 30 s, the band is within ±5 bpm of the oximeter at
every reading. Repeat once after 1 minute of brisk movement (stairs,
jumping) so the comparison covers a raised heart rate too.

## H2. HRV reaches the database

From firmware 0.6.0 the band sends every beat-to-beat interval, and
Postgres computes `device_telemetry.hrv` from them (`public.rmssd`). The
band's own figure is kept in `hrv_device` for comparison.

1. Same still position as H1, for 2 minutes.
2. Expect rows in `device_beats` within a few seconds of contact (about
   one per heartbeat), mostly `clean = true`.
3. Expect `hrv` to become non-NULL about 15–30 s after contact (it needs
   10 clean successive differences) and stay in a plausible range
   (adult at rest: roughly 20–100 ms).
4. `hrv` and `hrv_device` should agree within a few ms. Small
   differences are expected (the database uses the median of the last
   ~70 beats as its reference, the band the last 8); large ones must be
   reported. I can run the comparison from the database for your times.
5. For a detailed check, flash with `#define DEBUG_HRV 1`: every beat
   prints `[HRV-DBG] ibi ... accepted/rejected ...`. While still, at
   least 80% of beats should be accepted.

## H3. Movement does not fake HRV

1. With HRV showing, wave the hand for 10 s, then hold still again.
2. Expect rejections during the movement (with DEBUG_HRV) and `hrv`
   either unchanged or NULL, never a spike. It must recover within
   about 30 s of holding still.

## H4. No lost samples

During normal streaming there must be no `[PPG] FIFO overflow` lines.
One or two during a Wi-Fi scan or a reconnect are acceptable (the beat
chain resets there, by design); regular ones mean the main loop is
stalling and must be reported.

## B1. Change and forget a band (dashboard)

1. With a band connected, open Device settings. The band section shows
   **Change band** and **Forget this band**.
2. **Forget this band** → confirm. The card shows "Not connected".
   Reload the page: it must not reconnect to that band on its own.
3. **Set up a device** → **Connect via Bluetooth** → pick the band again.
   It connects, and its Wi-Fi status is read fresh.
4. **Change band**: the current band disconnects and the device picker
   opens. Cancel it: the card shows "Not connected", and nothing
   reconnects in the background.
5. With a second band available (its own `BAND_ID`, see
   PROVISIONING.md), repeat 4 and pick the second band. The card must
   show its band ID, and after a reload only that band is restored.

## S1. Child state, live (engine validation)

Open the session page with `?debug=1` added to the URL. The header's
Regulated / Amber / Dysregulated pills follow the band engine
automatically and switch live; nobody selects them. Under the pills a
line says where the shown state comes from, and in debug mode a second
line shows the provisional state, the score, each signal's points and
deviation (z), the number of valid signals, the baseline length and the
measured latency.

`CLINICAL_THRESHOLDS_SIGNED_OFF` is false, so the band's state is an
**unvalidated estimate**: the active pill is drawn with a **dashed
outline** (never the solid fill), with a "Band estimate · not validated"
tag underneath. No pill is highlighted (never a default "Regulated")
while the Band line reads "learning this child's baseline", "not enough
reliable signals" or "no live data". In each step below, the highlighted
pill should match the debug line's provisional state.

Therapist override (check once): tap Amber. The pill turns solid and the
line reads "Set by therapist · HH:MM" with a **Back to auto** button,
plus "Band estimate: X (not validated)". Refresh: the override is still
there. Tap Back to auto: the pills follow the band again (dashed).

Recording: in `session_events` the taps have `source = 'therapist'` (the
second as `state_override_cleared`), and each change of the dashed pill
has `source = 'band_estimate'` (a null `state_value` when the band loses
its state). No `source = 'band'` rows until sign-off. The session
summary shows only the therapist line, never the estimates.

Wear the band with the pulse sensor and the GSR electrodes on skin.

1. **Baseline.** Sit still for 2 minutes. Expect "learning this child's
   baseline (n of 60 s)", then Regulated highlighted (dashed). The debug
   line should read provisional `regulated`, score 0-1, 3 valid signals.
2. **GSR.** Grip the electrodes firmly (or take a sharp breath and hold
   it for 5 s). Expect the GSR z to rise within a few seconds and GSR to
   score 1-2 points. **If the GSR z goes negative instead, the GSR
   direction is inverted**: report it, and `GSR_AROUSAL_DIRECTION` in
   `frontend/src/lib/childState/engine.ts` becomes -1. Keep it up for
   15 s: provisional must reach `amber` about 12 s after the score first
   reached 2, not before.
3. **Calm down.** Release and sit still. Provisional must stay `amber`
   for 30 s after the score drops, then return to `regulated`.
4. **Movement.** Shake the hand for 10 s. Expect motion to score, and
   GSR and HRV to show "–" (excluded) while the movement is heavy, with
   the reason "Movement is corrupting the sensors". Never a jump to
   `dysregulated` from movement alone.
5. **HRV.** Only a drop in HRV may score; slow deep breathing (which
   raises HRV) must leave HRV at 0 points.
6. **Flapping.** Flap the hand at about 3 per second for 5 s: a
   "Flapping" tag appears. It must not change the score by itself.
7. **Latency.** The debug line shows latency (end of a second on the
   band to the screen). Expect about 0.3-1.5 s. The state label changes
   later by design (12 s to escalate, 30 s to de-escalate).
8. **No contact.** Take the GSR electrodes off: GSR shows "–" (excluded)
   rather than a number, once the reading pins at the ADC limit. Note
   the raw `gsr` value in `device_telemetry` with the electrodes off; if
   it does not pin, that value becomes `GSR_OPEN_CIRCUIT_ADC` in the
   firmware.

Send me the times of each step; I can read the matching `band_seconds`
rows to confirm the engine saw the same thing.

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
