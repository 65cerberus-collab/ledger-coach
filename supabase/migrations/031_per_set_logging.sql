-- ────────────────────────────────────────────────────────────────
-- 031_per_set_logging.sql
-- ────────────────────────────────────────────────────────────────
-- Phase 4: per-set logging. Replaces the single-entry-per-exercise
-- log shape (header-level actuals + per_set JSONB) with a normalized
-- parent/child model:
--
--   logs        — one row per performed prescription block
--   set_logs    — one row per concrete set (NEW, this migration)
--
-- This is a DESTRUCTIVE, single-migration cutover (no expand/contract,
-- no backfill). All existing log rows are cleared first so the new
-- NOT NULL columns can be added against an empty table. Run this ONCE
-- in the Supabase SQL Editor at cutover, ideally NOT during a live
-- training block — there is a brief window where the app expects the
-- new shape before it is deployed.
--
-- Ownership / RLS for set_logs delegates two hops:
--   set_logs.log_id -> logs.workout_id -> workouts.coach_id
-- via public.is_my_coach(), matching the delegated pattern in 018.
-- ────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════
-- PART A — restructure public.logs
-- ════════════════════════════════════════════════════════════════

-- A1. Clear all existing log rows FIRST. With an empty table the
-- NOT NULL block_id column (A3) cannot violate, and there is no row
-- to migrate (clean cutover, no backfill — locked decision).
delete from public.logs;

-- A2. Drop the stale uniqueness. The old unique index enforced one
-- log per (workout_id, exercise_id), which directly contradicts the
-- whole reason block_id exists: the same exercise can legitimately
-- appear in two different blocks of one workout, and each must be
-- loggable independently. Replaced by a per-block unique in A5.
drop index if exists public.logs_unique_per_exercise_idx;

-- A3. Tie each log to its prescription block (not just the exercise).
-- NOT NULL is safe because the table is now empty. ON DELETE CASCADE
-- mirrors the existing workout_id cascade: removing the block removes
-- the performance row recorded against it.
alter table public.logs
  add column block_id uuid not null
    references public.workout_blocks(id) on delete cascade;

-- A4. Declared coach-attention flag (Decision 2). Set true only when
-- the coach taps "Modified"; the silent fast-path leaves it false.
-- This is a DECLARED signal, not a computed deviation.
alter table public.logs
  add column modified boolean not null default false;

-- A5. New uniqueness: at most one log per block. block_id is unique
-- across the whole table because each block belongs to exactly one
-- workout, so this also implies one-log-per-(workout, block).
create unique index logs_unique_per_block_idx
  on public.logs(block_id);

-- A6. Drop the columns the per-set model replaces.
--   actual_sets / actual_reps / actual_weight_lb — superseded by the
--     concrete set_logs rows.
--   per_set (jsonb)  — superseded by the set_logs child table.
--   completed        — row-presence on block_id (performed vs not) plus
--     `modified` (as-prescribed vs with-changes) gives the same
--     3-state view the visual mark + sorting relied on.
--   mode             — text 'asPlanned'/'modified' is now fully encoded
--     by the `modified` boolean; keeping it would be a redundant,
--     NOT-NULL-with-no-default column every insert must populate.
alter table public.logs
  drop column actual_sets,
  drop column actual_reps,
  drop column actual_weight_lb,
  drop column per_set,
  drop column completed,
  drop column mode;


-- ════════════════════════════════════════════════════════════════
-- PART B — create public.set_logs
-- ════════════════════════════════════════════════════════════════
-- One row per concrete set. `side` is always concrete: an
-- 'alternating' prescription is EXPANDED into two rows (left + right)
-- at write time, so 'alternating' is never stored here. Work-type
-- coherence (reps vs duration vs weight) is enforced at the app layer
-- only — there is intentionally no work_type column and no CHECK/
-- trigger coupling the value columns.

create table public.set_logs (
  id               uuid primary key default gen_random_uuid(),
  log_id           uuid not null references public.logs(id) on delete cascade,
  set_number       smallint not null,
  side             text not null check (side in ('bilateral','left','right')),
  reps             smallint,
  weight_lb        numeric(7,2),
  duration_seconds integer,
  created_at       timestamptz not null default now(),
  unique (log_id, set_number, side)
);

-- No standalone index on log_id: the UNIQUE(log_id, set_number, side)
-- constraint's backing index already has log_id as its leading column,
-- so child-by-parent lookups are covered (no-redundant-index rule).

-- No updated_at / set_updated_at trigger: set rows are rewritten as a
-- batch on each Complete tap, never edited in place column-by-column.

comment on table public.set_logs is
  'One row per concrete performed set, child of public.logs. side is always concrete (bilateral/left/right); an alternating prescription expands into left+right rows at write time. Work-type coherence is enforced in the app, not the DB.';

comment on column public.set_logs.side is
  'Concrete side of this set: bilateral, left, or right. Never alternating — that prescription expands into two rows.';

comment on column public.set_logs.set_number is
  'Ordinal of this set within the parent log, 1-based. Unique together with (log_id, side).';


-- ════════════════════════════════════════════════════════════════
-- PART C — RLS on public.set_logs
-- ════════════════════════════════════════════════════════════════
-- Delegated own_coach, two hops: set_logs -> logs -> workouts.coach_id.
-- set_logs has no coach_id of its own; every policy joins through the
-- parent log and its workout and defers to public.is_my_coach().
-- _own_coach suffix leaves room for _own_client policies in Phase 3+.

alter table public.set_logs enable row level security;
alter table public.set_logs force row level security;

-- SELECT: visible only when the grandparent workout is the coach's.
drop policy if exists set_logs_select_own_coach on public.set_logs;
create policy set_logs_select_own_coach
on public.set_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.logs l
    join public.workouts w on w.id = l.workout_id
    where l.id = set_logs.log_id
      and public.is_my_coach(w.coach_id)
  )
);

-- INSERT: may only attach a set to a log under a workout they own.
drop policy if exists set_logs_insert_own_coach on public.set_logs;
create policy set_logs_insert_own_coach
on public.set_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.logs l
    join public.workouts w on w.id = l.workout_id
    where l.id = set_logs.log_id
      and public.is_my_coach(w.coach_id)
  )
);

-- UPDATE: USING scopes which rows are visible to update; WITH CHECK
-- prevents re-parenting a set onto a log the coach does not own.
drop policy if exists set_logs_update_own_coach on public.set_logs;
create policy set_logs_update_own_coach
on public.set_logs
for update
to authenticated
using (
  exists (
    select 1
    from public.logs l
    join public.workouts w on w.id = l.workout_id
    where l.id = set_logs.log_id
      and public.is_my_coach(w.coach_id)
  )
)
with check (
  exists (
    select 1
    from public.logs l
    join public.workouts w on w.id = l.workout_id
    where l.id = set_logs.log_id
      and public.is_my_coach(w.coach_id)
  )
);

-- DELETE: scoped to own coach via the same join.
drop policy if exists set_logs_delete_own_coach on public.set_logs;
create policy set_logs_delete_own_coach
on public.set_logs
for delete
to authenticated
using (
  exists (
    select 1
    from public.logs l
    join public.workouts w on w.id = l.workout_id
    where l.id = set_logs.log_id
      and public.is_my_coach(w.coach_id)
  )
);
