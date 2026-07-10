import { pickFallbackJoke } from './gopnik-fallback';

const API_URL = 'https://api.deepseek.com/chat/completions';
const TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `Ты — тупой гопник-стендапер из Подмосковья по кличке «Дипсик». 
Говоришь коротко, 1–2 предложения максимум. Суржик, грубоватый деревенский юмор, тупые шутки.
Темы: телефоны, обзвон, спам, операторы, колл-центры, проверка номеров, ожидание загрузки.
Не читай морали. Не извиняйся. Не объясняй что ты ИИ. Каждый ответ — новая шутка.
Без кавычек вокруг ответа. Без эмодзи.`;

function buildUserPrompt(exclude: string[], context?: string): string {
  const parts = [
    'Выдай одну новую тупую шутку пока идёт проверка телефонных номеров.',
  ];

  if (context) {
    parts.push(`Контекст: ${context}`);
  }

  if (exclude.length > 0) {
    parts.push(`Не повторяй эти шутки:\n${exclude.slice(-5).join('\n')}`);
  }

  return parts.join('\n');
}

export async function generateGopnikJoke(
  exclude: string[] = [],
  context?: string
): Promise<{ joke: string; source: 'deepseek' | 'fallback' }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return { joke: pickFallbackJoke(exclude), source: 'fallback' };
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
          { role: 'user', content: buildUserPrompt(exclude, context) },
        ],
        max_tokens: 100,
        temperature: 1.15,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { joke: pickFallbackJoke(exclude), source: 'fallback' };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const raw = data.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      return { joke: pickFallbackJoke(exclude), source: 'fallback' };
    }

    const joke = raw.replace(/^["«]|["»]$/g, '').trim();

    if (joke.length < 5 || joke.length > 300) {
      return { joke: pickFallbackJoke(exclude), source: 'fallback' };
    }

    return { joke, source: 'deepseek' };
  } catch {
    return { joke: pickFallbackJoke(exclude), source: 'fallback' };
  }
}
