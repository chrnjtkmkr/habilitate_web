import {
  useCallback,
  useEffect,
  useRef,
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

import { supabase } from '../lib/supabase';

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
  // ISSUE 1: DEVICE ONLINE STATE (cross-device visibility)
  // ==========================================================
  // Polls sensor_devices.is_online for the current bandId.
  // When the band is connected from another browser/device,
  // is_online will be true even though this session has no
  // BLE connection — the UI can then show a warning banner.
  // ==========================================================

  const [bandIsOnlineElsewhere, setBandIsOnlineElsewhere] =
    useState(false);

  const [bandOnlineSince, setBandOnlineSince] =
    useState<string | null>(null);

  const fetchBandOnlineState = useCallback(
    async (id: string) => {
      try {
        const { data } = await supabase
          .from('sensor_devices')
          .select('is_online, online_since')
          .eq('device_uid', id)
          .maybeSingle();

        if (data) {
          // The band is considered "online elsewhere" when the
          // DB shows it is online but this session does not
          // have an active BLE + WebSocket connection.
          setBandIsOnlineElsewhere(
            status !== 'connected' ? (data.is_online ?? false) : false
          );
          setBandOnlineSince(data.online_since ?? null);
        }
      } catch {
        // Polling errors are silent — do not disrupt the UI.
      }
    },
    [status],
  );

  // Subscribe to real-time updates when we know the bandId
  useEffect(() => {
    if (!bandId) {
      setBandIsOnlineElsewhere(false);
      setBandOnlineSince(null);
      return;
    }

    // Fetch immediately
    void fetchBandOnlineState(bandId);

    const subscription = supabase
      .channel(`sensor_devices:${bandId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sensor_devices',
          filter: `device_uid=eq.${bandId}`,
        },
        (payload) => {
          const isOnline = payload.new.is_online;
          const onlineSince = payload.new.online_since;
          
          setBandIsOnlineElsewhere(
             status !== 'connected' ? (isOnline ?? false) : false
          );
          setBandOnlineSince(onlineSince ?? null);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [bandId, status, fetchBandOnlineState]);

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

          // The ESP32 needs some time to process the
          // credentials and begin connecting.
          await new Promise<void>(
            (resolve) =>
              setTimeout(
                resolve,
                1000,
              ),
          );

          // Poll instead of doing only one status read.
          //
          // ESP32 may still be connecting when the first
          // status request arrives.
          const maxAttempts = 15;

          let finalStatus =
            'CONNECTING';

          for (
            let attempt = 0;
            attempt < maxAttempts;
            attempt++
          ) {
            finalStatus =
              await readWiFiStatus(
                device,
              );

            setWifiStatus(
              finalStatus,
            );

            if (
              finalStatus ===
                'CONNECTED' ||
              finalStatus ===
                'FAILED' ||
              finalStatus ===
                'INVALID' ||
              finalStatus ===
                'NO_CREDENTIALS'
            ) {
              break;
            }

            await new Promise<void>(
              (resolve) =>
                setTimeout(
                  resolve,
                  1000,
                ),
            );
          }

          // If it never reached a final state,
          // report timeout.
          if (
            finalStatus ===
              'CONNECTING'
          ) {
            finalStatus =
              'TIMEOUT';

            setWifiStatus(
              finalStatus,
            );
          }

          if (
            finalStatus !==
            'CONNECTED'
          ) {
            const message =
              finalStatus ===
              'TIMEOUT'
                ? 'Wi-Fi connection timed out. Please try again.'
                : `Wi-Fi connection failed: ${finalStatus}`;

            setWifiError(
              message,
            );
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

    // Issue 1: cross-device band visibility
    bandIsOnlineElsewhere,
    bandOnlineSince,

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