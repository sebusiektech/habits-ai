import { memo, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Apple, Archive, ArchiveRestore, ArrowUpDown, BarChart3, BedDouble, Bike, BookOpen, Brain, CalendarCheck, Check as CheckIcon,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Code, Coffee, Droplets, Dumbbell, Flame, Footprints, HeartPulse, Languages,
  Leaf, ListChecks, Moon, Music, Pause, PenLine, Pencil, Pill, PhoneOff, Play, Plus, Salad, Settings, Smile, Sparkles, Sun,
  Trash2, Wallet, type LucideIcon
} from 'lucide-react';
import type { DateKey } from '../lib/types';
import { addDays, daysInMonth, formatLong, monthShort, parseKey, weekday, weekdayShort } from '../lib/dates';
import { type HeatCell, ratioLevel } from '../lib/heatmap';
import type { IconKey } from '../lib/appearance';
import { tr, useT } from '../i18n';

export type IconName = 'today' | 'habits' | 'progress' | 'settings' | 'plus' | 'check' | 'back' | 'next' | 'chevron' | 'up' | 'down'
  | 'trash' | 'flame' | 'pause' | 'play' | 'archive' | 'restore' | 'edit' | 'reorder';
const ICONS: Record<IconName, LucideIcon> = {
  today: CalendarCheck, habits: ListChecks, progress: BarChart3, settings: Settings, plus: Plus, check: CheckIcon, back: ChevronLeft,
  next: ChevronRight, chevron: ChevronRight, up: ChevronUp, down: ChevronDown, trash: Trash2, flame: Flame, pause: Pause, play: Play,
  archive: Archive, restore: ArchiveRestore, edit: Pencil, reorder: ArrowUpDown
};
/** Typed way to set CSS custom properties from React. */
export const cssVars = (v: Record<string, string | number>) => v as CSSProperties;

export function Icon({ name, size = 22, fill = false, stroke = 2 }: { name: IconName; size?: number; fill?: boolean; stroke?: number }) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={stroke} fill={fill ? 'currentColor' : 'none'} aria-hidden="true" />;
}

