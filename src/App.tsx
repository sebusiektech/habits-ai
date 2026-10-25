import { useEffect, useState } from 'react';
import { useStore } from './store';
import { NavCtx, type Nav, type Route, type Tab } from './nav';
import { Icon, type IconName } from './components/ui';
import { LangCtx, setLang, tr } from './i18n';
import Today from './screens/Today';
import Progress from './screens/Progress';
import Settings from './screens/Settings';
import { HabitDetail, HabitsList } from './screens/Habits';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'today' }, { id: 'habits', label: 'Habits', icon: 'habits' },
  { id: 'progress', label: 'Progress', icon: 'progress' }, { id: 'settings', label: 'Settings', icon: 'settings' }
];

/** Keeps <html data-theme> and the browser theme-color in sync with the saved preference. */
function useTheme(theme: 'dark' | 'light' | 'system') {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#F2F2F2');
    };
    apply();
    try { localStorage.setItem('habits-theme', theme); } catch { /* storage unavailable: harmless */ }
    if (theme !== 'system') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  const { toast, data } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [stack, setStack] = useState<Route[]>([]);
  const [update, setUpdate] = useState(false);
  const route = stack[stack.length - 1];
  useTheme(data.prefs.theme);
  setLang(data.prefs.lang); // set before children render so every screen sees the new language in the same pass
  useEffect(() => {
    document.documentElement.lang = data.prefs.lang;
    try { localStorage.setItem('habits-lang', data.prefs.lang); } catch { /* harmless */ }
  }, [data.prefs.lang]);
  useEffect(() => {
    const u = () => setUpdate(true);
    window.addEventListener('habits:update-ready', u);
    return () => window.removeEventListener('habits:update-ready', u);
  }, []);

  const nav: Nav = { push: r => setStack(s => [...s, r]), pop: () => setStack(s => s.slice(0, -1)), goTab: t => { setStack([]); setTab(t); } };
  const screen = route ? <HabitDetail id={route.id} /> : tab === 'today' ? <Today /> : tab === 'habits' ? <HabitsList /> : tab === 'progress' ? <Progress /> : <Settings />;
  const key = route ? `habit-${route.id}` : tab;
  const activeTab = route ? 'habits' : tab;

  return (
    <LangCtx.Provider value={data.prefs.lang}>
      <NavCtx.Provider value={nav}>
        <div className="shell">
          <aside className="sidebar" aria-label={tr('Sidebar')}>
            <div className="brand">habits<i>.</i></div>
            <nav aria-label={tr('Main')}>
              {TABS.map(t => (
                <button key={t.id} className={`side-link ${activeTab === t.id ? 'on' : ''}`} aria-current={activeTab === t.id ? 'page' : undefined} onClick={() => nav.goTab(t.id)}>
                  <Icon name={t.icon} size={20} />{tr(t.label)}
                </button>
              ))}
            </nav>
          </aside>
          <div className="app">
            {update && (
              <div className="card" style={{ margin: 'calc(var(--sat) + 8px) 12px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="grow small">{tr('A new version is ready.')}</span>
                <button className="btn btn-sm btn-primary" onClick={() => (window as unknown as { __applyUpdate?: () => void }).__applyUpdate?.()}>{tr('Reload')}</button>
                <button className="btn btn-sm" onClick={() => setUpdate(false)}>{tr('Later')}</button>
              </div>
            )}
            {/* One enter-only CSS animation (opacity + transform) per navigation: compositor-driven, no exit phase. */}
            <main key={key} className={`scroll page-enter ${route ? 'no-tabs' : ''}`}><div className="page">{screen}</div></main>
          </div>
        </div>
        {!route && (
          <nav className="tabbar" aria-label={tr('Main')}>
            <div className="tabbar-inner">
              {TABS.map(t => (
                <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => nav.goTab(t.id)}>
                  <Icon name={t.icon} size={23} />{tr(t.label)}
                </button>
              ))}
            </div>
          </nav>
        )}
        {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
      </NavCtx.Provider>
    </LangCtx.Provider>
  );
}
