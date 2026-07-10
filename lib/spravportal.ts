import { delay } from './rate-limit';
import { fetchSearchFallback } from './search-fallback';
import type { SpravPortalCheck } from './types';

const PAGE_BASE = 'https://www.spravportal.ru/services/who-calls/num';
const TIMEOUT_MS = 10_000;

export function spravportalSourceUrl(phone: string): string {
  return `${PAGE_BASE}/${phone}`;
}

export function yandexSearchUrl(phone: string): string {
  return `https://yandex.ru/search/?text=${encodeURIComponent(phone)}`;
}

function isBrowserCheckPage(html: string): boolean {
  return (
    html.includes('Проверка браузера') ||
    (html.includes('noindex,nofollow') && html.length < 10_000)
  );
}

function parseSpravPortalHtml(
  html: string
): Omit<
  SpravPortalCheck,
  'available' | 'blocked' | 'method' | 'fallback'
> {
  const normalized = html.toLowerCase();

  const inDatabase =
    normalized.includes('не значится в спам-базах') ||
    normalized.includes('нежелательный') ||
    normalized.includes('отрицательн') ||
    normalized.includes('рейтинг');

  const isUnwanted =
    /\[нежелательный\]/i.test(html) ||
    normalized.includes('нежелательный звонок') ||
    normalized.includes('может быть нежелательным');

  const isNegative =
    normalized.includes('отрицательную') ||
    normalized.includes('отрицательный') ||
    /рейтинг[^<]*\d+\.?\d*\s*\/\s*5[^<]*отрицательн/i.test(html);

  const ratingMatch = html.match(/(\d+(?:\.\d+)?)\s*\/\s*5/i);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  const categories: string[] = [];
  const categoryMatch = html.match(/Категории\s+\d+[^<]*<\/h2>\s*([^<]+)/i);
  if (categoryMatch?.[1]) {
    categories.push(
      ...categoryMatch[1]
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    );
  }

  const reviewMatch = html.match(
    /Пользователь без имени сообщает:\s*"([^"]+)"/i
  );
  const reviewText = reviewMatch?.[1]?.trim() ?? null;

  const isSpam = isUnwanted || isNegative || (rating !== null && rating <= 2);

  return {
    inDatabase,
    isSpam,
    isUnwanted,
    isNegative,
    rating,
    categories,
    reviewText,
  };
}

async function fetchSpravPortalPage(
  phone: string
): Promise<SpravPortalCheck | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(spravportalSourceUrl(phone), {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();

    if (isBrowserCheckPage(html)) {
      return {
        available: false,
        blocked: true,
        method: 'none',
        fallback: false,
        inDatabase: false,
        isSpam: false,
        isUnwanted: false,
        isNegative: false,
        rating: null,
        categories: [],
        reviewText: null,
      };
    }

    return {
      available: true,
      blocked: false,
      method: 'scrape',
      fallback: true,
      ...parseSpravPortalHtml(html),
    };
  } catch {
    return null;
  }
}

async function fetchSpravPortalApi(
  phone: string,
  apiKey: string,
  apiBase: string
): Promise<SpravPortalCheck | null> {
  try {
    const base = apiBase.replace(/\/$/, '');
    const url = `${base}/check-spam/${phone}?apiKey=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      isSpam?: boolean;
      categories?: string[];
      errorMessage?: string;
    };

    if (data.errorMessage) return null;

    const categories = data.categories ?? [];

    return {
      available: true,
      blocked: false,
      method: 'api',
      fallback: false,
      inDatabase: true,
      isSpam: Boolean(data.isSpam),
      isUnwanted: Boolean(data.isSpam),
      isNegative: Boolean(data.isSpam),
      rating: data.isSpam ? 1 : 5,
      categories,
      reviewText: categories.length > 0 ? categories.join(', ') : null,
    };
  } catch {
    return null;
  }
}

export async function fetchSpravPortal(
  phone: string
): Promise<SpravPortalCheck | null> {
  const apiKey = process.env.WHO_CALLS_API_KEY;
  const apiBase = process.env.WHO_CALLS_API_URL;

  if (apiKey && apiBase) {
    const apiResult = await fetchSpravPortalApi(phone, apiKey, apiBase);
    if (apiResult) return apiResult;
    await delay(300);
  }

  const pageResult = await fetchSpravPortalPage(phone);
  if (pageResult && !pageResult.blocked) {
    return pageResult;
  }

  await delay(400);
  const searchResult = await fetchSearchFallback(phone);
  if (searchResult) {
    return searchResult;
  }

  return pageResult;
}
