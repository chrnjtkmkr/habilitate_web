import clsx from 'clsx';

const sizes = {
  xs: 'h-5 w-5 text-[8px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-[52px] w-[52px] text-base',
  lg: 'h-20 w-20 text-xl',
} as const;

interface AvatarCircleProps {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}

export default function AvatarCircle({ name, size = 'md', className }: AvatarCircleProps) {
  const initials = name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        'bg-[hsl(150,50%,90%)] text-[hsl(150,50%,30%)]',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
