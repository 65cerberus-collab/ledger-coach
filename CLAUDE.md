# CLAUDE.md

Project context for future Claude Code sessions working on Ledger.

## Project overview

- Ledger is a coach-centric personal training PWA.
- Stack: React + Vite + Tailwind. Single-file `src/App.jsx` (~4,800 lines), with entity hooks in `src/hooks/` and a Supabase client in `src/supabaseClient.js`.
- Deployed on Vercel; runs as a PWA on iPad.
- Repo: https://github.com/65cerberus-collab/ledger-coach

## Persistence

- **Supabase** (cloud-backed) is the source of truth. Coaches, clients, exercises, workouts (with nested `workout_blocks`), logs, attendance, measurements, client notes, and profiles all live in Supabase tables with RLS active.
- The only `localStorage` key still in use is `coach:version` — a sentinel kept around for any future migration. All other localStorage reads/writes were removed in the Phase 3 close-out cleanup.
- Schema is managed by Supabase migrations in `supabase/migrations/` (001–025 as of writing). The localStorage `SCHEMA_VERSION` sentinel is preserved at v7 but is effectively idle.

## Auth

- Email/password via Supabase Auth.
- One Supabase user account can own multiple coach profiles (UI-capped at 5 active). The coach switcher operates over the user's own profiles; profiles are per-account, isolated from other accounts.
- `AuthGate` component handles bootstrap and session listening.

## Units

- Canonical storage: **lb** (weights), **in** (lengths). Body fat % is unitless.
- Display unit toggles (lb/kg, in/cm) live at the hook boundary — conversion happens there, not in the UI.

## Features

- Multi-profile per account, isolated per-coach client data.
- Shared exercise library (~230 exercises, seeded server-side).
- Single-entry-per-exercise logging model with a "Modified" flow for per-set detail.
- Workout builder with per-block lb/kg toggle.
- Templates, attendance tracking, archive (don't delete) for clients and coaches.
- Measurements tab with bilateral arm/thigh, body fat %, and circumferences.
- Recent exercises panel showing the last 2 coach-built sessions.
- In-app User Guide accessed via the "?" icon in `TopBar`. (Note: User Guide copy still references the old localStorage model in places; updating that copy is a future polish task.)

## Design system

- Paper-and-ink aesthetic.
- Backgrounds: `#F4EFE6`, `#EDE6D8`.
- Ink: `#16140F`.
- Accent: `#D9401C` (warm red).
- Fonts: Fraunces (display serif), Instrument Sans (UI), JetBrains Mono (numbers).
- Tabular numerals everywhere numeric comparison matters.

## Working conventions

- Working branch: **`supabase-migration`**. Production tracks this via Vercel; `main` is stale and not used.
- Prefer minimal, targeted changes over refactors unless explicitly asked.
- Preserve existing design tokens, component patterns, and naming.
- Don't break the single-entry logging model unless explicitly redesigning it.
- New schema changes go in a new numbered file under `supabase/migrations/`.
- Verify the app builds (`npm run build`) after non-trivial changes.

## Current phase

- **Phase 3 closing out.** Workouts migration complete (W-1 reads, W-2a writes, W-3 logs+attendance, W-4 completion UI). Multi-profile complete. Documentation pass is part of close-out.

## Future phases

- **Phase 4:** payment gating with Stripe (per-seat SaaS model TBD against multi-profile reality), SMTP upgrade from Supabase built-in service.
- **Polish (unscheduled):** `ClientNotesTab` UX refinement.
- **Deferred from the Phase 3 plan, not currently scheduled:** `syncService.js` with dirty queue, sync indicator, conflict resolution per `MIGRATION_PLAN.md` §7, password reset UI, magic-link auth, Phase 2.5 test harness, multi-coach-per-client (`client_collaborators` table), template marketplace.

See `MIGRATION_PLAN.md` for the original migration plan and the "Phase 3 actual outcome" appendix at the end for what shipped vs. what was deferred.
