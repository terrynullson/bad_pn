'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseJsonResponse } from '@/lib/api-response';

const JOKE_INTERVAL_MS = 20_000;
const FADE_MS = 320;
const BATCH_SIZE = 10;
const PREFETCH_AT_REMAINING = 3;

interface GopnikCommentatorProps {
  checking: boolean;
  progress?: { current: number; total: number };
}

type Phase = 'jokes' | 'finale';

export default function GopnikCommentator({
  checking,
  progress,
}: GopnikCommentatorProps) {
  const [phase, setPhase] = useState<Phase>('jokes');
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const queueRef = useRef<string[]>([]);
  const recentRef = useRef<string[]>([]);
  const progressRef = useRef(progress);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasCheckingRef = useRef(false);
  const busyRef = useRef(false);
  const prefetchingRef = useRef(false);
  const checkingRef = useRef(checking);

  checkingRef.current = checking;
  progressRef.current = progress;

  const clearJokeInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchJokeBatch = useCallback(async (): Promise<string[]> => {
    const params = new URLSearchParams();
    params.set('count', String(BATCH_SIZE));

    if (recentRef.current.length > 0) {
      params.set('exclude', recentRef.current.join('|'));
    }

    const p = progressRef.current;
    if (p && p.total > 0) {
      params.set('context', `Проверено ${p.current} из ${p.total} номеров`);
    }

    const response = await fetch(`/api/joke?${params.toString()}`);
    if (!response.ok) return [];

    const data = await parseJsonResponse<{ jokes?: string[]; joke?: string }>(
      response
    );
    if (Array.isArray(data.jokes) && data.jokes.length > 0) {
      return data.jokes;
    }
    if (data.joke) return [data.joke];
    return [];
  }, []);

  const prefetchBatch = useCallback(async () => {
    if (prefetchingRef.current || !checkingRef.current) return;
    prefetchingRef.current = true;

    try {
      const batch = await fetchJokeBatch();
      if (batch.length > 0) {
        queueRef.current.push(...batch);
      }
    } catch {
      // шутки не критичны
    } finally {
      prefetchingRef.current = false;
    }
  }, [fetchJokeBatch]);

  const maybePrefetch = useCallback(() => {
    if (
      queueRef.current.length <= PREFETCH_AT_REMAINING &&
      !prefetchingRef.current
    ) {
      void prefetchBatch();
    }
  }, [prefetchBatch]);

  const takeNextJoke = useCallback(async (): Promise<string | null> => {
    if (queueRef.current.length === 0) {
      await prefetchBatch();
    }

    const joke = queueRef.current.shift() ?? null;
    if (joke) {
      recentRef.current = [...recentRef.current, joke].slice(-40);
      maybePrefetch();
    }

    return joke;
  }, [maybePrefetch, prefetchBatch]);

  const fetchFinale = useCallback(async (): Promise<string | null> => {
    const params = new URLSearchParams();
    params.set('mode', 'finale');
    const p = progressRef.current;
    if (p?.total) {
      params.set('context', `Проверка завершена: ${p.total} номеров`);
    }

    const response = await fetch(`/api/joke?${params.toString()}`);
    if (!response.ok) return null;

    const data = await parseJsonResponse<{ joke: string }>(response);
    return data.joke;
  }, []);

  const showJoke = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      setVisible(false);
      await new Promise((resolve) => setTimeout(resolve, FADE_MS));

      const joke = await takeNextJoke();
      if (joke) setText(joke);

      setVisible(true);
    } catch {
      setVisible(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [takeNextJoke]);

  const showFinale = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      setVisible(false);
      await new Promise((resolve) => setTimeout(resolve, FADE_MS));

      const line = await fetchFinale();
      if (line) setText(line);

      setVisible(true);
    } catch {
      setVisible(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [fetchFinale]);

  const scheduleJokeRotation = useCallback(() => {
    clearJokeInterval();
    intervalRef.current = setInterval(() => {
      showJoke();
    }, JOKE_INTERVAL_MS);
  }, [clearJokeInterval, showJoke]);

  const handleMore = () => {
    if (phase !== 'jokes' || !checking || busy) return;
    scheduleJokeRotation();
    showJoke();
  };

  const startJokes = useCallback(async () => {
    queueRef.current = [];
    recentRef.current = [];
    prefetchingRef.current = false;

    setBusy(true);
    busyRef.current = true;

    try {
      const batch = await fetchJokeBatch();
      if (batch.length > 0) {
        const [first, ...rest] = batch;
        queueRef.current = rest;
        recentRef.current = [first];
        setText(first);
        setVisible(true);
        maybePrefetch();
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }

    scheduleJokeRotation();
  }, [fetchJokeBatch, maybePrefetch, scheduleJokeRotation]);

  useEffect(() => {
    if (checking) {
      wasCheckingRef.current = true;
      setPhase('jokes');
      void startJokes();
      return () => clearJokeInterval();
    }

    if (wasCheckingRef.current) {
      wasCheckingRef.current = false;
      clearJokeInterval();
      queueRef.current = [];
      setPhase('finale');
      void showFinale();
    }
  }, [checking, clearJokeInterval, showFinale, startJokes]);

  return (
    <div
      className={`rounded-xl border-2 border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-lg ${
        checking ? 'mt-6' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xl">
          🧢
        </span>

        <div className="min-w-0 flex-1">
          <div className="min-h-[4rem] overflow-hidden rounded-lg bg-black/30 px-4 py-3">
            <p
              className={`text-base leading-relaxed text-slate-100 transition-all duration-300 ease-in-out ${
                visible
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-2 opacity-0'
              }`}
            >
              {text ?? (
                <span className="text-sm text-slate-500">
                  Ща нагенерю пачку приколов, подожди...
                </span>
              )}
            </p>
          </div>

          {phase === 'jokes' && checking && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleMore}
                disabled={busy}
                className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-4 py-1.5 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ещё
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
