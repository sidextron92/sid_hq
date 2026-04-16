# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Build & Dev Commands

```bash
npm run dev        # Start dev server (Next.js 16 + Turbopack)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
```

## Architecture

**Control Centre** — a personal kanban board built with Next.js 16, PocketBase, and a custom liquid glass design system.

### Stack
- **Next.js 16.2.3** (App Router, React 19, TypeScript 5, Tailwind CSS 4)
- **GSAP 3.14** for all interactive animations — no CSS transitions for interactive states
- **PocketBase 0.26** (self-hosted BaaS) for auth + data
- **liquid-glass-react** for SVG displacement-based glass effects

### Key Directories
- `src/app/page.tsx` — Kanban board (main app, ~900 lines with drag-and-drop)
- `src/app/login/page.tsx` — Login/signup page
- `src/components/glass/` — Liquid glass component library (barrel export from `index.ts`)
- `src/context/AuthContext.tsx` — Auth provider (`useAuth()` hook)
- `src/lib/pocketbase.ts` — PocketBase client, data operations, status/column mapping
- `liquid_glass_claude.md` — Full design system spec (560 lines) — **read this before modifying any glass component**

### Auth Flow
- `AuthProvider` wraps the app in `layout.tsx`
- PocketBase user auth (not admin auth) — credentials never in client bundle
- Protected pages check `useAuth()` and redirect to `/login` if unauthenticated
- **Login**: email + password
- **Signup**: email + password → OTP sent to email → verify OTP to complete registration
- `useAuth()` returns `{ user, loading, login, signup, verifySignupOtp, logout }`

### PocketBase Data Model
- **Collections**: `users`, `tasks`, `tags`, `spaces`, `recurring_jobs` — all with `owner` relation field
- All queries filter by `owner` (logged-in user's ID)
- Tasks use soft delete (`is_deleted` field)
- Status values: `backlog`, `todo`, `in_progress`, `done` — mapped to column names via `statusToColumn()`/`columnToStatus()`
- Tags auto-created with deterministic colors via `findOrCreateTag(name, ownerId)`

### Recurring Tasks
- **Collection**: `recurring_jobs` — fields: `owner`, `template_task_id` (relation→tasks), `period` (daily/weekly/monthly), `days` (JSON array, nullable), `is_active`, `last_executed_at`, `is_deleted`
- Tasks have optional `recurring_job_id` (relation→recurring_jobs) linking child tasks back to their recurring job
- One record per recurring task (no duplication); `last_executed_at` prevents double-execution
- `days` field: monthly `[1,15]`, weekly `[0-6]` (Sun=0), daily `null`
- Cron script: `scripts/cron-recurring.mjs` — runs daily, creates task copies with date-prefixed titles
  - Monthly: `[Apr'26] - Task title`, Weekly/Daily: `[16-Apr-2026] - Task title`
  - Requires env: `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`
- CRUD functions in `src/lib/pocketbase.ts`: `createRecurringJob`, `updateRecurringJob`, `deleteRecurringJob`, `fetchRecurringJobForTask`, `fetchRecurringJobById`

### Environment
```
NEXT_PUBLIC_POCKETBASE_URL=<pocketbase-instance-url>
```
This is the only env var. No secrets in client bundle.

### PocketBase Server Hooks
The PocketBase VPS container has a global auth middleware hook (`pb_hooks/require_auth.pb.js`) that blocks all unauthenticated API requests except an explicit allow list. When adding new public-facing endpoints, they must be added to this hook.

**Allowed without auth:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/_/*` | Any | Admin UI |
| `/api/health` | Any | Health check |
| `*/auth-methods*` | Any | Available auth methods |
| `*/auth-with-password*` | Any | Password login |
| `*/auth-with-otp*` | Any | OTP login |
| `*/auth-refresh*` | Any | Token refresh |
| `*/request-password-reset*` | Any | Password reset request |
| `*/confirm-password-reset*` | Any | Password reset confirm |
| `*/request-verification*` | Any | Email verification request |
| `*/confirm-verification*` | Any | Email verification confirm |
| `*/request-email-change*` | Any | Email change request |
| `*/confirm-email-change*` | Any | Email change confirm |
| `/api/collections/users/records` | POST only | User registration (signup) |
| `/api/collections/users/request-otp` | POST only | OTP request for signup verification |

All other `/api/*` requests require a valid auth token (regular user or superuser). The hook is volume-mounted via `docker-compose.yml` at `./pb_hooks:/pb_hooks`.

### Drag-and-Drop (Kanban)
Custom pointer-event-based implementation (no library). Key patterns:
- Mutable refs during drag to avoid React re-renders
- Card positioned `fixed` during drag to escape `overflow:hidden` containers
- FLIP animation on drop for smooth transition back to DOM position
- Drop target calculated by pointer position against column bounds

### Glass Component System
All glass UI uses `LiquidGlassWrap` as the core primitive (7-layer SVG filter architecture). Key props: `blurAmount`, `displacementScale`, `elasticity`, `overLight`, `tint`, `cornerRadius`. Components with `elasticity > 0` need parent containers without `overflow: hidden` to avoid clipping the elastic transform.

Import from barrel: `import { GlassButton, GlassCard } from "@/components/glass"`

### GSAP Animation Conventions
- Hover: scale up (1.03–1.05) with `back.out(1.7)`
- Press: scale down (0.85–0.92) with `power2.out`
- Release: spring back with `elastic.out(1, 0.4)`
- Slides/toggles: `elastic.out(1, 0.6–0.7)`
- Menu open: `elastic.out(1, 0.6)` / close: `power2.in`
