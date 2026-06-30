# Measurement Model

Status: signed off, pre-implementation. This document is the source of
truth for how reps / time / distance / side / load are modeled across the
app. Schema and UI work (PR-M1, PR-M2, then per-set logging PR2–PR5)
implement this; if code and this doc disagree, the doc wins until amended.

## Core idea

Every **exercise** (library default), **workout_block** (prescription),
and **set_log** (actual performed set) has exactly one measurement
**type**, plus a set of fields that apply regardless of type.

### Type (exactly one)
- `reps` — a repetition count
- `time` — a duration, stored canonically in **seconds**
- `distance` — a distance, stored canonically in **meters**

### Orthogonal to type (apply to any type)
- **side** — prescription level is `bilateral` | `unilateral` (per the 030
  collapse). A `unilateral` block expands into concrete left + right rows at
  log time; `set_logs` stores concrete `bilateral` | `left` | `right`. There
  is no separate `alternating` prescription value — unilateral covers it, and
  per-side set_logs capture the actuals.
- **load** — optional added weight, stored canonically in **pounds**
  (`weight_lb`). Applies to any type: loaded carry = distance + weight,
  weighted plank = time + weight, weighted reps = reps + weight.

## Canonical storage vs display

Trending must compare like with like, so everything is stored in one
canonical unit and only converted for display/entry:

| Quantity | Canonical store | Display / entry options        |
|----------|-----------------|--------------------------------|
| load     | pounds (lb)     | lb or kg (existing behavior)   |
| time     | seconds         | seconds (entry may group mm:ss)|
| distance | meters          | meters or yards/feet, per block|

Distance display unit is chosen **per block** (and carried as the block's
display preference), mirroring how load unit already works. The stored
value is always meters; conversion happens at the edges only.

## Per-table shape

### exercises (library defaults)
- Declares a `default_measure` (`reps` | `time` | `distance`) so every
  seeded exercise states its type up front rather than hiding it in
  free-text shorthand (e.g. `45s`, `10/leg`).
- Carries the matching default value (default reps count, default
  duration in seconds, or default distance in meters), a default side,
  and the existing default sets / rest.
- The old free-text `default_reps` is retired.

### workout_blocks (prescription)
- Type selector across `reps` | `time` | `distance` (extends the existing
  reps/time work_type).
- `reps` becomes a clean integer (no free text, no ranges — single number).
- Gains a distance value (meters, canonical) + a per-block display unit.
- `side` and optional `weight_lb` as today.
- Cleanup: the 15 known test-garbage blocks (non-numeric reps) are
  deleted; deleting a block auto-ungroups any superset partner.

### set_logs (actuals)
- One row per concrete performed set (child of `logs`, per PR1).
- Records exactly one of: reps (count) / duration_seconds / distance
  (meters), matching the block's type, plus optional `weight_lb` and a
  concrete `side`.
- Gains the distance column now (it was created in PR1 without one) so
  the logging UI is built against the finished shape.

## Reps decision (locked)

Single number only — no ranges, no free text. Rationale: the silent
"Complete" fast-path records the prescribed number directly as the actual,
giving dense trending data with zero coach effort. A range would force a
blank actual (the app can't know 8 vs 12) until the coach opens "Modified",
leaving trending gaps. Single targets never have that gap.

## Build sequence

All on the `per-set-logging` branch; all SQL runs at cutover.

1. **PR-M1** — migration: workout_blocks measurement columns + set_logs
   distance column + block reps cleanup (delete garbage, reps→smallint);
   builder type selector; planned-line displays.
2. **PR-M2** — migration: exercises measurement defaults + convert the ~85
   non-numeric seed defaults; exercise-editor UI. A handful of seeds are
   ambiguous (e.g. `20m` = meters or minutes) and need a per-value ruling
   at build time.
3. **PR2–PR5** — per-set logging data layer, two-button card, per-set
   form, history expand — built against the finished model.
4. **Trending** — per-type, meaningful comparisons.
