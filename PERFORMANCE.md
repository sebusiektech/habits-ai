# Comparing navigation performance (before / after)

Use the **production build** (`npm run build` then `npm run preview`) in Chrome or Edge, extensions off (Incognito), with real data.

1. F12 → **Performance** → gear → **CPU: 4× slowdown**.
2. **Record**, switch Today → Habits → Progress → Settings about five times, **Stop**.
3. Compare dropped frames (Frames lane), **Long Tasks** (>50 ms) and the Summary totals for Recalculate Style / Layout / Paint.
4. Optional: More tools → **Rendering** → *Paint flashing* shows what repaints during a switch (only the new page should).
5. React DevTools → Profiler: completing a habit should re-render the rows and the progress card, not the whole app.

What keeps it fast: one CSS enter animation per navigation, no blur or animated shadows, memoised habit rows and charts, heatmap columns memoised.
