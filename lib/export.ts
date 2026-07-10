import type { PhoneCheckResult } from './types';
import { getVerdictLabel } from './verdict-labels';
import { verdictLabel } from './verdict-labels';

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatIssues(result: PhoneCheckResult): string {
  return result.issues
    .map((issue) => `[${issue.severity}] ${issue.message}`)
    .join('; ');
}

function formatSources(result: PhoneCheckResult): string {
  return result.sources.map((s) => s.url).join('; ');
}

export function resultsToCsv(results: PhoneCheckResult[]): string {
  const header =
    'phone,normalized,verdict,operator,region,reviewsCount,issues,sources,checkedAt';

  const rows = results.map((result) =>
    [
      result.phone,
      result.normalized,
      getVerdictLabel(result.verdict),
      result.operator ?? '',
      result.region ?? '',
      String(result.reviewsCount),
      formatIssues(result),
      formatSources(result),
      result.checkedAt,
    ]
      .map(escapeCsvField)
      .join(',')
  );

  return '\uFEFF' + [header, ...rows].join('\n');
}

export function downloadCsv(results: PhoneCheckResult[], filename?: string): void {
  const csv = resultsToCsv(results);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    filename ?? `phone-check-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
