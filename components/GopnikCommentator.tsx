'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const JOKE_INTERVAL_MS = 20_000;
const FADE_MS = 320;

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

  const recentRef = useRef<string[]>([]);
  const progressRef = useRef(progress);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasCheckingRef = useRef(false);
  const busyRef = useRef(false);

  progressRef.current = progress;

  const clearJokeInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const requestLine = useCallback(
    async (mode: 'joke' | 'finale'): Promise<string | null> => {
      const params = new URLSearchParams();

      if (mode === 'finale') {
        params.set('mode', 'finale');
        const p = progressRef.current;
        if (p?.total) {
          params.set('context', `Проверка завершена: ${p.total} номеров`);
        }
      } else {
        if (recentRef.current.length > 0) {
          params.set('exclude', recentRef.current.join('|'));
        }
        const p = progressRef.current;
        if (p && p.total > 0) {
          params.set('context', `Проверено ${p.current} из ${p.total} номеров`);
        }
      }

      const response = await fetch(`/api/joke?${params.toString()}`);
      if (!response.ok) return null;

      const data = (await response.json()) as { joke: string };
      if (mode === 'joke') {
        recentRef.current = [...recentRef.current, data.joke].slice(-8);
      }
      return data.joke;
    },
    []
  );

  const showLine = useCallback(
    async (mode: 'joke' | 'finale') => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);

      try {
        setVisible(false);
        await new Promise((resolve) => setTimeout(resolve, FADE_MS));

        const line = await requestLine(mode);
        if (line) setText(line);

        setVisible(true);
      } catch {
        setVisible(true);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [requestLine]
  );

  const scheduleJokeRotation = useCallback(() => {
    clearJokeInterval();
    intervalRef.current = setInterval(() => {
      showLine('joke');
    }, JOKE_INTERVAL_MS);
  }, [clearJokeInterval, showLine]);

  const handleMore = () => {
    if (phase !== 'jokes' || !checking || busy) return;
    scheduleJokeRotation();
    showLine('joke');
  };

  useEffect(() => {
    if (checking) {
      wasCheckingRef.current = true;
      setPhase('jokes');
      recentRef.current = [];
      showLine('joke');
      scheduleJokeRotation();

      return () => clearJokeInterval();
    }

    if (wasCheckingRef.current) {
      wasCheckingRef.current = false;
      clearJokeInterval();
      setPhase('finale');
      showLine('finale');
    }
  }, [checking, clearJokeInterval, scheduleJokeRotation, showLine]);

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
                <span className="text-sm text-slate-500">Ща прикол затестим, подожди...</span>
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
