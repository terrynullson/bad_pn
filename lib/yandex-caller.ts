import {
  analyzePhoneSearchHits,
  collectPhoneSearchHits,
  duckDuckGoSearchUrl,
  type PhoneSearchCache,
  type SearchHit,
} from './search-fallback';
import type { YandexCallerCheck } from './types';

const TIMEOUT_MS = 12_000;
const WHO_CALLED_PAGE =
  'https://yandex.ru/yandexapp/ru/callerid/whocalled';

function isFallbackEnabled(): boolean {
  return process.env.ENABLE_SEARCH_FALLBACK !== 'false';
}

export function yandexCallerPageUrl(): string {
  return WHO_CALLED_PAGE;
}

export function yandexCallerSourceUrl(phone: string): string {
  return `https://yandex.ru/search/?text=${encodeURIComponent(`${phone} кто звонил`)}&lr=213`;
}

function extractLabel(text: string): string | null {
  if (/нежелательный звонок/i.test(text)) return 'Нежелательный звонок';
  if (/\[нежелательный\]/i.test(text)) return 'Нежелательный';
  if (/отрицательн/i.test(text)) return 'Отрицательная оценка';
  if (/спам/i.test(text)) return 'Спам';
  return null;
}

function analyzeYandexHits(phone: string, hits: SearchHit[]) {
  const analysis = analyzePhoneSearchHits(phone, hits);
  const yandexHits = hits.filter(
    (hit) =>
      /yandex\.ru/i.test(hit.url) ||
      /яндекс/i.test(`${hit.title} ${hit.snippet}`)
  );

  const signals = [...analysis.signals];

  for (const hit of yandexHits) {
    const text = `${hit.title} ${hit.snippet}`;
    if (/блокиров|нежелатель|спам|мошенн/i.test(text)) {
      signals.push(`Яндекс: ${hit.title}`);
    }
  }

  const primaryHit = analysis.relevant[0] ?? hits[0] ?? null;
  const primaryText = primaryHit
    ? `${primaryHit.title} ${primaryHit.snippet}`
    : '';

  return {
    ...analysis,
    signals: [...new Set(signals)],
    label: extractLabel(primaryText),
    snippet: primaryHit?.snippet ?? null,
    hasYandexMention: yandexHits.length > 0,
  };
}

async function probeDirectYandex(phone: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `${WHO_CALLED_PAGE}?phone=${encodeURIComponent(phone)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'text/html',
          'Accept-Language': 'ru-RU,ru;q=0.9',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) return true;

    const html = await response.text();
    return /робот|captcha|smartcaptcha/i.test(html);
  } catch {
    return true;
  }
}

export async function fetchYandexCaller(
  phone: string,
  cache?: PhoneSearchCache
): Promise<YandexCallerCheck | null> {
  if (!isFallbackEnabled()) return null;

  const blocked = process.env.VERCEL
    ? true
    : await probeDirectYandex(phone);
  const collected = await collectPhoneSearchHits(phone, cache);
  const hits = collected?.hits ?? [];

  if (hits.length === 0) {
    return {
      available: false,
      fallback: true,
      blocked,
      inDatabase: false,
      isUnwanted: false,
      isNegative: false,
      isSpam: false,
      label: null,
      signals: blocked
        ? ['Прямой доступ к Яндексу заблокирован капчей']
        : ['Поисковая эвристика не вернула результатов'],
      snippet: null,
      sourceUrl: yandexCallerSourceUrl(phone),
    };
  }

  const analysis = analyzeYandexHits(phone, hits);
  const sourceUrl = yandexCallerSourceUrl(phone);

  if (!analysis.found) {
    return {
      available: true,
      fallback: true,
      blocked,
      inDatabase: false,
      isUnwanted: false,
      isNegative: false,
      isSpam: false,
      label: null,
      signals: [
        blocked
          ? 'Яндекс «Кто звонил» недоступен с сервера (капча), проверка через поиск'
          : 'В поиске нет сигналов по номеру',
      ],
      snippet: null,
      sourceUrl,
    };
  }

  if (!analysis.isSpam && analysis.signals.length === 0) {
    return {
      available: true,
      fallback: true,
      blocked,
      inDatabase: true,
      isUnwanted: false,
      isNegative: false,
      isSpam: false,
      label: null,
      signals: ['Поиск не нашёл негативных меток Яндекса по номеру'],
      snippet: analysis.snippet,
      sourceUrl,
    };
  }

  return {
    available: true,
    fallback: true,
    blocked,
    inDatabase: true,
    isUnwanted: analysis.isUnwanted,
    isNegative: analysis.isNegative,
    isSpam: analysis.isSpam,
    label: analysis.label,
    signals: analysis.signals,
    snippet: analysis.snippet,
    sourceUrl,
  };
}

export function yandexCallerHeuristicUrl(phone: string): string {
  return duckDuckGoSearchUrl(`${phone} нежелательный звонок`);
}
