import type { AppData, DateKey, Habit } from './types';
import { addDays, daysInMonth, diffDays, parseKey, startOfWeek } from './dates';
import { completionIndex, doneSet, isDue } from './habits';

export type Index = Map<string, Set<DateKey>>;
export const makeIndex = (d: Pick<AppData, 'completions'>): Index => completionIndex(d.completions);

/** Earliest date with any data; null for a brand-new install. */
export function dataStart(d: AppData): DateKey | null {
  const dates: DateKey[] = [...d.habits.map(h => h.startDate), ...d.completions.map(c => c.date)];
  return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
}

export interface DayInfo { due: number; done: number }
export function dayInfo(habits: Habit[], idx: Index, date: DateKey): DayInfo {
  let due = 0, done = 0;
  for (const h of habits) if (isDue(h, date)) { due++; if (doneSet(idx, h.id).has(date)) done++; }
  return { due, done };
}

export interface RangeSummary { due: number; done: number; rate: number | null; completions: number; perfectDays: number }
/** Rate counts due days only; today is included only once everything due today is done (pending ≠ missed). */
export function rangeSummary(d: AppData, idx: Index, from: DateKey, to: DateKey, today: DateKey): RangeSummary {
  let due = 0, done = 0, perfectDays = 0;
  const n = diffDays(to, from);
  for (let i = 0; i <= n; i++) {
    const day = addDays(from, i);
    const info = dayInfo(d.habits, idx, day);
    if (!info.due) continue;
    if (info.done === info.due) perfectDays++;
    if (day === today && info.done < info.due) continue;
    due += info.due; done += info.done;
  }
  const completions = d.completions.filter(c => c.date >= from && c.date <= to).length;
  return { due, done, rate: due ? done / due : null, completions, perfectDays };
}

/** Consecutive days on which every due habit was completed (days with nothing due are skipped). */
export function perfectStreak(d: AppData, idx: Index, today: DateKey): number {
  const start = dataStart(d);
  if (!start) return 0;
  let n = 0;
  for (let day = today, guard = diffDays(today, start); guard >= 0; day = addDays(day, -1), guard--) {
    const info = dayInfo(d.habits, idx, day);
    if (!info.due) continue;
    if (info.done === info.due) n++;
    else if (day === today) continue;
    else break;
  }
  return n;
}

export interface Point { label: DateKey; rate: number | null; done: number; due: number }

/** One point per week; weeks wholly before the first data are null ("no data"), not 0%. */
export function weeklySeries(d: AppData, idx: Index, weeks: number, today: DateKey, ws: 0 | 1): Point[] {
  const start = dataStart(d), last = startOfWeek(today, ws), out: Point[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const s = addDays(last, -7 * w), e = addDays(s, 6) > today ? today : addDays(s, 6);
    if (start === null || e < start) { out.push({ label: s, rate: null, done: 0, due: 0 }); continue; }
    const r = rangeSummary(d, idx, s, e, today);
    out.push({ label: s, rate: r.rate, done: r.done, due: r.due });
  }
  return out;
}

export function monthKey(y: number, m: number): DateKey { return `${y}-${String(m).padStart(2, '0')}-01`; }
export function addMonths(key: DateKey, n: number): DateKey {
  const { y, m } = parseKey(key); const t = y * 12 + (m - 1) + n;
  return monthKey(Math.floor(t / 12), (t % 12) + 1);
}
export function monthSeries(d: AppData, idx: Index, months: number, today: DateKey): Point[] {
  const start = dataStart(d), cur = addMonths(today, 0).slice(0, 8) + '01', out: Point[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const s = addMonths(cur, -k), { y, m } = parseKey(s);
    const full = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`, e = full > today ? today : full;
    if (start === null || e < start) { out.push({ label: s, rate: null, done: 0, due: 0 }); continue; }
    const r = rangeSummary(d, idx, s, e, today);
    out.push({ label: s, rate: r.rate, done: r.done, due: r.due });
  }
  return out;
}

/** Per-day ratio of due habits completed; null on days where nothing was due. */
export function ratioMap(habits: Habit[], idx: Index, from: DateKey, to: DateKey): Map<DateKey, number | null> {
  const m = new Map<DateKey, number | null>();
  const n = diffDays(to, from);
  for (let i = 0; i <= n; i++) { const day = addDays(from, i); const x = dayInfo(habits, idx, day); m.set(day, x.due ? x.done / x.due : null); }
  return m;
}
