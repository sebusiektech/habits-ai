import type { DateKey } from './types';
import { addDays, diffDays, startOfWeek } from './dates';

export interface HeatCell {
  date: DateKey;
  /** completed ÷ due for the day; null when nothing was due (a rest day). */
  ratio: number | null;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
  /** before the first recorded data */
  noData: boolean;
  /** inside the data range but nothing due (rest or paused day) */
  rest: boolean;
}

export function ratioLevel(r: number | null | undefined): 0 | 1 | 2 | 3 | 4 {
  if (r === null || r === undefined || r <= 0) return 0;
  return r >= 1 ? 4 : r > 0.67 ? 3 : r > 0.34 ? 2 : 1;
}

/** Whole weeks (columns of seven cells) ending with the week that contains `today`. */
export function buildHeatmap(ratios: Map<DateKey, number | null>, today: DateKey, weeks: number, weekStart: 0 | 1, startKey: DateKey | null): HeatCell[][] {
  const first = addDays(startOfWeek(today, weekStart), -7 * (weeks - 1));
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(first, w * 7 + d);
      const ratio = ratios.get(date) ?? null;
      const future = diffDays(date, today) > 0;
      const noData = startKey !== null && date < startKey;
      col.push({ date, ratio, level: ratioLevel(ratio), future, noData, rest: !future && !noData && ratio === null });
    }
    cols.push(col);
  }
  return cols;
}
