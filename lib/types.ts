export type Verdict = 'OK' | 'PASS' | 'CAUTION' | 'REJECT' | 'INVALID';
export type IssueSeverity = 'info' | 'warning' | 'error';

export interface Issue {
  severity: IssueSeverity;
  message: string;
  source: string;
  sourceUrl: string;
  details?: string;
  unofficial?: boolean;
}

export interface Source {
  name: string;
  url: string;
  unofficial?: boolean;
}

export interface PhoneCheckResult {
  phone: string;
  normalized: string;
  verdict: Verdict;
  operator: string | null;
  region: string | null;
  reviewsCount: number;
  issues: Issue[];
  sources: Source[];
  checkedAt: string;
}

export interface CheckSummary {
  total: number;
  ok: number;
  pass: number;
  caution: number;
  reject: number;
  invalid: number;
}

export interface CheckResponse {
  summary: CheckSummary;
  results: PhoneCheckResult[];
}

// Заглушка для будущей HLR-проверки
export interface HlrCheckResult {}

export interface KtoZvonilMeta {
  operator?: string;
  region?: string;
  type?: string;
}

export interface KtoZvonilReputation {
  score?: number;
  level?: string;
  is_spam?: boolean;
  spam_reason?: string | null;
  reviews_count?: number;
}

export interface KtoZvonilReview {
  text?: string;
  category?: string;
}

export interface KtoZvonilResponse {
  number: string;
  meta?: KtoZvonilMeta;
  reputation?: KtoZvonilReputation;
  tags?: string[];
  reviews?: KtoZvonilReview[];
}

export type SpravPortalMethod = 'api' | 'scrape' | 'search' | 'none';

export interface SpravPortalCheck {
  available: boolean;
  blocked: boolean;
  method: SpravPortalMethod;
  fallback: boolean;
  inDatabase: boolean;
  isSpam: boolean;
  isUnwanted: boolean;
  isNegative: boolean;
  rating: number | null;
  categories: string[];
  reviewText: string | null;
  fallbackSignals?: string[];
  fallbackSourceUrl?: string;
}

export type CallfilterScore = 'negative' | 'neutral' | 'positive' | 'unknown';

export interface CallfilterCheck {
  available: boolean;
  fallback: boolean;
  score: CallfilterScore | null;
  status: string | null;
  categories: string[];
  ratings: string[];
  reviewsCount: number;
  description: string | null;
  isNegative: boolean;
}

export interface YandexCallerCheck {
  available: boolean;
  fallback: boolean;
  blocked: boolean;
  inDatabase: boolean;
  isUnwanted: boolean;
  isNegative: boolean;
  isSpam: boolean;
  label: string | null;
  signals: string[];
  snippet: string | null;
  sourceUrl: string;
}

export interface DeepSeekCheck {
  available: boolean;
  fallback: boolean;
  verdict: Verdict;
  confidence: number;
  isUnwanted: boolean;
  isNegative: boolean;
  isSpam: boolean;
  summary: string;
  signals: string[];
  snippetCount: number;
  sourceUrl: string;
}

export const BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 30;
