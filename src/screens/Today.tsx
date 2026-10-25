import { memo, useEffect, useMemo, useState } from 'react';
import { formatLong, formatShort, weekDays, weekdayShort, weekday, parseKey } from '../lib/dates';
import { byOrder, doneSet, habitStats, habitsDueOn } from '../lib/habits';
import { dayInfo, makeIndex, perfectStreak } from '../lib/stats';
import type { Habit } from '../lib/types';
import { tr } from '../i18n';
import { useStore } from '../store';
import { cssVars, Empty, Icon, HabitDisc } from '../components/ui';
import { HabitForm } from '../components/forms';
import { useNav } from '../nav';

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? tr('Late night') : h < 12 ? tr('Good morning') : h < 18 ? tr('Good afternoon') : tr('Good evening');
}

const HabitRow = memo(function HabitRow({ h, done, streak, locked, onToggle, onOpen }: {
  h: Habit; done: boolean; streak: number; locked: boolean; onToggle: (id: string) => void; onOpen: (id: string) => void;
}) {
  return (
    <div className={`hrow ${done ? 'done' : ''}`}>
      <HabitDisc icon={h.icon} />
      <button className="hbody" onClick={() => onOpen(h.id)}>
        <span className="hname ellipsis">{h.name}</span>
        {(streak > 0 || h.description) && (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
            {streak > 0 && <span className="pill"><Icon name="flame" size={12} fill />{streak}</span>}
            {h.description && <span className="small dim ellipsis">{h.description}</span>}
          </span>
        )}
      </button>
      <button className={`hcheck ${done ? 'on' : ''}`} role="checkbox" aria-checked={done} disabled={locked}
        aria-label={tr('Complete {name}', { name: h.name })} onClick={() => onToggle(h.id)}><Icon name="check" size={24} stroke={3} /></button>
    </div>
  );
});

export default function Today() {
  const { data, today, toggleHabit } = useStore();
  const nav = useNav();
  const ws = data.prefs.weekStart;
  const [sel, setSel] = useState(today);
  const [form, setForm] = useState(false);
  useEffect(() => { setSel(today); }, [today]);

  const idx = useMemo(() => makeIndex(data), [data.completions]); // eslint-disable-line react-hooks/exhaustive-deps
  const due = useMemo(() => habitsDueOn(data.habits, sel), [data.habits, sel]);
  const isDone = (h: Habit) => doneSet(idx, h.id).has(sel);
  const todo = due.filter(h => !isDone(h)), finished = due.filter(isDone);
  const streaks = useMemo(() => new Map(due.map(h => [h.id, habitStats(h, doneSet(idx, h.id), today).current])), [due, idx, today]);
  const week = useMemo(() => weekDays(today, ws).map(d => ({ d, ...dayInfo(data.habits, idx, d) })), [data.habits, idx, today, ws]);
  const streak = useMemo(() => perfectStreak(data, idx, today), [data, idx, today]);
  const open = (id: string) => nav.push({ name: 'habit', id });
  const toggle = (id: string) => void toggleHabit(id, sel);

  const [weekdayName, ...rest] = formatLong(sel).split(', ');
  const live = data.habits.filter(h => !h.archivedAt);
  const past = sel !== today;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="grow">
          <p className="eyebrow">{past ? tr('Editing a past day') : greeting()}</p>
          <h1 className="display" style={{ marginTop: 6 }}>{weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1)}</h1>
          <p className="subtitle">{rest.join(', ')}{past && <> · <button style={{ color: 'var(--accent-strong)', fontWeight: 700, minHeight: 32 }} onClick={() => setSel(today)}>{tr('Back to today')}</button></>}</p>
        </div>
        <button className="btn btn-primary desktop-only" onClick={() => setForm(true)}><Icon name="plus" size={18} /> {tr('New habit')}</button>
      </div>

      <div className="ribbon" style={{ marginTop: 20 }} role="group" aria-label={tr('This week')}>
        {week.map(w => {
          const future = w.d > today;
          return (
            <button key={w.d} disabled={future} aria-pressed={w.d === sel} aria-label={formatShort(w.d)}
              className={`rday ${w.d === sel ? 'sel' : ''} ${w.d === today ? 'today' : ''} ${w.due ? '' : 'rest'}`} onClick={() => setSel(w.d)}>
              {weekdayShort(weekday(w.d))}
              <span className="ring" style={cssVars({ '--p': w.due ? Math.round((w.done / w.due) * 100) : 0 })}><b>{parseKey(w.d).d}</b></span>
            </button>
          );
        })}
      </div>

      <div className="cols-2">
        <div>
          <div className="card" style={{ marginTop: 16 }}>
            {live.length === 0 ? (
              <p className="muted">{tr('Your progress for the day will show up here.')}</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <span className="big-count">{finished.length}</span><span className="muted" style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 28 }}>/{due.length}</span>
                    <p className="small muted" style={{ marginTop: 8 }}>
                      {!due.length ? tr('Rest day — nothing due.') : !todo.length ? tr('All done. Steady wins.') : tr('{n} left to do.', { n: todo.length })}
                    </p>
                  </div>
                  {streak > 0 && <span className="pill"><Icon name="flame" size={13} fill />{tr('{n}-day perfect streak', { n: streak })}</span>}
                </div>
                {due.length > 0 && <div className="dots" style={{ marginTop: 16 }} aria-hidden="true">{due.map(h => <i key={h.id} className={isDone(h) ? 'on' : ''} />)}</div>}
              </>
            )}
          </div>
        </div>

        <div>
          {live.length === 0 ? (
            <div style={{ marginTop: 16 }}><Empty title={tr('Start with one habit')} hint={tr('Small and specific works best.')} action={<button className="btn btn-primary" onClick={() => setForm(true)}>{tr('Create habit')}</button>} /></div>
          ) : due.length === 0 ? (
            <div style={{ marginTop: 16 }}><Empty title={tr('A day to rest')} hint={tr('No habits are due on this day.')} /></div>
          ) : (
            <>
              {todo.length > 0 && <><h2 className="h2">{tr('To do')} <span className="dim num">{todo.length}</span></h2>
                {todo.map(h => <HabitRow key={h.id} h={h} done={false} streak={streaks.get(h.id) ?? 0} locked={false} onToggle={toggle} onOpen={open} />)}</>}
              {finished.length > 0 && <><h2 className="h2">{tr('Done')} <span className="dim num">{finished.length}</span></h2>
                {[...finished].sort(byOrder).map(h => <HabitRow key={h.id} h={h} done streak={streaks.get(h.id) ?? 0} locked={false} onToggle={toggle} onOpen={open} />)}</>}
            </>
          )}
        </div>
      </div>

      <div className="fab-wrap mobile-only"><div><button className="fab" aria-label={tr('New habit')} onClick={() => setForm(true)}><Icon name="plus" size={28} stroke={2.5} /></button></div></div>
      {form && <HabitForm onClose={() => setForm(false)} />}
    </>
  );
}
