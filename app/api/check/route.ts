import { NextRequest, NextResponse } from 'next/server';
import { checkPhoneSources } from '@/lib/checker';
import {
  buildSummary,
  deduplicateWithMapping,
  normalizePhone,
  parseNumbersFromCsv,
  parseNumbersFromText,
} from '@/lib/normalize';
import { delay } from '@/lib/rate-limit';
import type { CheckResponse, PhoneCheckResult } from '@/lib/types';
import { MAX_BATCH_SIZE } from '@/lib/types';
import { buildResult } from '@/lib/verdict';

export const maxDuration = 60;

async function parseNumbersFromRequest(
  request: NextRequest
): Promise<string[] | null> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return null;
    }

    const text = await file.text();
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
      return parseNumbersFromCsv(text);
    }

    return parseNumbersFromText(text);
  }

  if (contentType.includes('application/json')) {
    const body = (await request.json()) as { numbers?: string[] };
    if (!Array.isArray(body.numbers)) {
      return null;
    }
    return body.numbers;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const numbers = await parseNumbersFromRequest(request);

  if (!numbers) {
    return NextResponse.json(
      { error: 'Ожидается JSON { numbers: string[] } или multipart/form-data с file' },
      { status: 400 }
    );
  }

  if (numbers.length === 0) {
    return NextResponse.json(
      { error: 'Загрузите номера' },
      { status: 400 }
    );
  }

  if (numbers.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Максимум ${MAX_BATCH_SIZE} номеров за один запрос` },
      { status: 400 }
    );
  }

  const mapping = deduplicateWithMapping(numbers);
  const uniqueResults = new Map<string, PhoneCheckResult>();

  let isFirstApiCall = true;

  for (const [key, originals] of mapping.entries()) {
    const samplePhone = originals[0];
    const isInvalidKey = key.startsWith('__invalid__:');
    const normalized = isInvalidKey ? null : key;

    if (!normalized) {
      uniqueResults.set(
        key,
        buildResult(samplePhone, null, {
          ktozvonil: null,
          ktozvonilUnavailable: false,
          spravportal: null,
        })
      );
      continue;
    }

    if (!isFirstApiCall) {
      await delay(1000);
    }
    isFirstApiCall = false;

    const sourceData = await checkPhoneSources(normalized);
    uniqueResults.set(key, buildResult(samplePhone, normalized, sourceData));
  }

  const results: PhoneCheckResult[] = [];

  for (const phone of numbers) {
    const normalized = normalizePhone(phone);
    const key = normalized ?? `__invalid__:${phone}`;
    const template = uniqueResults.get(key);

    if (!template) continue;

    results.push({
      ...template,
      phone,
    });
  }

  const response: CheckResponse = {
    summary: buildSummary(results),
    results,
  };

  return NextResponse.json(response);
}
