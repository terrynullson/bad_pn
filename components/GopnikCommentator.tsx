'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface GopnikCommentatorProps {
  active: boolean;
  progress?: { current: number; total: number };
}

export default function GopnikCommentator({
  active,
  progress,
}: GopnikCommentatorProps) {
  const [joke, setJoke] = useState<string | null>(null);
  const [source, setSource] = useState<'deepseek' | 'fallback' | null>(null);
  const [loading, setLoading] = useState(false);
  const recentRef = useRef<string[]>([]);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const fetchJoke = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (recentRef.current.length > 0) {
        params.set('exclude', recentRef.current.join('|'));
      }
      const p = progressRef.current;
      if (p && p.total > 0) {
        params.set('context', `Проверено ${p.current} из ${p.total} номеров`);
      }

      const query = params.toString();
      const response = await fetch(`/api/joke${query ? `?${query}` : ''}`);
      if (!response.ok) return;

      const data = (await response.json()) as {
        joke: string;
        source: 'deepseek' | 'fallback';
      };

      setJoke(data.joke);
      setSource(data.source);
      recentRef.current = [...recentRef.current, data.joke].slice(-8);
    } catch {
      // тихо — шутки не критичны
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setJoke(null);
      setSource(null);
      recentRef.current = [];
      return;
    }

    fetchJoke();
    const intervalId = setInterval(fetchJoke, 5000);

    return () => clearInterval(intervalId);
  }, [active, fetchJoke]);

  if (!active) return null;

  return (
    <div className="mt-6 rounded-xl border-2 border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 text-xl">
            🧢
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-yellow-400">
              Дипсик на связи
            </p>
            <p className="text-xs text-slate-400">тупой гопник-стендапер · ждём базу</p>
          </div>
        </div>
        {source && (
          <span className="shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] uppercase text-slate-300">
            {source === 'deepseek' ? 'deepseek' : 'офлайн'}
          </span>
        )}
      </div>

      <div className="min-h-[4rem] rounded-lg bg-black/30 px-4 py-3">
        {joke ? (
          <p className="text-base leading-relaxed text-slate-100">{joke}</p>
        ) : (
          <p className="animate-pulse text-sm text-slate-500">
            Ща прикол затестим, подожди...
          </p>
        )}
        {loading && joke && (
          <p className="mt-2 text-xs text-slate-500">думаю следующий прикол...</p>
        )}
      </div>
    </div>
  );
}
