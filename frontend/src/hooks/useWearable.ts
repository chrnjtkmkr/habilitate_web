import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  connectToHabilitateBand,
  disconnectFromHabilitateBand,
  provisionWiFi,
  readWiFiStatus,
  reconnectToAuthorizedHabilitateBand,
  scanWiFiNetworks,
  type HabilitateBluetoothDevice,
  type WiFiNetwork,
} from '../services/bleService';
import {
  describeWifiStatus,
  WIFI_STATUS_TIMEOUT,
} from '../services/wifiStatus';

// How long configureWiFi() waits for a final status. A join takes up
// to 20 s on the band and the first server handshake several more.
const PROVISION_WAIT_MS = 45_000;
const PROVISION_POLL_MS = 1_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export type WearableStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export function useWearable() {
  const [status, setStatus] =
    useState<WearableStatus>('disconnected');

  const [bandId, setBandId] =
    useState<string | null>(null);

  const [device, setDevice] =
    useState<HabilitateBluetoothDevice | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  // ==========================================================
  // WIFI STATE
  // ==========================================================

  const [wifiStatus, setWifiStatus] =
    useState<string>('NO_CREDENTIALS');

  const [wifiError, setWifiError] =
    useState<string | null>(null);

  const [wifiProvisioning, setWifiProvisioning] =
    useState(false);

  const [wifiNetworks, setWifiNetworks] =
    useState<WiFiNetwork[]>([]);

  const [wifiScanning, setWifiScanning] =
    useState(false);

  const [wifiScanStatus, setWifiScanStatus] =
    useState<
      'idle' | 'scanning' | 'success' | 'error'
    >('idle');

  const [wifiScanError, setWifiScanError] =
    useState<string | null>(null);

  // ==========================================================
  // DERIVED WIFI READY STATE
  // ==========================================================

  const wifiReady =
    wifiStatus === 'CONNECTED';

  // ==========================================================
  // SAVE LAST BAND ID
  // ==========================================================

  const rememberBandId = useCallback(
    (id: string) => {
      try {
        localStorage.setItem(
          'habilitate.bandId',
          id,
        );
      } catch {
        // Ignore localStorage errors.
      }
    },
    [],
  );

  // ==========================================================
  // MANUAL BLE CONNECTION
  // ==========================================================

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    try {
      const connected =
        await connectToHabilitateBand();

      setDevice(connected.device);
      setBandId(connected.bandId);
      setStatus('connected');

      rememberBandId(
        connected.bandId,
      );

      // Immediately check existing Wi-Fi state.
      try {
        const currentWiFiStatus =
          await readWiFiStatus(
            connected.device,
          );

        setWifiStatus(
          currentWiFiStatus,
        );
      } catch {
        // BLE connection is still valid even if
        // Wi-Fi status could not be read.
      }

      return connected;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to connect to the therapy band.';

      setStatus('error');
      setError(message);

      throw err;
    }
  }, [rememberBandId]);

  // ==========================================================
  // AUTOMATIC RESTORATION
  // ==========================================================
  // Runs when the dashboard/card is mounted.
  //
  // It does NOT open the Bluetooth chooser.
  //
  // It only checks devices that were previously authorized
  // by this browser origin.
  // ==========================================================

  const restoreConnection =
    useCallback(async () => {
      try {
        setError(null);

        let preferredBandId: string | null =
          null;

        try {
          preferredBandId =
            localStorage.getItem(
              'habilitate.bandId',
            );
        } catch {
          // Ignore localStorage errors.
        }

        const restored =
          await reconnectToAuthorizedHabilitateBand(
            preferredBandId,
          );

        if (!restored) {
          return false;
        }

        setDevice(
          restored.device,
        );

        setBandId(
          restored.bandId,
        );

        setStatus('connected');

        rememberBandId(
          restored.bandId,
        );

        // Read Wi-Fi status immediately after BLE
        // restoration.
        try {
          const currentWiFiStatus =
            await readWiFiStatus(
              restored.device,
            );

          setWifiStatus(
            currentWiFiStatus,
          );
        } catch (wifiErr) {
          const message =
            wifiErr instanceof Error
              ? wifiErr.message
              : 'Unable to read Wi-Fi status.';

          setWifiError(message);
        }

        return true;
      } catch {
        // Auto restoration is best effort.
        //
        // Do not show a scary error because the user may
        // simply need to use the manual connection button.
        return false;
      }
    }, [rememberBandId]);

  // ==========================================================
  // AUTOMATIC RESTORE ON MOUNT
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const restored =
        await restoreConnection();

      if (cancelled || !restored) {
        return;
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [restoreConnection]);

  // ==========================================================
  // MANUAL WIFI STATUS CHECK
  // ==========================================================

  const checkWiFiStatus =
    useCallback(async () => {
      if (!device) {
        return 'NO_DEVICE';
      }

      try {
        const currentStatus =
          await readWiFiStatus(device);

        setWifiStatus(
          currentStatus,
        );

        setWifiError(null);

        return currentStatus;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to read Wi-Fi status.';

        setWifiError(message);

        throw err;
      }
    }, [device]);

  // ==========================================================
  // WIFI SCAN
  // ==========================================================

  const scanWiFi =
    useCallback(async () => {
      if (!device) {
        const message =
          'Connect the therapy band via Bluetooth first.';

        setWifiScanError(message);
        setWifiScanStatus('error');

        throw new Error(message);
      }

      setWifiScanning(true);
      setWifiScanStatus('scanning');
      setWifiScanError(null);

      try {
        const networks =
          await scanWiFiNetworks(device);

        setWifiNetworks(
          networks,
        );

        setWifiScanStatus('success');

        return networks;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to scan Wi-Fi networks.';

        setWifiScanError(message);
        setWifiScanStatus('error');

        throw err;
      } finally {
        setWifiScanning(false);
      }
    }, [device]);

  // ==========================================================
  // CONFIGURE WIFI
  // ==========================================================

  const configureWiFi =
    useCallback(
      async (
        ssid: string,
        password: string,
      ) => {
        if (!device) {
          throw new Error(
            'Connect the therapy band via Bluetooth first.',
          );
        }

        if (!ssid.trim()) {
          throw new Error(
            'Wi-Fi network name is required.',
          );
        }

        setWifiProvisioning(true);
        setWifiError(null);

        try {
          await provisionWiFi(
            device,
            ssid.trim(),
            password,
          );

          // The band restarts its connection as soon as it
          // receives the write, so the first read already
          // reflects the new network, never the old one.
          await sleep(PROVISION_POLL_MS);

          // Wait for a final status. Failure details are
          // shown from wifiStatus by the UI; wifiError is
          // reserved for Bluetooth/transport errors.
          const deadline =
            Date.now() + PROVISION_WAIT_MS;

          let finalStatus =
            await readWiFiStatus(device);
          setWifiStatus(finalStatus);

          while (
            describeWifiStatus(finalStatus)
              .outcome === 'pending' &&
            Date.now() < deadline
          ) {
            await sleep(PROVISION_POLL_MS);
            finalStatus =
              await readWiFiStatus(device);
            setWifiStatus(finalStatus);
          }

          if (
            describeWifiStatus(finalStatus)
              .outcome === 'pending'
          ) {
            finalStatus = WIFI_STATUS_TIMEOUT;
            setWifiStatus(finalStatus);
          }

          return finalStatus;
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Unable to configure Wi-Fi.';

          setWifiError(
            message,
          );

          throw err;
        } finally {
          setWifiProvisioning(
            false,
          );
        }
      },
      [device],
    );

  // ==========================================================
  // BLE DISCONNECTION HANDLER
  // ==========================================================

  useEffect(() => {
    if (!device) {
      return;
    }

    const handleDisconnected =
      () => {
        setDevice(null);
        setBandId(null);
        setStatus(
          'disconnected',
        );

        // IMPORTANT:
        //
        // Do NOT change wifiStatus to NO_CREDENTIALS.
        //
        // BLE disconnection does NOT mean that the ESP32
        // forgot its Wi-Fi credentials.
      };

    device.addEventListener(
      'gattserverdisconnected',
      handleDisconnected,
    );

    return () => {
      device.removeEventListener(
        'gattserverdisconnected',
        handleDisconnected,
      );
    };
  }, [device]);

  // ==========================================================
  // MANUAL DISCONNECT
  // ==========================================================

  const disconnect =
    useCallback(() => {
      disconnectFromHabilitateBand(
        device,
      );

      setDevice(null);
      setBandId(null);
      setStatus(
        'disconnected',
      );
      setError(null);

      // We intentionally do NOT clear:
      //
      // wifiStatus
      //
      // because Wi-Fi credentials remain stored on the ESP32.
    }, [device]);

  // ==========================================================
  // RETURN API
  // ==========================================================

  return {
    status,
    bandId,
    device,
    error,

    isConnected:
      status ===
        'connected' &&
      !!device &&
      !!bandId,

    wifiStatus,
    wifiReady,
    wifiError,
    wifiProvisioning,

    wifiNetworks,
    wifiScanning,
    wifiScanStatus,
    wifiScanError,

    connect,
    disconnect,
    restoreConnection,
    checkWiFiStatus,
    scanWiFi,
    configureWiFi,
  };
}