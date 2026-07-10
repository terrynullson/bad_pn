export async function readErrorMessage(
  response: Response
): Promise<string> {
  const text = await response.text();

  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error ?? data.message ?? `Ошибка ${response.status}`;
  } catch {
    if (
      response.status === 504 ||
      response.status === 502 ||
      /an error occurred/i.test(text)
    ) {
      return 'Сервер не успел ответить (таймаут). Проверяйте по 1–2 номера за раз или отключите DEEPSEEK_CHECK на Vercel Hobby.';
    }

    return text.slice(0, 240) || `Ошибка ${response.status}`;
  }
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    if (
      response.status === 504 ||
      response.status === 502 ||
      /an error occurred/i.test(text)
    ) {
      throw new Error(
        'Сервер не успел ответить (таймаут). Проверяйте по 1–2 номера за раз.'
      );
    }

    throw new Error(
      text.slice(0, 240) || `Некорректный ответ сервера (${response.status})`
    );
  }
}
