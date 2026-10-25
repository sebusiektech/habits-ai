/** Low-level IndexedDB access. No React, no business logic. */
export const DB_NAME = 'habits-db';
/** Stays at 1 on purpose: existing databases keep every store (including those of removed features) untouched. */
export const DB_VERSION = 1;

/** Stores the habit tracker uses. */
export const STORE_KEYS = { habits: 'id', completions: 'id', meta: 'key' } as const;
export type StoreName = keyof typeof STORE_KEYS;
/** Stores written by earlier versions (tasks, focus, routines, goals, journal). Never read by the app; only counted/cleared on request. */
export const LEGACY_STORES = ['tasks', 'sessions', 'routines', 'routineChecks', 'goals', 'journal'] as const;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Versioned upgrades: add a new `if (old < N)` block per schema change; never edit old blocks. */
function upgrade(db: IDBDatabase, tx: IDBTransaction, oldVersion: number) {
  if (oldVersion < 1) {
    for (const [name, keyPath] of Object.entries(STORE_KEYS)) db.createObjectStore(name, { keyPath });
    tx.objectStore('completions').createIndex('byHabit', 'habitId');
    tx.objectStore('completions').createIndex('byDate', 'date');
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is not available in this browser.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => upgrade(req.result, req.transaction as IDBTransaction, e.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('Could not open the database.'));
    req.onblocked = () => reject(new Error('Database upgrade is blocked by another open tab. Close other habits. tabs and reload.'));
  }).catch(err => { dbPromise = null; throw err; });
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
}

const wrap = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error ?? new Error('Transaction aborted.'));
});

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return wrap<T[]>(db.transaction(store).objectStore(store).getAll());
}
export async function getOne<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return wrap<T | undefined>(db.transaction(store).objectStore(store).get(key));
}
export async function putMany(store: StoreName, values: unknown[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  await done(tx);
}
export const put = (store: StoreName, value: unknown) => putMany(store, [value]);
export async function remove(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}
export async function removeCompletionsOf(habitId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('completions', 'readwrite');
  const os = tx.objectStore('completions');
  const req = os.index('byHabit').openKeyCursor(IDBKeyRange.only(habitId));
  req.onsuccess = () => { const cur = req.result; if (cur) { os.delete(cur.primaryKey); cur.continue(); } };
  await done(tx);
}

/**
 * Replace or merge habits + completions (+ prefs) in ONE transaction: if anything fails the transaction aborts and
 * existing data is untouched. Legacy stores are never touched. merge: existing records win on the same key.
 */
export async function writeAll(data: { habits: unknown[]; completions: unknown[] }, mode: 'replace' | 'merge', prefs?: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['habits', 'completions', 'meta'], 'readwrite');
  for (const name of ['habits', 'completions'] as const) {
    const os = tx.objectStore(name);
    if (mode === 'replace') os.clear();
    for (const rec of data[name]) {
      if (mode === 'merge') os.add(rec).onerror = ev => { ev.preventDefault(); ev.stopPropagation(); };
      else os.put(rec);
    }
  }
  if (mode === 'replace' && prefs) tx.objectStore('meta').put({ key: 'prefs', value: prefs });
  await done(tx);
}

/** Counts of records left behind by removed features (only stores that exist and are non-empty). */
export async function legacyCounts(): Promise<Record<string, number>> {
  const db = await openDb();
  const names = LEGACY_STORES.filter(n => db.objectStoreNames.contains(n));
  const out: Record<string, number> = {};
  for (const n of names) { const c = await wrap(db.transaction(n).objectStore(n).count()); if (c) out[n] = c; }
  return out;
}
export async function clearLegacy(): Promise<void> {
  const db = await openDb();
  const names = LEGACY_STORES.filter(n => db.objectStoreNames.contains(n));
  const tx = db.transaction([...names, 'meta'], 'readwrite');
  for (const n of names) tx.objectStore(n).clear();
  tx.objectStore('meta').delete('timer');
  await done(tx);
}

/** Delete everything, including leftovers of removed features. Only reachable from an explicit confirmation. */
export async function wipeAll(): Promise<void> {
  const db = await openDb();
  const names = Array.from(db.objectStoreNames);
  const tx = db.transaction(names, 'readwrite');
  for (const n of names) tx.objectStore(n).clear();
  await done(tx);
}
