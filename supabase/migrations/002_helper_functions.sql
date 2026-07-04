-- 002_helper_functions.sql
-- Utility trigger function used by every table that has an `updated_at` column.
-- Each table's migration attaches a BEFORE UPDATE trigger that calls this.
--
-- Defining it once here avoids repeating the same plpgsql body across every
-- table file and gives last-write-wins sync (see MIGRATION_PLAN.md §7) a
-- single, trustworthy source of truth for the timestamp.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
