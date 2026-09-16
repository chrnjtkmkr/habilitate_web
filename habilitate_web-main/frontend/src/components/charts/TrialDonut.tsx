import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export interface TrialCounts {
  responded: number;
  partial: number;
  no_response: number;
  refused: number;
}

const COLORS: Record<string, string> = {
  responded: 'hsl(150, 50%, 50%)',
  partial: 'hsl(40, 70%, 55%)',
  no_response: 'hsl(240, 10%, 60%)',
  refused: 'hsl(350, 60%, 55%)',
};

const LABELS: Record<string, string> = {
  responded: 'Responded',
  partial: 'Partial',
  no_response: 'No Response',
  refused: 'Refused',
};

export default function TrialDonut({ counts }: { counts: TrialCounts }) {
  const total = counts.responded + counts.partial + counts.no_response + counts.refused;
  if (total === 0) return <p className="text-[13px] text-[#8E8EA0]">No trials recorded.</p>;

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: key, value }));

  return (
    <div>
      <div className="relative" style={{ minHeight: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height={140} minWidth={100}>
          <PieChart>
            <Pie
              data={data} dataKey="value"
              cx="50%" cy="50%"
              innerRadius={40} outerRadius={60}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[24px] font-bold" style={{ color: '#1B1B2E' }}>{total}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
        {Object.entries(counts).map(([key, value]) => (
          <span key={key} className="flex items-center gap-1 text-[11px]" style={{ color: '#5E5E7A' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[key] }} />
            {LABELS[key]} {value}
          </span>
        ))}
      </div>
    </div>
  );
}
