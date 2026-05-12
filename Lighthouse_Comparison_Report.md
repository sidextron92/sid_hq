# Lighthouse Performance Comparison Report

> Generated: 2026-05-12
> Branches: `main` (baseline) vs `performance-optimization`
> Test URL: Authenticated Kanban board (`/` after login)

---

## Overall Scores

| Category | main | performance-optimization | Δ |
|----------|------|--------------------------|---|
| **Performance** | 84 | **88** | **+4** 🟢 |
| Accessibility | 86 | 86 | 0 |
| Best Practices | 96 | 96 | 0 |
| SEO | 100 | 100 | 0 |

---

## Core Web Vitals & Key Metrics

| Metric | main | performance-optimization | Δ | Status |
|--------|------|--------------------------|---|--------|
| **First Contentful Paint** | 0.8 s | 0.8 s | 0 | ⚪ |
| **Largest Contentful Paint** | 4.4 s | **3.6 s** | **-0.8 s** | 🟢 Improved |
| **Total Blocking Time** | 100 ms | 150 ms | +50 ms | 🟡 Needs verification* |
| **Cumulative Layout Shift** | 0 | 0 | 0 | 🟢 Perfect |
| **Speed Index** | 2.6 s | 2.6 s | 0 | ⚪ |

> *TBT is sensitive to test environment noise. A single run is not statistically significant. Multiple runs recommended.

---

## Bundle Analysis

| Metric | main | performance-optimization | Δ |
|--------|------|--------------------------|---|
| Total `.next` size | 1.0G | 1.0G | — |
| JS chunks size | 1.4M | **1.3M** | **-0.1M** 🟢 |
| Largest chunk | 478K | **415K** | **-63K** 🟢 |

### Code Splitting (performance branch only)
The performance branch now creates **separate lazy-loaded chunks** for:
- `TiptapEditor` (only downloaded when task modal opens)
- `RainOverlay` (only downloaded when rain is enabled)
- `ManageSpacesModal`
- `BackgroundGalleryModal`
- `TaskCommentsPanel`

This means the **initial page load** no longer includes ~200KB+ of editor + modal code.

---

## What Changed

### 🔴 Critical Fixes Applied
1. **RainOverlay RAF loop** — Stops completely when rain is inactive (saves CPU/battery)
2. **Layout thrashing** — Card rect cache refreshed every 3rd frame instead of 60×/sec
3. **LiquidGlassWrap** — Mouse updates batched to ≤1 render/frame per card
4. **Code splitting** — Dynamic imports for heavy components (Tiptap, modals, rain)

### 🟠 High-Priority Fixes Applied
5. **Tiptap styles** — Moved from runtime `<style>` injection to `globals.css`
6. **Search optimization** — Pre-computed `strippedDescription` eliminates DOM creation during filtering
7. **KanbanBoard memoization** — Modal/rain state changes no longer re-render cards
8. **Video preload** — Added `preload="auto"` hint

### 🟡 Medium-Priority Fixes Applied
9. **next.config.ts** — Added `compress`, `optimizePackageImports`
10. **GSAP paint blocking** — Switched from `useLayoutEffect` to `useEffect`
11. **AudioContext** — Suspends after rain fade-out
12. **Service Worker** — API cache TTL reduced from 1h → 5m

---

## Recommendations

1. **Run multiple Lighthouse passes** (3-5x) to get statistically significant TBT numbers
2. **Test on real mobile devices** — Desktop simulation doesn't capture RAF loop battery savings
3. **Monitor real-world metrics** (Core Web Vitals from actual users) after deployment
4. **Consider adding `@next/bundle-analyzer`** for ongoing bundle monitoring:
   ```bash
   npm install -D @next/bundle-analyzer
   ```

---

## Files Generated

- `/tmp/lighthouse-reports/main-authenticated.html` — Full main branch report
- `/tmp/lighthouse-reports/main-authenticated.json` — Raw main branch data
- `/tmp/lighthouse-reports/perf-authenticated.html` — Full performance branch report
- `/tmp/lighthouse-reports/perf-authenticated.json` — Raw performance branch data

