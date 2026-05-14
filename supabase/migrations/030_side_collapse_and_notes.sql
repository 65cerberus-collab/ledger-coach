-- ────────────────────────────────────────────────────────────────
-- 030_side_collapse_and_notes.sql
-- ────────────────────────────────────────────────────────────────
-- Phase 4: collapse the workout_blocks.side enum-like column from
-- four values (bilateral/left/right/alternating) down to two
-- (bilateral/unilateral), and add free-text `notes` columns to
-- both workouts and workout_blocks.
--
-- The original CHECK on workout_blocks.side was declared inline in
-- migration 028 with no explicit constraint name, so PostgreSQL
-- auto-generated the canonical `workout_blocks_side_check` name.
-- We drop that constraint and recreate it with the collapsed value
-- set under the same name.
--
-- Legacy rows with side in (left/right/alternating) are converted
-- to 'unilateral' in-place, with a descriptive note appended to
-- workout_blocks.notes preserving the original intent. This happens
-- in the window between the old constraint being dropped and the
-- new one being added.

alter table public.workouts
  add column if not exists notes text;

alter table public.workout_blocks
  add column if not exists notes text;

alter table public.workout_blocks
  drop constraint workout_blocks_side_check;

update public.workout_blocks
set
  notes = case
    when notes is null or notes = '' then
      case side
        when 'left' then 'Left side only'
        when 'right' then 'Right side only'
        when 'alternating' then 'Alternating L/R'
      end
    else notes || E'\n' || case side
      when 'left' then 'Left side only'
      when 'right' then 'Right side only'
      when 'alternating' then 'Alternating L/R'
    end
  end,
  side = 'unilateral'
where side in ('left', 'right', 'alternating');

alter table public.workout_blocks
  add constraint workout_blocks_side_check
  check (side in ('bilateral','unilateral'));

-- Belt-and-braces: the CHECK above would already reject any
-- non-conforming row, but this assertion makes the failure mode
-- explicit if somehow constraint enforcement was bypassed.
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
    from public.workout_blocks
    where side not in ('bilateral','unilateral');
  if bad_count > 0 then
    raise exception
      'workout_blocks.side collapse aborted: % row(s) still hold legacy values (left/right/alternating)',
      bad_count;
  end if;
end$$;
