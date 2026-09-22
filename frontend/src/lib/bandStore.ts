import { create } from 'zustand';

import {
  connectToHabilitateBand,
  disconnectFromHabilitateBand,
  reconnectToAuthorizedHabilitateBand,
  setWearableSessionState,
  type HabilitateBluetoothDevice,
  type WearableSessionState,
} from '../services/bleService';

// The page's one Bluetooth connection to the band.
//
// It used to live inside DeviceSetupCard, which only renders before a
// session starts; going live unmounted it and dropped the connection,
// and the session page then tried to reconnect through getDevices(),
// which regular Chrome only offers behind a flag. Keeping the device
// here means the setup card and the live session share one connection
// for the whole page, and a dropped link is reconnected with the same
// device object, which Chrome allows without a user gesture.

export type BandLinkStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface BandStore {
  device: HabilitateBluetoothDevice | null;
  bandId: string | null;
  status: BandLinkStatus;
  error: string | null;
}

export const useBandStore = create<BandStore>(() => ({
  device: null,
  bandId: null,
  status: 'disconnected',
  error: null,
}));

const BAND_ID_STORAGE_KEY = 'habilitate.bandId';
const RECONNECT_MIN_MS = 2_000;
const RECONNECT_MAX_MS = 15_000;

let reconnectTimer: number | null = null;
let reconnectDelayMs = RECONNECT_MIN_MS;
// Set by an explicit disconnect so the link is not revived behind the
// user's back.
let reconnectWanted = false;
const watchedDevices = new WeakSet<HabilitateBluetoothDevice>();

function rememberBandId(bandId: string) {
  try {
    localStorage.setItem(BAND_ID_STORAGE_KEY, bandId);
  } catch {
    // Storage unavailable; only automatic restore after reload is lost.
  }
}

export function getRememberedBandId(): string | null {
  try {
    return localStorage.getItem(BAND_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(device: HabilitateBluetoothDevice) {
  clearReconnectTimer();
  reconnectTimer = window.setTimeout(async () => {
    reconnectTimer = null;
    if (!reconnectWanted || useBandStore.getState().device !== device) return;
    try {
      await device.gatt?.connect();
      reconnectDelayMs = RECONNECT_MIN_MS;
      useBandStore.setState({ status: 'connected', error: null });
    } catch (error) {
      console.warn('[Wearable] Bluetooth reconnect attempt failed; retrying', error);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
      scheduleReconnect(device);
    }
  }, reconnectDelayMs);
}

function handleDisconnected(event: Event) {
  const device = event.target as unknown as HabilitateBluetoothDevice;
  if (useBandStore.getState().device !== device) return;
  if (!reconnectWanted) {
    useBandStore.setState({ status: 'disconnected' });
    return;
  }
  console.warn('[Wearable] Bluetooth link to the band dropped; reconnecting');
  useBandStore.setState({ status: 'reconnecting' });
  reconnectDelayMs = RECONNECT_MIN_MS;
  scheduleReconnect(device);
}

function adoptDevice(device: HabilitateBluetoothDevice, bandId: string) {
  if (!watchedDevices.has(device)) {
    device.addEventListener('gattserverdisconnected', handleDisconnected);
    watchedDevices.add(device);
  }
  clearReconnectTimer();
  reconnectWanted = true;
  reconnectDelayMs = RECONNECT_MIN_MS;
  rememberBandId(bandId);
  useBandStore.setState({ device, bandId, status: 'connected', error: null });
}

// Opens the browser's device picker. Must run from a user gesture.
export async function connectBandWithPicker() {
  useBandStore.setState({ status: 'connecting', error: null });
  try {
    const { device, bandId } = await connectToHabilitateBand();
    adoptDevice(device, bandId);
    return { device, bandId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to connect to the therapy band.';
    useBandStore.setState({ status: 'error', error: message });
    throw error;
  }
}

// Restores a band this origin already authorised, without a picker.
// Only possible where the browser offers getDevices().
export async function restoreBand(): Promise<boolean> {
  if (useBandStore.getState().device) return true;
  const restored = await reconnectToAuthorizedHabilitateBand(getRememberedBandId());
  if (!restored) return false;
  adoptDevice(restored.device, restored.bandId);
  return true;
}

export function disconnectBand() {
  reconnectWanted = false;
  clearReconnectTimer();
  disconnectFromHabilitateBand(useBandStore.getState().device);
  useBandStore.setState({ device: null, bandId: null, status: 'disconnected', error: null });
}

// Disconnects and forgets the current band: the remembered ID is cleared
// and, where the browser supports it, its Bluetooth permission revoked,
// so nothing reconnects it until it is picked again.
export async function forgetBand() {
  const { device } = useBandStore.getState();
  disconnectBand();
  try {
    localStorage.removeItem(BAND_ID_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing was remembered.
  }
  if (device?.forget) {
    try {
      await device.forget();
    } catch (error) {
      // The band is already disconnected and unremembered; a failed
      // permission revoke only means Chrome still lists it as allowed.
      console.warn('[Wearable] Bluetooth forget() failed', error);
    }
  }
}

// Forgets the current band and opens the device picker for another one.
// Must run from a user gesture, like connectBandWithPicker().
export async function changeBand() {
  await forgetBand();
  return connectBandWithPicker();
}

// Returns a connected device, reconnecting the known one if needed.
async function ensureConnected(): Promise<HabilitateBluetoothDevice | null> {
  const { device } = useBandStore.getState();
  if (!device) {
    return (await restoreBand()) ? useBandStore.getState().device : null;
  }
  if (device.gatt?.connected) return device;
  await device.gatt?.connect();
  clearReconnectTimer();
  useBandStore.setState({ status: 'connected', error: null });
  return device;
}

export type SessionSyncResult = 'sent' | 'no-band' | 'unreachable';

export async function sendBandSessionState(
  state: WearableSessionState,
): Promise<SessionSyncResult> {
  const hadDevice = !!useBandStore.getState().device;
  if (!hadDevice && !getRememberedBandId()) return 'no-band';

  try {
    const device = await ensureConnected();
    if (!device) {
      console.warn(
        '[Wearable] session state not sent: no Bluetooth connection to the band ' +
          '(reconnect it from the session header)',
        state,
      );
      return 'unreachable';
    }
    await setWearableSessionState(device, state);
    return 'sent';
  } catch (error) {
    console.warn('[Wearable] session state not sent', state, error);
    return 'unreachable';
  }
}
