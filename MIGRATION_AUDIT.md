# MIGRATION_AUDIT.md

Phase 1 / Task 1 of the Supabase migration: a read-only audit of how Ledger
currently persists data on-device. Source: `src/App.jsx` (4,880 lines) and
`src/storage-shim.js`. No application code was modified to produce this
document.

All line numbers refer to `src/App.jsx` unless noted.

---

## 1. Inventory of `localStorage` keys

The app talks to a `STORAGE` helper that delegates to `window.storage`. On the
web/PWA target, `window.storage` is provided by `src/storage-shim.js`, which
prefixes every key with `ledger:` and stores values under the browser's
`localStorage`. The application code itself only ever uses these eight keys,
all in the `coach:` namespace. On disk in the browser they appear as
`ledger:coach:<name>`.

| App-level key            | On-disk key (browser)            | Purpose                                                                 |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------- |
| `coach:version`          | `ledger:coach:version`           | Stored schema version number, used to gate migrations.                  |
| `coach:coaches`          | `ledger:coach:coaches`           | Full list of coach profiles (active + archived).                        |
| `coach:currentCoachId`   | `ledger:coach:currentCoachId`    | Which coach the device is currently signed into.                        |
| `coach:clients`          | `ledger:coach:clients`           | All client profiles across all coaches (filtered to current coach in UI). |
| `coach:exercises`        | `ledger:coach:exercises`         | Shared exercise library (~230 seed entries plus user-added).            |
| `coach:workouts`         | `ledger:coach:workouts`          | All sessions and templates across all coaches.                          |
| `coach:logs`             | `ledger:coach:logs`              | All exercise logs (single-entry-per-exercise, post v6).                 |
| `coach:attendance`       | `ledger:coach:attendance`        | Attendance records per workout.                                         |
| `coach:unitPref` *(legacy)* | `ledger:coach:unitPref`       | v4-and-earlier global lb/kg pref. Read once on load for migration; cleared to `null` on first post-v5 load. Never written by current code outside that clearing step. |

There are **no other keys** read or written by the app.

---

## 2. Per-key shape, read sites, and write sites

All values are stored as JSON strings (the `STORAGE` helper handles the
serialization round-trip). Field names below come directly from the code
comments and from the constructors in `seedDemoWorkouts` and the `SEED_*`
arrays.

### `coach:version`
- **Shape:** `number` (current value: `6`).
- **Read:** line 539.
- **Write:** line 651 (only when `version < SCHEMA_VERSION` after a successful load).

### `coach:coaches`
- **Shape:** `Array<{ id: string, name: string, archived?: boolean, archivedAt?: string }>`
  - Seed defaults at lines 494–497 (`SEED_COACHES`).
  - `archived` / `archivedAt` are added by `archiveCoach` (line 746) and
    cleared by `restoreCoach` (line 754).
- **Read:** line 543.
- **Write (persistence effect):** line 659.

### `coach:currentCoachId`
- **Shape:** `string` (a coach `id`, e.g. `coach_alex`).
- **Read:** line 544.
- **Write (persistence effect):** line 660. Effect is gated so it only saves
  when `currentCoachId` is truthy.

### `coach:clients`
- **Shape:** `Array<Client>` where `Client` is, per `SEED_CLIENTS` (lines
  499–505) and patches scattered through the app:
  ```ts
  {
    id: string,                  // uid("c")
    coachId: string,             // owning coach (added at load time if missing)
    name: string,
    age: number,
    goals: string,
    injuries: string[],
    equipment: string[],
    level: "beginner" | "intermediate" | "advanced",
    notes: string,
    since: string,               // ISO date YYYY-MM-DD
    bodyweight: { date: string, kg: number }[],   // canonical kg
    archived?: boolean,
    archivedAt?: string,
    // measurements (Measurements tab) — optional, added on first edit:
    measurements?: { date: string, fields: Record<string, number> }[]
  }
  ```
  Length and circumference measurements are stored in canonical **cm**;
  bodyweight in canonical **kg** (per CLAUDE.md and the `toDisplay*` /
  `fromDisplay*` helpers at lines 150–179).
- **Read:** line 545.
- **Write (persistence effect):** line 661.

### `coach:exercises`
- **Shape:** `Array<Exercise>` per the `E(...)` factory at line 184:
  ```ts
  {
    id: string,                  // uid("ex")
    name: string,
    movement: "squat"|"hinge"|"push"|"pull"|"core"|"cardio"|"mobility"|"stretch",
    muscles: string[],
    equipment: string[],
    difficulty: "beginner"|"intermediate"|"advanced",
    tags: string[],
    contraindications: string[],
    defSets: number,
    defReps: string,             // e.g. "5", "10/leg", "45s"
    defRest: number,             // seconds
    notes: string
  }
  ```