const HABIT_ICONS: Record<IconKey, LucideIcon> = {
  sparkles: Sparkles, droplets: Droplets, book: BookOpen, dumbbell: Dumbbell, footprints: Footprints, brain: Brain, apple: Apple,
  salad: Salad, coffee: Coffee, pill: Pill, heart: HeartPulse, moon: Moon, bed: BedDouble, sun: Sun, pen: PenLine, music: Music,
  languages: Languages, bike: Bike, leaf: Leaf, smile: Smile, code: Code, wallet: Wallet, phoneoff: PhoneOff, flame: Flame
};
export function HabitGlyph({ icon, size = 22 }: { icon: string; size?: number }) {
  const C = HABIT_ICONS[icon as IconKey] ?? Sparkles;
  return <C size={size} strokeWidth={2} aria-hidden="true" />;
}
export function HabitDisc({ icon, size = 'md', solid }: { icon: string; size?: 'sm' | 'md' | 'lg'; solid?: boolean }) {
  return <span className={`hdisc ${size === 'md' ? '' : size} ${solid ? 'solid' : ''}`}><HabitGlyph icon={icon} size={size === 'lg' ? 34 : size === 'sm' ? 18 : 23} /></span>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose}>
          <motion.div className="sheet" role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }} onClick={e => e.stopPropagation()}>
            <div className="grabber" />
            {title && <h2>{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Confirm({ open, title, message, confirmLabel = tr('Confirm'), danger, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="muted" style={{ marginBottom: 18 }}>{message}</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <button className={`btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn btn-block" onClick={onCancel}>{tr('Cancel')}</button>
      </div>
    </Sheet>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export const Progress = ({ value }: { value: number }) => (
  <div className="bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
    <div className="bar-fill" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
  </div>
);

/* ---------- heatmap (columns of weeks) ---------- */
const HeatCol = memo(function HeatCol({ col, selected, mode, onSelect }: { col: HeatCell[]; selected: DateKey | null; mode: 'habit' | 'overall'; onSelect: (d: DateKey) => void }) {
  useT();
  const label = (c: HeatCell) => `${formatLong(c.date)}: ${c.noData ? tr('no data') : c.rest ? tr('Rest day')
    : mode === 'habit' ? (c.ratio ? tr('Completed') : tr('Missed')) : tr('{n}% done', { n: Math.round((c.ratio ?? 0) * 100) })}`;
  return (
    <div className="heat-col">
      {col.map(c => (
        <button key={c.date} data-l={c.level} disabled={c.future} aria-label={label(c)}
          className={`heat-cell ${c.future ? 'future' : ''} ${c.noData ? 'nodata' : ''} ${c.rest ? 'rest' : ''} ${selected === c.date ? 'sel' : ''}`}
          onClick={() => onSelect(c.date)} />
      ))}
    </div>
  );
});

export const Heatmap = memo(function Heatmap({ cols, weekStart, selected, onSelect, mode }: {
  cols: HeatCell[][]; weekStart: 0 | 1; selected?: DateKey | null; onSelect: (d: DateKey) => void; mode: 'habit' | 'overall';
}) {
  useT();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, [cols.length]);
  const months = useMemo(() => cols.map((col, i) => {
    const first = col.find(c => parseKey(c.date).d === 1);
    return first ? monthShort(first.date) : i === 0 ? monthShort(col[0].date) : '';
  }), [cols]);
  return (
    <div>
      <div style={{ display: 'flex' }}>
        <div className="heat-days" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map(r => <span key={r}>{r % 2 === 1 ? weekdayShort((weekStart + r) % 7) : ''}</span>)}</div>
        <div className="heat-wrap" ref={ref} style={{ flex: 1 }}>
          <div className="heat-months">{cols.map((c, i) => <div className="heat-month" key={c[0].date}><span>{months[i]}</span></div>)}</div>
          <div className="heat" style={{ marginTop: 4 }}>
            {cols.map(col => <HeatCol key={col[0].date} col={col} mode={mode} onSelect={onSelect} selected={selected && col.some(c => c.date === selected) ? selected : null} />)}
          </div>
        </div>
      </div>
      <div className="legend" aria-hidden="true">
        <i className="rest" /> {tr('Rest day')} &nbsp;
        {mode === 'habit'
          ? <><i style={{ background: 'var(--h0)' }} /> {tr('Missed')} &nbsp;<i style={{ background: 'var(--h4)' }} /> {tr('Done')}</>
          : <>{tr('Less')} {[0, 1, 2, 3, 4].map(l => <i key={l} style={{ background: `var(--h${l})` }} />)} {tr('More')}</>}
      </div>
    </div>
  );
});

/* ---------- month calendar ---------- */
export const MonthCalendar = memo(function MonthCalendar({ month, ratios, today, weekStart, startKey, selected, onSelect }: {
  month: DateKey; ratios: Map<DateKey, number | null>; today: DateKey; weekStart: 0 | 1; startKey: DateKey | null; selected: DateKey | null; onSelect: (d: DateKey) => void;
}) {
  useT();
  const { y, m } = parseKey(month);
  const lead = (weekday(month) - weekStart + 7) % 7;
  const total = daysInMonth(y, m);
  return (
    <div className="cal">
      {[0, 1, 2, 3, 4, 5, 6].map(i => <div className="cal-h" key={i}>{weekdayShort((weekStart + i) % 7)}</div>)}
      {Array.from({ length: lead }, (_, i) => <div key={`o${i}`} className="cal-cell out" />)}
      {Array.from({ length: total }, (_, i) => {
        const date = addDays(month, i), r = ratios.get(date) ?? null, future = date > today, before = startKey !== null && date < startKey;
        const rest = !future && (r === null || before);
        return (
          <button key={date} disabled={future} data-l={rest ? 0 : ratioLevel(r)}
            aria-label={`${formatLong(date)}: ${rest ? tr('Rest day') : tr('{n}% done', { n: Math.round((r ?? 0) * 100) })}`}
            className={`cal-cell ${rest ? 'rest' : ''} ${future ? 'future' : ''} ${date === today ? 'today' : ''} ${date === selected ? 'sel' : ''}`}
            onClick={() => onSelect(date)}>{i + 1}</button>
        );
      })}
    </div>
  );
});

export interface BarPoint { label: string; value: number | null; text: string }
/** value === null renders a hatched "no data" bar; 0 renders a flat baseline. */
export function BarChart({ points, max }: { points: BarPoint[]; max: number }) {
  return (
    <div>
      <div className="bars" role="img" aria-label={points.map(p => `${p.label}: ${p.value === null ? tr('no data') : p.text}`).join(', ')}>
        {points.map((p, i) => (
          <div className="bar" key={i}>
            <span className="bar-lbl num">{p.value === null ? '' : p.text}</span>
            <div className={`bar-body ${p.value === null ? 'none' : p.value === 0 ? 'zero' : ''}`} style={{ height: p.value && max ? `${Math.max(3, (p.value / max) * 78)}%` : undefined }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{points.map((p, i) => <span key={i} className="bar-lbl" style={{ flex: 1, textAlign: 'center' }}>{p.label}</span>)}</div>
    </div>
  );
}

export const Empty = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="card" style={{ textAlign: 'center', padding: '34px 20px' }}>
    <p style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em' }}>{title}</p>
    {hint && <p className="muted" style={{ marginTop: 6 }}>{hint}</p>}
    {action && <div style={{ marginTop: 18 }}>{action}</div>}
  </div>
);

export const Header = ({ title, subtitle, eyebrow, right }: { title: string; subtitle?: string; eyebrow?: string; right?: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
    <div className="grow">{eyebrow && <p className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</p>}<h1 className="title">{title}</h1>{subtitle && <p className="subtitle">{subtitle}</p>}</div>
    {right}
  </div>
);

export const BackBar = ({ onBack, right }: { onBack: () => void; right?: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <button className="back" onClick={onBack}><Icon name="back" size={20} /> {tr('Back')}</button>{right}
  </div>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: 'block' }}><span className="label">{label}</span>{children}</label>
);
