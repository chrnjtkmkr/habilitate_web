# Provisioning a new band

Each physical band needs its own identity. Two bands flashed with the same
`BAND_ID` advertise the same Bluetooth name and write into the same
telemetry stream, so the dashboard cannot tell them apart.

A band's identity is two values in `HabilitateBand/secrets.h` (gitignored):

| Value          | Example   | Used for                                            |
|----------------|-----------|-----------------------------------------------------|
| `BAND_ID`      | `HAB-002` | Bluetooth name (`Habilitate-HAB-002`), `band_id` in telemetry, `sensor_devices.device_uid` |
| `DEVICE_TOKEN` | 64 hex chars | Authenticates the band to the `wearable-ws` Edge Function |

## 1. Generate a token and its hash

Run locally. Only the hash goes into the database; the token itself goes
only into `secrets.h`.

```bash
TOKEN=$(openssl rand -hex 32)
echo "DEVICE_TOKEN: $TOKEN"
printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1   # token_hash
```

## 2. Register the band

Run in the Supabase SQL editor. `center_id` is the center that owns the band.

```sql
with device as (
  insert into public.sensor_devices (center_id, device_uid, device_name, bluetooth_name, status)
  values ('<center uuid>', 'HAB-002', 'Therapy band HAB-002', 'Habilitate-HAB-002', 'active')
  returning id
)
insert into public.device_credentials (device_id, token_hash)
select id, '<token_hash from step 1>' from device;
```

To revoke a band's token later:
`update public.device_credentials set revoked_at = now() where device_id = '<id>';`

## 3. Flash

Copy `secrets.example.h` to `secrets.h`, set `BAND_ID` and `DEVICE_TOKEN`,
and delete the `DEVICE_TOKEN_IS_PLACEHOLDER` line.

Arduino IDE settings (Tools menu):

- Board: **ESP32S3 Dev Module**
- USB CDC On Boot: **Enabled**
- Partition Scheme: **Huge APP (3MB No OTA/1MB SPIFFS)**. The firmware is
  about 1.35 MB and does not fit the default 1.25 MB app partition.

Always flash from this repository's `firmware/HabilitateBand` folder.

On boot the serial monitor prints `[BOOT] HAB-002 firmware <version>`.
Check that it matches before handing the band over.
