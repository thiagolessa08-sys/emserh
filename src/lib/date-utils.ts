import type { ChecklistItemStatus } from '@/lib/types';

const PATTERNS = [
  /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
  /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
  /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // D/M/YY
];

export function parseBrazilianDate(input: string): Date | null {
  const trimmed = input.trim();
  for (const re of PATTERNS) {
    const m = trimmed.match(re);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = `20${y}`;
      const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

const ATTENTION_THRESHOLD_DAYS = 15;

export function validityStatus(validity: Date, now: Date = new Date()): ChecklistItemStatus {
  const diffMs = validity.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'NAO_CONFORME';
  if (diffDays <= ATTENTION_THRESHOLD_DAYS) return 'ATENCAO';
  return 'CONFORME';
}
