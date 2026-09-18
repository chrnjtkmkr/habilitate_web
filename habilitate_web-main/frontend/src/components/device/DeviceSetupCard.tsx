import { useState } from 'react';

import Button from '../Button';
import Modal from '../Modal';
import Pill from '../Pill';

import { useWearable } from '../../hooks/useWearable';

export default function DeviceSetupCard() {
  const [open, setOpen] =
    useState(false);

  const [selectedSSID, setSelectedSSID] =
    useState('');

  const [password, setPassword] =
    useState('');

const {
  status,
  bandId,
  error,
  isConnected,

  bandIsOnlineElsewhere,
  bandOnlineSince,

  wifiStatus,
  wifiReady,
  wifiError,
  wifiProvisioning,

  wifiNetworks,
  wifiScanning,
  wifiScanError,

  connect,
  scanWiFi,
  configureWiFi,
} = useWearable();

  // ==========================================================
  // CONNECT BLE
  // ==========================================================

  async function handleConnect() {
    try {
      await connect();
    } catch {
      // Error is already stored in useWearable.
    }
  }

  // ==========================================================
  // SCAN WIFI
  // ==========================================================

  async function handleScanWiFi() {
    try {
      await scanWiFi();
    } catch {
      // Error is already stored in useWearable.
    }
  }

  // ==========================================================
  // CONFIGURE WIFI
  // ==========================================================

  async function handleConfigureWiFi() {
    if (!selectedSSID) {
      return;
    }

    try {
      await configureWiFi(
        selectedSSID,
        password,
      );
    } catch {
      // Error is already stored in useWearable.
    }
  }

  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  function handleClose() {
    if (
      status ===
        'connecting' ||
      wifiProvisioning ||
      wifiScanning
    ) {
      return;
    }

    setOpen(false);
  }

  // ==========================================================
  // SIGNAL LABEL
  // ==========================================================

  function getSignalLabel(
    rssi: number,
  ) {
    if (rssi >= -50) {
      return 'Excellent signal';
    }

    if (rssi >= -65) {
      return 'Good signal';
    }

    if (rssi >= -75) {
      return 'Fair signal';
    }

    return 'Weak signal';
  }

  // ==========================================================
  // MAIN CARD STATUS
  // ==========================================================

  const deviceReady =
    isConnected &&
    wifiReady;

  return (
    <>
      {/* =====================================================
          MAIN DEVICE CARD
          ===================================================== */}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-medium text-ink-primary">
              Therapy band
            </h3>

            <p className="mt-1 text-sm text-ink-secondary">
              {deviceReady
                ? `Band ${bandId} is connected and ready for the session.`
                : isConnected
                  ? `Band ${bandId} is connected.`
                  : 'Connect a Habilitate therapy band before starting this session.'}
            </p>
          </div>

          <Pill
            variant={
              deviceReady
                ? 'success'
                : isConnected
                  ? 'success'
                  : status ===
                      'connecting'
                    ? 'warning'
                    : status ===
                        'error'
                      ? 'danger'
                      : 'neutral'
            }
          >
            {deviceReady
              ? 'Ready'
              : isConnected
                ? 'Connected'
                : status ===
                    'connecting'
                  ? 'Connecting'
                  : status ===
                      'error'
                    ? 'Error'
                    : 'Not connected'}
          </Pill>
        </div>

        {/* ===================================================
            BAND INFORMATION
            =================================================== */}

        {isConnected &&
          bandId && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3">
              <div>
                <p className="text-xs text-ink-secondary">
                  Band ID
                </p>

                <p className="font-medium text-ink-primary">
                  {bandId}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-ink-secondary">
                  Wi-Fi
                </p>

                <p
                  className={
                    wifiReady
                      ? 'font-medium text-ink-primary'
                      : 'font-medium text-ink-secondary'
                  }
                >
                  {wifiReady
                    ? 'Connected'
                    : wifiStatus ||
                      'Checking...'}
                </p>
              </div>
            </div>
          )}

        {/* ===================================================
            ISSUE 1: BAND IN USE ELSEWHERE
            =================================================== */}

        {bandIsOnlineElsewhere && (
          <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
            <p className="text-sm font-medium text-ink-primary">
              Band already in use
            </p>

            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              Band {bandId ?? 'this device'} is currently
              streaming data from another session
              {bandOnlineSince
                ? ` (since ${new Date(bandOnlineSince).toLocaleTimeString()})`
                : ''}.
              You can still connect via Bluetooth to configure
              it, but data transmission will remain active on
              the other device until that session ends.
            </p>
          </div>
        )}

        {/* ===================================================
            READY MESSAGE
            =================================================== */}

        {deviceReady && (
          <div className="mt-3 rounded-xl border border-success/20 bg-success/5 p-3">
            <p className="text-sm font-medium text-ink-primary">
              Device ready
            </p>

            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              Your therapy band is already configured.
              You do not need to scan for Wi-Fi or enter
              the password again.
            </p>
          </div>
        )}

        {/* ===================================================
            ACTION BUTTONS
            =================================================== */}

        <div className="mt-3 flex items-center justify-end gap-2">
          {isConnected && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setOpen(true)
              }
            >
              Device settings
            </Button>
          )}

          {!isConnected && (
            <Button
              onClick={() =>
                setOpen(true)
              }
              disabled={
                status ===
                'connecting'
              }
            >
              {status ===
              'connecting'
                ? 'Connecting...'
                : 'Set up a device'}
            </Button>
          )}
        </div>
      </div>

      {/* =====================================================
          DEVICE SETUP MODAL
          ===================================================== */}

      <Modal
        open={open}
        onClose={handleClose}
        title="Set up a therapy band"
      >
        <div className="space-y-5">

          {/* =================================================
              AUTOMATICALLY CONNECTED STATE
              ================================================= */}

          {deviceReady && (
            <div className="rounded-xl border border-success/20 bg-success/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success">
                    ✓
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-ink-primary">
                    Device already connected
                  </h4>

                  <p className="mt-1 text-sm leading-5 text-ink-secondary">
                    Your Habilitate band was automatically
                    restored. It is already connected to
                    Wi-Fi and ready for the session.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-ink-secondary">
                    Band ID
                  </p>

                  <p className="mt-1 font-medium text-ink-primary">
                    {bandId}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-ink-secondary">
                    Wi-Fi
                  </p>

                  <p className="mt-1 font-medium text-ink-primary">
                    Connected
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              NORMAL INSTRUCTIONS
              ================================================= */}

          {!deviceReady && (
            <div className="rounded-xl border border-border bg-background p-4">
              <h4 className="font-medium text-ink-primary">
                Connect your Habilitate band
              </h4>

              <p className="mt-1 text-sm leading-5 text-ink-secondary">
                Make sure the therapy band is powered on
                and nearby. Bluetooth will be used to
                identify and configure the device.
              </p>
            </div>
          )}

          {/* =================================================
              DEVICE STATUS
              ================================================= */}

          <div className="rounded-xl border border-dashed border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-primary">
                  Device status
                </p>

                <p className="mt-1 text-xs text-ink-secondary">
                  {deviceReady
                    ? `Connected to ${bandId} and ready.`
                    : isConnected
                      ? `Connected to ${bandId}.`
                      : status ===
                          'connecting'
                        ? 'Searching for your Habilitate band...'
                        : status ===
                            'error'
                          ? 'Connection failed.'
                          : 'Device setup has not started yet.'}
                </p>
              </div>

              <Pill
                variant={
                  deviceReady
                    ? 'success'
                    : isConnected
                      ? 'success'
                      : status ===
                          'connecting'
                        ? 'warning'
                        : status ===
                            'error'
                          ? 'danger'
                          : 'neutral'
                }
              >
                {deviceReady
                  ? 'Ready'
                  : isConnected
                    ? 'Connected'
                    : status ===
                        'connecting'
                      ? 'Connecting'
                      : status ===
                          'error'
                        ? 'Error'
                        : 'Not connected'}
              </Pill>
            </div>
          </div>

          {/* =================================================
              BAND ID
              ================================================= */}

          {isConnected &&
            bandId && (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs text-ink-secondary">
                  Connected Band ID
                </p>

                <p className="mt-1 text-lg font-semibold text-ink-primary">
                  {bandId}
                </p>
              </div>
            )}

          {/* =================================================
              ISSUE 1: BAND IN USE ELSEWHERE (modal)
              ================================================= */}

          {bandIsOnlineElsewhere && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                  ⚠
                </div>

                <div>
                  <h4 className="font-medium text-ink-primary">
                    Band already in use
                  </h4>

                  <p className="mt-1 text-sm leading-5 text-ink-secondary">
                    This band is currently streaming data from
                    another device or browser session
                    {bandOnlineSince
                      ? ` (online since ${new Date(bandOnlineSince).toLocaleTimeString()})`
                      : ''}.
                    You can still view and configure it here,
                    but sensor data will only transmit to one
                    session at a time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =================================================
              WIFI STATUS
              ================================================= */}

          {isConnected && (
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-primary">
                    Wi-Fi status
                  </p>

                  <p className="mt-1 text-xs text-ink-secondary">
                    {wifiReady
                      ? 'The therapy band is connected to the configured Wi-Fi network.'
                      : wifiStatus ===
                          'CONNECTING'
                        ? 'The therapy band is connecting to Wi-Fi...'
                        : 'Wi-Fi setup may be required.'}
                  </p>
                </div>

                <Pill
                  variant={
                    wifiReady
                      ? 'success'
                      : wifiStatus ===
                          'CONNECTING'
                        ? 'warning'
                        : wifiStatus ===
                              'FAILED'
                          ? 'danger'
                          : 'neutral'
                  }
                >
                  {wifiReady
                    ? 'Connected'
                    : wifiStatus}
                </Pill>
              </div>
            </div>
          )}

          {/* =================================================
              WIFI SETUP
              ================================================= */}

          {isConnected &&
            !wifiReady && (
              <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                <div>
                  <h4 className="font-medium text-ink-primary">
                    Wi-Fi setup
                  </h4>

                  <p className="mt-1 text-sm leading-5 text-ink-secondary">
                    Scan nearby networks and select the
                    Wi-Fi network used by this therapy
                    center.
                  </p>
                </div>

                {/* SCAN BUTTON */}

                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={
                      handleScanWiFi
                    }
                    disabled={
                      wifiScanning ||
                      wifiProvisioning
                    }
                  >
                    {wifiScanning
                      ? 'Scanning...'
                      : wifiNetworks.length >
                          0
                        ? 'Refresh'
                        : 'Scan nearby networks'}
                  </Button>
                </div>

                {/* SCAN ERROR */}

                {wifiScanError && (
                  <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                    {wifiScanError}
                  </div>
                )}

                {/* NETWORK LIST */}

                {wifiNetworks.length >
                  0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-ink-secondary">
                      Nearby networks
                    </p>

                    <div className="max-h-56 space-y-2 overflow-y-auto">
                      {wifiNetworks.map(
                        (network) => {
                          const selected =
                            selectedSSID ===
                            network.ssid;

                          return (
                            <button
                              key={`${network.ssid}-${network.channel ?? 'na'}`}
                              type="button"
                              onClick={() => {
                                setSelectedSSID(
                                  network.ssid,
                                );

                                setPassword(
                                  '',
                                );
                              }}
                              className={`w-full rounded-xl border p-3 text-left transition ${
                                selected
                                  ? 'border-ink-primary bg-background'
                                  : 'border-border bg-background hover:border-ink-secondary'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-ink-primary">
                                    {network.ssid}
                                  </p>

                                  <p className="mt-1 text-xs text-ink-secondary">
                                    {getSignalLabel(
                                      network.rssi,
                                    )}{' '}
                                    ·{' '}
                                    {network.rssi}{' '}
                                    dBm
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {network.secure && (
                                    <span
                                      className="text-xs text-ink-secondary"
                                      aria-label="Secured network"
                                    >
                                      🔒
                                    </span>
                                  )}

                                  {selected && (
                                    <span className="text-sm font-semibold text-ink-primary">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

                {/* SELECTED NETWORK */}

                {selectedSSID && (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="selected-wifi"
                        className="text-xs font-medium text-ink-secondary"
                      >
                        Selected network
                      </label>

                      <div
                        id="selected-wifi"
                        className="mt-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-primary"
                      >
                        {selectedSSID}
                      </div>
                    </div>

                    {/* PASSWORD */}

                    <div>
                      <label
                        htmlFor="wifi-password"
                        className="text-xs font-medium text-ink-secondary"
                      >
                        Wi-Fi password
                      </label>

                      <input
                        id="wifi-password"
                        type="password"
                        value={password}
                        onChange={(event) =>
                          setPassword(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Enter Wi-Fi password"
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-secondary focus:border-ink-primary"
                      />
                    </div>

                    {/* CONNECT WIFI */}

                    <Button
                      className="w-full"
                      onClick={
                        handleConfigureWiFi
                      }
                      disabled={
                        wifiProvisioning ||
                        !selectedSSID
                      }
                    >
                      {wifiProvisioning
                        ? 'Connecting ESP32 to Wi-Fi...'
                        : 'Connect ESP32 to Wi-Fi'}
                    </Button>
                  </div>
                )}

                {/* WIFI ERROR */}

                {wifiError && (
                  <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                    {wifiError}
                  </div>
                )}
              </div>
            )}

          {/* =================================================
              GENERAL ERROR
              ================================================= */}

          {error && (
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* =================================================
              FOOTER BUTTONS
              ================================================= */}

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={
                handleClose
              }
              disabled={
                status ===
                  'connecting' ||
                wifiProvisioning ||
                wifiScanning
              }
            >
              Cancel
            </Button>

            {deviceReady ? (
              <Button
                onClick={() =>
                  setOpen(false)
                }
              >
                Continue to Session
              </Button>
            ) : !isConnected ? (
              <Button
                onClick={
                  handleConnect
                }
                disabled={
                  status ===
                  'connecting'
                }
              >
                {status ===
                'connecting'
                  ? 'Connecting...'
                  : 'Connect via Bluetooth'}
              </Button>
            ) : (
              <Button
                onClick={() =>
                  setOpen(false)
                }
                disabled={
                  status ===
                  'connecting'
                }
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}