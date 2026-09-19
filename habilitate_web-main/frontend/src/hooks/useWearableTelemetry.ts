import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

type TelemetryRow = Database['public']['Tables']['device_telemetry']['Row'];
type MetricRow = Database['public']['Tables']['wearable_metrics']['Row'];

export function useWearableTelemetry(bandId: string | null) {
  const [telemetry, setTelemetry] = useState<TelemetryRow | null>(null);
  const [metrics, setMetrics] = useState<MetricRow | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState('IDLE');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bandId) {
      setTelemetry(null);
      setMetrics(null);
      setRealtimeStatus('IDLE');
      setError(null);
      return;
    }

    let cancelled = false;

    const loadLatest = async () => {
      const [{ data: telemetryRow, error: telemetryError }, { data: metricRow, error: metricError }] =
        await Promise.all([
          supabase
            .from('device_telemetry')
            .select('*')
            .eq('band_id', bandId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('wearable_metrics')
            .select('*')
            .eq('band_id', bandId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (cancelled) return;

      if (telemetryError) {
        setError(telemetryError.message);
      } else {
        setTelemetry(telemetryRow);
      }

      if (metricError) {
        setError((current) => current ?? metricError.message);
      } else {
        setMetrics(metricRow);
      }
    };

    void loadLatest();

    const channel = supabase
      .channel(`telemetry:${bandId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'device_telemetry',
          filter: `band_id=eq.${bandId}`,
        },
        (payload) => {
          setTelemetry(payload.new as TelemetryRow);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wearable_metrics',
          filter: `band_id=eq.${bandId}`,
        },
        (payload) => {
          setMetrics(payload.new as MetricRow);
        },
      )
      .subscribe((status) => {
        setRealtimeStatus(status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError(`Realtime subscription: ${status}`);
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [bandId]);

  return {
    telemetry,
    metrics,
    realtimeStatus,
    error,
    isReceiving: realtimeStatus === 'SUBSCRIBED' && telemetry !== null,
  };
}
