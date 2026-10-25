import type { Completion, DateKey, Habit, PauseRange } from './types';
import { addDays, diffDays, startOfWeek, toKey, weekday } from './dates';
import { isIcon } from './appearance';

/** Fill in fields older versions never stored (icon, colour, order, pauses) without touching the database. */
export function normalizeAll(raw: Array<Partial<Habit> & Pick<Habit, 'id' | 'name' | 'schedule' | 'startDate' | 'createdAt'>>): Habit[] {
  const ranked = [...raw].sort((a, b) => (a.order ?? 1e15 + a.createdAt) - (b.order ?? 1e15 + b.createdAt));
  return ranked.map((h, i) => {
    const pauses: PauseRange[] = Array.isArray(h.pauses) ? h.pauses.map(p => ({ from: p.from, to: p.to ?? null })) : [];
    // Habits archived by an older version had no pause range: treat archive day onward as paused.
    if (h.archivedAt && !pauses.length) pauses.push({ from: toKey(new Date(h.archivedAt)), to: null });
    return {
      id: h.id, name: h.name, description: h.description, schedule: [...h.schedule].sort(),
      weeklyTarget: h.weeklyTarget ?? h.schedule.length, startDate: h.startDate, createdAt: h.createdAt,
      icon: isIcon(h.icon) ? h.icon : 'sparkles',
      order: typeof h.order === 'number' ? h.order : i, pauses, archivedAt: h.archivedAt ?? null
    };
  });
}

export const isDaily = (h: Habit) => h.schedule.length === 7;
export const isPausedOn = (h: Habit, date: DateKey) => h.pauses.some(p => date >= p.from && (p.to === null || date <= p.to));
/** A habit is "due" on a date when scheduled, started and not paused. Everything else is a rest day, never a miss. */
export const isDue = (h: Habit, date: DateKey) => h.schedule.includes(weekday(date)) && date >= h.startDate && !isPausedOn(h, date);

export type HabitStatus = 'active' | 'paused' | 'archived';
export function statusOf(h: Habit, today: DateKey): HabitStatus {
  if (h.archivedAt) return 'archived';
  return isPausedOn(h, today) ? 'paused' : 'active';
}

export function completionIndex(completions: Completion[]): Map<string, Set<DateKey>> {
  const m = new Map<string, Set<DateKey>>();
  for (const c of completions) { let s = m.get(c.habitId); if (!s) m.set(c.habitId, (s = new Set())); s.add(c.date); }
  return m;
}
const EMPTY: Set<DateKey> = new Set();
export const doneSet = (idx: Map<string, Set<DateKey>>, id: string) => idx.get(id) ?? EMPTY;

export function firstDate(h: Habit, done: Set<DateKey>): DateKey {
  let first = h.startDate;
  for (const d of done) if (d < first) first = d;
  return first;
}

export interface HabitStats {
  current: number; longest: number; totalDone: number; dueDays: number; dueDone: number;
  /** null when nothing has been due yet (no data is not 0%). */
  rate: number | null;
}

/**
 * Streaks and rates look at due days only. Rest days and paused days are skipped, never counted as misses;
 * a pending (not yet completed) today does not break a streak or lower the rate.
 */
export function habitStats(h: Habit, done: Set<DateKey>, today: DateKey): HabitStats {
  const first = firstDate(h, done);
  const span = diffDays(today, first);
  let longest = 0, run = 0, dueDays = 0, dueDone = 0;
  for (let i = 0; i <= span; i++) {
    const d = addDays(first, i);
    if (!isDue(h, d)) continue;
    const ok = done.has(d);
    if (ok) { run++; longest = Math.max(longest, run); }
    else if (d !== today) run = 0;
    if (ok || d !== today) { dueDays++; if (ok) dueDone++; }
  }
  let current = 0;
  for (let i = span; i >= 0; i--) {
    const d = addDays(first, i);
    if (!isDue(h, d)) continue;
    if (done.has(d)) current++;
    else if (d === today) continue;
    else break;
  }
  return { current, longest, totalDone: done.size, dueDays, dueDone, rate: dueDays ? dueDone / dueDays : null };
}

/** Due-day completions inside the week containing `date`, and how many days were due. */
export function weekProgress(h: Habit, done: Set<DateKey>, date: DateKey, ws: 0 | 1, until?: DateKey) {
  const s = startOfWeek(date, ws);
  let due = 0, ok = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(s, i); if (until && d > until) break; if (isDue(h, d)) { due++; if (done.has(d)) ok++; } }
  return { due, done: ok };
}

export const byOrder = (a: Habit, b: Habit) => a.order - b.order || a.createdAt - b.createdAt;
export const habitsDueOn = (hs: Habit[], date: DateKey) => hs.filter(h => isDue(h, date)).sort(byOrder);

/* ---- pause / archive helpers: both add an open pause range, so history and streaks are never rewritten ---- */
const hasOpenPause = (h: Habit) => h.pauses.some(p => p.to === null);
const closePauses = (h: Habit, today: DateKey): PauseRange[] =>
  h.pauses.map(p => (p.to === null ? { from: p.from, to: addDays(today, -1) } : p)).filter(p => p.to === null || p.to >= p.from);
export const pauseHabit = (h: Habit, today: DateKey): Habit => (hasOpenPause(h) ? h : { ...h, pauses: [...h.pauses, { from: today, to: null }] });
export const resumeHabit = (h: Habit, today: DateKey): Habit => ({ ...h, pauses: closePauses(h, today) });
export const archiveHabit = (h: Habit, today: DateKey): Habit => ({ ...pauseHabit(h, today), archivedAt: Date.now() });
export const restoreHabit = (h: Habit, today: DateKey): Habit => ({ ...resumeHabit(h, today), archivedAt: null });
