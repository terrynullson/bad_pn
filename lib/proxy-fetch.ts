import { ProxyAgent, fetch as undiciFetch } from 'undici';

/** Прокси только для KtoZvonil (приоритет) или общий HTTPS/HTTP_PROXY. */
export function getKtoZvonilProxyUrl(): string | undefined {
  const dedicated = process.env.KTOZVONIL_PROXY_URL?.trim();
  if (dedicated) return dedicated;

  return (
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    undefined
  );
}

export async function fetchWithOptionalProxy(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const proxyUrl = getKtoZvonilProxyUrl();

  if (!proxyUrl) {
    return fetch(url, init);
  }

  const agent = new ProxyAgent(proxyUrl);

  try {
    const response = await undiciFetch(url, {
      ...init,
      dispatcher: agent,
    } as Parameters<typeof undiciFetch>[1]);

    return response as unknown as Response;
  } finally {
    await agent.close();
  }
}