- **Read:** line 546.
- **Write (persistence effect):** line 662.
- **Merge behavior on load (lines 568–575):** if a stored library exists, any
  entries from `SEED_EXERCISES` whose `name` (case-insensitive) is missing
  are appended. A fresh install gets the full seed.

### `coach:workouts`
- **Shape:** `Array<Workout>` per `seedDemoWorkouts` (lines 4796–4880) and
  builder code:
  ```ts
  {
    id: string,                  // uid("w")
    coachId: string,
    clientId: string | null,     // null for templates
    name: string,
    date: string | null,         // ISO date; null for templates
    isTemplate: boolean,
    blocks: Array<{
      exId: string,
      sets: number,
      reps: string,              // e.g. "5", "8/leg"
      rest: number,              // seconds
      notes: string,
      weight: number | null,     // canonical kg, planned load
      unit: "lb" | "kg"          // per-block display unit (added in v5)
    }>
  }
  ```
- **Read:** line 547.
- **Write (persistence effect):** line 663.

### `coach:logs`
- **Shape (post-v6, single-entry-per-exercise):** `Array<Log>`:
  ```ts
  {
    id: string,                  // uid("log")
    workoutId: string,
    exId: string,
    date: string,                // ISO YYYY-MM-DD
    source: "coach" | "client",
    notes: string,
    completed: boolean,
    mode: "asPlanned" | "modified",
    actualSets: number,
    actualReps: string,          // either a single rep value or comma-joined per-set reps
    actualWeight: number | null, // canonical kg when consistent across sets
    perSet: Array<{ reps: string|number, weight: number|null }> | null,
    unit: "lb" | "kg"            // per-log display unit (added in v5)
  }
  ```
  The pre-v6 shape was many rows per `(workoutId, exId)` (one per set); the
  loader collapses those into the new shape. See migration (lines 593–632).
- **Read:** line 548.
- **Write (persistence effect):** line 664.

### `coach:attendance`
- **Shape:** `Array<{ id: string, workoutId: string, status: string, date: string }>`
  where `status` is the attendance label (e.g. `"completed"`, `"missed"`,
  `"rescheduled"`) chosen in the UI. New rows are written via
  `onAttendance` at line 880 and replace any prior row for the same
  `workoutId`.
- **Read:** line 549.
- **Write (persistence effect):** line 665.

### `coach:unitPref` *(legacy, read-only path except for one cleanup write)*
- **Shape:** `"lb" | "kg" | null`.
- **Read:** line 550.
- **Write:** line 653 — explicitly set to `null` on first load after migration
  to v5+ so the legacy key is cleared. Never written elsewhere by the
  current code.

---

## 3. The `STORAGE` helper

Defined at lines 131–141:

```js
const STORAGE = {
  async load(key, fallback) {
    try {
      const res = await window.storage.get(key);
      return res && res.value ? JSON.parse(res.value) : fallback;
    } catch { return fallback; }
  },
  async save(key, value) {
    try { await window.storage.set(key, JSON.stringify(value)); } catch {}
  }
};
```

### Public surface

| Method            | Args                  | Returns                 | Behavior                                                                                  |
| ----------------- | --------------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `STORAGE.load`    | `(key, fallback)`     | `Promise<any>`          | Awaits `window.storage.get(key)`. Parses `res.value` as JSON. On any error or missing record, returns `fallback`. |
| `STORAGE.save`    | `(key, value)`        | `Promise<void>`         | JSON-stringifies `value` and awaits `window.storage.set(key, json)`. Errors are swallowed. |

### Notes on the abstraction

- The helper assumes values are JSON-encodable. Every caller in the app
  passes either `null`, a number, a string, or a plain array of objects.
- Errors are intentionally silent — `load` falls back to its caller-supplied
  default and `save` is fire-and-forget. This means a quota overflow, a
  parse failure, or a missing `window.storage` would all degrade silently.
- The helper has no `delete` method even though the underlying
  `window.storage` shim provides one. The legacy `coach:unitPref` is
  "deleted" by writing `null` (line 653); the value is then read back as the
  fallback on next load.
- There is no batching, no debouncing, and no key whitelisting; the React
  effects at lines 659–665 fire `STORAGE.save` whenever the corresponding
  state slice changes, after the initial load gate.

### Underlying `window.storage` (shim at `src/storage-shim.js`)

