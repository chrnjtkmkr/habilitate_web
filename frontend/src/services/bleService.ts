// ============================================================
// HABILITATE BLE SERVICE
// ============================================================
// BLE is used for:
// 1. Device discovery
// 2. Band ID
// 3. Wi-Fi provisioning
// 4. Wi-Fi status
// 5. Wi-Fi network scanning
//
// Normal sensor streaming will later move to Wi-Fi/WSS.
// ============================================================

export const HABILITATE_SERVICE_UUID =
  '7b7a0001-5a7d-4f4c-9f5e-7a3d6b9e1001';

export const BAND_ID_CHARACTERISTIC_UUID =
  '7b7a0002-5a7d-4f4c-9f5e-7a3d6b9e1001';

export const SENSOR_CHARACTERISTIC_UUID =
  '7b7a0003-5a7d-4f4c-9f5e-7a3d6b9e1001';

export const WIFI_CONFIG_CHARACTERISTIC_UUID =
  '7b7a0004-5a7d-4f4c-9f5e-7a3d6b9e1001';

export const WIFI_STATUS_CHARACTERISTIC_UUID =
  '7b7a0005-5a7d-4f4c-9f5e-7a3d6b9e1001';

export const WIFI_SCAN_REQUEST_CHARACTERISTIC_UUID =
  '7b7a0006-5a7d-4f4c-9f5e-7a3d6b9e1001';

export const WIFI_SCAN_RESULTS_CHARACTERISTIC_UUID =
  '7b7a0007-5a7d-4f4c-9f5e-7a3d6b9e1001';

export const SESSION_STATE_CHARACTERISTIC_UUID =
  '7b7a0008-5a7d-4f4c-9f5e-7a3d6b9e1001';

// ============================================================
// LOCAL TYPES
// ============================================================
// We intentionally define the small subset of Web Bluetooth
// types needed by Habilitate instead of depending on the
// browser's global Bluetooth TypeScript definitions.
// ============================================================

export interface HabilitateBluetoothCharacteristic {
  readValue(): Promise<DataView>;

  writeValue(value: BufferSource): Promise<void>;

  startNotifications(): Promise<HabilitateBluetoothCharacteristic>;

  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: Event) => void,
  ): void;

  removeEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: Event) => void,
  ): void;
}

export interface HabilitateBluetoothService {
  getCharacteristic(
    uuid: string,
  ): Promise<HabilitateBluetoothCharacteristic>;
}

export interface HabilitateBluetoothGattServer {
  connected: boolean;

  connect(): Promise<HabilitateBluetoothGattServer>;

  getPrimaryService(
    uuid: string,
  ): Promise<HabilitateBluetoothService>;

  disconnect(): void;
}

export interface HabilitateBluetoothDevice {
  id: string;

  name?: string;

  gatt?: HabilitateBluetoothGattServer;

  addEventListener(
    type: 'gattserverdisconnected',
    listener: (event: Event) => void,
  ): void;

  removeEventListener(
    type: 'gattserverdisconnected',
    listener: (event: Event) => void,
  ): void;
}

interface HabilitateBluetoothAPI {
  requestDevice(options: {
    filters: Array<{
      services: string[];
    }>;

    optionalServices?: string[];
  }): Promise<HabilitateBluetoothDevice>;

  getDevices?(): Promise<HabilitateBluetoothDevice[]>;
}

// ============================================================
// WIFI TYPES
// ============================================================

export interface WiFiNetwork {
  ssid: string;
  rssi: number;
  secure: boolean;
  // 802.1X network; the band cannot join these (firmware 0.4.1+).
  enterprise: boolean;
  channel?: number;
}

// ============================================================
// WEB BLUETOOTH ACCESS
// ============================================================

function getBluetooth(): HabilitateBluetoothAPI {
  if (
    typeof navigator === 'undefined' ||
    !('bluetooth' in navigator)
  ) {
    throw new Error(
      'Web Bluetooth is not available in this browser.',
    );
  }

  return (
    navigator as Navigator & {
      bluetooth: HabilitateBluetoothAPI;
    }
  ).bluetooth;
}

// ============================================================
// TEXT DECODER
// ============================================================

const textDecoder = new TextDecoder();

function decodeDataView(value: DataView): string {
  return textDecoder.decode(value).replace(/\0/g, '').trim();
}

// ============================================================
// CONNECT - MANUAL FIRST-TIME SETUP
// ============================================================
// This opens the browser's Bluetooth device chooser.
// It must normally be triggered by a user action.
// ============================================================

