import {
  Area, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, ComposedChart,
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface StateRegion {
  startSec: number;
  endSec: number;
  state: 'regulated' | 'amber' | 'dysregulated';
}

interface ActivityBoundary {
  timeSec: number;
  name: string;
}

interface SpontaneousDot {
  timeSec: number;
}

export interface EngagementTraceProps {
  data: { timeSec: number; engagement: number }[];
  stateRegions: StateRegion[];
  activityBoundaries: ActivityBoundary[];
  spontaneousDots: SpontaneousDot[];
}

const STATE_COLORS: Record<string, string> = {
  regulated: 'hsl(150, 50%, 90%)',
  amber: 'hsl(40, 70%, 90%)',
  dysregulated: 'hsl(350, 70%, 92%)',
};

function formatMmSs(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Custom label for numbered activity markers (used when 5+ activities)
function NumberedMarkerLabel({ viewBox, value }: { viewBox?: { x?: number; y?: number }; value?: string | number }) {
  const x = viewBox?.x ?? 0;
  const r = 9;
  const cy = 6;
  return (
    <g>
      <circle cx={x} cy={cy} r={r} fill="hsl(150, 45%, 55%)" />
      <text x={x} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight={600} fontFamily="Manrope, system-ui, sans-serif">
        {value}
      </text>
    </g>
  );
}

export default function EngagementTrace({ data, stateRegions, activityBoundaries, spontaneousDots }: EngagementTraceProps) {
  const { t } = useTranslation();

  if (data.length < 2) return <p className="text-[13px] text-[#8E8EA0]">Not enough data for engagement trace.</p>;

  const maxTime = data[data.length - 1].timeSec;
  const spontData = spontaneousDots.map((d) => ({ timeSec: d.timeSec, engagement: 50 }));
  const useNumbered = activityBoundaries.length >= 5;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: useNumbered ? 20 : 10, right: 16, left: 0, bottom: 4 }}>
          {stateRegions.map((r, i) => (
            <ReferenceArea
              key={i}
              x1={r.startSec} x2={r.endSec}
              fill={STATE_COLORS[r.state] ?? STATE_COLORS.regulated}
              fillOpacity={0.6}
              ifOverflow="extendDomain"
            />
          ))}
          {activityBoundaries.map((b, i) =>
            useNumbered ? (
              <ReferenceLine
                key={i}
                x={b.timeSec}
                stroke="#D4D4DC"
                strokeDasharray="4 4"
                label={<NumberedMarkerLabel value={i + 1} />}
              />
            ) : (
              <ReferenceLine
                key={i}
                x={b.timeSec}
                stroke="#D4D4DC"
                strokeDasharray="4 4"
                label={{ value: b.name, position: 'top', fontSize: 10, fill: '#8E8EA0', offset: i % 2 === 0 ? 4 : 18 }}
              />
            ),
          )}
          <defs>
            <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(150, 50%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(150, 50%, 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timeSec" type="number"
            domain={[0, maxTime]}
            tickFormatter={formatMmSs}
            tick={{ fontSize: 11, fill: '#8E8EA0' }}
            axisLine={{ stroke: '#EBEBF0' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#8E8EA0' }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(0)}%`, 'Engagement']}
            labelFormatter={(label) => formatMmSs(Number(label))}
            contentStyle={{ fontSize: 12, border: '1px solid #EBEBF0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          />
          <Area
            type="monotone"
            dataKey="engagement"
            stroke="hsl(150, 50%, 50%)"
            strokeWidth={2}
            fill="url(#engGrad)"
            dot={false}
            isAnimationActive={false}
          />
          {spontData.length > 0 && (
            <Scatter
              data={spontData}
              dataKey="engagement"
              fill="hsl(245, 80%, 70%)"
              shape="circle"
              isAnimationActive={false}
              legendType="none"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Numbered activity legend — only when 5+ activities */}
      {useNumbered && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: '#EBEBF0' }}>
          <p className="mb-2" style={{ color: '#7A7A92', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {t('activity_key_label')}
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {activityBoundaries.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center shrink-0 rounded-full text-white"
                  style={{ width: 18, height: 18, fontSize: 10, fontWeight: 600, backgroundColor: 'hsl(150, 45%, 55%)', fontFamily: 'Manrope, system-ui, sans-serif' }}
                >
                  {i + 1}
                </span>
                <span className="text-[13px] truncate" style={{ color: '#1B1B2E', fontWeight: 500 }}>
                  {b.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
