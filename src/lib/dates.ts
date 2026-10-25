import type { DateKey } from './types';
import { getLang, tr } from '../i18n';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of a Date (uses local getters, so it follows the device timezone). */
export function toKey(d: Date = new Date()): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayKey = (): DateKey => toKey(new Date());

export function parseKey(key: DateKey): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}
export function isValidKey(key: unknown): key is DateKey {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { y, m, d } = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** All calendar arithmetic runs in UTC so DST shifts can never move a date. */
const utc = (key: DateKey) => { const { y, m, d } = parseKey(key); return Date.UTC(y, m - 1, d); };
const fromUtc = (ms: number): DateKey => {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

export const addDays = (key: DateKey, n: number): DateKey => fromUtc(utc(key) + n * 86400000);
export const diffDays = (a: DateKey, b: DateKey): number => Math.round((utc(a) - utc(b)) / 86400000);
/** 0 = Sunday … 6 = Saturday */
export const weekday = (key: DateKey): number => new Date(utc(key)).getUTCDay();

export function startOfWeek(key: DateKey, weekStart: 0 | 1): DateKey {
  const offset = (weekday(key) - weekStart + 7) % 7;
  return addDays(key, -offset);
}
export const weekDays = (key: DateKey, weekStart: 0 | 1): DateKey[] => {
  const s = startOfWeek(key, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
};
export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let n = diffDays(to, from), i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  pl: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
};
const WEEKDAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], pl: ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'] };
export const monthShort = (key: DateKey) => MONTHS[getLang()][parseKey(key).m - 1];
/** 0 = Sunday … 6 = Saturday */
export const weekdayShort = (i: number) => WEEKDAYS[getLang()][((i % 7) + 7) % 7];

// Creating an Intl formatter is expensive; build once per language and memoise results per date key.
const LOCALE = { en: 'en-US', pl: 'pl-PL' } as const;
const fmts: Record<string, Intl.DateTimeFormat> = {};
const cache = new Map<string, string>();
function fmt(kind: 'long' | 'short'): Intl.DateTimeFormat {
  const id = `${getLang()}:${kind}`;
  return (fmts[id] ??= new Intl.DateTimeFormat(LOCALE[getLang()], kind === 'long'
    ? { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' }));
}
function formatKey(kind: 'long' | 'short', key: DateKey): string {
  const id = `${getLang()}:${kind}:${key}`;
  let v = cache.get(id);
  if (v === undefined) { v = fmt(kind).format(new Date(utc(key))); cache.set(id, v); }
  return v;
}
export const formatLong = (key: DateKey): string => formatKey('long', key);
export const formatShort = (key: DateKey): string => formatKey('short', key);

export function formatDuration(totalSec: number): string {
  const m = Math.round(totalSec / 60);
  if (m < 60) return tr('{n}m', { n: m });
  return `${tr('{n}h', { n: Math.floor(m / 60) })} ${m % 60 ? tr('{n}m', { n: m % 60 }) : ''}`.trim();
}
export const mmss = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
export const uid = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function dayOffsetLabelSafe(date: DateKey, today: DateKey): string {
  const n = diffDays(date, today);
  return n === 0 ? tr('Today') : n === 1 ? tr('Tomorrow') : n === -1 ? tr('Yesterday') : formatLong(date);
}

const MONTH_FMT: Record<string, Intl.DateTimeFormat> = {};
/** "October 2026" / "październik 2026" for the month containing `key`. */
export function formatMonth(key: DateKey): string {
  const lang = getLang();
  const f = (MONTH_FMT[lang] ??= new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  return f.format(new Date(utc(key)));
}
