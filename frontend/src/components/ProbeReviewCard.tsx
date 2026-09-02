import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  useProbesForSession,
  useConfirmProbe,
  useVoidProbe,
  useInsertManualProbe,
} from '../lib/queries/probes';
import Button from './Button';

const S = {
  card: { background: '#FFF', border: '1px solid #EBEBF0', borderRadius: 12, boxShadow: '0 1px 2px rgba(230,230,235,0.5)' } as const,
  label: { color: '#7A7A92', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  text1: { color: '#1B1B2E' },
  text2: { color: '#5E5E7A' },
  text3: { color: '#8E8EA0' },
};

interface Props {
  sessionId: string;
  childId: string;
}

export default function ProbeReviewCard({ sessionId, childId }: Props) {
  const { t } = useTranslation();
  const { data: probes, isLoading } = useProbesForSession(sessionId, 'response_to_name');
  const confirmProbe = useConfirmProbe(sessionId);
  const voidProbe = useVoidProbe(sessionId);
  const insertManual = useInsertManualProbe(sessionId);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualLatency, setManualLatency] = useState('');
  const [manualLooked, setManualLooked] = useState(true);

  function handleAddManual() {
    const latencyMs = manualLatency ? parseInt(manualLatency, 10) : null;
    insertManual.mutate({
      session_id: sessionId,
      child_id: childId,
      attribute_id: 'response_to_name',
      method: 'therapist_manual',
      therapist_confirmed: true,
      raw: {
        latency_ms: latencyMs,
        orientation: manualLooked ? 'looked' : 'did_not_look',
        target: 'therapist',
      },
      score: manualLooked ? 1 : 0,
      valid: true,
    });
    setShowManualForm(false);
    setManualLatency('');
    setManualLooked(true);
  }

  if (isLoading) return null;

  const hasProbes = probes && probes.length > 0;

  return (
    <div className="p-5" style={S.card}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[16px] font-semibold" style={S.text1}>
          {t('probe_review_title')}
        </p>
        <span className="text-[12px]" style={S.text3}>
          {t('probe_review_subtitle')}
        </span>
      </div>

      {!hasProbes && (
        <p className="text-[13px] py-4 text-center" style={S.text3}>
          {t('probe_review_empty')}
        </p>
      )}

      {hasProbes && (
        <div className="space-y-2">
          {probes.map((probe) => {
            const raw = probe.raw as Record<string, unknown>;
            const latencyMs = typeof raw?.latency_ms === 'number' ? raw.latency_ms : null;
            const orientation = raw?.orientation as string | undefined;
            const looked = orientation === 'looked';
            const isConfirmed = probe.therapist_confirmed;
            const isVoided = !probe.valid;
            const isDecided = isConfirmed || isVoided;

            return (
              <div
                key={probe.id}
                className="flex items-center justify-between rounded-lg px-4 py-3"
                style={{
                  border: '1px solid #EBEBF0',
                  backgroundColor: isVoided ? '#FDF2F2' : isConfirmed ? '#F0FDF4' : '#FAFAFA',
                }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium" style={S.text1}>
                    {format(new Date(probe.captured_at), 'HH:mm:ss')}
                    <span className="ml-2" style={{ color: looked ? '#0D9F7E' : '#A83246' }}>
                      {looked ? t('probe_looked') : t('probe_did_not_look')}
                    </span>
                  </p>
                  <p className="text-[11px] mt-0.5" style={S.text3}>
                    {latencyMs !== null && `${latencyMs}ms`}
                    {probe.method === 'therapist_manual' && ` · ${t('probe_manual')}`}
                    {isVoided && probe.void_reason && ` · ${t('probe_voided')}`}
                  </p>
                </div>

                {!isDecided && (
                  <div className="flex gap-2 shrink-0 ml-3">
                    <Button
                      size="sm"
                      onClick={() => confirmProbe.mutate(probe.id)}
                    >
                      {t('probe_confirm')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => voidProbe.mutate(probe.id)}
                    >
                      {t('probe_not_real')}
                    </Button>
                  </div>
                )}

                {isConfirmed && (
                  <span className="text-[11px] font-medium shrink-0 ml-3" style={{ color: '#0D9F7E' }}>
                    ✓ {t('probe_confirmed')}
                  </span>
                )}
                {isVoided && (
                  <span className="text-[11px] font-medium shrink-0 ml-3" style={{ color: '#A83246' }}>
                    ✗ {t('probe_voided')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add manual probe */}
      <div className="mt-4">
        {!showManualForm ? (
          <button
            onClick={() => setShowManualForm(true)}
            className="text-[13px] font-medium"
            style={{ color: '#5B5BF0' }}
          >
            + {t('probe_add_manual')}
          </button>
        ) : (
          <div className="rounded-lg p-4" style={{ border: '1px solid #EBEBF0', backgroundColor: '#F8F8FC' }}>
            <p className="text-[12px] font-medium mb-3" style={S.text2}>
              {t('probe_add_manual')}
            </p>
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-1.5 text-[13px]" style={S.text1}>
                <input
                  type="checkbox"
                  checked={manualLooked}
                  onChange={(e) => setManualLooked(e.target.checked)}
                  className="rounded"
                />
                {t('probe_child_looked')}
              </label>
              <input
                type="number"
                value={manualLatency}
                onChange={(e) => setManualLatency(e.target.value)}
                placeholder={t('probe_latency_placeholder')}
                className="rounded-lg px-3 py-1.5 text-[13px] w-32"
                style={{ border: '1px solid #EBEBF0' }}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddManual}>
                {t('probe_save')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowManualForm(false)}>
                {t('modal_cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