The shim implements `get`/`set`/`delete`/`list` against `localStorage`
with the prefix `ledger:`. Only `get` and `set` are used by the application.
The shim is installed at module load by `src/main.jsx` (`import './storage-shim.js'`).

---

## 4. Schema versioning and the load-time migration

`SCHEMA_VERSION` is declared at line 143 and is currently `6`.

The single load effect (lines 537–656) is the only place migrations run. It
runs once on mount (empty dep array) and gates the rest of the app behind
`loaded` (line 654).

### Step-by-step

1. **Read stored version** (line 539): `version = STORAGE.load("coach:version", 0)`. A fresh install reads `0`.
2. **Compute `stale`** (line 540): `stale = version < SCHEMA_VERSION`.
3. **Read all eight slices in parallel** via `Promise.all` (lines 542–551), including the legacy `coach:unitPref` "for migration only".
4. **Derive the migration unit seed** (line 555): `migrationUnit = legacyUnitPref === "kg" ? "kg" : "lb"`. This becomes the default per-block / per-log unit for any record predating v5.
5. **Coaches** (lines 557–563): use stored coaches if present, otherwise `SEED_COACHES`. If the persisted `currentCoachId` points at an archived coach (or doesn't exist), fall back to the first non-archived coach, then the first coach, then the hard-coded `"coach_alex"`.
6. **Clients** (line 565): seed from `SEED_CLIENTS` on a fresh install. Otherwise, ensure every client has a `coachId` (defaulting to `currentInit`).
7. **Exercises** (lines 568–575): on fresh or empty, use `SEED_EXERCISES`. Otherwise merge in any seed entries whose `name` (case-insensitive) is not already present. This is how the seed library is incrementally grown across releases.
8. **Workouts** (lines 577–589):
   - On fresh, call `seedDemoWorkouts(...)`.
   - Otherwise, ensure each workout has a `coachId` (derived from its client, or `currentInit`).
   - Ensure every block has `weight` (default `null`) and `unit` (default `migrationUnit`). The second `map` at line 587 also defaults any block missing a unit to `"lb"` — this catches seed demo blocks specifically, which don't ship with a unit.
9. **Logs** (lines 592–641): two paths.
   - **Stale + old shape** (`stale && first log lacks "mode"`, line 593): the per-set rows are grouped by `workoutId|exId`. Each group becomes a single-entry log with `mode` derived from whether weights and reps were consistent across sets and matched the planned weight, plus `actualSets`, `actualReps`, `actualWeight`, `perSet`, and a `unit` taken from the matching block (or `migrationUnit`). Lines 596–631.
   - **Otherwise** (lines 634–640): leave the data alone but stamp a `unit` field on any log that's missing one, taken from the matching block or `migrationUnit`.
10. **Hydrate React state** (lines 643–649) with the migrated arrays.
11. **Persist version bump** (line 651): `STORAGE.save("coach:version", SCHEMA_VERSION)` only if `stale`.
12. **Clear legacy key** (line 653): `if (legacyUnitPref !== null) STORAGE.save("coach:unitPref", null)`.
13. **Mark loaded** (line 654): `setLoaded(true)`. Until this fires, the persistence effects (659–665) are no-ops, so no data is ever overwritten before migration completes.

### Observable migrations encoded in this loader

- **v4 → v5:** adopt per-block / per-log `unit` field; legacy global
  `coach:unitPref` is read once and cleared.
- **v5 → v6:** collapse per-set logs into single-entry-per-exercise logs
  with `mode`, `actualSets`, `actualReps`, `actualWeight`, `perSet`. Block
  `weight` field defaulted to `null`.
- **All migrations:** ensure every workout has a `coachId`, every client
  has a `coachId`, the exercise library is union-merged with the latest
  seed by name, and the chosen current coach is non-archived.

There is **no migration for going backwards** — if a future `SCHEMA_VERSION`
loads older data, only the same forward steps run. Likewise, the loader
performs no quarantine of unknown keys.

---

## 5. Export / import (JSON backup) flow

User-triggered backup is the only cross-device data path the app supports.

### `exportData` (lines 759–784)

Builds a snapshot in memory and downloads it as `ledger-backup-<YYYY-MM-DD>.json`.

```js
const snapshot = {
  appName: "Ledger",
  schemaVersion: SCHEMA_VERSION,    // 6
  exportedAt: new Date().toISOString(),
  coaches,
  currentCoachId,
  clients: allClients,
  exercises,
  workouts: allWorkouts,
  logs: allLogs,
  attendance: allAttendance,
};
```

- Serialized via `JSON.stringify(snapshot, null, 2)` (pretty-printed).
- Wrapped in a `Blob({ type: "application/json" })`, served via
  `URL.createObjectURL` → anchor click → `URL.revokeObjectURL`.
- Note the snapshot uses **app-state** field names (`clients`, `workouts`,
  `logs`, `attendance`), not the storage keys (`coach:clients`, etc.).
- Note: the legacy `coach:unitPref` is **not** included in the snapshot
  (current code doesn't track it as state). It is, however, read on import
  for backward compatibility (see below).

### `importData` (lines 786–821)

1. Read the file via `FileReader.readAsText` and `JSON.parse`.
2. Validate `data.appName === "Ledger"`. If not, toast "Not a valid Ledger backup file" and bail.
3. Compute a fallback unit for legacy backups (`schemaVersion < 5` could lack per-block / per-log units): `backupUnit = data.unitPref === "kg" ? "kg" : "lb"`.
4. Re-hydrate state by calling each setter directly:
   - `setCoaches(data.coaches)`
   - `setCurrentCoachId(data.currentCoachId)`
   - `setAllClients(data.clients)`
   - `setExercises(data.exercises)`
   - `setAllWorkouts(...)` — each block defaulted to `{ unit: backupUnit, ...b }` so existing units win.
   - `setAllLogs(...)` — each log defaulted to `{ unit: backupUnit, ...lg }`.
   - `setAllAttendance(data.attendance)`
5. Reset navigation: `setSelectedClientId(null)`, `setBuilderCtx(null)`, `setView("dashboard")`.
6. Toast "Restored from <date>" using `data.exportedAt`.

### How restore reaches storage

`importData` does **not** call `STORAGE.save` directly. Each setter triggers
the corresponding `useEffect` at lines 659–665, which writes the new value
to the appropriate storage key. Because `loaded` is already `true` by the
time the user can trigger import, every slice is written. The schema
version key (`coach:version`) is **not** touched by import — the version
already on disk from the loader's earlier write stays put. There is no
upgrade pass on imported data beyond the unit defaulting, so a backup
authored under an older `schemaVersion` is treated as if it were the
current shape on the importing device.

### Surfaces that trigger backup/restore

`exportData` and `importData` are passed into `<TopBar />` at line 834
(`onExport`, `onImport`). The User Guide describes the file format and
behavior to end users at lines 1574, 1632, and 1649.

---

## 6. Other data persistence mechanisms

A repo-wide search (`grep -rn "localStorage\|sessionStorage\|indexedDB\|window\.storage\|document\.cookie"`)
was run across `src/`, `index.html`, `public/`, `vite.config.js`, and
`main.jsx`. Findings:

- **`localStorage`** — used only via the `storage-shim.js` shim (lines
  10, 19, 27, 36, 37). The shim is the only direct caller. App code goes
  through `STORAGE` → `window.storage`.
- **`sessionStorage`** — not used.
- **`IndexedDB` / `idb`** — not used.
- **Cookies** (`document.cookie`) — not used. There is no auth and no
  server.
- **In-memory only** — UI state (`view`, `selectedClientId`, `builderCtx`,
  `toast`) and the `loaded` gate. These are not persisted.
- **Service worker / PWA cache** — `vite-plugin-pwa` (configured in
  `vite.config.js`) registers a Workbox service worker that precaches
  static assets matching `**/*.{js,css,html,svg,png,ico,woff2}`. This is
  application-shell caching only; it does **not** store user data and is
  not part of the data layer to be migrated. Worth being aware of for
  Supabase rollouts because stale shells could keep an old client around
  after a schema bump.
- **The User Guide text at lines 1574, 1632, 1649** mentions
  `localStorage` only descriptively (in user-facing copy explaining where
  data lives). No additional storage calls are made there.

So `localStorage` (via the shim) is the **only** persistence mechanism for
user data, and the eight `coach:*` keys above are its complete surface.

---

## Quick reference: every read/write in one table

| Key                       | Read line | Write line(s)                          |
| ------------------------- | --------: | -------------------------------------- |
| `coach:version`           | 539       | 651                                    |
| `coach:coaches`           | 543       | 659                                    |
| `coach:currentCoachId`    | 544       | 660                                    |
| `coach:clients`           | 545       | 661                                    |
| `coach:exercises`         | 546       | 662                                    |
| `coach:workouts`          | 547       | 663                                    |
| `coach:logs`              | 548       | 664                                    |
| `coach:attendance`        | 549       | 665                                    |
| `coach:unitPref` (legacy) | 550       | 653 (cleared to `null` on first post-v5 load) |
