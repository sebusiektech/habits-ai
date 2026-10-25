import { useMemo, useState } from 'react';
import { addDays, formatLong, formatShort, startOfWeek, weekdayShort } from '../lib/dates';
import { archiveHabit, byOrder, doneSet, firstDate, habitStats, isDaily, isDue, pauseHabit, restoreHabit, resumeHabit, statusOf, weekProgress } from '../lib/habits';
import { buildHeatmap } from '../lib/heatmap';
import { makeIndex } from '../lib/stats';
import type { DateKey, Habit } from '../lib/types';
import * as repo from '../db/repo';
import { tr } from '../i18n';
import { useStore } from '../store';
import { BackBar, BarChart, Confirm, Empty, Header, HabitDisc, Heatmap, Icon, Segmented, Sheet } from '../components/ui';
import { HabitForm } from '../components/forms';
import { useNav } from '../nav';

const schedule = (h: Habit) => (isDaily(h) ? tr('Every day') : h.schedule.map(d => weekdayShort(d)).join(' · '));

/** The "Habits" tab: manage, reorder, pause, archive. */
export function HabitsList() {
  const { data, today, run } = useStore();
  const nav = useNav();
  const [form, setForm] = useState(false);
  const [reorder, setReorder] = useState(false);
  const idx = useMemo(() => makeIndex(data), [data.completions]); // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => [...data.habits].sort(byOrder), [data.habits]);
  const group = (s: 'active' | 'paused' | 'archived') => sorted.filter(h => statusOf(h, today) === s);
  const active = group('active'), paused = group('paused'), archived = group('archived');

  const swap = (list: Habit[], i: number, dir: -1 | 1) => {
    const a = list[i], b = list[i + dir];
    if (!b) return;
    void run(() => repo.saveHabits([{ ...a, order: b.order }, { ...b, order: a.order }]));
  };
  const row = (h: Habit, list: Habit[], i: number, canMove: boolean) => {
    const st = habitStats(h, doneSet(idx, h.id), today);
    return (
      <div key={h.id} className="hrow" style={{ minHeight: 68 }}>
        <HabitDisc icon={h.icon} />
        <button className="hbody" onClick={() => nav.push({ name: 'habit', id: h.id })} disabled={reorder && canMove}>
          <span className="hname ellipsis">{h.name}</span>
          <span className="small dim ellipsis">{schedule(h)}</span>
        </button>
        {reorder && canMove ? (
          <>
            <button className="icon-btn" aria-label={tr('Move up')} disabled={i === 0} style={{ opacity: i === 0 ? 0.25 : 1 }} onClick={() => swap(list, i, -1)}><Icon name="up" size={20} /></button>
            <button className="icon-btn" aria-label={tr('Move down')} disabled={i === list.length - 1} style={{ opacity: i === list.length - 1 ? 0.25 : 1 }} onClick={() => swap(list, i, 1)}><Icon name="down" size={20} /></button>
          </>
        ) : (
          <>{st.current > 0 && <span className="pill"><Icon name="flame" size={12} fill />{st.current}</span>}<Icon name="chevron" size={16} /></>
        )}
      </div>
    );
  };

  return (
    <>
      <Header title={tr('Habits')} subtitle={data.habits.length ? tr('{n} active', { n: active.length }) : undefined}
        right={<div style={{ display: 'flex', gap: 6 }}>
          {active.length > 1 && <button className={`icon-btn filled ${reorder ? 'on' : ''}`} aria-label={tr('Reorder')} aria-pressed={reorder} style={reorder ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined} onClick={() => setReorder(!reorder)}><Icon name="reorder" size={20} /></button>}
          <button className="btn btn-primary desktop-only" onClick={() => setForm(true)}><Icon name="plus" size={18} /> {tr('New habit')}</button>
        </div>} />
      {data.habits.length === 0 && <div style={{ marginTop: 16 }}><Empty title={tr('No habits yet')} hint={tr('Small and specific works best.')} action={<button className="btn btn-primary" onClick={() => setForm(true)}>{tr('Create habit')}</button>} /></div>}
      <div style={{ marginTop: 16 }}>{active.map((h, i) => row(h, active, i, true))}</div>
      {paused.length > 0 && <><h2 className="h2">{tr('Paused')}</h2>{paused.map((h, i) => row(h, paused, i, false))}</>}
      {archived.length > 0 && <><h2 className="h2">{tr('Archived')}</h2>{archived.map((h, i) => row(h, archived, i, false))}</>}
      <div className="fab-wrap mobile-only"><div><button className="fab" aria-label={tr('New habit')} onClick={() => setForm(true)}><Icon name="plus" size={28} stroke={2.5} /></button></div></div>
      {form && <HabitForm onClose={() => setForm(false)} />}
    </>
  );
}

