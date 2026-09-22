// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HabilitateBluetoothDevice } from '../services/bleService';

// A band that records session-state writes and can be dropped/reconnected.
function fakeBand(bandId = 'HAB-001') {
  const listeners = new Set<(e: Event) => void>();
  const writes: string[] = [];
  let connected = true;
  let failConnect = false;

  const characteristic = {
    readValue: async () => new DataView(new TextEncoder().encode(bandId).buffer),
    writeValue: async (value: BufferSource) => {
      if (!connected) throw new Error('GATT Server is disconnected');
      writes.push(new TextDecoder().decode(value as ArrayBuffer));
    },
    startNotifications: async () => characteristic,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const service = { getCharacteristic: async () => characteristic };

  const device = {
    id: 'dev-1',
    name: `Habilitate-${bandId}`,
    gatt: {
      get connected() { return connected; },
      connect: vi.fn(async () => {
        if (failConnect) throw new Error('Bluetooth Device is no longer in range.');
        connected = true;
        return device.gatt;
      }),
      getPrimaryService: async () => service,
      disconnect: () => { connected = false; },
    },
    addEventListener: (_: string, fn: (e: Event) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: Event) => void) => listeners.delete(fn),
  };

  return {
    device: device as unknown as HabilitateBluetoothDevice,
    writes,
    connectSpy: device.gatt.connect,
    // Simulates the band rebooting or walking out of range.
    drop() {
      connected = false;
      const event = { target: device } as unknown as Event;
      listeners.forEach((fn) => fn(event));
    },
    setFailConnect(value: boolean) { failConnect = value; },
  };
}

async function loadStore(band: ReturnType<typeof fakeBand>) {
  vi.resetModules();
  vi.doMock('../services/bleService', async (importActual) => ({
    ...(await importActual<typeof import('../services/bleService')>()),
    connectToHabilitateBand: vi.fn(async () => ({ device: band.device, bandId: 'HAB-001' })),
    reconnectToAuthorizedHabilitateBand: vi.fn(async () => null),
  }));
  return import('./bandStore');
}

// Node 25's built-in global localStorage shadows jsdom's and has no
// methods without --localstorage-file, so each test gets its own.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock('../services/bleService');
});

describe('bandStore session state', () => {
  it('reports no-band when nothing was ever paired', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    expect(await store.sendBandSessionState('ACTIVE')).toBe('no-band');
    expect(band.writes).toEqual([]);
  });

  it('writes over the connection opened by the setup card', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    await store.connectBandWithPicker();

    expect(await store.sendBandSessionState('ACTIVE')).toBe('sent');
    expect(band.writes).toEqual(['ACTIVE']);
  });

  it('reconnects the same device after the link drops, without a picker', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    await store.connectBandWithPicker();

    band.drop();
    expect(store.useBandStore.getState().status).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(2_000);
    expect(band.connectSpy).toHaveBeenCalled();
    expect(store.useBandStore.getState().status).toBe('connected');
    expect(await store.sendBandSessionState('PAUSE')).toBe('sent');
    expect(band.writes).toEqual(['PAUSE']);
  });

  it('keeps retrying with backoff while the band is unreachable', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    await store.connectBandWithPicker();

    band.setFailConnect(true);
    band.drop();
    await vi.advanceTimersByTimeAsync(2_000 + 4_000 + 8_000);
    expect(band.connectSpy).toHaveBeenCalledTimes(3);
    expect(store.useBandStore.getState().status).toBe('reconnecting');

    band.setFailConnect(false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(store.useBandStore.getState().status).toBe('connected');
  });

  it('sends immediately on a dropped link by reconnecting on demand', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    await store.connectBandWithPicker();

    band.drop();
    expect(await store.sendBandSessionState('ACTIVE')).toBe('sent');
    expect(band.writes).toEqual(['ACTIVE']);
  });

  it('reports unreachable when a band was paired but cannot be reached', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    await store.connectBandWithPicker();
    band.setFailConnect(true);
    band.drop();

    expect(await store.sendBandSessionState('ACTIVE')).toBe('unreachable');
  });

  it('reports unreachable after a reload, when only the remembered ID is left', async () => {
    localStorage.setItem('habilitate.bandId', 'HAB-001');
    const band = fakeBand();
    const store = await loadStore(band);

    expect(await store.sendBandSessionState('ACTIVE')).toBe('unreachable');
  });

  it('does not revive the link after an explicit disconnect', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    await store.connectBandWithPicker();

    store.disconnectBand();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(band.connectSpy).not.toHaveBeenCalled();
    expect(store.useBandStore.getState().status).toBe('disconnected');
  });

  it('forgets the band: disconnects, clears the remembered ID, revokes permission', async () => {
    const band = fakeBand();
    const forget = vi.fn(async () => {});
    (band.device as unknown as { forget: () => Promise<void> }).forget = forget;
    const store = await loadStore(band);
    await store.connectBandWithPicker();
    expect(localStorage.getItem('habilitate.bandId')).toBe('HAB-001');

    await store.forgetBand();
    expect(forget).toHaveBeenCalled();
    expect(localStorage.getItem('habilitate.bandId')).toBeNull();
    expect(store.useBandStore.getState()).toMatchObject({ device: null, bandId: null, status: 'disconnected' });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(band.connectSpy).not.toHaveBeenCalled();
    expect(await store.sendBandSessionState('ACTIVE')).toBe('no-band');
  });

  it('changes band: forgets the current one, then opens the picker', async () => {
    const band = fakeBand();
    const store = await loadStore(band);
    await store.connectBandWithPicker();
    const { connectToHabilitateBand } = await import('../services/bleService');

    await store.changeBand();
    expect(connectToHabilitateBand).toHaveBeenCalledTimes(2);
    expect(store.useBandStore.getState().status).toBe('connected');
  });
});
