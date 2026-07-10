'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ProgressBar from '@/components/ProgressBar';
import ResultsTable from '@/components/ResultsTable';
import { downloadCsv } from '@/lib/export';
import { getVerdictLabel } from '@/lib/verdict-labels';
import type { CheckResponse, CheckSummary, PhoneCheckResult } from '@/lib/types';
import { BATCH_SIZE } from '@/lib/types';

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function mergeSummaries(summaries: CheckSummary[]): CheckSummary {
  return summaries.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      ok: acc.ok + s.ok,
      caution: acc.caution + s.caution,
      reject: acc.reject + s.reject,
      invalid: acc.invalid + s.invalid,
    }),
    { total: 0, ok: 0, caution: 0, reject: 0, invalid: 0 }
  );
}

export default function Home() {
  const [results, setResults] = useState<PhoneCheckResult[]>([]);
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (numbers: string[]) => {
    setIsChecking(true);
    setError(null);
    setResults([]);
    setSummary(null);
    setProgress({ current: 0, total: numbers.length });

    const batches = chunkArray(numbers, BATCH_SIZE);
    const allResults: PhoneCheckResult[] = [];
    const allSummaries: CheckSummary[] = [];
    let checked = 0;

    try {
      for (const batch of batches) {
        const response = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numbers: batch }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'Ошибка проверки');
        }

        const data = (await response.json()) as CheckResponse;
        allResults.push(...data.results);
        allSummaries.push(data.summary);
        checked += batch.length;
        setProgress({ current: checked, total: numbers.length });
        setResults([...allResults]);
        setSummary(mergeSummaries(allSummaries));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-semibold text-slate-900">Проверка номеров</h1>
          <p className="mt-1 text-sm text-slate-600">
            Проверка российских номеров перед исходящим обзвоном
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <FileUpload onCheck={handleCheck} isChecking={isChecking} />
        </section>

        {isChecking && (
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <ProgressBar current={progress.current} total={progress.total} />
          </section>
        )}

        {error && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        )}

        {summary && results.length > 0 && (
          <>
            <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-700">
                <span className="font-medium">{summary.total} номеров:</span>{' '}
                {summary.ok} {getVerdictLabel('OK')} · {summary.caution}{' '}
                {getVerdictLabel('CAUTION')} · {summary.reject}{' '}
                {getVerdictLabel('REJECT')}
                {summary.invalid > 0 &&
                  ` · ${summary.invalid} ${getVerdictLabel('INVALID')}`}
              </p>
              <button
                type="button"
                onClick={() => downloadCsv(results)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Скачать CSV
              </button>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <ResultsTable results={results} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
