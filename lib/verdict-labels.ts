import type { Verdict } from './types';

export const VERDICT_LABELS: Record<Verdict, string> = {
  OK: 'ЗАЕБИСЬ',
  CAUTION: 'ХУЙ ЗНАЕТ',
  REJECT: 'ХУЙНЯ',
  INVALID: 'НЕ МОРОСИ',
};

export function getVerdictLabel(verdict: Verdict): string {
  return VERDICT_LABELS[verdict];
}

/** @deprecated Используйте getVerdictLabel */
export function verdictLabel(verdict: Verdict): string {
  return getVerdictLabel(verdict);
}
