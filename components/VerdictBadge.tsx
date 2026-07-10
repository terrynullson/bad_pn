import type { Verdict } from '@/lib/types';
import { getVerdictLabel } from '@/lib/verdict-labels';
import { verdictLabel } from '@/lib/verdict-labels';

const STYLES: Record<Verdict, string> = {
  OK: 'bg-green-100 text-green-800',
  CAUTION: 'bg-yellow-100 text-yellow-800',
  REJECT: 'bg-red-100 text-red-800',
  INVALID: 'bg-slate-100 text-slate-600',
};

interface VerdictBadgeProps {
  verdict: Verdict;
}

export default function VerdictBadge({ verdict }: VerdictBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[verdict]}`}
    >
      {getVerdictLabel(verdict)}
    </span>
  );
}
