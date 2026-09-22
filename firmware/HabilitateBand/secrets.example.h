// Per-band identity. Copy this file to secrets.h (gitignored) and set
// the values for the ONE band you are about to flash.
//
// Every physical band needs its own BAND_ID and DEVICE_TOKEN, and both
// must be registered in the database before the band can stream.
// See firmware/PROVISIONING.md.
#pragma once
#define BAND_ID      "HAB-000"
#define DEVICE_TOKEN "CHANGE_ME_BEFORE_FLASHING"
#define DEVICE_TOKEN_IS_PLACEHOLDER 1  // Delete this line after setting the real token
