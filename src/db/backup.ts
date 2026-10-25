import type { AppData, Habit } from '../lib/types';
import { DEFAULT_PREFS, SCHEMA_VERSION } from '../lib/types';
import { isValidKey } from '../lib/dates';
import { normalizeAll } from '../lib/habits';
import { tr } from '../i18n';
import { writeAll } from './db';

export interface BackupFile {
  app: 'habits.';
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
}

export function makeBackup(d: AppData): BackupFile {
  return { app: 'habits.', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: { habits: d.habits, completions: d.completions, prefs: d.prefs } };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string';
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const key = (v: unknown) => isValidKey(v);
const arrOf = (v: unknown, f: (x: unknown) => boolean) => Array.isArray(v) && v.every(f);

const isHabit = (r: unknown) => isObj(r) && str(r.id) && str(r.name) && arrOf(r.schedule, x => num(x) && (x as number) >= 0 && (x as number) <= 6) &&
  key(r.startDate) && num(r.createdAt) &&
  (r.icon === undefined || str(r.icon)) && (r.color === undefined || str(r.color)) && (r.order === undefined || num(r.order)) &&
  (r.archivedAt === undefined || r.archivedAt === null || num(r.archivedAt)) &&
  (r.pauses === undefined || arrOf(r.pauses, p => isObj(p) && key(p.from) && (p.to === null || p.to === undefined || key(p.to))));
const isCompletion = (r: unknown) => isObj(r) && str(r.id) && str(r.habitId) && key(r.date) && num(r.at) && r.id === `${r.habitId}:${r.date}`;

/** Lists from removed features that an older backup may still contain; they are ignored, never imported. */
const IGNORED = ['tasks', 'sessions', 'routines', 'routineChecks', 'goals', 'journal'] as const;

export type Validation =
  | { ok: true; backup: BackupFile; counts: Record<string, number>; ignored: number }
  | { ok: false; error: string };

/** Pure validation: never touches the database. */
export function validateBackup(raw: unknown): Validation {
  if (!isObj(raw)) return { ok: false, error: tr('This file is not a habits. backup.') };
  if (raw.app !== 'habits.') return { ok: false, error: tr('This file was not created by habits.') };
  if (!num(raw.schemaVersion)) return { ok: false, error: tr('The backup has no schema version.') };
  if ((raw.schemaVersion as number) > SCHEMA_VERSION)
    return { ok: false, error: tr('This backup was made by a newer version of habits. (schema {v}). Update the app and try again.', { v: String(raw.schemaVersion) }) };
  if ((raw.schemaVersion as number) < 1) return { ok: false, error: tr('Unsupported backup schema version.') };
  if (!isObj(raw.data)) return { ok: false, error: tr('The backup contains no data.') };
  const data = raw.data;
  const lists = { habits: data.habits ?? [], completions: data.completions ?? [] };
  for (const [name, list] of Object.entries(lists)) {
    if (!Array.isArray(list)) return { ok: false, error: tr('"{name}" must be a list.', { name }) };
    const guard = name === 'habits' ? isHabit : isCompletion;
    const bad = list.findIndex(r => !guard(r));
    if (bad !== -1) return { ok: false, error: tr('Invalid record #{n} in "{name}". Nothing was imported.', { n: bad + 1, name }) };
    if (new Set(list.map(r => (r as { id: string }).id)).size !== list.length) return { ok: false, error: tr('Duplicate records found in "{name}".', { name }) };
  }
  const prefs = isObj(data.prefs) ? data.prefs : {};
  const habits: Habit[] = normalizeAll(lists.habits as Habit[]);
  const ignored = IGNORED.reduce((n, k) => n + (Array.isArray(data[k]) ? (data[k] as unknown[]).length : 0), 0);
  return {
    ok: true, ignored, counts: { habits: habits.length, completions: (lists.completions as unknown[]).length },
    backup: {
      app: 'habits.', schemaVersion: raw.schemaVersion as number, exportedAt: str(raw.exportedAt) ? (raw.exportedAt as string) : '',
      data: {
        habits, completions: lists.completions as AppData['completions'],
        prefs: {
          weekStart: prefs.weekStart === 0 ? 0 : 1,
          theme: prefs.theme === 'light' || prefs.theme === 'system' || prefs.theme === 'dark' ? prefs.theme : DEFAULT_PREFS.theme,
          lang: prefs.lang === 'pl' ? 'pl' : 'en'
        }
      }
    }
  };
}

export function parseBackupText(text: string): Validation {
  try { return validateBackup(JSON.parse(text)); }
  catch { return { ok: false, error: tr('The file is not valid JSON.') }; }
}

export async function applyBackup(b: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
  // Merge keeps current prefs; replace adopts the backup's prefs. Legacy stores are never touched.
  await writeAll({ habits: b.data.habits, completions: b.data.completions }, mode, mode === 'replace' ? b.data.prefs : undefined);
}
