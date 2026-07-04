-- Migration 022: drop single-column UNIQUE on coaches.user_id; add composite UNIQUE on (user_id, name).
--
-- Rationale: Phase 3 design supports one auth user having multiple coach profiles
-- (one human, multiple gym/business contexts). The original single-column UNIQUE
-- prevented this. The composite UNIQUE preserves duplicate-prevention within a
-- single user's profiles while permitting multi-profile ownership.
--
-- Existing data note: as of 2026-05-04, one coaches row exists (Test Coach for
-- 65cerberus@gmail.com). The composite UNIQUE accepts this row without conflict.
--
-- Future work: a row-count CHECK constraint or BEFORE INSERT trigger will cap
-- profiles per user at 5 when the in-app create-profile feature ships.

begin;

-- 1. Drop the legacy single-column UNIQUE constraint.
alter table public.coaches
  drop constraint if exists coaches_user_id_key;

-- 2. Add composite UNIQUE so a user cannot create two profiles with identical names.
alter table public.coaches
  add constraint coaches_user_id_name_key unique (user_id, name);

commit;
