import { createContext, useContext } from 'react';
import { PL } from './pl';

export type Lang = 'en' | 'pl';

function initial(): Lang {
  try { return localStorage.getItem('habits-lang') === 'pl' ? 'pl' : 'en'; } catch { return 'en'; }
}
let current: Lang = initial();
export const getLang = (): Lang => current;
/** Called by <App/> during render so every child sees the new language in the same pass. */
export const setLang = (l: Lang) => { current = l; };

type Params = Record<string, string | number>;
const fill = (s: string, p?: Params) => (p ? s.replace(/\{(\w+)\}/g, (_, k: string) => (k in p ? String(p[k]) : `{${k}}`)) : s);

/** Translate an English UI string. Unknown keys fall back to English, so nothing can ever render blank. */
export function tr(key: string, params?: Params): string {
  return fill(current === 'pl' ? (PL[key] ?? key) : key, params);
}

/** Polish plural category: 1 → one, 2–4 (except 12–14) → few, everything else → many. */
export function plCategory(n: number): 'one' | 'few' | 'many' {
  const a = Math.abs(n);
  if (a === 1) return 'one';
  const m10 = a % 10, m100 = a % 100;
  return m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? 'few' : 'many';
}

/** Plural phrases. English: [one, other]. Polish: [one, few, many]. Use {n} for the number. */
const PLURALS: Record<string, { en: [string, string]; pl: [string, string, string] }> = {
  'days left': { en: ['{n} day left', '{n} days left'], pl: ['Został {n} dzień', 'Zostały {n} dni', 'Zostało {n} dni'] }
};
export function trn(key: string, n: number): string {
  const f = PLURALS[key];
  if (!f) return String(n);
  const s = current === 'pl' ? f.pl[{ one: 0, few: 1, many: 2 }[plCategory(n)]] : f.en[n === 1 ? 0 : 1];
  return fill(s, { n });
}

export const LangCtx = createContext<Lang>('en');
/** Subscribes a component to language changes (needed only for memoised components) and returns tr. */
export function useT() { useContext(LangCtx); return tr; }
