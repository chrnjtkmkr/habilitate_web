import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';

export interface ActivityBarData {
  name: string;
  engagement: number;
}

function barColor(pct: number) {
  if (pct >= 60) return 'hsl(150, 50%, 50%)';
  if (pct >= 30) return 'hsl(40, 70%, 55%)';
  return 'hsl(350, 60%, 55%)';
}

export default function ActivityBarChart({ data }: { data: ActivityBarData[] }) {
  if (data.length === 0) return <p className="text-[13px] text-[#8E8EA0]">No activity data.</p>;

  const sorted = [...data].sort((a, b) => b.engagement - a.engagement);
  const barHeight = 32;
  const height = Math.max(120, sorted.length * (barHeight + 8) + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fontSize: 11, fill: '#1B1B2E' }}
          axisLine={false}
          tickLine={false}
        />
        <Bar dataKey="engagement" barSize={barHeight} radius={[0, 6, 6, 0]} isAnimationActive={false}>
          {sorted.map((entry, i) => (
            <Cell key={i} fill={barColor(entry.engagement)} />
          ))}
          <LabelList dataKey="engagement" position="right" fontSize={12} fill="#1B1B2E" formatter={(v) => `${Number(v).toFixed(0)}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
