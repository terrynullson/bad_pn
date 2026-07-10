import { callfilterSourceUrl } from './callfilter';
import { ktoZvonilSourceUrl } from './ktozvonil';
import { duckDuckGoSearchUrl } from './search-fallback';
import { spravportalSourceUrl, yandexSearchUrl } from './spravportal';
import {
  yandexCallerHeuristicUrl,
  yandexCallerPageUrl,
  yandexCallerSourceUrl,
} from './yandex-caller';
import type { PhoneSourceData } from './checker';
import type {
  CallfilterCheck,
  Issue,
  KtoZvonilResponse,
  PhoneCheckResult,
  Source,
  SpravPortalCheck,
  Verdict,
  YandexCallerCheck,
} from './types';

const CAUTION_TAGS = ['реклама', 'коллектор'];

const VERDICT_RANK: Record<Verdict, number> = {
  INVALID: 0,
  OK: 1,
  CAUTION: 2,
  REJECT: 3,
};

function worstVerdict(verdicts: Verdict[]): Verdict {
  return verdicts.reduce(
    (worst, current) =>
      VERDICT_RANK[current] > VERDICT_RANK[worst] ? current : worst,
    'OK'
  );
}

function collectCategories(data: KtoZvonilResponse): string[] {
  const categories = new Set<string>();

  for (const tag of data.tags ?? []) {
    if (tag.trim()) categories.add(tag.trim());
  }

  for (const review of data.reviews ?? []) {
    if (review.category?.trim()) categories.add(review.category.trim());
    if (review.text?.trim()) categories.add(review.text.trim());
  }

  return Array.from(categories);
}

function hasCautionTags(tags: string[]): boolean {
  const lower = tags.map((t) => t.toLowerCase());
  return CAUTION_TAGS.some((tag) =>
    lower.some((t) => t.includes(tag))
  );
}

function buildInvalidResult(phone: string): PhoneCheckResult {
  return {
    phone,
    normalized: '',
    verdict: 'INVALID',
    operator: null,
    region: null,
    reviewsCount: 0,
    issues: [
      {
        severity: 'error',
        message: 'Неверный формат номера',
        source: 'Система',
        sourceUrl: '',
      },
    ],
    sources: [],
    checkedAt: new Date().toISOString(),
  };
}

function buildKtoZvonilIssues(
  data: KtoZvonilResponse | null,
  phone: string,
  unavailable: boolean
): Issue[] {
  const sourceUrl = ktoZvonilSourceUrl(phone);
  const issues: Issue[] = [];

  if (unavailable || !data) {
    issues.push({
      severity: 'warning',
      message: 'Сервис KtoZvonil недоступен',
      source: 'KtoZvonil',
      sourceUrl,
    });
    return issues;
  }

  const meta = data.meta;
  if (meta?.operator || meta?.region || meta?.type) {
    const parts = [
      meta.operator ? `Оператор: ${meta.operator}` : null,
      meta.region ? `регион: ${meta.region}` : null,
      meta.type ? `тип: ${meta.type}` : null,
    ].filter(Boolean);

    issues.push({
      severity: 'info',
      message: parts.join(', '),
      source: 'KtoZvonil',
      sourceUrl,
    });
  }

  const reputation = data.reputation;
  const reviewsCount = reputation?.reviews_count ?? 0;
  const categories = collectCategories(data);

  if (reputation?.is_spam) {
    issues.push({
      severity: 'error',
      message: 'Номер помечен как спам',
      source: 'KtoZvonil',
      sourceUrl,
      details: reputation.spam_reason ?? undefined,
    });
  }

  if (reputation?.level === 'danger') {
    issues.push({
      severity: 'error',
      message: 'Высокий уровень опасности',
      source: 'KtoZvonil',
      sourceUrl,
    });
  }

  if (reviewsCount > 0) {
    const categoryText =
      categories.length > 0 ? categories.join(', ') : 'без категорий';
    issues.push({
      severity: reviewsCount > 5 ? 'error' : 'warning',
      message: `Найдено ${reviewsCount} отзыв${reviewsCount === 1 ? '' : reviewsCount < 5 ? 'а' : 'ов'}: ${categoryText}`,
      source: 'KtoZvonil',
      sourceUrl,
      details: categoryText,
    });
  } else if (
    !reputation?.is_spam &&
    reputation?.level === 'safe' &&
    (data.tags?.length ?? 0) === 0
  ) {
    issues.push({
      severity: 'info',
      message: 'В базе KtoZvonil нет жалоб на этот номер',
      source: 'KtoZvonil',
      sourceUrl,
    });
  }

  if (hasCautionTags(categories)) {
    issues.push({
      severity: 'warning',
      message: 'Обнаружены теги: реклама или коллектор',
      source: 'KtoZvonil',
      sourceUrl,
      details: categories.join(', '),
    });
  }

  if (reputation?.level === 'warning') {
    issues.push({
      severity: 'warning',
      message: 'Предупреждение от сервиса',
      source: 'KtoZvonil',
      sourceUrl,
    });
  }

  return issues;
}

