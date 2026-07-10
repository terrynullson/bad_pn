'use client';

import { Fragment, useState } from 'react';
import IssueList from './IssueList';
import VerdictBadge from './VerdictBadge';
import type { PhoneCheckResult } from '@/lib/types';

function summarizeProblems(result: PhoneCheckResult): string {
  const problem = result.issues.find(
    (issue) => issue.severity === 'error' || issue.severity === 'warning'
  );

  if (!problem) return '—';

  if (result.reviewsCount > 0) {
    return `${problem.message.split(':')[0]} (${result.reviewsCount} жалоб${result.reviewsCount === 1 ? 'а' : result.reviewsCount < 5 ? 'ы' : ''})`;
  }

  return problem.message;
}

interface ResultsTableProps {
  results: PhoneCheckResult[];
}

export default function ResultsTable({ results }: ResultsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (results.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Номер</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Вердикт</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Оператор</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Регион</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Проблемы</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Источники</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {results.map((result, index) => {
            const rowKey = `${result.phone}-${index}`;
            const isExpanded = expanded.has(rowKey);

            return (
              <Fragment key={rowKey}>
                <tr
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleRow(rowKey)}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-900">
                    {result.phone}
                  </td>
                  <td className="px-4 py-3">
                    <VerdictBadge verdict={result.verdict} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {result.operator ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {result.region ?? '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-700">
                    {summarizeProblems(result)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {result.sources.map((source, sourceIndex) => (
                        <span key={source.url} className="inline-flex items-center">
                          {sourceIndex > 0 && (
                            <span className="mr-2 text-slate-300">·</span>
                          )}
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {source.name}
                            {source.unofficial && (
                              <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-800">
                                ~
                              </span>
                            )}
                            {' '}↗
                          </a>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50">
                    <td colSpan={6} className="px-4 py-4">
                      <IssueList issues={result.issues} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
