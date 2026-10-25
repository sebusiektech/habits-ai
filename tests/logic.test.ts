import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isValidKey, startOfWeek, weekday, toKey } from '../src/lib/dates';
import { archiveHabit, habitStats, isDue, normalizeAll, pauseHabit, restoreHabit, resumeHabit, statusOf, weekProgress } from '../src/lib/habits';
import { buildHeatmap, ratioLevel } from '../src/lib/heatmap';
import { dayInfo, makeIndex, monthSeries, perfectStreak, rangeSummary, ratioMap, weeklySeries } from '../src/lib/stats';
import { makeBackup, validateBackup } from '../src/db/backup';
import { DEFAULT_PREFS, type AppData, type Habit } from '../src/lib/types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Read', icon: 'book', schedule: [0, 1, 2, 3, 4, 5, 6], weeklyTarget: 7, startDate: '2024-01-01',
  createdAt: 0, order: 0, pauses: [], archivedAt: null, ...over
});
const data = (habits: Habit[], days: Array<[string, string]> = []): AppData => ({
  habits, completions: days.map(([h, d]) => ({ id: `${h}:${d}`, habitId: h, date: d, at: 1 })), prefs: DEFAULT_PREFS
});

describe('dates', () => {
  it('handles leap years and month boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(isValidKey('2023-02-29')).toBe(false);
  });
  it('is immune to DST transitions', () => {
    expect(addDays('2024-03-30', 2)).toBe('2024-04-01');
    expect(diffDays('2024-11-04', '2024-11-03')).toBe(1);
    expect(diffDays('2024-03-11', '2024-03-10')).toBe(1);
  });
  it('computes weeks', () => {
    expect(weekday('2024-02-29')).toBe(4);
    expect(startOfWeek('2024-02-29', 1)).toBe('2024-02-26');
    expect(startOfWeek('2024-02-29', 0)).toBe('2024-02-25');
    expect(toKey(new Date(2024, 0, 5, 23, 59))).toBe('2024-01-05');
  });
});

describe('streaks', () => {
  it('counts consecutive days and keeps a pending today alive', () => {
    const s = habitStats(habit(), new Set(['2024-01-01', '2024-01-02', '2024-01-03']), '2024-01-04');
    expect(s.current).toBe(3); expect(s.longest).toBe(3);
  });
  it('breaks on a missed past day', () => {
    const s = habitStats(habit(), new Set(['2024-01-01', '2024-01-03']), '2024-01-03');
    expect(s.current).toBe(1); expect(s.longest).toBe(1); expect(s.rate).toBeCloseTo(2 / 3);
  });
  it('does not treat unscheduled days as failures', () => {
    const h = habit({ schedule: [1, 3, 5] }); // Mon/Wed/Fri; 2024-01-01 is a Monday
    const s = habitStats(h, new Set(['2024-01-01', '2024-01-03', '2024-01-05']), '2024-01-06');
    expect(s.current).toBe(3); expect(s.rate).toBe(1);
  });
  it('returns null rate when nothing has been due yet', () => {
    expect(habitStats(habit({ startDate: '2024-01-10' }), new Set(), '2024-01-10').rate).toBeNull();
  });
});

describe('pause and archive', () => {
  it('skips paused days without breaking the streak or lowering the rate', () => {
    // done Jan 1-3, paused Jan 4-6, resumed and done Jan 7
    const h = habit({ pauses: [{ from: '2024-01-04', to: '2024-01-06' }] });
    const s = habitStats(h, new Set(['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-07']), '2024-01-07');
    expect(s.current).toBe(4); expect(s.rate).toBe(1);
    expect(isDue(h, '2024-01-05')).toBe(false);
  });
  it('pause → resume closes the range the day before, so today is due again', () => {
    const paused = pauseHabit(habit(), '2024-02-10');
    expect(statusOf(paused, '2024-02-12')).toBe('paused');
    const back = resumeHabit(paused, '2024-02-12');
    expect(isDue(back, '2024-02-11')).toBe(false); expect(isDue(back, '2024-02-12')).toBe(true);
    expect(statusOf(back, '2024-02-12')).toBe('active');
  });
  it('archive/restore keep history and never count the archived period as misses', () => {
    const a = archiveHabit(habit({ startDate: '2024-02-28' }), '2024-03-01');
    expect(statusOf(a, '2024-03-05')).toBe('archived');
    const done = new Set(['2024-02-28', '2024-02-29']);
    const st = habitStats(a, done, '2024-03-05');
    expect(st.rate).toBe(1); expect(st.dueDays).toBe(2); expect(st.totalDone).toBe(2); // Mar 1–5 are not misses
    const r = restoreHabit(a, '2024-03-10');
    expect(r.archivedAt).toBeNull(); expect(isDue(r, '2024-03-10')).toBe(true); expect(isDue(r, '2024-03-09')).toBe(false);
  });
  it('treats habits archived by older versions as paused from the archive day', () => {
    const t = new Date(2024, 4, 10, 12).getTime();
    const [h] = normalizeAll([{ id: 'x', name: 'Old', schedule: [0, 1, 2, 3, 4, 5, 6], startDate: '2024-01-01', createdAt: 1, archivedAt: t }]);
    expect(h.pauses).toEqual([{ from: '2024-05-10', to: null }]);
    expect(h.icon).toBe('sparkles'); expect(h.color).toBeUndefined(); expect(h.order).toBe(0);
  });
  it('counts weekly progress on due days up to a date', () => {
    const p = weekProgress(habit({ schedule: [1, 3, 5] }), new Set(['2024-01-01', '2024-01-03']), '2024-01-04', 1, '2024-01-04');
    expect(p).toEqual({ due: 2, done: 2 });
  });
});