function getSpravSourceMeta(
  data: SpravPortalCheck,
  phone: string
): { name: string; url: string; unofficial: boolean } {
  if (data.method === 'api') {
    return {
      name: 'SpravPortal API',
      url: spravportalSourceUrl(phone),
      unofficial: false,
    };
  }

  if (data.method === 'search') {
    return {
      name: 'Поиск (эвристика)',
      url: data.fallbackSourceUrl ?? duckDuckGoSearchUrl(phone),
      unofficial: true,
    };
  }

  if (data.method === 'scrape') {
    return {
      name: 'SpravPortal (парсинг)',
      url: spravportalSourceUrl(phone),
      unofficial: true,
    };
  }

  return {
    name: 'SpravPortal',
    url: spravportalSourceUrl(phone),
    unofficial: false,
  };
}

function buildSpravPortalIssues(
  data: SpravPortalCheck | null,
  phone: string,
  hasApiKey: boolean
): Issue[] {
  const defaultUrl = spravportalSourceUrl(phone);
  const issues: Issue[] = [];

  if (!data) {
    issues.push({
      severity: 'warning',
      message: 'Сервис SpravPortal недоступен',
      source: 'SpravPortal',
      sourceUrl: defaultUrl,
    });
    return issues;
  }

  if (data.blocked && data.method === 'none') {
    issues.push({
      severity: 'warning',
      message:
        'SpravPortal заблокировал прямой доступ, а поисковая эвристика тоже не сработала',
      source: 'SpravPortal',
      sourceUrl: defaultUrl,
      details: hasApiKey
        ? 'Проверьте WHO_CALLS_API_URL и WHO_CALLS_API_KEY в настройках Vercel'
        : 'Запросите тестовый ключ на api@spravportal.ru',
    });
    issues.push({
      severity: 'info',
      message: 'Проверьте номер вручную через поиск',
      source: 'Яндекс',
      sourceUrl: yandexSearchUrl(phone),
    });
    return issues;
  }

  const sourceMeta = getSpravSourceMeta(data, phone);

  if (data.fallback) {
    issues.push({
      severity: 'info',
      message:
        data.method === 'search'
          ? 'Данные SpravPortal получены через поисковую эвристику (сниппеты DuckDuckGo) — метод ненадёжный'
          : 'Данные SpravPortal получены парсингом страницы — метод ненадёжный',
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      details: 'Для продакшена рекомендуется SpravPortal API',
      unofficial: true,
    });
  }

  if (data.isUnwanted) {
    issues.push({
      severity: 'error',
      message: 'Номер помечен как нежелательный звонок',
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      details: data.categories.join(', ') || data.fallbackSignals?.join('; ') || undefined,
      unofficial: sourceMeta.unofficial,
    });
  }

  if (data.isNegative) {
    issues.push({
      severity: 'error',
      message: 'Отрицательная оценка номера',
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      details:
        data.rating !== null
          ? `Рейтинг: ${data.rating} / 5`
          : data.fallbackSignals?.join('; '),
      unofficial: sourceMeta.unofficial,
    });
  }

  if (data.isSpam && !data.isUnwanted && !data.isNegative) {
    issues.push({
      severity: 'error',
      message: 'Номер в спам-базе SpravPortal',
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      details: data.categories.join(', ') || undefined,
      unofficial: sourceMeta.unofficial,
    });
  }

  if (data.rating !== null && data.rating <= 3 && !data.isNegative) {
    issues.push({
      severity: data.rating <= 2 ? 'error' : 'warning',
      message: `Низкий рейтинг: ${data.rating} / 5`,
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      unofficial: sourceMeta.unofficial,
    });
  }

  if (data.reviewText && !data.isUnwanted && !data.isNegative) {
    issues.push({
      severity: 'warning',
      message: `Отзыв: ${data.reviewText}`,
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      unofficial: sourceMeta.unofficial,
    });
  }

  if (
    data.categories.length > 0 &&
    !data.isUnwanted &&
    !data.isSpam &&
    !data.isNegative
  ) {
    issues.push({
      severity: 'warning',
      message: `Сигналы: ${data.categories.join(', ')}`,
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      unofficial: sourceMeta.unofficial,
    });
  }

  if (
    data.method === 'search' &&
    data.inDatabase &&
    !data.isSpam &&
    data.fallbackSignals?.length
  ) {
    issues.push({
      severity: 'info',
      message: data.fallbackSignals[0],
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      unofficial: true,
    });
  }

  if (
    data.inDatabase &&
    !data.isSpam &&
    !data.isUnwanted &&
    !data.isNegative &&
    (data.rating === null || data.rating > 3) &&
    data.method !== 'search'
  ) {
    issues.push({
      severity: 'info',
      message: 'Номер не значится в спам-базах SpravPortal',
      source: sourceMeta.name,
      sourceUrl: sourceMeta.url,
      unofficial: sourceMeta.unofficial,
    });
  }

  return issues;
}

