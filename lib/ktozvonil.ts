import { delay } from './rate-limit';
import { fetchWithOptionalProxy } from './proxy-fetch';
import type { KtoZvonilResponse } from './types';

const API_BASE = 'https://ktozvonil.net/api/v2/numbers';
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

export interface KtoZvonilFetchResult {
  data: KtoZvonilResponse | null;
  failureReason: string | null;
}

export function ktoZvonilSourceUrl(phone: string): string {
  return `https://ktozvonil.net/nomer/${phone}`;
}

export async function fetchKtoZvonil(
  phone: string
): Promise<KtoZvonilFetchResult> {
  let lastFailure: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetchWithOptionalProxy(`${API_BASE}/${phone}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'bad-phone-numbers/1.0 (+https://github.com/terrynullson/bad_pn)',
        },
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        lastFailure = 'KtoZvonil: лимит запросов (429)';
        if (attempt < MAX_RETRIES) {
          await delay(BACKOFF_MS[attempt] ?? 4000);
          continue;
        }
        return { data: null, failureReason: lastFailure };
      }

      if (!response.ok) {
        lastFailure = `KtoZvonil: HTTP ${response.status}`;
        return { data: null, failureReason: lastFailure };
      }

      return {
        data: (await response.json()) as KtoZvonilResponse,
        failureReason: null,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastFailure = 'KtoZvonil: таймаут запроса';
      } else {
        lastFailure = `KtoZvonil: ${error instanceof Error ? error.message : 'сетевая ошибка'}`;
      }

      if (attempt < MAX_RETRIES) {
        await delay(BACKOFF_MS[attempt] ?? 4000);
        continue;
      }
    }
  }

  return { data: null, failureReason: lastFailure };
}
