import type { SearchHit } from './search-fallback';

const API_URL = 'https://google.serper.dev/search';
const TIMEOUT_MS = 12_000;

export function isSerperEnabled(): boolean {
  return Boolean(process.env.SERPER_API_KEY?.trim());
}

export async function fetchSerperHits(query: string): Promise<SearchHit[] | null> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'ru',
        hl: 'ru',
        num: 10,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      organic?: { title?: string; snippet?: string; link?: string }[];
    };

    const hits = (data.organic ?? [])
      .map((item) => ({
        title: item.title?.trim() ?? '',
        snippet: item.snippet?.trim() ?? '',
        url: item.link?.trim() ?? '',
      }))
      .filter((hit) => hit.title || hit.snippet);

    return hits.length > 0 ? hits : null;
  } catch {
    return null;
  }
}

export function serperSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
