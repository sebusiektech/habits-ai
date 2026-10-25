export type ID = string;
/** Local calendar date as "YYYY-MM-DD". Never derived from UTC timestamps. */
export type DateKey = string;

/** Inclusive range during which a habit is paused. `to: null` = still paused. */
export interface PauseRange { from: DateKey; to: DateKey | null }

export interface Habit {
  id: ID;
  name: string;
  description?: string;
  icon: string;
  /** Legacy: earlier versions stored a per-habit colour. Ignored; the interface is black, white and gray. */
  color?: string;
  /** Weekdays the habit is due on, 0 = Sunday … 6 = Saturday. Daily = all seven. */
  schedule: number[];
  /** Kept for compatibility with older backups; always equals schedule.length for new habits. */
  weeklyTarget: number;
  startDate: DateKey;
  createdAt: number;
  order: number;
  /** Paused (and archived) periods: those days are skipped, never counted as misses. */
  pauses: PauseRange[];
  archivedAt: number | null;
}

/** id = `${habitId}:${date}` which makes duplicates impossible by construction. */
export interface Completion { id: ID; habitId: ID; date: DateKey; at: number }

export type ThemePref = 'dark' | 'light' | 'system';
export type LangPref = 'en' | 'pl';
export interface Prefs { weekStart: 0 | 1; theme: ThemePref; lang: LangPref }

export interface AppData { habits: Habit[]; completions: Completion[]; prefs: Prefs }

export const DEFAULT_PREFS: Prefs = { weekStart: 1, theme: 'dark', lang: 'en' };
/** 2 = habit icon/colour/order/pauses added (all optional on read, so v1 backups still import). */
export const SCHEMA_VERSION = 2;
