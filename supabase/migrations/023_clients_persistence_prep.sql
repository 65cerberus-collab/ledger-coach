-- ────────────────────────────────────────────────────────────────
-- 023_clients_persistence_prep.sql
-- ────────────────────────────────────────────────────────────────
-- Phase 3 Step 5a: prepare schema for client writes.
--
-- Adds two columns to public.clients used by the coach detail view:
--   notes  — free-form coach-authored summary
--   since  — date the client started training with the coach
--
-- Creates public.client_notes for the dated client journal. Ownership
-- is delegated through the parent client's coach_id, mirroring the
-- pattern established in 020_rls_measurements.sql (EXISTS subquery on
-- public.clients filtered by public.is_my_coach(c.coach_id)).
--
-- The updated_at trigger reuses the public.set_updated_at() function
-- introduced in 002_helper_functions.sql, matching the convention used
-- by 010_measurements_table.sql.

alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists since date;

create table if not exists public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  date        date not null,
  ts          bigint not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists client_notes_client_ts_idx
  on public.client_notes(client_id, ts desc);

create trigger client_notes_set_updated_at
  before update on public.client_notes
  for each row execute function public.set_updated_at();

-- Enable RLS. `force` ensures the table owner is also subject to RLS,
-- preventing accidental data leaks via owner-role bypass.
alter table public.client_notes enable row level security;
alter table public.client_notes force row level security;

-- SELECT: a coach can read notes only when the parent client is theirs.
create policy client_notes_select_own_coach
on public.client_notes
for select
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_notes.client_id
      and public.is_my_coach(c.coach_id)
  )
);

-- INSERT: a coach can record a note only for a client they own.
create policy client_notes_insert_own_coach
on public.client_notes
for insert
to authenticated
with check (
  exists (
    select 1 from public.clients c
    where c.id = client_notes.client_id
      and public.is_my_coach(c.coach_id)
  )
);

-- UPDATE: a coach can update only notes under their own clients, and
-- cannot move a note to a client they do not own (enforced by WITH
-- CHECK on the post-update client_id).
create policy client_notes_update_own_coach
on public.client_notes
for update
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_notes.client_id
      and public.is_my_coach(c.coach_id)
  )
)
with check (
  exists (
    select 1 from public.clients c
    where c.id = client_notes.client_id
      and public.is_my_coach(c.coach_id)
  )
);

-- DELETE: a coach can delete only notes under their own clients.
create policy client_notes_delete_own_coach
on public.client_notes
for delete
to authenticated
using (
  exists (
    select 1 from public.clients c
    where c.id = client_notes.client_id
      and public.is_my_coach(c.coach_id)
  )
);
