import type { SpravPortalCheck } from './types';

const TIMEOUT_MS = 12_000;
const DDG_HTML_URL = 'https://html.duckduckgo.com/html/';
const DDG_LITE_URL = 'https://lite.duckduckgo.com/lite/';

const SEARCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html',
  'Accept-Language': 'ru-RU,ru;q=0.9',
};

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

function parseHtmlSearchResults(html: string): SearchHit[] {
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

function parseLiteSearchResults(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linkMatch = row.match(
      /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    );

    if (!linkMatch) continue;

    const url = decodeDuckDuckGoUrl(linkMatch[1]);
    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
    if (!title || url.includes('duckduckgo.com')) continue;

    let snippet = '';
    const nextRow = rows[i + 1];
    if (nextRow && !/<a[^>]*href="https?:\/\//i.test(nextRow)) {
      snippet = nextRow.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    hits.push({ url, title, snippet });
  }

  return hits;
}

function parseRawSearchHeuristic(html: string, phone: string): SearchHit[] {
  const text = html.replace(/<[^>]+>/g, ' ');
  if (!phoneMatchesText(text, phone)) return [];

  const hits: SearchHit[] = [];
  const patterns = [
    /\[[^\]]*нежелательн[^\]]*\][^.!?]{0,160}/gi,
    /нежелательн[^.!?]{0,160}/gi,
    /отрицательн[^.!?]{0,120}/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const chunk = match[0].replace(/\s+/g, ' ').trim();
      if (!phoneMatchesText(chunk, phone)) continue;

      hits.push({
        title: chunk,
        snippet: chunk,
        url: '',
      });
    }
  }

  return hits;
}

function parseSearchResults(html: string, phone: string): SearchHit[] {
  const htmlHits = parseHtmlSearchResults(html);
  if (htmlHits.length > 0) return htmlHits;

  const liteHits = parseLiteSearchResults(html);
  if (liteHits.length > 0) return liteHits;

  return parseRawSearchHeuristic(html, phone);
}

function isSearchBlocked(html: string): boolean {
  return (
    /challenge-form|anomaly-modal|captcha|робот/i.test(html) &&
    !/\[нежелательн/i.test(html)
  );
}

export function analyzePhoneSearchHits(phone: string, hits: SearchHit[]) {
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

async function fetchSearchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: SEARCH_HEADERS,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchDdgHits(
  query: string,
  phoneForHeuristic?: string
): Promise<SearchHit[] | null> {
  const phone = phoneForHeuristic ?? query.replace(/\D/g, '');

  const liteHtml = await fetchSearchHtml(
    `${DDG_LITE_URL}?q=${encodeURIComponent(query)}`
  );
  if (liteHtml && !isSearchBlocked(liteHtml)) {
    const liteHits = parseSearchResults(liteHtml, phone);
    if (liteHits.length > 0) return liteHits;
  }

  const html = await fetchSearchHtml(
    `${DDG_HTML_URL}?q=${encodeURIComponent(query)}`
  );
  if (!html || isSearchBlocked(html)) return null;

  const hits = parseSearchResults(html, phone);
  return hits.length > 0 ? hits : null;
}

export async function fetchSearchFallback(
  phone: string
): Promise<SpravPortalCheck | null> {
  if (!isFallbackEnabled()) return null;

  try {
    const hits =
      (await fetchDdgHits(`${phone} нежелательный звонок`, phone)) ??
      (await fetchDdgHits(phone, phone));
    if (!hits) return null;

    const analysis = analyzePhoneSearchHits(phone, hits);

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
