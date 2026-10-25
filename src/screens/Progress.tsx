import { useMemo, useState } from 'react';
import { addDays, formatLong, formatMonth, formatShort } from '../lib/dates';
import { byOrder, doneSet, habitStats, isDue as dueOn } from '../lib/habits';
import { buildHeatmap } from '../lib/heatmap';
import { addMonths, dataStart, makeIndex, monthKey, monthSeries, perfectStreak, ratioMap, rangeSummary, weeklySeries } from '../lib/stats';
import { parseKey } from '../lib/dates';
import type { DateKey } from '../lib/types';
import { tr } from '../i18n';
import { useStore } from '../store';
import { BarChart, Empty, Header, HabitDisc, Heatmap, Icon, MonthCalendar, Segmented, Sheet } from '../components/ui';
import { useNav } from '../nav';

type Range = '7' | '30' | '90' | 'all';
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);

export default function Progress() {
  const { data, today } = useStore();
  const nav = useNav();
  const ws = data.prefs.weekStart;
  const [range, setRange] = useState<Range>('30');
  const [view, setView] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(() => monthKey(parseKey(today).y, parseKey(today).m));
  const [day, setDay] = useState<DateKey | null>(null);

  const idx = useMemo(() => makeIndex(data), [data.completions]); // eslint-disable-line react-hooks/exhaustive-deps
  const start = useMemo(() => dataStart(data), [data]);
  const live = useMemo(() => data.habits.filter(h => !h.archivedAt), [data.habits]);
  const from = range === 'all' ? start ?? today : addDays(today, -(Number(range) - 1));
  const sum = useMemo(() => rangeSummary(data, idx, from, today, today), [data, idx, from, today]);
  const streak = useMemo(() => perfectStreak(data, idx, today), [data, idx, today]);
  const weekly = useMemo(() => weeklySeries(data, idx, 8, today, ws), [data, idx, today, ws]);
  const monthly = useMemo(() => monthSeries(data, idx, 6, today), [data, idx, today]);
  const yearFrom = addDays(today, -53 * 7);
  const ratios = useMemo(() => ratioMap(data.habits, idx, view === 'year' ? yearFrom : month, view === 'year' ? today : addDays(addMonths(month, 1), -1)), [data.habits, idx, view, month, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const cols = useMemo(() => (view === 'year' ? buildHeatmap(ratios, today, 53, ws, start) : []), [view, ratios, today, ws, start]);
  const rows = useMemo(() => live.map(h => ({ h, st: habitStats(h, doneSet(idx, h.id), today) })).sort((a, b) => (b.st.rate ?? -1) - (a.st.rate ?? -1) || byOrder(a.h, b.h)), [live, idx, today]);

  if (!data.habits.length) return <><Header title={tr('Progress')} /><div style={{ marginTop: 16 }}><Empty title={tr('No data yet')} hint={tr('Complete a habit and real statistics will appear here. Nothing is ever simulated.')} /></div></>;

  const isCurrentMonth = month === monthKey(parseKey(today).y, parseKey(today).m);

  return (
    <>
      <Header title={tr('Progress')} subtitle={start ? tr('Since {date}', { date: formatShort(start) }) : undefined} />
      <div style={{ marginTop: 14 }}><Segmented value={range} onChange={setRange} options={[{ value: '7', label: tr('{n}d', { n: 7 }) }, { value: '30', label: tr('{n}d', { n: 30 }) }, { value: '90', label: tr('{n}d', { n: 90 }) }, { value: 'all', label: tr('All') }]} /></div>
      <div className="grid2 four" style={{ marginTop: 14 }}>
        <div className="card"><p className="kpi">{pct(sum.rate)}</p><p className="small muted">{tr('Consistency')}{sum.due ? ` · ${sum.done}/${sum.due}` : ''}</p></div>
        <div className="card"><p className="kpi">{sum.completions}</p><p className="small muted">{tr('Completions')}</p></div>
        <div className="card"><p className="kpi">{sum.perfectDays}</p><p className="small muted">{tr('Perfect days')}</p></div>
        <div className="card"><p className="kpi"><Icon name="flame" size={22} fill /> {streak}</p><p className="small muted">{tr('Perfect-day streak')}</p></div>
      </div>

      <h2 className="h2">{tr('Consistency')}</h2>
      <div className="card">
        <Segmented value={view} onChange={v => { setView(v); setDay(null); }} options={[{ value: 'month', label: tr('Month') }, { value: 'year', label: tr('Year') }]} />
        {view === 'month' ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button className="icon-btn filled" aria-label={tr('Previous month')} onClick={() => setMonth(addMonths(month, -1))}><Icon name="back" /></button>
              <b style={{ fontFamily: 'var(--display)', fontSize: 20, letterSpacing: '-.02em' }}>{formatMonth(month)}</b>
              <button className="icon-btn filled" aria-label={tr('Next month')} disabled={isCurrentMonth} style={{ opacity: isCurrentMonth ? 0.3 : 1 }} onClick={() => setMonth(addMonths(month, 1))}><Icon name="next" /></button>
            </div>
            <MonthCalendar month={month} ratios={ratios} today={today} weekStart={ws} startKey={start} selected={day} onSelect={setDay} />
          </div>
        ) : (
          <div style={{ marginTop: 14 }}><Heatmap cols={cols} weekStart={ws} selected={day} onSelect={setDay} mode="overall" /></div>
        )}
        <p className="small dim" style={{ marginTop: 10 }}>{tr('Tap a day to see or correct what you completed.')}</p>
      </div>

      <div className="cols-2">
        <div><h2 className="h2">{tr('Weekly')}</h2>
          <div className="card"><BarChart max={1} points={weekly.map(p => ({ label: formatShort(p.label).replace(' ', '\u00a0'), value: p.rate, text: pct(p.rate) }))} /></div></div>
        <div><h2 className="h2">{tr('Monthly')}</h2>
          <div className="card"><BarChart max={1} points={monthly.map(p => ({ label: formatMonth(p.label).split(' ')[0].slice(0, 3), value: p.rate, text: pct(p.rate) }))} />
            <p className="small dim" style={{ marginTop: 8 }}>{tr('Hatched = no data yet. A flat line = recorded, 0%.')}</p></div></div>
      </div>

      <h2 className="h2">{tr('By habit')}</h2>
      {rows.length === 0 ? <p className="muted small">{tr('No active habits.')}</p> : (
        <div className="list">
          {rows.map(({ h, st }) => (
            <button key={h.id} className="row" style={{ width: '100%', textAlign: 'left', minHeight: 64 }} onClick={() => nav.push({ name: 'habit', id: h.id })}>
              <HabitDisc icon={h.icon} size="sm" />
              <div className="grow"><div className="ellipsis" style={{ fontWeight: 700 }}>{h.name}</div>
                <div className="bar-track" style={{ marginTop: 6 }}><div className="bar-fill" style={{ width: `${Math.round((st.rate ?? 0) * 100)}%` }} /></div></div>
              <b className="num" style={{ minWidth: 44, textAlign: 'right' }}>{pct(st.rate)}</b>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!day} onClose={() => setDay(null)} title={day ? formatLong(day) : ''}>
        {day && <DayList date={day} today={today} />}
      </Sheet>
    </>
  );
}

/** Habits due on a date with toggles; past days can be corrected. */
function DayList({ date, today }: { date: DateKey; today: DateKey }) {
  const { data, toggleHabit } = useStore();
  const done = new Set(data.completions.filter(c => c.date === date).map(c => c.habitId));
  const due = data.habits.filter(h => !h.archivedAt || done.has(h.id)).filter(h => done.has(h.id) || dueOn(h, date)).sort(byOrder);
  if (!due.length) return <p className="muted">{tr('Rest day — nothing due.')}</p>;
  return (
    <div>
      {date > today && <p className="muted" style={{ marginBottom: 12 }}>{tr("Future days can't be completed yet.")}</p>}
      {due.map(h => (
        <div key={h.id} className={`hrow ${done.has(h.id) ? 'done' : ''}`} style={{ minHeight: 64 }}>
          <HabitDisc icon={h.icon} size="sm" />
          <span className="hname grow ellipsis" style={{ fontSize: 16 }}>{h.name}</span>
          <button className={`hcheck ${done.has(h.id) ? 'on' : ''}`} style={{ width: 44, height: 44 }} role="checkbox" aria-checked={done.has(h.id)} disabled={date > today}
            aria-label={tr('Complete {name}', { name: h.name })} onClick={() => toggleHabit(h.id, date)}><Icon name="check" size={22} stroke={3} /></button>
        </div>
      ))}
    </div>
  );
}
