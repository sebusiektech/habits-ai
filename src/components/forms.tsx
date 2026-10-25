import { useState } from 'react';
import type { Habit } from '../lib/types';
import { uid, weekdayShort } from '../lib/dates';
import { ICON_KEYS } from '../lib/appearance';
import * as repo from '../db/repo';
import { tr } from '../i18n';
import { useStore } from '../store';
import { Field, HabitGlyph, HabitDisc, Sheet } from './ui';

const ALL = [0, 1, 2, 3, 4, 5, 6], WEEKDAYS = [1, 2, 3, 4, 5], WEEKEND = [0, 6];
const IDEAS: { name: string; icon: string }[] = [
  { name: 'Drink water', icon: 'droplets' }, { name: 'Read', icon: 'book' }, { name: 'Walk', icon: 'footprints' },
  { name: 'Meditate', icon: 'brain' }, { name: 'Stretch', icon: 'leaf' }
];
const same = (a: number[], b: number[]) => a.length === b.length && a.every(x => b.includes(x));

/** Create or edit a habit. Only a name is required; everything else has a sensible default. */
export function HabitForm({ habit, onClose, onSaved }: { habit?: Habit; onClose: () => void; onSaved?: (h: Habit) => void }) {
  const { data, run, today } = useStore();
  const ws = data.prefs.weekStart;
  const [name, setName] = useState(habit?.name ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? 'sparkles');
  const [days, setDays] = useState<number[]>(habit?.schedule ?? ALL);
  const [desc, setDesc] = useState(habit?.description ?? '');
  const [showDesc, setShowDesc] = useState(!!habit?.description);
  const [err, setErr] = useState('');
  const order = [0, 1, 2, 3, 4, 5, 6].map(i => (i + ws) % 7);
  const toggleDay = (d: number) => setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort());

  const save = async () => {
    const n = name.trim();
    if (!n) return setErr(tr('Give the habit a name.'));
    if (n.length > 60) return setErr(tr('Keep the name under 60 characters.'));
    if (!days.length) return setErr(tr('Pick at least one weekday.'));
    const h: Habit = {
      id: habit?.id ?? uid(), name: n, description: desc.trim() || undefined, icon, schedule: [...days].sort(), weeklyTarget: days.length,
      startDate: habit?.startDate ?? today, createdAt: habit?.createdAt ?? Date.now(),
      order: habit?.order ?? Math.max(-1, ...data.habits.map(x => x.order)) + 1, pauses: habit?.pauses ?? [], archivedAt: habit?.archivedAt ?? null
    };
    if (await run(() => repo.saveHabit(h), habit ? 'Habit updated' : 'Habit created')) { onSaved?.(h); onClose(); }
  };

  return (
    <Sheet open onClose={onClose} title={habit ? tr('Edit habit') : tr('New habit')}>
      <div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
          <HabitDisc icon={icon} />
          <input className="input" value={name} maxLength={60} autoFocus={!habit} aria-label={tr('Name')} placeholder={tr('e.g. Read 20 pages')}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
        </div>
        {!habit && !name && (
          <div className="chips" style={{ marginTop: 12 }}>
            {IDEAS.map(i => <button key={i.name} className="chip" onClick={() => { setName(tr(i.name)); setIcon(i.icon); }}>{tr(i.name)}</button>)}
          </div>
        )}
        <span className="label">{tr('Icon')}</span>
        <div className="iconpick">
          {ICON_KEYS.map(k => <button key={k} className={k === icon ? 'on' : ''} aria-label={k} aria-pressed={k === icon} onClick={() => setIcon(k)}><HabitGlyph icon={k} size={22} /></button>)}
        </div>
      </div>
      <span className="label">{tr('Repeat on')}</span>
      <div className="chips">
        {order.map(d => <button key={d} className={`chip ${days.includes(d) ? 'on' : ''}`} aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>{weekdayShort(d)}</button>)}
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        <button className={`chip ${same(days, ALL) ? 'on' : ''}`} onClick={() => setDays(ALL)}>{tr('Every day')}</button>
        <button className={`chip ${same(days, WEEKDAYS) ? 'on' : ''}`} onClick={() => setDays(WEEKDAYS)}>{tr('Weekdays')}</button>
        <button className={`chip ${same(days, WEEKEND) ? 'on' : ''}`} onClick={() => setDays(WEEKEND)}>{tr('Weekends')}</button>
      </div>
      {showDesc
        ? <Field label={tr('Description (optional)')}><input className="input" value={desc} maxLength={140} onChange={e => setDesc(e.target.value)} /></Field>
        : <button className="chip" style={{ marginTop: 16 }} onClick={() => setShowDesc(true)}>{tr('Add a description')}</button>}
      {err && <p role="alert" style={{ color: 'var(--danger)', marginTop: 12 }}>{err}</p>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 22, minHeight: 54 }} onClick={save}>{tr('Save')}</button>
    </Sheet>
  );
}
