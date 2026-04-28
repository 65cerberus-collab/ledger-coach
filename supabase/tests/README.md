# supabase/tests

pgTAP test suite for Ledger's Supabase Postgres backend. Each per-table
file asserts that the Row-Level Security policies defined in migrations
`013_rls_*.sql` … `021_rls_*.sql` admit the right rows for the right
roles and reject everything else. See `MIGRATION_PLAN.md` §5 and §9.

## One-time setup

Apply `00_helpers.sql` to the live database **once**, like a migration:

1. Open the Supabase SQL Editor for the project.
2. Paste the entire contents of `00_helpers.sql`.
3. Run it.

This installs the `tests` schema with auth-simulation helpers
(`tests.authenticate_as`, …) and fixture creators (`tests.create_coach`,
…). The script is idempotent — re-running it is a no-op.

Verify the install:

```sql
SELECT proname
FROM pg_proc
WHERE pronamespace = 'tests'::regnamespace
ORDER BY proname;
```

You should see eight rows (`authenticate_as`, `authenticate_as_anon`,
`clear_authentication`, `create_client`, `create_coach`,
`create_exercise`, `create_user`, `create_workout`).

## Running a test file

1. Open the test file (e.g. `01_rls_coaches.sql`) in this repo.
2. Copy the entire file contents.
3. Paste into the Supabase SQL Editor.
4. Run.
5. Read the TAP output in the result panel.

Every test file (everything except `00_helpers.sql`) wraps itself in a
`BEGIN; … ROLLBACK;` block, so running it leaves no trace in the
database — fixtures created by `tests.create_coach`, `tests.create_user`,
etc. are rolled back along with the test transaction. You can run any
test file repeatedly without cleanup.

## Suite run order

Run the foundation once, then each per-table file in numeric order:

- `00_helpers.sql` — one-time install (not a test file).
- `01_rls_coaches.sql`
- `02_rls_clients.sql`
- `03_rls_exercises.sql`
- `04_rls_workouts.sql`
- `05_rls_workout_blocks.sql`
- `06_rls_logs.sql`
- `07_rls_attendance.sql`
- `08_rls_measurements.sql`
- `09_rls_profiles.sql`

Files `01_*` through `09_*` will be added in subsequent PRs; only
`00_helpers.sql` and this README ship in the foundation PR.

## Reading TAP output

pgTAP emits Test Anything Protocol lines:

- `ok 1 - description` — assertion passed.
- `not ok 2 - description` — assertion failed; the `# Failed test …`
  diagnostic that follows shows the expected vs. actual values.
- `1..N` at the top is the planned test count.
- `# Failed N tests of M` (or its absence) is the bottom-line summary.
  A clean run ends with no `# Failed` line and no `not ok` lines.

If a single assertion fails, treat the whole file as failing — RLS
correctness is binary.

## CI

Manual for now. Continuous-integration execution (e.g. running pgTAP
against an ephemeral Supabase branch on every PR) is deferred to
Phase 3+ of the migration. Until then, run the suite by hand in the
SQL Editor before merging any change to migrations under
`supabase/migrations/0[12][0-9]_rls_*.sql` or to RLS helper functions.