export async function connectToHabilitateBand(): Promise<{
  device: HabilitateBluetoothDevice;
  bandId: string;
}> {
  const bluetooth = getBluetooth();

  const device = await bluetooth.requestDevice({
    filters: [
      {
        services: [HABILITATE_SERVICE_UUID],
      },
    ],
    optionalServices: [HABILITATE_SERVICE_UUID],
  });

  if (!device.gatt) {
    throw new Error(
      'The selected Habilitate band does not support GATT.',
    );
  }

  const server = device.gatt.connected
    ? device.gatt
    : await device.gatt.connect();

  const service =
    await server.getPrimaryService(
      HABILITATE_SERVICE_UUID,
    );

  const bandIdCharacteristic =
    await service.getCharacteristic(
      BAND_ID_CHARACTERISTIC_UUID,
    );

  const value =
    await bandIdCharacteristic.readValue();

  const bandId = decodeDataView(value);

  if (!bandId) {
    throw new Error(
      'Unable to read the Habilitate Band ID.',
    );
  }

  return {
    device,
    bandId,
  };
}

// ============================================================
// AUTO RECONNECT TO PREVIOUSLY AUTHORIZED DEVICE
// ============================================================
// IMPORTANT:
//
// requestDevice() opens the Bluetooth chooser.
//
// getDevices() returns devices that this browser origin has
// already been granted access to.
//
// This is what fixes the repeated setup problem.
// ============================================================

export async function reconnectToAuthorizedHabilitateBand(
  preferredBandId?: string | null,
): Promise<{
  device: HabilitateBluetoothDevice;
  bandId: string;
} | null> {
  try {
    const bluetooth = getBluetooth();

    if (!bluetooth.getDevices) {
      // Browser does not support automatic restoration.
      return null;
    }

    const authorizedDevices =
      await bluetooth.getDevices();

    if (!authorizedDevices.length) {
      return null;
    }

    // If we previously connected to a specific band,
    // prefer that exact device.
    let device: HabilitateBluetoothDevice | undefined;

    if (preferredBandId) {
      device = authorizedDevices.find(
        (candidate) =>
          candidate.name ===
          `Habilitate-${preferredBandId}`,
      );
    }

    // Otherwise look for any Habilitate band.
    if (!device) {
      device = authorizedDevices.find(
        (candidate) =>
          candidate.name?.startsWith('Habilitate-'),
      );
    }

    if (!device || !device.gatt) {
      return null;
    }

    const server = device.gatt.connected
      ? device.gatt
      : await device.gatt.connect();

    const service =
      await server.getPrimaryService(
        HABILITATE_SERVICE_UUID,
      );

    const bandIdCharacteristic =
      await service.getCharacteristic(
        BAND_ID_CHARACTERISTIC_UUID,
      );

    const value =
      await bandIdCharacteristic.readValue();

    const bandId = decodeDataView(value);

    if (!bandId) {
      return null;
    }

    return {
      device,
      bandId,
    };
  } catch (error) {
    // Automatic restoration is intentionally best-effort: if it
    // fails, the UI still offers "Connect via Bluetooth". The
    // reason is logged because callers such as session-state sync
    // depend on this succeeding without a user gesture.
    console.warn('[Wearable] Bluetooth reconnect failed', error);
    return null;
  }
}

// ============================================================
// DISCONNECT
// ============================================================

export function disconnectFromHabilitateBand(
  device: HabilitateBluetoothDevice | null,
): void {
  if (!device?.gatt) {
    return;
  }

  if (device.gatt.connected) {
    device.gatt.disconnect();
  }
}

// ============================================================
// GET BLE SERVICE
// ============================================================

async function getHabilitateService(
  device: HabilitateBluetoothDevice,
): Promise<HabilitateBluetoothService> {
  if (!device.gatt) {
    throw new Error(
      'Habilitate band does not expose a GATT server.',
    );
  }

  const server = device.gatt.connected
    ? device.gatt
    : await device.gatt.connect();

  return server.getPrimaryService(
    HABILITATE_SERVICE_UUID,
  );
}

// ============================================================
// PROVISION WIFI
// ============================================================

export async function provisionWiFi(
  device: HabilitateBluetoothDevice,
  ssid: string,
  password: string,
): Promise<void> {
  const service =
    await getHabilitateService(device);

  const characteristic =
    await service.getCharacteristic(
      WIFI_CONFIG_CHARACTERISTIC_UUID,
    );

  const payload = JSON.stringify({
    ssid,
    password,
  });

  const encoder = new TextEncoder();

  await characteristic.writeValue(
    encoder.encode(payload),
  );
}

