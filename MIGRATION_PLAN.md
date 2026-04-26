# Ledger — Supabase Migration Plan

This document defines the architecture for migrating Ledger from per-device localStorage to a Supabase backend. It is the planning artifact for Phase 1; implementation lives in subsequent phases.

It assumes [`MIGRATION_AUDIT.md`](./MIGRATION_AUDIT.md) and [`CLAUDE.md`](./CLAUDE.md) as prerequisites. Read those first.

---

## 1. Goals and non-goals

### Goals

- Cloud-backed persistence so a coach's data survives device loss, browser data clearing, and PWA reinstalls.
- Multi-device support — same coach can use Ledger on iPad and laptop without manual JSON shuffling.
- Foundation for future client-facing features (clients logging into their own view) and future collaboration features (shared clients, template marketplace).
- Preserve the offline-capable PWA experience for mid-session use without internet.
- Preserve the canonical-units storage model.
- Preserve the single-entry-per-exercise logging model.

### Non-goals (for this migration)

- Re-architecting the front end. App.jsx stays a single file; storage gets abstracted, not rewritten.
- Importing existing localStorage data into Supabase. The app has been in test mode; users start fresh on first sign-up. (See §8.)
- Multi-coach-per-account UX. One auth account = one coach record. (See §3.)
- Multi-coach access to the same client (deferred to a later phase via a `client_collaborators` table; see §3.6).
- Coach-to-coach template sharing (deferred to a later phase via a template `visibility` column; see §3.6).
- Real-time live updates between devices (Phase 4 candidate).
- A native app. PWA continues.

---

## 2. Pre-migration: flip canonical units to lb/in

The current app stores weights in kg and lengths in cm canonically, with display unit toggles converting on read/write. The user works in pounds and inches 95% of the time, with the kg/cm toggle reserved for kettlebells (kg) and clients who track their own bodyweight or body comp metric.

**Decision:** flip the canonical storage to **lb (weights) and in (lengths)** to match the dominant use case.

This is a pre-Phase-1 change to App.jsx. Doing it now means the localStorage data shape and the Supabase schema agree. Otherwise we'd be designing two different canonical systems and converting between them at the sync boundary — a known source of bugs.

### 2.1 Scope of the unit flip

- All weight columns and fields become `lb`-canonical: `weight_lb`, `actual_weight_lb`, `value_lb`, `per_set[].weight_lb`.
- All length columns and fields become `in`-canonical: `value_in` for circumferences.
- Body fat % stays unitless.
- Display toggles still work the same way: a per-block `unit: "lb" | "kg"` field, a per-measurement `unit: "lb" | "kg" | "in" | "cm"` field. Toggling lb ↔ kg or in ↔ cm only changes display, not storage.
- Conversion helpers (`toDisplay`, `fromDisplay`, `toDisplayLen`, `fromDisplayLen`) flip direction.
- Schema bump: `SCHEMA_VERSION` 6 → 7 with a one-shot conversion migration on load that multiplies every existing kg → lb (×2.20462) and every cm → in (÷2.54).

### 2.2 Why bother, given the migration

We considered: "if we're not importing localStorage data, why convert it at all?" Two reasons:

1. The current author/tester (you) has been using the app in test mode with real data. That data shouldn't get nuked just because the canonical units flip.
2. The pre-Phase-1 unit flip is a self-contained change that's easy to test in isolation. Bundling it with Supabase work would muddy the diff.

The conversion migration runs once when the existing app version is updated, then never again.

### 2.3 Phase ordering (revised)

- **Phase 0:** Flip canonical to lb/in. Self-contained App.jsx change. Schema 6 → 7.
- **Phase 1:** Storage abstraction (extract `storageService.js`). Behavior-preserving.
- **Phase 2+:** Supabase work, designed in lb/in to match.

---

## 3. Auth strategy

### 3.1 Decision: Option A — single coach per account

