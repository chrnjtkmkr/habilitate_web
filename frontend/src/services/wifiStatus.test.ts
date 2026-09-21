import { describe, expect, it } from 'vitest';

import {
  describeWifiStatus,
  isValidWifiPassword,
  WIFI_STATUS_TIMEOUT,
} from './wifiStatus';

describe('describeWifiStatus', () => {
  it('treats only CONNECTED as connected', () => {
    expect(describeWifiStatus('CONNECTED').outcome).toBe('connected');
  });

  it('keeps waiting while the band is joining Wi-Fi or the server', () => {
    expect(describeWifiStatus('CONNECTING').outcome).toBe('pending');
    expect(describeWifiStatus('CLOUD_CONNECTING').outcome).toBe('pending');
  });

  it('stops waiting on every failure the firmware reports', () => {
    for (const status of [
      'FAILED_AUTH',
      'NO_NETWORK',
      'NO_INTERNET',
      'FAILED',
      'INVALID_CREDENTIALS',
      'NO_CREDENTIALS',
      WIFI_STATUS_TIMEOUT,
    ]) {
      expect(describeWifiStatus(status).outcome).toBe('failed');
    }
  });

  it('maps the pre-0.4.0 INVALID status to network not found', () => {
    expect(describeWifiStatus('INVALID')).toEqual(describeWifiStatus('NO_NETWORK'));
  });

  it('keeps polling on a status it does not recognise', () => {
    expect(describeWifiStatus('').outcome).toBe('pending');
    expect(describeWifiStatus('SOMETHING_NEW').outcome).toBe('pending');
  });
});

describe('isValidWifiPassword', () => {
  it('accepts an empty password for open networks', () => {
    expect(isValidWifiPassword('')).toBe(true);
  });

  it('accepts WPA passphrases of 8 to 63 characters', () => {
    expect(isValidWifiPassword('a'.repeat(8))).toBe(true);
    expect(isValidWifiPassword('a'.repeat(63))).toBe(true);
  });

  it('rejects passphrases the band would reject', () => {
    expect(isValidWifiPassword('a'.repeat(7))).toBe(false);
    expect(isValidWifiPassword('a'.repeat(65))).toBe(false);
  });

  it('accepts a 64-character PSK only when it is hex', () => {
    expect(isValidWifiPassword('0123456789abcdef'.repeat(4))).toBe(true);
    expect(isValidWifiPassword('z'.repeat(64))).toBe(false);
  });
});
