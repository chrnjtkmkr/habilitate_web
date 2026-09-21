import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '../Button';
import Modal from '../Modal';
import Pill from '../Pill';

import { useWearable } from '../../hooks/useWearable';
import {
  describeWifiStatus,
  isValidWifiPassword,
} from '../../services/wifiStatus';

export default function DeviceSetupCard() {
  const { t } = useTranslation();

  const [open, setOpen] =
    useState(false);

  // Shows the Wi-Fi setup form while the band is already online, so
  // it can be moved to another network without a power cycle.
  const [changingWifi, setChangingWifi] =
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
    if (
      !selectedSSID ||
      !isValidWifiPassword(password)
    ) {
      return;
    }

    try {
      const result = await configureWiFi(
        selectedSSID,
        password,
      );

      if (
        describeWifiStatus(result).outcome ===
        'connected'
      ) {
        setChangingWifi(false);
        setSelectedSSID('');
        setPassword('');
      }
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

  const wifiInfo =
    describeWifiStatus(wifiStatus);

  const passwordValid =
    isValidWifiPassword(password);

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
                  {t(wifiInfo.labelKey)}
                </p>
              </div>
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
              WIFI STATUS
              ================================================= */}

          {isConnected && (
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-primary">
                    {t('band_wifi_status_title')}
                  </p>

                  <p className="mt-1 text-xs text-ink-secondary">
                    {t(wifiInfo.detailKey)}
                  </p>
                </div>

                <Pill variant={wifiInfo.tone}>
                  {t(wifiInfo.labelKey)}
                </Pill>
              </div>

              {wifiReady && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setChangingWifi(
                        (current) => !current,
                      )
                    }
                    disabled={wifiProvisioning}
                  >
                    {changingWifi
                      ? t('band_wifi_keep_current')
                      : t('band_wifi_change')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* =================================================
              WIFI SETUP
              ================================================= */}

          {isConnected &&
            (!wifiReady || changingWifi) && (
              <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                <div>
                  <h4 className="font-medium text-ink-primary">
                    {t('band_wifi_setup_title')}
                  </h4>

                  <p className="mt-1 text-sm leading-5 text-ink-secondary">
                    {t('band_wifi_setup_hint')}
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
                      ? t('band_wifi_scanning')
                      : wifiNetworks.length >
                          0
                        ? t('band_wifi_refresh')
                        : t('band_wifi_scan')}
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
                      {t('band_wifi_nearby')}
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
                              disabled={network.enterprise}
                              onClick={() => {
                                setSelectedSSID(
                                  network.ssid,
                                );

                                setPassword(
                                  '',
                                );
                              }}
                              className={`w-full rounded-xl border p-3 text-left transition ${
                                network.enterprise
                                  ? 'cursor-not-allowed border-border bg-background opacity-60'
                                  : selected
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
                                    {network.enterprise
                                      ? t('band_wifi_enterprise_unsupported')
                                      : `${getSignalLabel(network.rssi)} · ${network.rssi} dBm`}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {network.secure && (
                                    <span
                                      className="text-xs text-ink-secondary"
                                      aria-label={t('band_wifi_secured')}
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
                        {t('band_wifi_selected')}
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
                        {t('band_wifi_password')}
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
                        placeholder={t('band_wifi_password_placeholder')}
                        aria-invalid={!passwordValid}
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-secondary focus:border-ink-primary"
                      />

                      {!passwordValid && (
                        <p className="mt-1 text-xs text-danger">
                          {t('band_wifi_password_invalid')}
                        </p>
                      )}
                    </div>

                    {/* CONNECT WIFI */}

                    <Button
                      className="w-full"
                      onClick={
                        handleConfigureWiFi
                      }
                      disabled={
                        wifiProvisioning ||
                        !selectedSSID ||
                        !passwordValid
                      }
                    >
                      {wifiProvisioning
                        ? t('band_wifi_connecting')
                        : t('band_wifi_connect')}
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