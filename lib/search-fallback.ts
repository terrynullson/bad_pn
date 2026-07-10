import type { SpravPortalCheck } from './types';

const TIMEOUT_MS = 12_000;
const DDG_URL = 'https://html.duckduckgo.com/html/';

export interface SearchHit {
  title: string;
  snippet: string;
  url: string;
}

function isFallbackEnabled(): boolean {
  return process.env.ENABLE_SEARCH_FALLBACK !== 'false';
}

function phoneMatchesText(text: string, phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const compact = text.replace(/\D/g, '');
  const core = digits.slice(-10);
  return compact.includes(digits) || compact.includes(core);
}

function decodeDuckDuckGoUrl(href: string): string {
  try {
    const normalized = href.startsWith('//') ? `https:${href}` : href;
    const url = new URL(normalized);
    const target = url.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : normalized;
  } catch {
    return href;
  }
}

function parseSearchResults(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const titleMatches = [
    ...html.matchAll(
      /class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi
    ),
  ];
  const snippetMatches = [
    ...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi),
  ];

  for (let i = 0; i < titleMatches.length; i++) {
    const titleMatch = titleMatches[i];
    const snippetMatch = snippetMatches[i];

    hits.push({
      url: decodeDuckDuckGoUrl(titleMatch[1]),
      title: titleMatch[2].trim(),
      snippet: (snippetMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim(),
    });
  }

  return hits;
}

function analyzeHits(phone: string, hits: SearchHit[]) {
  const relevant = hits.filter(
    (hit) =>
      phoneMatchesText(`${hit.title} ${hit.snippet}`, phone) ||
      hit.url.includes(phone)
  );

  const signals: string[] = [];
  let isUnwanted = false;
  let isNegative = false;
  let spravportalUrl: string | null = null;

  for (const hit of relevant) {
    const text = `${hit.title} ${hit.snippet}`;

    if (hit.url.includes('spravportal.ru')) {
      spravportalUrl = hit.url;
    }

    if (/\[нежелательный\]/i.test(hit.title) || /нежелательный звонок/i.test(text)) {
      isUnwanted = true;
      signals.push(`Заголовок: ${hit.title}`);
    }

    if (/отрицательн/i.test(text)) {
      isNegative = true;
      signals.push('Упоминается отрицательная оценка');
    }

    if (/потенциально нежелательн/i.test(text)) {
      isUnwanted = true;
      signals.push('Потенциально нежелательный звонок');
    }

    if (/\bспам\b/i.test(text) || /мошенн/i.test(text)) {
      signals.push(text.match(/спам|мошенн/i)?.[0] ?? 'риск');
    }
  }

  const isSpam = isUnwanted || isNegative;

  return {
    relevant,
    signals: [...new Set(signals)],
    isUnwanted,
    isNegative,
    isSpam,
    spravportalUrl,
    found: relevant.length > 0,
  };
}

export function duckDuckGoSearchUrl(phone: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(phone)}`;
}

export async function fetchSearchFallback(
  phone: string
): Promise<SpravPortalCheck | null> {
  if (!isFallbackEnabled()) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `${DDG_URL}?q=${encodeURIComponent(phone)}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html',
          'Accept-Language': 'ru-RU,ru;q=0.9',
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();
    const hits = parseSearchResults(html);
    const analysis = analyzeHits(phone, hits);

    if (!analysis.found) {
      return {
        available: true,
        blocked: false,
        method: 'search',
        fallback: true,
        inDatabase: false,
        isSpam: false,
        isUnwanted: false,
        isNegative: false,
        rating: null,
        categories: [],
        reviewText: null,
        fallbackSignals: ['В поиске нет явных сигналов по этому номеру'],
        fallbackSourceUrl: duckDuckGoSearchUrl(phone),
      };
    }

    if (!analysis.isSpam && analysis.signals.length === 0) {
      return {
        available: true,
        blocked: false,
        method: 'search',
        fallback: true,
        inDatabase: true,
        isSpam: false,
        isUnwanted: false,
        isNegative: false,
        rating: null,
        categories: [],
        reviewText: null,
        fallbackSignals: ['Поиск не нашёл негативных меток по номеру'],
        fallbackSourceUrl: analysis.spravportalUrl ?? duckDuckGoSearchUrl(phone),
      };
    }

    return {
      available: true,
      blocked: false,
      method: 'search',
      fallback: true,
      inDatabase: true,
      isSpam: analysis.isSpam,
      isUnwanted: analysis.isUnwanted,
      isNegative: analysis.isNegative,
      rating: analysis.isNegative ? 1 : null,
      categories: analysis.signals,
      reviewText: analysis.relevant[0]?.snippet || null,
      fallbackSignals: analysis.signals,
      fallbackSourceUrl: analysis.spravportalUrl ?? duckDuckGoSearchUrl(phone),
    };
  } catch {
    return null;
  }
}
