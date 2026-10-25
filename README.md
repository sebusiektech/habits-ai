# habits.

A focused, private, offline habit tracker (PWA). React + TypeScript + Vite + Tailwind + Motion, data in IndexedDB on your device.
No account, no backend, no tracking. Developed on Windows, used on iPhone. English and Polish.

**What it does:** daily dashboard · habits with icon and weekday schedule · complete/undo (today or any past day) ·
pause, archive, reorder · streaks, completion rate, weekly and monthly progress · month calendar and year heatmap ·
light/dark themes · JSON backup and restore.

## 1. Set up on Windows (10 or 11)

1. Install **Node.js LTS** from https://nodejs.org (defaults), then reopen your terminal.
2. Extract the ZIP, e.g. to `C:\Projects\habits`, and open that folder in **Windows Terminal**.
3. Run:

```powershell
node -v          # v20 or newer
npm install      # needed once after updating: icons come from lucide-react
npm run dev
```

Open the printed `http://localhost:5173/habits/` address. Other commands: `npm run build` (type-check + production build),
`npm run preview` (serve the build — the service worker only runs here, not in `dev`), `npm test`.

## 2. Publish for free on GitHub Pages

1. Create a free GitHub account and a **public repository** named `habits` (or change `base` in `vite.config.ts` to `/<your-repo>/`).
2. Install Git for Windows, then in the project folder:

```powershell
git init
git add .
git commit -m "habits."
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

3. GitHub → **Settings → Pages → Source: GitHub Actions**. The workflow in `.github/workflows/deploy.yml` builds and deploys on every push.
4. Your app appears at `https://<your-username>.github.io/<your-repo>/`.

## 3. Install on your iPhone

Open the URL in **Safari** → Share → **Add to Home Screen**. Launch from the icon (that is what hides Safari's bars).
Open it once online so it can cache, then it works offline.

## 4. Updating from the earlier "productivity" version

Your **habits, completion history and settings are kept** — the database is not reset or migrated. Habits get a default icon you can change.
Tasks, journal, focus sessions, routines and goals were removed from the app. Their old records are **left untouched** on the device;
Settings → *Old data* appears if any exist and lets you delete them when you are ready (they are not included in new backups).
Old backup files still import (the removed-feature parts are ignored). Pausing/archiving never counts the skipped days as misses.

## 5. Backups

Settings → **Export backup (JSON)** → *Save to Files*. Import offers **Merge** (keeps what you have) or **Replace**; files are validated first and never uploaded.
Data lives in the browser: clearing Safari website data, deleting the app or iOS storage eviction can erase it — export regularly.
Safari and the Home Screen app have **separate** storage on iOS.

## Notes

- Updates: the installed app shows "A new version is ready" with **Reload** / **Later**; it never reloads by itself.
- Statistics count only the days a habit is *due*. Rest days and paused days are skipped, never misses; a pending today is not a miss.
- See `DESIGN.md` (design system, languages) and `PERFORMANCE.md` (how to compare navigation smoothness).

## Layout

```
src/lib        dates, habit logic (streaks/pauses), statistics, heatmap, models   (pure, tested)
src/db         IndexedDB layer, repository, backup validation/import
src/screens    Today, Habits (+detail), Progress, Settings
src/components shared UI, habit form
src/i18n       English/Polish
tests          logic, i18n, IndexedDB
```