function buildCallfilterIssues(
  data: CallfilterCheck | null,
  phone: string
): Issue[] {
  const sourceUrl = callfilterSourceUrl(phone);
  const sourceName = 'Callfilter (эвристика)';
  const issues: Issue[] = [];

  if (!data || !data.available) {
    issues.push({
      severity: 'warning',
      message: 'Callfilter.app недоступен',
      source: sourceName,
      sourceUrl,
      unofficial: true,
    });
    return issues;
  }

  issues.push({
    severity: 'info',
    message: 'Данные Callfilter получены парсингом страницы — неофициальный метод',
    source: sourceName,
    sourceUrl,
    unofficial: true,
  });

  if (data.isNegative || data.score === 'negative') {
    issues.push({
      severity: 'error',
      message: 'Отрицательная оценка на Callfilter',
      source: sourceName,
      sourceUrl,
      details: [
        data.status,
        data.ratings.join(', '),
        data.categories.join(', '),
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
      unofficial: true,
    });
  }

  if (data.reviewsCount > 0) {
    issues.push({
      severity: data.reviewsCount > 5 || data.isNegative ? 'error' : 'warning',
      message: `Callfilter: ${data.reviewsCount} отзыв${data.reviewsCount === 1 ? '' : data.reviewsCount < 5 ? 'а' : 'ов'}`,
      source: sourceName,
      sourceUrl,
      unofficial: true,
    });
  }

  if (data.categories.length > 0 && !data.isNegative) {
    issues.push({
      severity: 'warning',
      message: `Категории Callfilter: ${data.categories.join(', ')}`,
      source: sourceName,
      sourceUrl,
      unofficial: true,
    });
  }

  if (
    !data.isNegative &&
    data.reviewsCount === 0 &&
    (data.status?.toLowerCase().includes('нет рейтинга') ||
      data.score === 'neutral')
  ) {
    issues.push({
      severity: 'info',
      message: 'На Callfilter нет негативных отзывов',
      source: sourceName,
      sourceUrl,
      unofficial: true,
    });
  }

  return issues;
}

function buildYandexCallerIssues(
  data: YandexCallerCheck | null,
  phone: string
): Issue[] {
  const sourceName = 'Яндекс «Кто звонил» (эвристика)';
  const sourceUrl = data?.sourceUrl ?? yandexCallerSourceUrl(phone);
  const issues: Issue[] = [];

  if (!data) {
    issues.push({
      severity: 'warning',
      message: 'Яндекс «Кто звонил» недоступен',
      source: sourceName,
      sourceUrl: yandexCallerPageUrl(),
      unofficial: true,
    });
    return issues;
  }

  if (data.blocked) {
    issues.push({
      severity: 'info',
      message:
        'Прямой доступ к yandex.ru/yandexapp/ru/callerid/whocalled заблокирован капчей — используется поисковая эвристика',
      source: sourceName,
      sourceUrl: yandexCallerHeuristicUrl(phone),
      unofficial: true,
    });
  }

  if (data.fallback) {
    issues.push({
      severity: 'info',
      message: 'Данные Яндекса получены через поисковые сниппеты — метод ненадёжный',
      source: sourceName,
      sourceUrl,
      unofficial: true,
    });
  }

  if (data.isUnwanted) {
    issues.push({
      severity: 'error',
      message: data.label
        ? `Яндекс: ${data.label}`
        : 'Номер помечен как нежелательный (по данным поиска)',
      source: sourceName,
      sourceUrl,
      details: data.signals.join('; ') || data.snippet || undefined,
      unofficial: true,
    });
  }

  if (data.isNegative && !data.isUnwanted) {
    issues.push({
      severity: 'error',
      message: 'Отрицательная оценка в базе Яндекса (по данным поиска)',
      source: sourceName,
      sourceUrl,
      details: data.signals.join('; ') || data.snippet || undefined,
      unofficial: true,
    });
  }

  if (data.isSpam && !data.isUnwanted && !data.isNegative) {
    issues.push({
      severity: 'error',
      message: 'Номер в спам-базе (по данным поиска Яндекса)',
      source: sourceName,
      sourceUrl,
      details: data.signals.join('; ') || undefined,
      unofficial: true,
    });
  }

  if (
    data.inDatabase &&
    !data.isSpam &&
    !data.isUnwanted &&
    !data.isNegative &&
    data.signals.length > 0
  ) {
    issues.push({
      severity: 'info',
      message: data.signals[0],
      source: sourceName,
      sourceUrl,
      unofficial: true,
    });
  }

  if (
    data.available &&
    data.inDatabase &&
    !data.isSpam &&
    !data.isUnwanted &&
    !data.isNegative
  ) {
    issues.push({
      severity: 'info',
      message: 'В поиске нет негативных меток Яндекса по номеру',
      source: sourceName,
      sourceUrl,
      unofficial: true,
    });
  }

  return issues;
}

function determineKtoZvonilVerdict(
  data: KtoZvonilResponse | null,
  unavailable: boolean
): Verdict {
  if (unavailable || !data) return 'CAUTION';

  const reputation = data.reputation;
  const reviewsCount = reputation?.reviews_count ?? 0;
  const categories = collectCategories(data);

  if (
    reputation?.is_spam ||
    reviewsCount > 5 ||
    reputation?.level === 'danger'
  ) {
    return 'REJECT';
  }

  if (
    (reviewsCount >= 1 && reviewsCount <= 5) ||
    hasCautionTags(categories) ||
    reputation?.level === 'warning'
  ) {
    return 'CAUTION';
  }

  return 'OK';
}

function determineSpravPortalVerdict(data: SpravPortalCheck | null): Verdict {
  if (data?.blocked && data.method === 'none') return 'CAUTION';
  if (!data || !data.available) return 'CAUTION';

  if (data.isSpam || data.isUnwanted || data.isNegative) {
    return 'REJECT';
  }

  if (data.rating !== null && data.rating <= 2) {
    return 'REJECT';
  }

  if (data.rating !== null && data.rating <= 3) {
    return 'CAUTION';
  }

  if (data.categories.length > 0 || data.reviewText) {
    return 'CAUTION';
  }

  return 'OK';
}

function determineCallfilterVerdict(data: CallfilterCheck | null): Verdict {
  if (!data || !data.available) return 'CAUTION';

  if (data.isNegative || data.score === 'negative') {
    return 'REJECT';
  }

  if (data.reviewsCount > 5) {
    return 'REJECT';
  }

  if (data.reviewsCount >= 1 || data.categories.length > 0) {
    return 'CAUTION';
  }

  return 'OK';
}

function determineYandexCallerVerdict(data: YandexCallerCheck | null): Verdict {
  if (!data || !data.available) return 'CAUTION';

  if (data.isSpam || data.isUnwanted || data.isNegative) {
    return 'REJECT';
  }

  return 'OK';
}

function buildSources(phone: string, sourceData: PhoneSourceData): Source[] {
  const spravportal = sourceData.spravportal;
  const sources: Source[] = [
    { name: 'KtoZvonil', url: ktoZvonilSourceUrl(phone) },
  ];

  if (spravportal && spravportal.available && spravportal.method !== 'none') {
    const meta = getSpravSourceMeta(spravportal, phone);
    sources.push({
      name: meta.name,
      url: meta.url,
      unofficial: meta.unofficial,
    });
  } else {
    sources.push({ name: 'SpravPortal', url: spravportalSourceUrl(phone) });
  }

  if (spravportal?.fallback) {
    sources.push({
      name: 'Яндекс',
      url: yandexSearchUrl(phone),
      unofficial: true,
    });
  }

  if (sourceData.callfilter?.available) {
    sources.push({
      name: 'Callfilter (эвристика)',
      url: callfilterSourceUrl(phone),
      unofficial: true,
    });
  }

  if (sourceData.yandexCaller) {
    sources.push({
      name: 'Яндекс «Кто звонил» (эвристика)',
      url: sourceData.yandexCaller.sourceUrl,
      unofficial: true,
    });
  }

  return sources;
}

export function buildResult(
  phone: string,
  normalized: string | null,
  sourceData: PhoneSourceData
): PhoneCheckResult {
  if (!normalized) {
    return buildInvalidResult(phone);
  }

  const ktoIssues = buildKtoZvonilIssues(
    sourceData.ktozvonil,
    normalized,
    sourceData.ktozvonilUnavailable
  );
  const hasApiKey = Boolean(process.env.WHO_CALLS_API_KEY && process.env.WHO_CALLS_API_URL);
  const spravIssues = buildSpravPortalIssues(
    sourceData.spravportal,
    normalized,
    hasApiKey
  );
  const callfilterIssues = buildCallfilterIssues(
    sourceData.callfilter,
    normalized
  );
  const yandexIssues = buildYandexCallerIssues(
    sourceData.yandexCaller,
    normalized
  );

  const issues = [
    ...ktoIssues,
    ...spravIssues,
    ...callfilterIssues,
    ...yandexIssues,
  ].sort((a, b) => {
    const rank = { error: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  const verdict = worstVerdict([
    determineKtoZvonilVerdict(
      sourceData.ktozvonil,
      sourceData.ktozvonilUnavailable
    ),
    determineSpravPortalVerdict(sourceData.spravportal),
    determineCallfilterVerdict(sourceData.callfilter),
    determineYandexCallerVerdict(sourceData.yandexCaller),
  ]);

  const ktoReviews = sourceData.ktozvonil?.reputation?.reviews_count ?? 0;
  const spravReviews = sourceData.spravportal?.reviewText ? 1 : 0;
  const callfilterReviews = sourceData.callfilter?.reviewsCount ?? 0;

  return {
    phone,
    normalized,
    verdict,
    operator: sourceData.ktozvonil?.meta?.operator ?? null,
    region: sourceData.ktozvonil?.meta?.region ?? null,
    reviewsCount: Math.max(ktoReviews, spravReviews, callfilterReviews),
    issues,
    sources: buildSources(normalized, sourceData),
    checkedAt: new Date().toISOString(),
  };
}