// ============================================================
// READ WIFI STATUS
// ============================================================

export async function readWiFiStatus(
  device: HabilitateBluetoothDevice,
): Promise<string> {
  const service =
    await getHabilitateService(device);

  const characteristic =
    await service.getCharacteristic(
      WIFI_STATUS_CHARACTERISTIC_UUID,
    );

  const value =
    await characteristic.readValue();

  return decodeDataView(value);
}

// ============================================================
// SESSION STATE
// ============================================================
// The browser sends the therapy-session state over the same
// already-authorized BLE connection used for device setup.
// This is control-plane traffic only; sensor streaming remains
// ESP32 -> Wi-Fi/WSS -> Supabase Edge Function.
// ============================================================

export type WearableSessionState =
  | 'ACTIVE'
  | 'RESUME'
  | 'PAUSE'
  | 'STOPPED';

export async function setWearableSessionState(
  device: HabilitateBluetoothDevice,
  state: WearableSessionState,
): Promise<void> {
  const service = await getHabilitateService(device);
  const characteristic = await service.getCharacteristic(
    SESSION_STATE_CHARACTERISTIC_UUID,
  );

  await characteristic.writeValue(
    new TextEncoder().encode(state),
  );
}

// ============================================================
// SCAN WIFI NETWORKS
// ============================================================

export async function scanWiFiNetworks(
  device: HabilitateBluetoothDevice,
): Promise<WiFiNetwork[]> {
  const service =
    await getHabilitateService(device);

  const requestCharacteristic =
    await service.getCharacteristic(
      WIFI_SCAN_REQUEST_CHARACTERISTIC_UUID,
    );

  const resultsCharacteristic =
    await service.getCharacteristic(
      WIFI_SCAN_RESULTS_CHARACTERISTIC_UUID,
    );

  const networks = new Map<
    string,
    WiFiNetwork
  >();

  return new Promise(async (resolve, reject) => {
    let finished = false;

    const cleanup = () => {
      resultsCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        handleScanResult,
      );
    };

    const finish = (
      result?: WiFiNetwork[],
      error?: Error,
    ) => {
      if (finished) {
        return;
      }

      finished = true;

      cleanup();

      if (error) {
        reject(error);
        return;
      }

      resolve(result ?? []);
    };

    const timeout = window.setTimeout(() => {
      finish(
        undefined,
        new Error(
          'Wi-Fi scan timed out. Please try again.',
        ),
      );
    }, 20000);

    const handleScanResult = (event: Event) => {
      try {
        const target = event.target as {
          value?: DataView | null;
        };

        const value = target.value;

        if (!value) {
          return;
        }

        const message =
          decodeDataView(value);

        if (!message) {
          return;
        }

        const data = JSON.parse(message);

        if (data.type === 'network') {
          const network: WiFiNetwork = {
            ssid: String(data.ssid ?? ''),
            rssi: Number(data.rssi ?? -100),
            secure: Boolean(data.secure),
            enterprise: Boolean(data.enterprise),
            channel:
              data.channel !== undefined
                ? Number(data.channel)
                : undefined,
          };

          if (!network.ssid) {
            return;
          }

          const existing =
            networks.get(network.ssid);

          if (
            !existing ||
            network.rssi > existing.rssi
          ) {
            networks.set(
              network.ssid,
              network,
            );
          }
        }

        if (data.type === 'error') {
          window.clearTimeout(timeout);

          finish(
            undefined,
            new Error(
              data.message ||
                'Wi-Fi scan failed.',
            ),
          );

          return;
        }

        if (data.type === 'end') {
          window.clearTimeout(timeout);

          const sortedNetworks =
            Array.from(networks.values()).sort(
              (a, b) => b.rssi - a.rssi,
            );

          finish(sortedNetworks);
        }
      } catch (error) {
        window.clearTimeout(timeout);

        finish(
          undefined,
          error instanceof Error
            ? error
            : new Error(
                'Invalid Wi-Fi scan response.',
              ),
        );
      }
    };

    try {
      await resultsCharacteristic.startNotifications();

      resultsCharacteristic.addEventListener(
        'characteristicvaluechanged',
        handleScanResult,
      );

      const encoder = new TextEncoder();

      await requestCharacteristic.writeValue(
        encoder.encode('SCAN'),
      );
    } catch (error) {
      window.clearTimeout(timeout);

      finish(
        undefined,
        error instanceof Error
          ? error
          : new Error(
              'Unable to start Wi-Fi scan.',
            ),
      );
    }
  });
}