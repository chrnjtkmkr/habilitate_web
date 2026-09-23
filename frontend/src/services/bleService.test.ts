import { afterEach, describe, expect, it, vi } from 'vitest';

import { BLE_CONNECT_TIMEOUT_MS, reconnectToAuthorizedHabilitateBand } from './bleService';

// A band the browser has already authorised, reachable without a picker.
function authorisedBand(bandId: string) {
  const characteristic = {
    readValue: async () => new DataView(new TextEncoder().encode(bandId).buffer),
  };
  const gatt = {
    connected: true,
    connect: async () => gatt,
    getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }),
    disconnect: () => {},
  };
  return { id: bandId, name: `Habilitate-${bandId}`, gatt, addEventListener() {}, removeEventListener() {} };
}

function stubBluetooth(devices: ReturnType<typeof authorisedBand>[]) {
  vi.stubGlobal('navigator', { bluetooth: { getDevices: async () => devices, requestDevice: vi.fn() } });
}

afterEach(() => vi.unstubAllGlobals());

describe('reconnectToAuthorizedHabilitateBand', () => {
  it('restores the remembered band', async () => {
    stubBluetooth([authorisedBand('HAB-001'), authorisedBand('HAB-002')]);
    expect((await reconnectToAuthorizedHabilitateBand('HAB-002'))?.bandId).toBe('HAB-002');
  });

  it('never falls back to another authorised band', async () => {
    stubBluetooth([authorisedBand('HAB-002')]);
    expect(await reconnectToAuthorizedHabilitateBand('HAB-001')).toBeNull();
  });

  it('restores nothing when no band is remembered', async () => {
    stubBluetooth([authorisedBand('HAB-001')]);
    expect(await reconnectToAuthorizedHabilitateBand(null)).toBeNull();
  });

  it('gives up after the connect timeout when the remembered band is off', async () => {
    vi.useFakeTimers();
    try {
      const band = authorisedBand('HAB-001');
      const disconnect = vi.fn();
      Object.assign(band.gatt, { connected: false, connect: () => new Promise<never>(() => {}), disconnect });
      stubBluetooth([band]);

      const pending = reconnectToAuthorizedHabilitateBand('HAB-001');
      await vi.advanceTimersByTimeAsync(BLE_CONNECT_TIMEOUT_MS);
      expect(await pending).toBeNull();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
