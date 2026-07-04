# Infrastructure & Operations Notes

Operational context for Ledger — hosting, capacity, and deploy/auth configuration.
Distinct from `CLAUDE.md` (code context) and `MIGRATION_PLAN.md` (historical migration plan).

## Capacity & scaling — how many simultaneous users can the system support?

Open question to size **before real client logins arrive (Phase 5).** Today there is
effectively one user (the coach); client-facing auth turns that into many concurrent
users hitting Supabase directly.

**Supabase is the real ceiling.** The client PWA talks to Supabase directly, so the
database is where concurrency pressure lands. Dimensions to size against tier limits:
- Concurrent Postgres connections (connection pooling / PgBouncer settings).
- Monthly active users (MAU) for auth.
- Database size and bandwidth/egress.
- Free tier pauses the project after inactivity — unacceptable once clients depend on it.

**Vercel is mostly about serving the static app, not concurrency.** The app is a static
PWA; Vercel's relevant limits are bandwidth and build minutes, which scale gently. Unlikely
to be the bottleneck, but worth confirming.

**Output wanted:** a rough "N simultaneous clients before we must upgrade tiers" figure,
and which limit hits first — so tier upgrades become a planned cost line (Phase 5/6), not a
surprise outage when onboarding the Nth client.

### [TO RESEARCH — fill against current pricing pages; limits change over time]
- Supabase Free vs Pro: concurrent connection limits, MAU cap, DB size, egress, pause policy.
- Vercel Hobby vs Pro: bandwidth, build minutes, any serverless/function limits in use.
- Recommended tier for the initial personal-use + small beta soak, and the trigger to upgrade.

## Deploy & auth configuration (must-not-break)

- Vercel Production Branch: `supabase-migration` (production deploys from here).
- Supabase **Site URL** and **redirect allowlist** must match the deployed domain — auth
  (sign-in, magic links) breaks if they drift. Any domain or rebrand change requires
  updating these in the Supabase dashboard.
- Free tier has **no backups / PITR** — any destructive SQL needs a manual CSV export and a
  non-destructive preview `SELECT` first.

## Rebrand touch-points (see CLAUDE.md, Phase 5)

- User-visible brand strings live in `index.html`, `vite.config.js` (PWA manifest name /
  short_name), `src/App.jsx` (wordmark + User Guide copy), and the auth screens.
- Internal identifiers stay stable through a rebrand: the package name `ledger-coach`, and
  the localStorage prefixes `ledger:` / `ledger:nav:` (renaming them orphans saved nav state
  and builder drafts for no benefit).
