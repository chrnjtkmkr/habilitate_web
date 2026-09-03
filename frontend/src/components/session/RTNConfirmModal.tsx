import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useConfirmProbe, useVoidProbe } from '../../lib/queries/probes';
import Button from '../Button';

/**
 * RTNConfirmModal
 *
 * Non-blocking top-right toast that slides in from the right edge whenever
 * the ResponseToNameDetector fires a candidate during a live session.
 *
 * Layout: horizontal flex — left accent stripe | center (time + label +
 * subtitle) | right (Confirm / Not a real attempt buttons + dismiss ×).
 *
 * No backdrop or pointer-events blocking — the session interface remains
 * fully interactive behind the notification.
 */

interface RTNConfirmModalProps {
  sessionId: string;
  probeId: string;
  capturedAt: string;
  looked: boolean;
  onDone: () => void;
}

export default function RTNConfirmModal({
  sessionId,
  probeId,
  capturedAt,
  looked,
  onDone,
}: RTNConfirmModalProps) {
  const { t } = useTranslation();
  const confirmProbe = useConfirmProbe(sessionId);
  const voidProbe = useVoidProbe(sessionId);

  // Drive the slide-in from the right
  const [visible, setVisible] = useState(false);
  const doneCalledRef = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function safeDone() {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    setVisible(false);          // slide out
    setTimeout(onDone, 220);   // unmount after animation
  }

  async function handleConfirm() {
    await confirmProbe.mutateAsync(probeId);
    safeDone();
  }

  async function handleVoid() {
    await voidProbe.mutateAsync(probeId);
    safeDone();
  }

  const timeLabel = (() => {
    try { return format(new Date(capturedAt), 'HH:mm:ss'); }
    catch { return capturedAt; }
  })();

  return (
    /*
     * Fixed top-right toast.
     * - No backdrop / overlay — session UI stays fully interactive.
     * - z-index: 1000 — above session cards but below native browser UI.
     * - Slides in from the right on mount, slides out on action/dismiss.
     */
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 1000,
        width: 400,
        maxWidth: 'calc(100vw - 32px)',
        transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 28px))',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* ── Compact horizontal toast body ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#FFFFFF',
          border: '1px solid #EBEBF0',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.11)',
          padding: '10px 12px',
        }}
      >
        {/* Accent stripe — green for looked, rose for didn't look */}
        <div
          style={{
            width: 3,
            alignSelf: 'stretch',
            borderRadius: 99,
            backgroundColor: looked ? '#0D9F7E' : '#A83246',
            flexShrink: 0,
          }}
        />

        {/* Left text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1B1B2E', lineHeight: 1.3 }}>
            {timeLabel}
            <span style={{ marginLeft: 7, fontSize: 12, fontWeight: 500, color: looked ? '#0D9F7E' : '#A83246' }}>
              {looked ? t('probe_looked') : t('probe_did_not_look')}
            </span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8E8EA0', lineHeight: 1.2 }}>
            Response to Name · Confirm or void
          </p>
        </div>

        {/* Right: Confirm + Not real + dismiss — all in one horizontal row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={confirmProbe.isPending || voidProbe.isPending}
          >
            {t('probe_confirm')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleVoid}
            disabled={confirmProbe.isPending || voidProbe.isPending}
          >
            {t('probe_not_real')}
          </Button>
          <button
            onClick={safeDone}
            aria-label="Dismiss"
            style={{
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', borderRadius: '50%',
              color: '#8E8EA0', fontSize: 18, cursor: 'pointer',
              padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
