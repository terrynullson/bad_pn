import { collectPhoneSearchHits, type PhoneSearchCache } from './search-fallback';
import type { PhoneSourceData } from './checker';
import type { DeepSeekCheck, Verdict } from './types';

const API_URL = 'https://api.deepseek.com/chat/completions';
const TIMEOUT_MS = 20_000;

const CHECK_SYSTEM_PROMPT = `Ты аналитик по проверке российских мобильных номеров перед АРЕНДОЙ линии для исходящего обзвона.
Номер будут использовать как АОН: при звонке клиенту не должно всплывать «Спам», «Мошенник», «Нежелательный».
На входе — сниппеты из поисковика и сводка других источников.
Оцени, есть ли признаки спама, нежелательного звонка или мошенничества у ЭТОЙ линии.

Отвечай ТОЛЬКО валидным JSON без markdown и пояснений:
{"verdict":"OK"|"PASS"|"CAUTION"|"REJECT","confidence":0.0,"isUnwanted":false,"isNegative":false,"summary":"кратко по-русски","signals":["..."]}

Правила:
- REJECT — явный спам/мошенник/негатив: линию для исходящих брать нельзя
- CAUTION при слабых/неоднозначных сигналах
- PASS если негатива нет, но данных мало или источники недоступны
- OK если уверенно чистая линия для исходящих
- confidence от 0 до 1 — насколько уверен в выводе
- Не выдумывай факты, которых нет во входных данных
- signals — короткие цитаты/факты из сниппетов`;

function isEnabled(): boolean {
  return (
    process.env.ENABLE_DEEPSEEK_CHECK === 'true' &&
    Boolean(process.env.DEEPSEEK_API_KEY?.trim())
  );
}

function getMode(): 'all' | 'fallback' {
  return process.env.DEEPSEEK_CHECK_MODE === 'all' ? 'all' : 'fallback';
}

export function deepSeekCheckSourceUrl(phone: string): string {
  return `https://platform.deepseek.com/`;
}

function shouldRunCheck(sourceData: PhoneSourceData): boolean {
  if (getMode() === 'all') return true;

  const sp = sourceData.spravportal;
  if (sp?.blocked && sp.method === 'none') return true;
  if (!sp || !sp.available) return true;
  if (sp.method === 'search' && !sp.isSpam) return true;

  return false;
}

function buildSourcesSummary(sourceData: PhoneSourceData): string {
  const lines: string[] = [];

  const kto = sourceData.ktozvonil;
  if (kto) {
    lines.push(
      `KtoZvonil: spam=${kto.reputation?.is_spam ?? false}, level=${kto.reputation?.level ?? '?'}, reviews=${kto.reputation?.reviews_count ?? 0}`
    );
  } else {
    lines.push('KtoZvonil: недоступен');
  }

  const sp = sourceData.spravportal;
  if (sp) {
    lines.push(
      `SpravPortal: method=${sp.method}, blocked=${sp.blocked}, unwanted=${sp.isUnwanted}, negative=${sp.isNegative}, spam=${sp.isSpam}`
    );
  } else {
    lines.push('SpravPortal: недоступен');
  }

  const cf = sourceData.callfilter;
  if (cf?.available) {
    lines.push(
      `Callfilter: score=${cf.score ?? '?'}, negative=${cf.isNegative}, reviews=${cf.reviewsCount}`
    );
  }

  const ya = sourceData.yandexCaller;
  if (ya) {
    lines.push(
      `Yandex heuristic: unwanted=${ya.isUnwanted}, negative=${ya.isNegative}, spam=${ya.isSpam}`
    );
  }

  return lines.join('\n');
}

function buildSnippetsBlock(
  hits: { title: string; snippet: string; url: string }[]
): string {
  if (hits.length === 0) return 'Поисковые сниппеты: не получены';

  return hits
    .slice(0, 12)
    .map(
      (hit, i) =>
        `${i + 1}. ${hit.title}\n   ${hit.snippet}\n   ${hit.url}`
    )
    .join('\n');
}

function parseVerdict(value: unknown): Verdict {
  if (
    value === 'REJECT' ||
    value === 'CAUTION' ||
    value === 'PASS' ||
    value === 'OK'
  ) {
    return value;
  }
  return 'CAUTION';
}

function parseCheckResponse(raw: string): Omit<
  DeepSeekCheck,
  'available' | 'fallback' | 'snippetCount' | 'sourceUrl'
> | null {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const data = JSON.parse(cleaned) as {
      verdict?: string;
      confidence?: number;
      isUnwanted?: boolean;
      isNegative?: boolean;
      summary?: string;
      signals?: string[];
    };

    const verdict = parseVerdict(data.verdict);
    const confidence =
      typeof data.confidence === 'number'
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.5;

    const isUnwanted = Boolean(data.isUnwanted);
    const isNegative = Boolean(data.isNegative);
    const isSpam =
      verdict === 'REJECT' || isUnwanted || isNegative;

    return {
      verdict,
      confidence,
      isUnwanted,
      isNegative,
      isSpam,
      summary: data.summary?.trim() || 'Анализ DeepSeek без комментария',
      signals: Array.isArray(data.signals)
        ? data.signals.map((s) => String(s).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}

export async function fetchDeepSeekCheck(
  phone: string,
  sourceData: PhoneSourceData,
  cache?: PhoneSearchCache
): Promise<DeepSeekCheck | null> {
  if (!isEnabled() || !shouldRunCheck(sourceData)) {
    return null;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;

  const collected = await collectPhoneSearchHits(phone, cache);
  const hits = collected?.hits ?? [];
  const sourceUrl = collected?.sourceUrl ?? deepSeekCheckSourceUrl(phone);

  const userPrompt = [
    `Номер: ${phone}`,
    '',
    'Сводка других источников:',
    buildSourcesSummary(sourceData),
    '',
    'Поисковые сниппеты:',
    buildSnippetsBlock(hits),
  ].join('\n');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: CHECK_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 350,
        temperature: 0.1,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        fallback: true,
        verdict: 'CAUTION',
        confidence: 0,
        isUnwanted: false,
        isNegative: false,
        isSpam: false,
        summary: 'DeepSeek недоступен',
        signals: [],
        snippetCount: hits.length,
        sourceUrl,
      };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = parseCheckResponse(raw);
    if (!parsed) return null;

    return {
      available: true,
      fallback: true,
      snippetCount: hits.length,
      sourceUrl,
      ...parsed,
    };
  } catch {
    return null;
  }
}
