# Performance Audit — Control Centre

> Branch: `performance-optimization`  
> Date: 2026-05-12  
> Auditor: OpenCode Agent

---

## Executive Summary

The app is a heavy client-side SPA inside Next.js. Four critical issues cause unnecessary CPU/battery drain, layout thrashing, and bloated initial bundles. This audit covers the **critical** findings and the fixes applied on the `performance-optimization` branch.

---

## 🔴 Critical Issues (Fixed on Branch)

### 1. RainOverlay Canvas Burns CPU Even When Inactive
**File:** `src/components/RainOverlay.tsx`  
**Impact:** `requestAnimationFrame` loop never stops after mount. Every session wastes CPU even if the user never enables rain.

**Fix Applied:**
- RAF loop now **pauses completely** when `active=false` and the drop/splatter arrays are empty.
- Loop **restarts** automatically when `active` toggles back to `true`.

---

### 2. Layout Thrashing Every Animation Frame
**File:** `src/components/RainOverlay.tsx`  
**Impact:** `getBoundingClientRect()` is called on every card element **every frame** (up to 60×/sec). With 50 cards this forces synchronous layout recalculations and destroys frame budget.

**Fix Applied:**
- Card rects are now **cached** and refreshed only every 3rd frame (20 Hz) instead of every frame.
- Collision detection is **skipped entirely** when rain is inactive (drops just fall through on wind-down).

---

### 3. LiquidGlassWrap Mouse Tracking Triggers Re-renders on Every Pixel
**File:** `src/components/glass/LiquidGlassWrap.tsx`  
**Impact:** Each task card (and column header) updates React state (`mouseOffset`, `mousePos`, `elasticTransform`) on every `mousemove` event. On a busy board this floods React’s render queue.

**Fix Applied:**
- Mouse-move state updates are now **batched inside `requestAnimationFrame`**.
- A card can never schedule more than **one React update per frame**, eliminating redundant renders.
- `isHovered` remains in state (low-frequency) so enter/leave transitions still work.

> **Requirement preserved:** LiquidGlassWrap remains on **every task card**.

---

### 4. Zero Code Splitting — 2600-Line Client Bundle
**File:** `src/app/page.tsx`  
**Impact:** The entire Kanban page eagerly imports Tiptap, GSAP, all modals, and the rain engine. Users download and parse JS for features they may never open.

**Fix Applied:**
- `next/dynamic` with `ssr: false` is now used for:
  - `TiptapEditor` (only needed when task modal opens)
  - `RainOverlay` (separate chunk)
  - `ManageSpacesModal`
  - `BackgroundGalleryModal`
  - `TaskCommentsPanel`
- `TaskCardContent` is wrapped in `React.memo` so board-level state changes don’t re-render unchanged cards.

---

## 🟠 High-Priority Issues (Fixed on Branch)

| # | Issue | File | Recommendation | Status |
|---|-------|------|----------------|--------|
| 5 | Tiptap styles re-injected on every modal open | `TiptapEditor.tsx` | Move `TIPTAP_STYLES` to `globals.css` | ✅ Fixed |
| 6 | No video preload hints | `page.tsx` | Add `preload="auto"` to fallback background video | ✅ Fixed |
| 7 | Main page re-renders everything on every state change | `page.tsx` | Extract columns into memoized `KanbanBoard` sub-component | ✅ Fixed |
| 8 | `stripHtml` creates DOM nodes in the render path | `page.tsx` | Pre-compute `strippedDescription` on every Task; add `fastStripHtml()` | ✅ Fixed |

---

## 🟡 Medium-Priority Issues

| # | Issue | File | Recommendation |
|---|-------|------|----------------|
| 9 | Minimal `next.config.ts` | `next.config.ts` | Add `compress`, `experimental.optimizePackageImports` | ✅ Fixed |
| 10 | SW caches API too aggressively | `public/sw.js` | Lower `pb-api` TTL from 1 h → 5 min for fresher data | ✅ Fixed |
| 11 | GSAP in `useLayoutEffect` | `page.tsx` | Move to `useEffect` to avoid paint blocking | ✅ Fixed |
| 12 | AudioContext never suspended | `page.tsx` | Call `ctx.suspend()` after rain fade-out to remove audio indicator | ✅ Fixed |

---

## 🟢 Quick Wins Already Applied or Suggested

- `next.config.ts` now includes `optimizePackageImports` for `gsap`, `@tiptap/*`, and `liquid-glass-react`.
- `TaskCardContent` is memoized with `React.memo`.
- Rain canvas unmounts its RAF loop when idle (massive battery saving on mobile).

---

## Metrics to Validate After Merge

1. **Lighthouse Performance score** on `/` (mobile)
2. **Total Blocking Time (TBT)** — should drop after code-splitting
3. **JavaScript bundle size** — check `/.next/static/chunks` for new dynamic chunks
4. **CPU profile** while dragging a card with Rain active — layout thrashing should be gone
5. **Battery drain** with Rain disabled — should be near-zero

---

## Branch Checklist

- [x] `performance-optimization` branch created from `main`
- [x] RainOverlay RAF pause + rect caching
- [x] LiquidGlassWrap RAF-batched mouse tracking
- [x] Dynamic imports for TiptapEditor, modals, RainOverlay
- [x] `next.config.ts` optimization flags
- [x] `React.memo` on `TaskCardContent`
- [x] Move Tiptap styles to global CSS
- [x] Pre-compute stripped text for fast search
- [x] Extract `KanbanBoard` memoized sub-component
- [ ] Add `next/image` for backgrounds (medium priority)
- [ ] Reduce SW API cache TTL (medium priority)
