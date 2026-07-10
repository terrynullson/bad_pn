import { delay } from './rate-limit';
import type { KtoZvonilResponse } from './types';

const API_BASE = 'https://ktozvonil.net/api/v2/numbers';
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

export function ktoZvonilSourceUrl(phone: string): string {
  return `https://ktozvonil.net/nomer/${phone}`;
}

export async function fetchKtoZvonil(
  phone: string
): Promise<KtoZvonilResponse | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${API_BASE}/${phone}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await delay(BACKOFF_MS[attempt] ?? 4000);
          continue;
        }
        return null;
      }

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as KtoZvonilResponse;
    } catch {
      if (attempt < MAX_RETRIES) {
        await delay(BACKOFF_MS[attempt] ?? 4000);
        continue;
      }
      return null;
    }
  }

  return null;
}

