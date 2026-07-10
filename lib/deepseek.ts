import {
  JOKE_STYLE_EXAMPLES,
  pickFallbackJoke,
  pickFallbackJokesBatch,
  pickFinaleMessage,
} from './gopnik-fallback';

const API_URL = 'https://api.deepseek.com/chat/completions';
const TIMEOUT_MS = 25_000;
const BATCH_SIZE = 10;
const PREFETCH_THRESHOLD = 3;

export { BATCH_SIZE, PREFETCH_THRESHOLD };

const SYSTEM_PROMPT = `Ты — тупой гопник-стендапер из Подмосковья. Говоришь как пацан с района: суржик, деревенский юмор, тупые но смешные приколы.
Можно и нужно материться: хуй, хуйня, бля, заебись, пиздец, нахуй — в меру, для колорита.
Каждая шутка — 1–2 коротких предложения. Темы: телефоны, обзвон, спам, операторы, колл-центры, проверка номеров, ожидание базы.
Не читай морали. Не извиняйся. Не объясняй что ты ИИ. Без эмодзи. Без кавычек вокруг шуток.
Пиши в ТОЧНО ТАКОМ ЖЕ стиле как примеры — грубо, живо, с самоиронией и бытовыми сравнениями.`;

function buildBatchUserPrompt(
  count: number,
  exclude: string[],
  context?: string
): string {
  const parts = [
    `Выдай ровно ${count} РАЗНЫХ шуток пока идёт проверка телефонных номеров.`,
    'Формат ответа — ТОЛЬКО JSON-массив строк, без markdown и пояснений:',
    '["шутка 1", "шутка 2", ...]',
    '',
    'Примеры стиля (копируй тон и подачу, НЕ повторяй дословно):',
    ...JOKE_STYLE_EXAMPLES.map((joke) => `- ${joke}`),
  ];

  if (context) {
    parts.push('', `Контекст: ${context}`);
  }

  if (exclude.length > 0) {
    parts.push(
      '',
      'Не повторяй и не перефразируй эти шутки:',
      ...exclude.slice(-20).map((joke) => `- ${joke}`)
    );
  }

  return parts.join('\n');
}

function buildFinalePrompt(context?: string): string {
  const parts = [
    'Проверка телефонных номеров только что завершилась. Выдай одну короткую завершающую фразу (1–2 предложения): подведи итог, скажи что всё готово.',
    'Тон: суржик, грубовато, можно мат. Это финал, не шутка про ожидание.',
  ];

  if (context) {
    parts.push(`Контекст: ${context}`);
  }

  return parts.join('\n');
}

function cleanJoke(raw: string): string {
  return raw.replace(/^["«'-\s]+|["»'\s]+$/g, '').trim();
}

function parseJokesJson(raw: string, count: number): string[] {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => cleanJoke(String(item)))
      .filter((joke) => joke.length >= 5 && joke.length <= 300)
      .slice(0, count);
  } catch {
    const lines = cleaned
      .split('\n')
      .map((line) => cleanJoke(line.replace(/^\d+[\).\s-]+/, '')))
      .filter((joke) => joke.length >= 5 && joke.length <= 300);

    return lines.slice(0, count);
  }
}

export async function generateGopnikJokes(
  count: number = BATCH_SIZE,
  exclude: string[] = [],
  context?: string
): Promise<{ jokes: string[]; source: 'deepseek' | 'fallback' }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      jokes: pickFallbackJokesBatch(count, exclude),
      source: 'fallback',
    };
  }

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildBatchUserPrompt(count, exclude, context) },
        ],
        max_tokens: Math.min(2200, count * 120 + 200),
        temperature: 1.2,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        jokes: pickFallbackJokesBatch(count, exclude),
        source: 'fallback',
      };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return {
        jokes: pickFallbackJokesBatch(count, exclude),
        source: 'fallback',
      };
    }

    const jokes = parseJokesJson(raw, count);
    if (jokes.length < Math.max(3, Math.floor(count / 2))) {
      const fallback = pickFallbackJokesBatch(count, [...exclude, ...jokes]);
      return { jokes: fallback, source: 'fallback' };
    }

    while (jokes.length < count) {
      const extra = pickFallbackJoke([...exclude, ...jokes]);
      jokes.push(extra);
    }

    return { jokes, source: 'deepseek' };
  } catch {
    return {
      jokes: pickFallbackJokesBatch(count, exclude),
      source: 'fallback',
    };
  }
}

export async function generateGopnikJoke(
  exclude: string[] = [],
  context?: string
): Promise<{ joke: string; source: 'deepseek' | 'fallback' }> {
  const result = await generateGopnikJokes(1, exclude, context);
  return { joke: result.jokes[0], source: result.source };
}

export async function generateFinaleMessage(
  context?: string
): Promise<{ joke: string; source: 'deepseek' | 'fallback' }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return { joke: pickFinaleMessage(), source: 'fallback' };
  }

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildFinalePrompt(context) },
        ],
        max_tokens: 120,
        temperature: 1.0,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { joke: pickFinaleMessage(), source: 'fallback' };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const raw = data.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return { joke: pickFinaleMessage(), source: 'fallback' };
    }

    const joke = cleanJoke(raw);

    if (joke.length < 5 || joke.length > 300) {
      return { joke: pickFinaleMessage(), source: 'fallback' };
    }

    return { joke, source: 'deepseek' };
  } catch {
    return { joke: pickFinaleMessage(), source: 'fallback' };
  }
}