One Supabase auth user owns exactly one `coaches` row. There is no in-app coach switcher. To use a different coach, sign out and sign in as that coach.

### 3.2 Why Option A

- **Maps cleanly to per-seat SaaS pricing.** Each account is one billable identity.
- **Onboarding via signup link works.** Standard pattern: send a coach a signup URL, they create their account, they have their own data.
- **Auth-based identity = billable identity.** Stripe and other billing tools bind to auth users.
- **No data migration concerns.** Without localStorage import in scope, there's no awkward "which coach is you" decision at sign-up.
- **Foundation for everything later.** Per-coach analytics, audit trails, support, account deletion — all easier when account = coach.

### 3.3 Auth method

**Email/password as primary, with magic-link as a secondary option** for password reset and quick re-login. No social OAuth in Phase 2 — keep the auth surface small.

### 3.4 The current multi-coach UX

The existing app's coach switcher in the TopBar disappears under Option A. The current "switch coaches without logging out" workflow becomes "sign out, sign in as the other account." For the 95%-solo use case this is fine. The UX is replaced, not preserved.

### 3.5 What this trades away

- "Two coaches share an iPad and switch between their own data without logging out" becomes a sign-out / sign-in flow. Modest friction; standard SaaS UX.
- Cross-coach client transfer (the existing app's "archive coach with active clients, transfer them to another coach" flow) goes away. Replacement: when archiving, the user can either archive the clients along with the coach or export them as a JSON file to be imported into a different account.

### 3.6 Future features built on top of Option A

These are **deferred to a later phase** and are first-class product features, not auth-model decisions:

- **Multi-coach access to the same client.** Pattern: a `client_collaborators` join table mapping `(client_id, coach_id, role)` where role is `owner` or `collaborator`. RLS extends to "I can see this client if I'm the owner OR a collaborator." Invitation system: Coach A invites Coach B by email; B accepts; the row is created. This makes the rare "group approach" use case possible without compromising the single-coach-per-account auth model.
- **Coach-to-coach template sharing.** Pattern: add a `visibility` column to `workouts` where `is_template = true`. Values: `private` (default), `unlisted` (sharable by link), `public` (browsable by all coaches). Coach B can clone a public template into their own account. This makes a future "template marketplace" possible — useful for new trainers learning from experienced ones, and a possible monetization vector (paid premium templates).

Both features are **out of scope for Phases 1–4**, called out here so the schema can accommodate them later without a redesign.

---

## 4. Database schema

Canonical units: lb (weights), in (lengths). Body fat unitless.

Weight columns are `numeric(7,2)` — pounds, two decimal places. Length columns are `numeric(6,2)` — inches, two decimal places. More precision than humans need but spares us rounding bugs at conversion boundaries.

### 4.1 Tables

```sql
-- ────────────────────────────────────────────────────────────────
-- COACHES
-- ────────────────────────────────────────────────────────────────
-- One row per coach. Tied 1:1 to a Supabase auth user (Option A).
create table coaches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade unique,
  name          text not null,
  archived      boolean not null default false,
  archived_at   date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index coaches_user_id_idx on coaches(user_id);

-- ────────────────────────────────────────────────────────────────
-- CLIENTS
-- ────────────────────────────────────────────────────────────────
create table clients (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references coaches(id) on delete cascade,
  name          text not null,
  age           int,
  level         text check (level in ('beginner','intermediate','advanced')),
  goals         text,
  injuries      text[] not null default '{}',
  equipment     text[] not null default '{}',
  archived      boolean not null default false,
  archived_at   date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index clients_coach_id_idx on clients(coach_id);

-- ────────────────────────────────────────────────────────────────
-- EXERCISES (shared library + custom additions)
-- ────────────────────────────────────────────────────────────────
-- coach_id NULL = seeded/shared library entry, readable by all coaches.
-- coach_id NOT NULL = custom exercise owned by that coach.
create table exercises (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid references coaches(id) on delete cascade,  -- nullable
  name              text not null,
  movement          text not null check (movement in ('push','pull','squat','hinge','core','cardio','mobility','stretch')),
  muscles           text[] not null default '{}',
  equipment         text[] not null default '{}',
  difficulty        text check (difficulty in ('beginner','intermediate','advanced')),
  tags              text[] not null default '{}',
  contraindications text[] not null default '{}',
  default_sets      int,
  default_reps      text,
  default_rest      int,
  notes             text,
  is_seed           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index exercises_coach_id_idx on exercises(coach_id);
create unique index exercises_global_name_idx on exercises(lower(name)) where coach_id is null;
create unique index exercises_per_coach_name_idx on exercises(coach_id, lower(name)) where coach_id is not null;

-- ────────────────────────────────────────────────────────────────
-- WORKOUTS
-- ────────────────────────────────────────────────────────────────
-- Templates have client_id NULL and is_template = true.
-- Self-directed sessions have is_self_directed = true.
-- visibility column reserved for future template marketplace (§3.6).
create table workouts (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid not null references coaches(id) on delete cascade,
  client_id         uuid references clients(id) on delete cascade,
  name              text,
  date              date,
  is_template       boolean not null default false,
  is_self_directed  boolean not null default false,
  visibility        text not null default 'private' check (visibility in ('private','unlisted','public')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index workouts_coach_id_idx on workouts(coach_id);
create index workouts_client_id_date_idx on workouts(client_id, date desc) where client_id is not null;
create index workouts_template_idx on workouts(coach_id) where is_template = true;

-- ────────────────────────────────────────────────────────────────
-- WORKOUT BLOCKS (exercises within a workout, ordered)
-- ────────────────────────────────────────────────────────────────
create table workout_blocks (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references workouts(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete restrict,
  position     int not null,
  sets         int,
  reps         text,
  weight_lb    numeric(7,2),
  rest_seconds int,
  unit         text not null default 'lb' check (unit in ('lb','kg')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index workout_blocks_workout_id_position_idx on workout_blocks(workout_id, position);

-- ────────────────────────────────────────────────────────────────
-- LOGS (one per exercise per workout — single-entry model)
-- ────────────────────────────────────────────────────────────────
create table logs (
  id                 uuid primary key default gen_random_uuid(),
  workout_id         uuid not null references workouts(id) on delete cascade,
  exercise_id        uuid not null references exercises(id) on delete restrict,
  date               date not null,
  source             text not null default 'coach' check (source in ('coach','client')),
  mode               text not null check (mode in ('asPlanned','modified')),
  actual_sets        int,
  actual_reps        text,
  actual_weight_lb   numeric(7,2),
  per_set            jsonb,
  unit               text not null default 'lb' check (unit in ('lb','kg')),
  completed          boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index logs_workout_exercise_idx on logs(workout_id, exercise_id);
create index logs_exercise_date_idx on logs(exercise_id, date desc);
create unique index logs_unique_per_exercise_idx on logs(workout_id, exercise_id);

-- ────────────────────────────────────────────────────────────────
-- ATTENDANCE
-- ────────────────────────────────────────────────────────────────
create table attendance (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references workouts(id) on delete cascade unique,
  status      text not null check (status in ('present','missed','cancelled')),
  date        date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────
-- MEASUREMENTS (bodyweight, body fat, circumferences)
-- ────────────────────────────────────────────────────────────────
create table measurements (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  date        date not null,
  type        text not null check (type in ('weight','bodyFat','waist','hips','chest','armL','armR','thighL','thighR')),
  value_lb    numeric(7,2),
  value_in    numeric(6,2),
  value_pct   numeric(5,2),
  unit        text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index measurements_client_type_date_idx on measurements(client_id, type, date desc);

-- ────────────────────────────────────────────────────────────────
-- PROFILES (user-level metadata, separate from coaches)
-- ────────────────────────────────────────────────────────────────
create table profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  schema_version int not null default 7,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

### 4.2 Decisions worth noting

**Workout blocks as a separate table, not JSONB on workouts.** The current localStorage model nests blocks inside the workout JSON. Two reasons to split them out:

1. We frequently query "did this client do this exercise recently" — that's `workout_blocks join workouts` with a where clause on `client_id`, much faster against a relational table than against JSONB extraction.
2. Per-block `unit`, `notes`, and `weight_lb` are first-class fields with constraints, not arbitrary JSON.

The cost is one extra table and one extra round-trip on workout save. Acceptable.

**Logs keep `per_set` as JSONB.** Per-set data is a list of `{reps, weight_lb}` pairs whose only consumer is the same log row. There's no query that filters or joins on per-set values. JSONB is the right shape.

**`exercises.coach_id` is nullable.** Seeded/shared exercises have `coach_id IS NULL` and `is_seed = true`. Custom exercises have `coach_id` set to the owner. RLS allows everyone to read shared exercises and only the owner to read/write custom ones.

**Soft-delete via `archived`, never hard-delete.** Already the app's pattern; the schema preserves it. Hard delete only on `auth.users` cascading deletion (account closure).

**`updated_at` is a column with a trigger.** Auto-updated on row UPDATE via Postgres trigger. Becomes the basis for last-write-wins conflict resolution (see §7).

**`workouts.visibility` column is included now even though template sharing is deferred.** It defaults to `private` so existing single-coach behavior is preserved. Adding it now means we don't need a schema migration when the template-sharing feature ships.

---

## 5. Row-level security

Every table has RLS enabled with explicit policies. Default-deny.

### 5.1 Helper function

```sql
create or replace function is_my_coach(coach uuid) returns boolean
language sql security definer set search_path = public
as $$
  select exists (select 1 from coaches where id = coach and user_id = auth.uid());
$$;
```

### 5.2 Policy summary by table

| Table          | SELECT                                              | INSERT                  | UPDATE                  | DELETE                  |
| -------------- | --------------------------------------------------- | ----------------------- | ----------------------- | ----------------------- |
| coaches        | `user_id = auth.uid()`                              | `user_id = auth.uid()`  | `user_id = auth.uid()`  | `user_id = auth.uid()`  |
| clients        | `is_my_coach(coach_id)`                             | `is_my_coach(coach_id)` | `is_my_coach(coach_id)` | `is_my_coach(coach_id)` |
| exercises      | `coach_id is null OR is_my_coach(coach_id)`         | `is_my_coach(coach_id)` | `is_my_coach(coach_id)` | `is_my_coach(coach_id)` |
| workouts       | `is_my_coach(coach_id)`                             | `is_my_coach(coach_id)` | `is_my_coach(coach_id)` | `is_my_coach(coach_id)` |
| workout_blocks | via workouts                                        | via workouts            | via workouts            | via workouts            |
| logs           | via workouts                                        | via workouts            | via workouts            | via workouts            |
| attendance     | via workouts                                        | via workouts            | via workouts            | via workouts            |
| measurements   | via clients                                         | via clients             | via clients             | via clients             |
| profiles       | `user_id = auth.uid()`                              | `user_id = auth.uid()`  | `user_id = auth.uid()`  | `user_id = auth.uid()`  |

"via workouts" / "via clients" means the policy joins through that parent table's ownership rule. Concrete SQL will be in the Phase 2 migration files.

### 5.3 Seed exercises

The ~230 shipped exercises are inserted with `coach_id = null` and `is_seed = true`, readable by all authenticated users. They are inserted by a server-side migration script that bypasses RLS so no individual user "owns" them. New seed exercises in future app versions are added the same way.

---

## 6. Sync model

The app is a PWA used on iPad, often during a session in a gym basement with patchy WiFi. Offline behavior is not optional.

### 6.1 The choice: offline-first with optimistic local writes

**All reads and writes go to localStorage first. A background sync layer pushes changes to Supabase when online and pulls server changes back.**

This means:
- The user never waits for the network to log a set.
- Network interruptions are invisible to the UX.
- localStorage stays as the live data store; Supabase is the durable replica + multi-device fan-out.

### 6.2 What this is *not*

- **Not** a remote-first model where every read is an HTTP call. Latency would tank the UX, and offline would break entirely.
- **Not** a CRDT system. CRDTs are powerful but expensive to implement; for this app's data shape, simpler approaches suffice (see §7).
- **Not** a real-time multi-device live update model in Phase 1–3. That's a Phase 4 candidate using Supabase Realtime.

### 6.3 Architecture

The `storageService.js` layer (Phase 1 deliverable) becomes the abstraction point:

```
                     ┌─────────────────────┐
                     │      App.jsx        │
                     │  (UI + state)       │
                     └──────────┬──────────┘
                                │ async calls
                     ┌──────────▼──────────┐
                     │  storageService.js  │
                     │  - get/set/delete   │
                     │  - schema version   │
                     │  - migrations       │
                     └──────────┬──────────┘
                                │
                ┌───────────────┼───────────────┐
                │                               │
       ┌────────▼────────┐         ┌────────────▼─────────┐
       │   localStorage  │  ───→   │  syncService.js      │
       │   (live data)   │         │  - dirty-record      │
       │                 │         │    queue             │
       └─────────────────┘         │  - background push   │
                                    │  - background pull   │
                                    │  - conflict resolve  │
                                    └────────────┬─────────┘
                                                 │ network
                                       ┌─────────▼──────────┐
                                       │     Supabase       │
                                       │   (durable store)  │
                                       └────────────────────┘
```

**Reads** always come from localStorage. The UI never blocks on the network.

**Writes** go to localStorage immediately and are added to a **dirty queue** persisted in localStorage. The sync service drains the queue when online, pushing changes via Supabase's REST API.

**Pull** happens periodically (every N minutes when foreground), on app launch, and on resume from background. The sync service queries `updated_at > last_pulled_at` for each table the user has access to and merges results into localStorage, then triggers a UI re-render via the existing state mechanism.

### 6.4 The dirty queue

A simple structure stored in localStorage under `coach:syncQueue`:

```js
{
  pendingWrites: [
    { id: uuid, table: 'logs', op: 'upsert', payload: {...}, queuedAt: timestamp, attempts: 0 },
    { id: uuid, table: 'workouts', op: 'delete', payload: {id}, queuedAt: timestamp, attempts: 0 },
    // ...
  ],
  lastPulledAt: { workouts: timestamp, logs: timestamp, ... }
}
```

Each pending write is keyed by a client-generated UUID, so retries are idempotent. The sync service processes the queue serially, one write per HTTP call (with possible batching as an optimization later).

### 6.5 Failure modes and fallbacks

- **Network down:** writes accumulate in queue, app continues normally. Visual indicator in TopBar (small dot) shows pending writes. No user action required.
- **Conflict on push (record changed on server since last pull):** see §7.
- **Auth expired:** sync service pauses, app prompts re-login on next foreground. Local data remains intact; queue is preserved across login.
- **Schema mismatch (server is newer than client):** sync service blocks writes, app prompts user to update. Avoid silent data corruption.
- **Long offline period:** queue grows. No hard cap initially; if it becomes a problem in practice we add one and surface a warning.

---

## 7. Conflict resolution

Conflicts happen when the same record is modified on two devices while one is offline.

### 7.1 Granularity: record-level last-write-wins, with structured exceptions

For most tables, **last-write-wins at the record level** based on `updated_at`. The newer write replaces the older. This is the simplest model and acceptable for most data because:

- Most edits are point-in-time corrections (fixing a typo, changing a planned weight).
- The data isn't financially sensitive — a lost edit is annoying, not catastrophic.
- The app is single-coach in practice for most users; conflicts are rare.

### 7.2 Exceptions

**Logs are append-only.** A logged exercise should never get overwritten by a stale "this exercise wasn't logged yet" state from another device. The sync service treats `logs` rows as additive: never delete a log just because the other device doesn't have it yet. If two devices log the same `(workout_id, exercise_id)` pair independently — vanishingly rare in practice — we keep the most recent and surface a notification.

**Measurements are append-only.** Same logic. Two devices entering measurements for the same date and metric is unusual; if it happens, keep both (different `id`, same `date`+`type`).

**Workouts are last-write-wins, but with caution.** If a coach edits a workout's blocks on two devices, the newer wins. This loses data in pathological cases. We accept it for now and revisit if real users hit it.

**Archived flags are sticky.** If either side has `archived = true`, the merged result is archived. Avoids "I archived a client on my iPad and the laptop un-archived them on next sync" weirdness.

### 7.3 What the user sees

Conflicts should be invisible most of the time. When the sync service detects a real conflict (server-side `updated_at` newer than the record's `updated_at` at the time of the local edit), it:

1. Applies the resolution rule for that table.
2. If data was lost (overwritten by a newer server version), shows a small toast: "Your changes to [Maya's workout] were superseded by a newer edit from another device."
3. Logs the conflict with both versions to a local audit log for debugging.

No conflict modals, no manual merge UX. The audit log is enough to diagnose if a user reports something weird.

---

## 8. First-sign-in flow

Because we're not importing localStorage data, the first-sign-in flow is simple.

1. User signs up.
2. App creates the `auth.users` row, then the `coaches` row tied to it.
3. Seed exercises are already in the DB and readable to all authenticated users — nothing to insert per-account.
4. The user lands on an empty dashboard. Add a client to begin.

There is no "import existing data" prompt, no "which coach is you" question, no JSON upload step.

If a user already has localStorage data on the device they're signing up on, that data continues to live in localStorage but is not synced to Supabase. The app will eventually want to clear it (a "start fresh" prompt on first successful sign-in) so the localStorage cache reflects the empty cloud state, not stale data from the test era.

---

## 9. Phased rollout

### Phase 0 — Canonical units flip to lb/in

**Goal:** Pre-Phase-1 change so localStorage canonical matches Supabase canonical.

**Deliverables:**
- Conversion helpers flip direction (kg → lb canonical, cm → in canonical)
- Schema bump 6 → 7 with one-shot migration on load
- All weight/length-handling code reviewed for canonical assumptions

**Risks:** Easy to miss a site that still expects kg-canonical. Manual testing on full user data required.

**Rollback:** Revert the PR. Schema migration is one-way; rollback means restoring from a JSON backup taken before the change.

### Phase 1 — Storage abstraction (in progress)

**Goal:** Refactor storage access into `src/storageService.js` without changing app behavior. Pure structural change.

**Deliverables:**
- `MIGRATION_AUDIT.md` ✓ (merged)
- `MIGRATION_PLAN.md` ← this file
- `src/storageService.js` — async key-value interface that internally uses localStorage
- App.jsx refactored to use `storageService` instead of direct `STORAGE` calls
- Build passes, app behaves identically

**Risks:** App.jsx is 4,800 lines with many storage touchpoints. A careless refactor could break the load-time migration logic.

**Rollback:** Revert the PR. The audit and plan documents stay.

### Phase 2 — Supabase setup

**Goal:** Create the Supabase project, schema, RLS policies, and seed data. No app changes yet.

**Deliverables:**
- Supabase project provisioned
- All `CREATE TABLE`, `CREATE INDEX`, RLS policies, helper functions deployed
- Seed exercises inserted via server-side script
- Auth configured (email/password + magic link)
- pgTAP test suite covering every RLS policy
- Local development setup documented

**Risks:** RLS is easy to get wrong. The pgTAP tests are non-negotiable before considering Phase 2 complete.

**Rollback:** Drop the project. No client-side changes to revert.

### Phase 2.5 — Test harness

**Goal:** Build the testing foundation needed for Phase 3.

**Deliverables:**
- Test runner setup (Vitest recommended; integrates well with Vite)
- Tests for `storageService.js` covering all key/value operations
- Tests for the conversion helpers (lb↔kg, in↔cm)
- Tests for the load-time migration logic
- Mock Supabase client for offline test scenarios
- CI integration so tests run on every PR

**Risks:** App.jsx has zero tests today. There's a temptation to write tests for everything, but Phase 2.5 should focus only on the surfaces Phase 3 will touch — storage, sync, auth. UI testing can come later.

**Rollback:** N/A. Tests don't ship to production.

### Phase 3 — Auth + initial sync

**Goal:** Wire the app to Supabase. localStorage remains the live store; Supabase becomes the durable replica.

**Deliverables:**
- Auth UI (sign-up, sign-in, password reset, magic link)
- First-sign-in flow (per §8)
- `src/syncService.js` with dirty queue, push, pull
- Visual sync indicator in TopBar
- Conflict resolution per §7
- Tests for sync logic, queue management, conflict scenarios

**Risks:** This is the heaviest phase. Edge cases everywhere — partial uploads, auth expiration mid-sync, schema mismatches. Heavy testing required, ideally with a beta cohort of 1–2 real users.

**Rollback:** Feature-flag the entire Supabase path. If broken, flip the flag back to localStorage-only.

### Phase 4 — Multi-device polish

**Goal:** Real-time updates when both devices are online. Optional.

**Deliverables:**
- Supabase Realtime subscriptions for the user's data
- UI behavior when remote changes arrive while editing
- Multi-tab handling

**Risks:** Realtime adds complexity for moderate UX gain. Worth doing only if real users have multi-device pain.

**Rollback:** Turn off subscriptions. App continues with periodic pull.

### Phase 5 — Decommission localStorage path

**Goal:** Once stable, remove the localStorage-only fallback paths.

**Deliverables:**
- localStorage becomes pure cache, never the authority
- Removal of "you're offline indefinitely" code paths
- Possible: simplification of `storageService.js` now that two backends aren't needed

**Risks:** None significant if Phase 3 has been stable for months.

**Rollback:** N/A — this is cleanup.

### Future phases (deferred, not scheduled)

- **Multi-coach access to same client.** `client_collaborators` join table, invitation flow, RLS extensions. (§3.6)
- **Template marketplace.** Use the `workouts.visibility` column already in the schema; add template browse/clone UI. (§3.6)
- **Account deletion / GDPR data export.** "Download all my data" and "Delete my account" buttons.

---

## 10. Open questions

These need answers before the relevant phase starts.

1. **Email provider.** Supabase ships with default email sending capped to ~3 emails/hour for development. For production, swap to Resend (~$0–20/month, simplest setup) or Postmark (best deliverability) so emails come from your domain with proper SPF/DKIM/DMARC. **Decision: start with Supabase default for Phase 2 development; swap to Resend before the first real (non-test) user.**
2. **Supabase pricing tier.** Free tier is fine for development. Pro tier ($25/month) becomes necessary at production launch for daily backups, no project pause after inactivity, and connection pooling. **Decision: open to Pro when flagged necessary, likely at the Phase 3 → public launch transition.**
3. **Test strategy.** **Decision: Phase 2.5 builds a test harness focused on storage, sync, conversion helpers, and migration logic. UI testing deferred.**
4. **Seed exercise updates.** When new seed exercises are added in a future app version, server-side migration scripts insert the new shared rows. **Confirmed.**
5. **GDPR / account deletion.** "Download all my data" and "delete my account" buttons. **Out of scope for migration; tracked as a future-phase requirement.**

---

*End of MIGRATION_PLAN.md*
