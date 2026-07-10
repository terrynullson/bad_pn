import type { Issue } from '@/lib/types';

const ICONS: Record<Issue['severity'], string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '✕',
};

interface IssueListProps {
  issues: Issue[];
}

export default function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return <p className="text-sm text-slate-500">Проблем не обнаружено</p>;
  }

  return (
    <ul className="space-y-2">
      {issues.map((issue, index) => (
        <li
          key={`${issue.message}-${index}`}
          className="flex items-start gap-2 text-sm"
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            {ICONS[issue.severity]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-slate-800">{issue.message}</p>
            {issue.details && (
              <p className="mt-0.5 text-xs text-slate-500">{issue.details}</p>
            )}
            {issue.sourceUrl && (
              <a
                href={issue.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                {issue.source}
                {issue.unofficial && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    эвристика
                  </span>
                )}
                {' '}↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
