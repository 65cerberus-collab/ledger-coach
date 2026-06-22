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
- Schema is managed by Supabase migrations in `supabase/migrations/` (001–029 as of writing; 027 skipped). The localStorage `SCHEMA_VERSION` sentinel is preserved at v7 but is effectively idle.

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
- In-app User Guide accessed via the "?" icon in `TopBar`.

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

- **Phase 4: Commercial Hardening & UX Refinement.** Targeting production-readiness for real beta users before payment infrastructure (Phase 5). Shipped: three workout primitives (supersets mig 026, unilateral mig 028, isometric mig 029), delete-workout UI (PR #53), navigation persistence (PR #54), builder draft autosave (PR #55), User Guide accuracy + discoverability refresh (PRs #56, #57), side enum collapse to bilateral/unilateral + workout/block notes columns (mig 030, PR #59). Shipped also: HistoryTab coach-personal expand parity (commit 045499c). Open: ProgressTab metrics rework, ClientNotesTab UX refinement, onboarding flow, per-set logging UI (foundational primitive — next major work). Decision (2026-06-21): unassigned workout shelf DROPPED — permanent two-category model, every non-template workout must have a client; client-less keepers become templates. Hard save-block (client-or-template) is the intended permanent rule. Old unassigned workouts purged from the DB.

## Future phases

- **Phase 5:** payment gating with Stripe (per-seat SaaS model TBD against multi-profile reality), SMTP upgrade from Supabase built-in service as a prerequisite.
- **Deferred from the Phase 3 plan, not currently scheduled:** `syncService.js` with dirty queue, sync indicator, conflict resolution per `MIGRATION_PLAN.md` §7, password reset UI, magic-link auth, Phase 2.5 test harness, multi-coach-per-client (`client_collaborators` table), template marketplace.

See `MIGRATION_PLAN.md` for the original migration plan and the "Phase 3 actual outcome" appendix at the end for what shipped vs. what was deferred.
