-- Migration 024: add coaches.last_used_at and a 30-char CHECK on coaches.name.
--
-- Rationale: Phase 3 PR-A adds a Sign-up flow and last-used profile tracking.
--   * last_used_at lets useCoaches order profiles by recency, so a returning
--     user's most-recently-used profile is the default selection.
--   * The CHECK enforces the same 30-char cap that the Sign-up form enforces
--     client-side (input maxLength + form validation), so the DB is the source
--     of truth even if a client bypasses the UI.
--
-- Idempotency: ADD COLUMN uses IF NOT EXISTS. The CHECK is added inside a
-- DO-block that drops the constraint first if present, then adds it — this
-- avoids relying on `ADD CONSTRAINT IF NOT EXISTS`, which is not available on
-- all Postgres versions.
--
-- No backfill: existing rows leave last_used_at NULL; useCoaches uses
-- `NULLS LAST` so legacy rows still sort sanely (after any rows with a value).

begin;

alter table public.coaches
  add column if not exists last_used_at timestamptz;

do $$
begin
  if exists (
    select 1
      from pg_constraint
     where conname = 'coaches_name_length'
       and conrelid = 'public.coaches'::regclass
  ) then
    alter table public.coaches drop constraint coaches_name_length;
  end if;

  alter table public.coaches
    add constraint coaches_name_length check (length(name) <= 30);
end$$;

commit;
