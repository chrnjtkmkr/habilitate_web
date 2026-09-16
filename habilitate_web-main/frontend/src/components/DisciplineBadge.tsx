import { useTranslation } from 'react-i18next';
import Pill from './Pill';

interface DisciplineBadgeProps {
  displayName: string | null;
  className?: string;
}

export default function DisciplineBadge({ displayName, className }: DisciplineBadgeProps) {
  const { t } = useTranslation();
  const label = displayName ?? t('discipline_unspecified');
  return <Pill variant="neutral" className={className}>{label}</Pill>;
}
