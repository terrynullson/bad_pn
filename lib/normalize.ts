const HEADER_PATTERN = /^(phone|номер|number)$/i;
const LETTER_PATTERN = /[a-zA-Zа-яА-ЯёЁ]/;
const PHONE_CHARS_PATTERN = /^[\d\s\-+().,;]*$/;

export interface InvalidInputLine {
  lineNumber: number;
  content: string;
}

export function stripToDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1);
  }

  return digits;
}

export function lineHasInvalidChars(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  return (
    LETTER_PATTERN.test(trimmed) || !PHONE_CHARS_PATTERN.test(trimmed)
  );
}

export function findInvalidInputLines(text: string): InvalidInputLine[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => lineHasInvalidChars(line))
    .map(({ line, lineNumber }) => ({
      lineNumber,
      content: line.trim(),
    }));
}

export function sanitizeInputText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const digits = stripToDigits(line.trim());
      return digits;
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

export function normalizePhone(raw: string): string | null {
  const digits = stripToDigits(raw);

  if (!/^7\d{10}$/.test(digits)) {
    return null;
  }

  return digits;
}

export function parseNumbersFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseNumbersFromCsv(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const firstColumn = lines[0].split(',')[0].trim();
  const hasHeader = HEADER_PATTERN.test(firstColumn);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => line.split(',')[0].trim())
    .filter((value) => value.length > 0);
}

export function deduplicateWithMapping(
  numbers: string[]
): Map<string, string[]> {
  const mapping = new Map<string, string[]>();

  for (const phone of numbers) {
    const normalized = normalizePhone(phone);
    const key = normalized ?? `__invalid__:${phone}`;

    const existing = mapping.get(key);
    if (existing) {
      existing.push(phone);
    } else {
      mapping.set(key, [phone]);
    }
  }

  return mapping;
}

export function buildSummary(results: { verdict: string }[]): {
  total: number;
  ok: number;
  caution: number;
  reject: number;
  invalid: number;
} {
  return {
    total: results.length,
    ok: results.filter((r) => r.verdict === 'OK').length,
    caution: results.filter((r) => r.verdict === 'CAUTION').length,
    reject: results.filter((r) => r.verdict === 'REJECT').length,
    invalid: results.filter((r) => r.verdict === 'INVALID').length,
  };
}
