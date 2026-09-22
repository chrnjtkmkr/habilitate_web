import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  provisionWiFi,
  readWiFiStatus,
  scanWiFiNetworks,
  type WiFiNetwork,
} from '../services/bleService';
import {
  describeWifiStatus,
  WIFI_STATUS_TIMEOUT,
} from '../services/wifiStatus';
import {
  changeBand as changeBandInStore,
  connectBandWithPicker,
  disconnectBand,
  forgetBand as forgetBandInStore,
  restoreBand,
  useBandStore,
} from '../lib/bandStore';

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
  // The Bluetooth connection itself lives in bandStore, so it survives
  // this card unmounting when a session goes live. This hook adds the
  // Wi-Fi setup state the card needs.
  const device = useBandStore((s) => s.device);
  const bandId = useBandStore((s) => s.bandId);
  const linkStatus = useBandStore((s) => s.status);
  const error = useBandStore((s) => s.error);

  const status: WearableStatus =
    linkStatus === 'reconnecting' ? 'connecting' : linkStatus;

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
  // MANUAL BLE CONNECTION (opens the browser's device picker)
  // ==========================================================

  const connect = useCallback(
    () => connectBandWithPicker(),
    [],
  );

  // ==========================================================
  // AUTOMATIC RESTORATION
  // ==========================================================
  // Reuses the page's existing connection, or silently restores
  // a band this origin already authorised where the browser
  // supports it. Never opens the picker.

  const restoreConnection = useCallback(async () => {
    try {
      return await restoreBand();
    } catch {
      // Best effort: the card still offers "Connect via Bluetooth".
      return false;
    }
  }, []);

  useEffect(() => {
    void restoreConnection();
  }, [restoreConnection]);

  // Read the band's Wi-Fi status whenever the link comes up,
  // including after an automatic reconnect.
  useEffect(() => {
    if (!device || linkStatus !== 'connected') return;
    let cancelled = false;
    readWiFiStatus(device)
      .then((current) => {
        if (cancelled) return;
        setWifiStatus(current);
        setWifiError(null);
      })
      .catch((err: unknown) => {
        // The Bluetooth link can still be fine; only the read failed.
        if (cancelled) return;
        setWifiError(
          err instanceof Error
            ? err.message
            : 'Unable to read Wi-Fi status.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [device, linkStatus]);

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
  // MANUAL DISCONNECT
  // ==========================================================
  // wifiStatus is kept on purpose: the band keeps its Wi-Fi
  // credentials after Bluetooth disconnects.

  const disconnect = useCallback(() => {
    disconnectBand();
  }, []);

  // ==========================================================
  // FORGET / CHANGE BAND
  // ==========================================================
  // Nothing from the previous band's Wi-Fi setup carries over.

  const resetWifiState = useCallback(() => {
    setWifiStatus('NO_CREDENTIALS');
    setWifiError(null);
    setWifiNetworks([]);
    setWifiScanStatus('idle');
    setWifiScanError(null);
  }, []);

  const forgetBand = useCallback(async () => {
    await forgetBandInStore();
    resetWifiState();
  }, [resetWifiState]);

  // Opens the browser's device picker, so it must run from a click.
  const changeBand = useCallback(async () => {
    resetWifiState();
    return changeBandInStore();
  }, [resetWifiState]);

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
    forgetBand,
    changeBand,
    restoreConnection,
    checkWiFiStatus,
    scanWiFi,
    configureWiFi,
  };
}
