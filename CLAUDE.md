# CLAUDE.md

Project context for future Claude Code sessions working on Ledger.

## Project overview

- Ledger is a coach-centric personal training PWA.
- Stack: React + Vite + Tailwind. Single-file `src/App.jsx` (~4,800 lines).
- Deployed on Vercel; runs as a PWA on iPad.
- Repo: https://github.com/65cerberus-collab/ledger-coach

## Storage & data

- Per-device `localStorage` with JSON backup/restore.
- Canonical units: **kg** (weight) and **cm** (length). Display defaults are **lb** and **in**.
- Schema is versioned. Current version: **v6**.
- Always bump `SCHEMA_VERSION` and document migrations when changing data shape.

## Features

- Multi-coach system with isolated per-coach client data.
- Shared exercise library (~230 exercises).
- Single-entry-per-exercise logging model with a "Modified" flow for per-set detail.
- Workout builder with per-block lb/kg toggle.
- Templates, attendance tracking, and archive (don't delete) for clients and coaches.
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

- Prefer minimal, targeted changes over refactors unless explicitly asked.
- Preserve existing design tokens, component patterns, and naming.
- Canonical kg/cm storage must be preserved in any data model change.
- Don't break the single-entry logging model unless explicitly redesigning it.
- Verify the app builds (`npm run build`) after non-trivial changes.

## Current task

- Phase 1 of the Supabase migration:
  - Audit `localStorage` usage.
  - Write a migration plan.
  - Refactor storage access into a centralized `storageService.js`.
- Work only on the `supabase-migration` branch.
- Commit changes only to that branch.
