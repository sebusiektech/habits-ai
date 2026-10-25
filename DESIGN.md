# habits. — design notes (black, white and gray)

A calm, tactile tracker in a strictly monochrome palette. The signature is the **dot string**: every habit due today is one dot that fills when done —
the same motif as the app icon (four dots rising from dark gray to white).

## Look
- **Palette:** true black (dark) or soft white (light), one inverted accent (white on black / black on white), and gray ramps for heatmaps, charts and surfaces. No colour anywhere.
- **Identity per habit:** its icon (24 to choose from) — colours were removed with the palette. Old stored colour values are simply ignored.
- **Type:** rounded display numerals/headlines (`ui-rounded` → SF Pro Rounded on iPhone, Segoe UI Variable on Windows), system sans for text. No web fonts: offline and private.
- **Shape:** large soft rows (24 px), inverted fill on completion, a quick ring pulse. Rest days are dashed everywhere — never shown as failures.
- **Both themes** are token-driven (`src/styles/index.css`); contrast was calculated: body text ≥ 17:1, secondary text ≥ 4.9:1.

## Screens
Today (week ribbon doubles as a day picker, dot-string progress, to-do / done) · Habits (manage, reorder, paused, archived) ·
Habit detail (streaks, 8-week bars, heatmap, edit/pause/archive/delete) · Progress (consistency, month calendar / year heatmap, weekly and monthly trends, by-habit) · Settings.

## Navigation
Desktop ≥ 1024 px: sidebar. Phones/tablets: bottom tab bar (Today, Habits, Progress, Settings) plus a floating "+" on Today and Habits. Safe areas and landscape handled.

## Motion and performance
One enter-only CSS animation (opacity + transform, ~180 ms) per navigation. Motion for React only for dialogs. No `backdrop-filter`, no animated blur/shadow/filter/size;
rows are memoised, statistics and heatmaps are memoised, `prefers-reduced-motion` disables animation.

## Data model (unchanged database)
IndexedDB stays at version 1; stores `habits`, `completions`, `meta`. New optional habit fields (`icon`, `order`, `pauses`; legacy `color` is ignored) are filled in when read, so old records open unchanged.
Pause and archive add a *pause range*; due-day logic skips those days. Completion ids are `habitId:date`, so duplicates are impossible.

## Languages (English / Polish)
Settings → Language. `tr('English text')` + `src/i18n/pl.ts`; unknown keys fall back to English. Dates, month and weekday names use `Intl`. Your own habit names are never translated.
`tests/i18n.test.ts` fails if any `tr('…')` string lacks a Polish entry.
