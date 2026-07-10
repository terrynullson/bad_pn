import type { CallfilterCheck } from './types';

const BASE_URL = 'https://callfilter.app';
const TIMEOUT_MS = 12_000;

export function callfilterSourceUrl(phone: string): string {
  return `${BASE_URL}/${phone}`;
}

type ScoreType = NonNullable<CallfilterCheck['score']>;

function parseCallfilterHtml(html: string): Omit<CallfilterCheck, 'available'> {
  const scoreMatch = html.match(
    /<div class="scoreContainer">[\s\S]*?<div class="score (negative|neutral|positive|unknown)"/i
  );
  const statusMatch = html.match(
    /<span style="color:#000">\s*([^<]+)\s*<\/span>/i
  );

  const categories: string[] = [];
  const categoriesBlock = html.match(/<div class="categories">[\s\S]*?<\/div>\s*<div style="clear: both">/i);
  if (categoriesBlock) {
    for (const match of categoriesBlock[0].matchAll(/<li[^>]*>([^<]+)<\/li>/gi)) {
      const value = match[1].trim();
      if (value && !/^0x\s*нет рейтинга$/i.test(value)) {
        categories.push(value);
      }
    }
  }

  const ratings: string[] = [];
  const ratingsBlock = html.match(/<div class="ratings">[\s\S]*?<\/div>\s*<div class="categories">/i);
  if (ratingsBlock) {
    for (const match of ratingsBlock[0].matchAll(/<li[^>]*>([^<]+)<\/li>/gi)) {
      const value = match[1].trim();
      if (value && !/^0x\s*нет рейтинга$/i.test(value)) {
        ratings.push(value);
      }
    }
  }

  const reviewsMatch = html.match(/<strong>(\d+)<\/strong>\s*отзыв/i);
  const descMatch = html.match(/<div class="advanced"[^>]*>([\s\S]*?)<\/div>/i);

  const score = (scoreMatch?.[1] as ScoreType | undefined) ?? null;
  const status = statusMatch?.[1]?.trim() ?? null;
  const reviewsCount = reviewsMatch ? Number(reviewsMatch[1]) : 0;
  const description =
    descMatch?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() ?? null;

  const statusLower = (status ?? '').toLowerCase();
  const isNegative =
    score === 'negative' ||
    /отрицатель|negative/.test(statusLower) ||
    ratings.some((r) => /отрицатель|negative/i.test(r));

  return {
    fallback: true,
    score,
    status,
    categories,
    ratings,
    reviewsCount,
    description,
    isNegative,
  };
}

export async function fetchCallfilter(
  phone: string
): Promise<CallfilterCheck | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(callfilterSourceUrl(phone), {
      signal: controller.signal,
      headers: {
        Accept: 'text/html',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const html = await response.text();

    if (!html.includes(phone) && !html.includes(phone.slice(-10))) {
      return null;
    }

    return {
      available: true,
      ...parseCallfilterHtml(html),
    };
  } catch {
    return null;
  }
}
