// Maps the band's Wi-Fi status (BLE characteristic 0x0005) to what the
// UI shows. The status values are defined in the firmware header
// (firmware/HabilitateBand/HabilitateBand.ino, "WIFI STATUS VALUES").
//
// The band keeps retrying on its own after every failure, so "failed"
// here only means the dashboard should stop waiting and tell the user.

export type WifiOutcome = 'connected' | 'pending' | 'failed';

export interface WifiStatusInfo {
  outcome: WifiOutcome;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  labelKey: string;
  detailKey: string;
}

// Set by the dashboard, never by the band: provisioning waited longer
// than PROVISION_WAIT_MS without a final status.
export const WIFI_STATUS_TIMEOUT = 'TIMEOUT';

const STATUS_INFO: Record<string, WifiStatusInfo> = {
  CONNECTED: {
    outcome: 'connected',
    tone: 'success',
    labelKey: 'band_wifi_state_connected',
    detailKey: 'band_wifi_state_connected_detail',
  },
  CONNECTING: {
    outcome: 'pending',
    tone: 'warning',
    labelKey: 'band_wifi_state_connecting',
    detailKey: 'band_wifi_state_connecting_detail',
  },
  CLOUD_CONNECTING: {
    outcome: 'pending',
    tone: 'warning',
    labelKey: 'band_wifi_state_cloud_connecting',
    detailKey: 'band_wifi_state_cloud_connecting_detail',
  },
  NO_INTERNET: {
    outcome: 'failed',
    tone: 'danger',
    labelKey: 'band_wifi_state_no_internet',
    detailKey: 'band_wifi_state_no_internet_detail',
  },
  FAILED_AUTH: {
    outcome: 'failed',
    tone: 'danger',
    labelKey: 'band_wifi_state_failed_auth',
    detailKey: 'band_wifi_state_failed_auth_detail',
  },
  NO_NETWORK: {
    outcome: 'failed',
    tone: 'danger',
    labelKey: 'band_wifi_state_no_network',
    detailKey: 'band_wifi_state_no_network_detail',
  },
  FAILED: {
    outcome: 'failed',
    tone: 'danger',
    labelKey: 'band_wifi_state_failed',
    detailKey: 'band_wifi_state_failed_detail',
  },
  INVALID_CREDENTIALS: {
    outcome: 'failed',
    tone: 'danger',
    labelKey: 'band_wifi_state_invalid_credentials',
    detailKey: 'band_wifi_state_invalid_credentials_detail',
  },
  NO_CREDENTIALS: {
    outcome: 'failed',
    tone: 'neutral',
    labelKey: 'band_wifi_state_no_credentials',
    detailKey: 'band_wifi_state_no_credentials_detail',
  },
  [WIFI_STATUS_TIMEOUT]: {
    outcome: 'failed',
    tone: 'warning',
    labelKey: 'band_wifi_state_timeout',
    detailKey: 'band_wifi_state_timeout_detail',
  },
};

// Firmware before 0.4.0 reported INVALID for a missing SSID.
STATUS_INFO.INVALID = STATUS_INFO.NO_NETWORK;

const UNKNOWN_INFO: WifiStatusInfo = {
  outcome: 'pending',
  tone: 'neutral',
  labelKey: 'band_wifi_state_unknown',
  detailKey: 'band_wifi_state_unknown_detail',
};

export function describeWifiStatus(status: string): WifiStatusInfo {
  return STATUS_INFO[status] ?? UNKNOWN_INFO;
}

// Mirrors the firmware's check: WPA passphrase of 8-63 characters,
// a 64-character hex PSK, or empty for an open network.
export function isValidWifiPassword(password: string): boolean {
  if (password.length === 0) return true;
  if (password.length === 64) return /^[0-9a-fA-F]{64}$/.test(password);
  return password.length >= 8 && password.length <= 63;
}
