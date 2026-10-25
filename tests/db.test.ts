// Needs `npm install` (fake-indexeddb). Verifies persistence and that data of removed features survives untouched.
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb, DB_NAME, legacyCounts, openDb, clearLegacy } from '../src/db/db';
import * as repo from '../src/db/repo';
import { applyBackup, makeBackup, validateBackup } from '../src/db/backup';

const reset = async () => { await closeDb(); await new Promise<void>(res => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = r.onerror = () => res(); }); };
beforeEach(reset);

/** Build a v1 database exactly like earlier versions did (all nine stores), then add records. */
async function seedOldDatabase() {
  await new Promise<void>((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [n, k] of [['habits', 'id'], ['completions', 'id'], ['tasks', 'id'], ['sessions', 'id'], ['routines', 'id'], ['routineChecks', 'id'], ['goals', 'id'], ['journal', 'date'], ['meta', 'key']])
        db.createObjectStore(n, { keyPath: k });
      r.transaction!.objectStore('completions').createIndex('byHabit', 'habitId');
      r.transaction!.objectStore('completions').createIndex('byDate', 'date');
    };
    r.onsuccess = () => {
      const db = r.result, tx = db.transaction(['habits', 'completions', 'tasks', 'journal', 'meta'], 'readwrite');
      tx.objectStore('habits').put({ id: 'h1', name: 'Run', schedule: [1, 3], weeklyTarget: 2, startDate: '2025-01-01', createdAt: 5, archivedAt: null });
      tx.objectStore('completions').put({ id: 'h1:2025-01-01', habitId: 'h1', date: '2025-01-01', at: 1 });
      tx.objectStore('tasks').put({ id: 't1', title: 'old task', date: null, done: false, priority: false, order: 1, createdAt: 1 });
      tx.objectStore('journal').put({ date: '2025-01-01', achievements: 'x', distractions: '', lessons: '', tomorrow: '', notes: '', updatedAt: 1 });
      tx.objectStore('meta').put({ key: 'prefs', value: { weekStart: 0, defaultBreakMin: 10, theme: 'light' } });
      tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  });
}

describe('storage', () => {
  it('initialises empty and prevents duplicate completions', async () => {
    expect((await repo.loadAll()).habits).toEqual([]);
    await repo.setCompletion('h1', '2024-05-01', true);
    await repo.setCompletion('h1', '2024-05-01', true);
    expect((await repo.loadAll()).completions).toHaveLength(1);
    await repo.setCompletion('h1', '2024-05-01', false);
    expect((await repo.loadAll()).completions).toHaveLength(0);
  });
  it('opens an existing database without losing habits, history or settings, and fills in new habit fields', async () => {
    await seedOldDatabase();
    const d = await repo.loadAll();
    expect(d.habits).toHaveLength(1); expect(d.habits[0].icon).toBe('sparkles'); expect(d.completions).toHaveLength(1);
    expect(d.prefs).toEqual({ weekStart: 0, theme: 'light', lang: 'en' });
  });
  it('keeps data of removed features untouched until the user deletes it', async () => {
    await seedOldDatabase();
    expect(await legacyCounts()).toEqual({ tasks: 1, journal: 1 });
    const v = validateBackup(JSON.parse(JSON.stringify(makeBackup(await repo.loadAll()))));
    if (!v.ok) throw new Error(v.error);
    await applyBackup(v.backup, 'replace');
    expect(await legacyCounts()).toEqual({ tasks: 1, journal: 1 }); // restore never touches them
    await clearLegacy();
    expect(await legacyCounts()).toEqual({});
    expect((await repo.loadAll()).habits).toHaveLength(1);
  });
  it('exports and restores (replace and merge) without duplicates', async () => {
    await repo.saveHabit({ id: 'h1', name: 'Read', icon: 'book', schedule: [1], weeklyTarget: 1, startDate: '2024-05-01', createdAt: 1, order: 0, pauses: [], archivedAt: null });
    await repo.setCompletion('h1', '2024-05-06', true);
    const backup = JSON.parse(JSON.stringify(makeBackup(await repo.loadAll())));
    await repo.wipeEverything();
    const v = validateBackup(backup);
    if (!v.ok) throw new Error(v.error);
    await applyBackup(v.backup, 'replace');
    let d = await repo.loadAll();
    expect(d.habits).toHaveLength(1); expect(d.completions).toHaveLength(1);
    await applyBackup(v.backup, 'merge');
    d = await repo.loadAll();
    expect(d.habits).toHaveLength(1); expect(d.completions).toHaveLength(1);
  });
  it('deleting a habit removes its completions only', async () => {
    await repo.setCompletion('a', '2024-05-01', true); await repo.setCompletion('b', '2024-05-01', true);
    await repo.deleteHabit('a');
    expect((await repo.loadAll()).completions.map(c => c.habitId)).toEqual(['b']);
    void openDb;
  });
});
