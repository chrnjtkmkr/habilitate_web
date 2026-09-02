interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  tone?: 'sage' | 'amber' | 'rose';
}

const toneColors = {
  sage: { stroke: 'hsl(150,50%,40%)', fill: 'hsl(150,50%,85%)' },
  amber: { stroke: 'hsl(38,92%,50%)', fill: 'hsl(38,92%,88%)' },
  rose: { stroke: 'hsl(350,70%,50%)', fill: 'hsl(350,70%,90%)' },
};

export default function MiniSparkline({ data, width = 80, height = 24, tone = 'sage' }: MiniSparklineProps) {
  if (data.length < 2) {
    return <span className="text-xs text-ink-muted">—</span>;
  }

  const colors = toneColors[tone];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 2;
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * usableW;
    const y = pad + usableH - ((v - min) / range) * usableH;
    return `${x},${y}`;
  });

  const linePath = `M${points.join(' L')}`;
  const areaPath = `${linePath} L${pad + usableW},${pad + usableH} L${pad},${pad + usableH} Z`;

  return (
    <svg width={width} height={height} className="block" aria-hidden="true">
      <path d={areaPath} fill={colors.fill} opacity={0.4} />
      <path d={linePath} fill="none" stroke={colors.stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
