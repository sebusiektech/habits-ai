export const ICON_KEYS = [
  'sparkles', 'droplets', 'book', 'dumbbell', 'footprints', 'brain', 'apple', 'salad', 'coffee', 'pill', 'heart', 'moon',
  'bed', 'sun', 'pen', 'music', 'languages', 'bike', 'leaf', 'smile', 'code', 'wallet', 'phoneoff', 'flame'
] as const;
export type IconKey = (typeof ICON_KEYS)[number];
export const isIcon = (v: unknown): v is IconKey => typeof v === 'string' && (ICON_KEYS as readonly string[]).includes(v);