describe('overall statistics', () => {
  const a = habit({ id: 'a' }), b = habit({ id: 'b', schedule: [1, 2, 3, 4, 5] });
  it('summarises due days only and excludes a pending today', () => {
    const d = data([a, b], [['a', '2024-01-01'], ['b', '2024-01-01'], ['a', '2024-01-02']]);
    const idx = makeIndex(d);
    expect(dayInfo(d.habits, idx, '2024-01-02')).toEqual({ due: 2, done: 1 });
    const r = rangeSummary(d, idx, '2024-01-01', '2024-01-02', '2024-01-02');
    expect(r.done).toBe(2); expect(r.due).toBe(2); expect(r.perfectDays).toBe(1); expect(r.completions).toBe(3);
  });
  it('computes the perfect-day streak and skips days with nothing due', () => {
    const d = data([habit({ id: 'w', schedule: [1] })], [['w', '2024-01-01'], ['w', '2024-01-08']]); // Mondays only
    expect(perfectStreak(d, makeIndex(d), '2024-01-10')).toBe(2);
  });
  it('marks weeks and months before the first data as null, not zero', () => {
    const d = data([habit({ startDate: '2024-01-15' })], [['h1', '2024-01-15']]);
    const idx = makeIndex(d);
    const w = weeklySeries(d, idx, 4, '2024-01-17', 1);
    expect(w[0].rate).toBeNull(); expect(w[3].rate).toBeCloseTo(0.5); // Jan 15 done, Jan 16 missed, today (17th) pending is excluded
    expect(monthSeries(d, idx, 3, '2024-01-17')[0].rate).toBeNull();
  });
});

describe('heatmap', () => {
  it('builds whole weeks and flags rest, future and no-data cells', () => {
    const ratios = ratioMap([habit({ schedule: [1, 2, 3, 4, 5] })], makeIndex(data([habit()], [['h1', '2024-02-28']])), '2024-02-01', '2024-02-29');
    const cols = buildHeatmap(ratios, '2024-02-29', 4, 1, '2024-02-20');
    expect(cols).toHaveLength(4); cols.forEach(c => expect(c).toHaveLength(7));
    const flat = cols.flat();
    expect(flat.find(c => c.date === '2024-02-28')?.level).toBe(4);
    expect(flat.find(c => c.date === '2024-03-01')?.future).toBe(true);
    expect(flat.find(c => c.date === '2024-02-10')?.noData).toBe(true);
    expect(flat.find(c => c.date === '2024-02-24')?.rest).toBe(true); // Saturday: not due
  });
  it('maps ratios to levels', () => { expect([0, 0.2, 0.5, 0.8, 1].map(ratioLevel)).toEqual([0, 1, 2, 3, 4]); });
});

describe('backup validation', () => {
  it('round-trips a valid export', () => {
    const d = data([habit()], [['h1', '2024-01-01']]);
    const res = validateBackup(JSON.parse(JSON.stringify(makeBackup(d))));
    expect(res.ok).toBe(true);
  });
  it('rejects newer schema, foreign files and bad records', () => {
    const b = JSON.parse(JSON.stringify(makeBackup(data([]))));
    expect(validateBackup({ ...b, schemaVersion: 99 }).ok).toBe(false);
    expect(validateBackup({ hello: 1 }).ok).toBe(false);
    expect(validateBackup({ ...b, data: { ...b.data, habits: [{ id: 'x' }] } }).ok).toBe(false);
    expect(validateBackup({ ...b, data: { ...b.data, completions: [{ id: 'a', habitId: 'h', date: '2024-13-40', at: 1 }] } }).ok).toBe(false);
  });
  it('imports an old (v1) backup: legacy habit shape accepted, removed-feature lists ignored', () => {
    const old = {
      app: 'habits.', schemaVersion: 1, exportedAt: '2025-01-01T00:00:00Z',
      data: {
        habits: [{ id: 'h1', name: 'Run', schedule: [1, 3], weeklyTarget: 2, startDate: '2025-01-01', createdAt: 5, archivedAt: null }],
        completions: [{ id: 'h1:2025-01-01', habitId: 'h1', date: '2025-01-01', at: 1 }],
        tasks: [{ id: 't', title: 'x', date: null, done: false, priority: false, order: 1, createdAt: 1 }], journal: [], goals: [],
        prefs: { weekStart: 0, defaultBreakMin: 10, theme: 'light' }
      }
    };
    const r = validateBackup(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ignored).toBe(1); expect(r.counts).toEqual({ habits: 1, completions: 1 });
      expect(r.backup.data.habits[0].icon).toBe('sparkles'); expect(r.backup.data.prefs).toEqual({ weekStart: 0, theme: 'light', lang: 'en' });
    }
  });
  it('defaults missing or junk preference values', () => {
    const b = JSON.parse(JSON.stringify(makeBackup(data([]))));
    b.data.prefs = { theme: '<script>', lang: 'xx' };
    const r = validateBackup(b);
    if (r.ok) expect(r.backup.data.prefs).toEqual({ weekStart: 1, theme: 'dark', lang: 'en' });
  });
});
