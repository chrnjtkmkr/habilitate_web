import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const config = {
  improving: {
    bg: 'bg-[hsl(150,50%,92%)]',
    text: 'text-[hsl(150,50%,28%)]',
    icon: '\u2197',
    key: 'trajectory_improving',
  },
  steady: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    icon: '\u2192',
    key: 'trajectory_steady',
  },
  needs_attention: {
    bg: 'bg-[hsl(350,70%,94%)]',
    text: 'text-[hsl(350,70%,35%)]',
    icon: '\u26A0',
    key: 'trajectory_needs_attention',
  },
} as const;

interface TrajectoryPillProps {
  trajectory: string | null;
  size?: 'sm' | 'md';
}

export default function TrajectoryPill({ trajectory, size = 'sm' }: TrajectoryPillProps) {
  const { t } = useTranslation();
  if (!trajectory || !(trajectory in config)) return null;
  const c = config[trajectory as keyof typeof config];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        c.bg, c.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
    >
      <span aria-hidden="true">{c.icon}</span>
      {t(c.key)}
    </span>
  );
}
