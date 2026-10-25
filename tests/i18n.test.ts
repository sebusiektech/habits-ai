import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { plCategory, setLang, tr, trn } from '../src/i18n';
import { PL } from '../src/i18n/pl';
import { makeBackup, validateBackup } from '../src/db/backup';
import { DEFAULT_PREFS, type AppData } from '../src/lib/types';
import { formatDuration, formatLong, monthShort, weekdayShort } from '../src/lib/dates';

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe('i18n', () => {
  it('every tr("…") literal in the source has a Polish translation', () => {
    const re = /\btr\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
    const missing: string[] = [];
    for (const f of walk('src').filter(f => /\.tsx?$/.test(f) && !f.includes('i18n'))) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(re)) { const k = (m[1] ?? m[2]).replace(/\\'/g, "'"); if (!(k in PL)) missing.push(`${f}: ${k}`); }
    }
    expect(missing).toEqual([]);
  });
  it('keeps {placeholders} identical between English and Polish', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [k, v] of Object.entries(PL)) expect(ph(v)).toBe(ph(k));
  });
  it('uses correct Polish plural categories', () => {
    expect([1, 2, 4, 5, 12, 14, 21, 22, 25, 112].map(plCategory)).toEqual(['one', 'few', 'few', 'many', 'many', 'many', 'many', 'few', 'many', 'many']);
    setLang('pl');
    expect(trn('days left', 1)).toBe('Został 1 dzień');
    expect(trn('days left', 3)).toBe('Zostały 3 dni');
    expect(trn('days left', 5)).toBe('Zostało 5 dni');
    setLang('en');
    expect(trn('days left', 1)).toBe('1 day left');
    expect(trn('days left', 2)).toBe('2 days left');
  });
  it('translates, interpolates and falls back to English for unknown keys', () => {
    setLang('pl');
    expect(tr('Today')).toBe('Dziś');
    expect(tr('Complete {name}', { name: 'Bieg' })).toBe('Ukończ: Bieg');
    expect(tr('Some brand new string')).toBe('Some brand new string');
    setLang('en');
    expect(tr('Complete {name}', { name: 'Run' })).toBe('Complete Run');
  });
  it('localises dates, months, weekdays and durations', () => {
    setLang('pl');
    expect(formatLong('2026-10-24')).toBe('sobota, 24 października');
    expect(monthShort('2026-10-24')).toBe('paź');
    expect(weekdayShort(1)).toBe('pon');
    expect(formatDuration(3900)).toBe('1 godz. 5 min');
    setLang('en');
    expect(formatLong('2026-10-24')).toBe('Saturday, October 24');
    expect(formatDuration(3900)).toBe('1h 5m');
  });

  it('keeps the language in backups and defaults old backups to English', () => {
    const d: AppData = { habits: [], completions: [], prefs: { ...DEFAULT_PREFS, lang: 'pl' } };
    const b = JSON.parse(JSON.stringify(makeBackup(d)));
    const ok = validateBackup(b); if (ok.ok) expect(ok.backup.data.prefs.lang).toBe('pl');
    b.data.prefs = { weekStart: 1, theme: 'dark' }; // made before the language setting existed
    const old = validateBackup(b); if (old.ok) expect(old.backup.data.prefs.lang).toBe('en');
  });
});
