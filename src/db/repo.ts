/** Typed repository: the only module the UI talks to for persistence. */
import type { AppData, Completion, Habit, Prefs } from '../lib/types';
import { DEFAULT_PREFS } from '../lib/types';
import { normalizeAll } from '../lib/habits';
import { applyBackup, type BackupFile } from './backup';
import { clearLegacy, getAll, getOne, legacyCounts, put, putMany, remove, removeCompletionsOf, wipeAll } from './db';

interface MetaRow<T> { key: string; value: T }

export async function loadAll(): Promise<AppData> {
  const [habits, completions, prefsRow] = await Promise.all([
    getAll<Habit>('habits'), getAll<Completion>('completions'), getOne<MetaRow<Partial<Prefs>>>('meta', 'prefs')
  ]);
  const p = prefsRow?.value ?? {};
  // Pick known fields only: older stored prefs may carry settings of removed features.
  const prefs: Prefs = {
    weekStart: p.weekStart === 0 ? 0 : DEFAULT_PREFS.weekStart,
    theme: p.theme === 'light' || p.theme === 'system' ? p.theme : DEFAULT_PREFS.theme,
    lang: p.lang === 'pl' ? 'pl' : DEFAULT_PREFS.lang
  };
  return { habits: normalizeAll(habits), completions, prefs };
}

export const saveHabit = (h: Habit) => put('habits', h);
export const saveHabits = (hs: Habit[]) => putMany('habits', hs);
export async function deleteHabit(id: string) {
  await remove('habits', id);
  await removeCompletionsOf(id);
}
export const completionId = (habitId: string, date: string) => `${habitId}:${date}`;
/** Idempotent: writing the same (habit, date) twice overwrites the same key. */
export const setCompletion = (habitId: string, date: string, done: boolean) =>
  done ? put('completions', { id: completionId(habitId, date), habitId, date, at: Date.now() } satisfies Completion)
       : remove('completions', completionId(habitId, date));
export const savePrefs = (p: Prefs) => put('meta', { key: 'prefs', value: p } satisfies MetaRow<Prefs>);
export const wipeEverything = wipeAll;
export const loadLegacyCounts = legacyCounts;
export const removeLegacyData = clearLegacy;
export const importBackup = (b: BackupFile, mode: 'replace' | 'merge') => applyBackup(b, mode);
