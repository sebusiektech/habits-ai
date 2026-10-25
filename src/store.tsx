import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, DateKey } from './lib/types';
import * as repo from './db/repo';
import { todayKey } from './lib/dates';
import { tr } from './i18n';

export interface Toast { id: number; text: string; kind: 'info' | 'error' }

interface Store {
  data: AppData;
  today: DateKey;
  /** Run a repository write, reload state, surface errors. Returns true on success. */
  run: (fn: () => Promise<unknown>, okMsg?: string) => Promise<boolean>;
  notify: (text: string, kind?: Toast['kind']) => void;
  toast: Toast | null;
  toggleHabit: (habitId: string, date: DateKey) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => { const s = useContext(Ctx); if (!s) throw new Error('Store missing'); return s; };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [today, setToday] = useState(todayKey());
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number>();
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;

  const notify = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text: tr(text), kind });
    toastTimer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 6000 : 2000);
  }, []);

  const reload = useCallback(async () => { setData(await repo.loadAll()); }, []);

  useEffect(() => {
    repo.loadAll().then(setData).catch(e => setFatal(e instanceof Error ? e.message : 'Could not open local storage.'));
  }, []);

  // Keep "today" correct across midnight, timezone changes and app resumes.
  useEffect(() => {
    const sync = () => setToday(prev => { const n = todayKey(); return n === prev ? prev : n; });
    const id = window.setInterval(sync, 30000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', sync); window.removeEventListener('focus', sync); };
  }, []);

  const run = useCallback(async (fn: () => Promise<unknown>, okMsg?: string) => {
    try { await fn(); await reload(); if (okMsg) notify(okMsg); return true; }
    catch (e) { notify(e instanceof Error ? e.message : 'Something went wrong. Your data was not changed.', 'error'); return false; }
  }, [reload, notify]);

  const toggleHabit = useCallback(async (habitId: string, date: DateKey) => {
    const on = dataRef.current?.completions.some(c => c.habitId === habitId && c.date === date) ?? false;
    await run(() => repo.setCompletion(habitId, date, !on));
  }, [run]);

  const value = useMemo(() => data && ({ data, today, run, notify, toast, toggleHabit, reload }), [data, today, run, notify, toast, toggleHabit, reload]);

  if (fatal) return (
    <div style={{ padding: 28 }}>
      <h1 className="title">habits.</h1>
      <p className="muted" style={{ marginTop: 12 }}>{tr('Local storage is unavailable: {error}', { error: tr(fatal) })}</p>
      <p className="muted small" style={{ marginTop: 12 }}>{tr('Private browsing or restricted settings can block IndexedDB. Open the app normally from the Home Screen.')}</p>
    </div>
  );
  if (!data) return <div style={{ padding: 28 }} className="muted">{tr('Loading…')}</div>;

  return <Ctx.Provider value={value as Store}>{children}</Ctx.Provider>;
}