export function HabitDetail({ id }: { id: string }) {
  const { data, today, run, toggleHabit } = useStore();
  const nav = useNav();
  const ws = data.prefs.weekStart;
  const [weeks, setWeeks] = useState<'26' | '53'>('26');
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [day, setDay] = useState<DateKey | null>(null);
  const h = data.habits.find(x => x.id === id);
  const set = useMemo(() => makeIndex(data).get(id) ?? new Set<DateKey>(), [data.completions, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useMemo(() => (h ? habitStats(h, set, today) : null), [h, set, today]);
  const cols = useMemo(() => {
    if (!h) return [];
    const earliest = [...set].sort()[0];
    const start = earliest && earliest < h.startDate ? earliest : h.startDate;
    const ratios = new Map<DateKey, number | null>();
    for (let i = 0, n = Number(weeks) * 7 + 7; i < n; i++) {
      const d = addDays(today, -i);
      ratios.set(d, isDue(h, d) ? (set.has(d) ? 1 : 0) : set.has(d) ? 1 : null);
    }
    return buildHeatmap(ratios, today, Number(weeks), ws, start);
  }, [h, set, today, weeks, ws]);
  const trend = useMemo(() => {
    if (!h) return [];
    const first = firstDate(h, set);
    return Array.from({ length: 8 }, (_, k) => {
      const s = startOfWeek(addDays(today, -7 * (7 - k)), ws), p = weekProgress(h, set, s, ws, today);
      const before = addDays(s, 6) < first;
      return { label: formatShort(s), value: before || !p.due ? null : p.done / p.due, text: p.due ? `${p.done}/${p.due}` : '' };
    });
  }, [h, set, today, ws]);
  if (!h || !st) return <><BackBar onBack={nav.pop} /><Empty title={tr('Habit not found')} /></>;

  const status = statusOf(h, today);
  const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
  const save = (next: Habit, msg: string) => run(() => repo.saveHabit(next), msg);

  return (
    <div>
      <BackBar onBack={nav.pop} right={<button className="btn btn-sm" onClick={() => setEdit(true)}><Icon name="edit" size={16} /> {tr('Edit')}</button>} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
        <HabitDisc icon={h.icon} size="lg" solid />
        <div className="grow">
          <h1 className="title">{h.name}</h1>
          <p className="subtitle">{h.description || schedule(h)}</p>
          {status !== 'active' && <span className="pill neutral" style={{ marginTop: 8 }}>{status === 'paused' ? tr('Paused') : tr('Archived')}</span>}
        </div>
      </div>

      <div className="grid2 four" style={{ marginTop: 20 }}>
        <div className="card"><p className="kpi"><Icon name="flame" size={22} fill /> {st.current}</p><p className="small muted">{tr('Current streak')}</p></div>
        <div className="card"><p className="kpi">{st.longest}</p><p className="small muted">{tr('Longest streak')}</p></div>
        <div className="card"><p className="kpi">{pct(st.rate)}</p><p className="small muted">{tr('Completion rate')}</p></div>
        <div className="card"><p className="kpi">{st.totalDone}</p><p className="small muted">{tr('Total completed')}</p></div>
      </div>
      <p className="small muted" style={{ margin: '12px 4px 0' }}>{tr('Streaks and rates count only the days this habit is due. Rest days and paused days are never misses.')}</p>

      <h2 className="h2">{tr('Last 8 weeks')}</h2>
      <div className="card"><BarChart max={1} points={trend.map(p => ({ label: p.label.replace(' ', '\u00a0'), value: p.value, text: p.text }))} /></div>

      <h2 className="h2">{tr('History')}</h2>
      <div className="card">
        <div style={{ marginBottom: 12 }}><Segmented value={weeks} onChange={setWeeks} options={[{ value: '26', label: tr('6 months') }, { value: '53', label: tr('1 year') }]} /></div>
        <Heatmap cols={cols} weekStart={ws} selected={day} onSelect={setDay} mode="habit" />
        <p className="small dim" style={{ marginTop: 8 }}>{tr('Tap a day to view or correct it.')}</p>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
        {status === 'archived'
          ? <button className="btn btn-block" onClick={() => save(restoreHabit(h, today), 'Habit restored')}><Icon name="restore" size={18} /> {tr('Restore habit')}</button>
          : <>
            {status === 'paused'
              ? <button className="btn btn-block" onClick={() => save(resumeHabit(h, today), 'Habit resumed')}><Icon name="play" size={18} /> {tr('Resume habit')}</button>
              : <button className="btn btn-block" onClick={() => save(pauseHabit(h, today), 'Habit paused')}><Icon name="pause" size={18} /> {tr('Pause habit')}</button>}
            <button className="btn btn-block" onClick={() => save(archiveHabit(h, today), 'Habit archived')}><Icon name="archive" size={18} /> {tr('Archive habit')}</button>
          </>}
        <button className="btn btn-danger btn-block" onClick={() => setDel(true)}><Icon name="trash" size={18} /> {tr('Delete habit and history')}</button>
      </div>

      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? formatLong(day) : ''}>
        {day && <>
          <p className="muted" style={{ marginBottom: 16 }}>
            {isDue(h, day) ? tr('Due this day') : tr('Rest day (extra completions are allowed and never hurt streaks)')} · {set.has(day) ? tr('Completed') : tr('Not completed')}
          </p>
          {day <= today
            ? <button className="btn btn-primary btn-block" onClick={() => toggleHabit(h.id, day)}>{set.has(day) ? tr('Mark as not completed') : tr('Mark as completed')}</button>
            : <p className="muted">{tr("Future days can't be completed yet.")}</p>}
        </>}
      </Sheet>
      {edit && <HabitForm habit={h} onClose={() => setEdit(false)} />}
      <Confirm open={del} danger title={tr('Delete this habit?')} message={tr('Its entire completion history will be permanently deleted. Archive it instead to keep the history.')}
        confirmLabel={tr('Delete forever')} onCancel={() => setDel(false)}
        onConfirm={async () => { setDel(false); if (await run(() => repo.deleteHabit(h.id), 'Habit deleted')) nav.pop(); }} />
    </div>
  );
}
