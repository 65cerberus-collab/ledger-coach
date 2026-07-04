import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { repsOrNull } from './useWorkouts.js';

// ── Per-set logging data layer ──────────────────────────────────
// logs is the parent (one row per performed prescription block);
// set_logs is its child (one row per concrete set). This hook owns
// both, mirroring how useWorkouts owns workout_blocks: a nested
// select hydrates the children, and saveLog rewrites them as a batch
// (delete-then-insert) on every save.
//
// Unit policy: set values are kept CANONICAL here (weightLb in lb,
// distanceM in meters, durationSeconds, reps). Display <-> canonical
// conversion is a UI concern handled where the prescribing block's
// unit/distanceUnit is in hand (PR4/PR5), so this layer never touches
// units — it only coerces reps to smallint via repsOrNull.

const LOG_SELECT = `
  id, workout_id, block_id, exercise_id, date, source, unit, modified, notes,
  set_logs (
    id, log_id, set_number, side, reps, weight_lb, duration_seconds, distance_m
  )
`;

export function setFromRow(row) {
  return {
    id: row.id,
    setNumber: row.set_number,
    side: row.side,
    reps: row.reps,
    weightLb: row.weight_lb,
    durationSeconds: row.duration_seconds,
    distanceM: row.distance_m,
  };
}

export function fromRow(row) {
  const sets = (row.set_logs ?? [])
    .slice()
    .sort((a, b) =>
      (a.set_number - b.set_number) || a.side.localeCompare(b.side)
    )
    .map(setFromRow);

  return {
    id: row.id,
    workoutId: row.workout_id,
    blockId: row.block_id,
    exId: row.exercise_id,
    date: row.date,
    source: row.source,
    unit: row.unit,
    modified: row.modified,
    notes: row.notes ?? null,
    sets,
  };
}

// Parent log row. No id is emitted: saveLog upserts on the block_id
// unique index, so on conflict the existing row keeps its own id (and
// its child set_logs FKs stay valid). exercise_id is still NOT NULL on
// logs after migration 031 — it must be supplied on every write.
export function toLogRow(log) {
  return {
    workout_id: log.workoutId,
    block_id: log.blockId,
    exercise_id: log.exId,
    date: log.date,
    source: log.source ?? 'coach',
    unit: log.unit ?? 'lb',
    modified: log.modified ?? false,
    notes: log.notes ?? null,
  };
}

// Child set row. Values arrive canonical; only reps is coerced.
export function toSetRow(set, logId) {
  return {
    log_id: logId,
    set_number: set.setNumber,
    side: set.side,
    reps: repsOrNull(set.reps),
    weight_lb: set.weightLb ?? null,
    duration_seconds: set.durationSeconds ?? null,
    distance_m: set.distanceM ?? null,
  };
}

// Expand a prescription's per-set inputs into concrete set_logs rows.
// bilateral  -> one 'bilateral' row per set.
// unilateral -> a 'left' and a 'right' row per set, each carrying its
//   own side sub-object {reps, weightLb, durationSeconds, distanceM}
//   (so L/R can differ). A missing sub-object yields an all-null side.
// 'alternating' is never produced — it collapsed to unilateral upstream.
export function buildSetRows(prescriptionSide, sets) {
  const rows = [];
  (sets ?? []).forEach((set, i) => {
    const setNumber = i + 1;
    if (prescriptionSide === 'unilateral') {
      const left = set.left ?? {};
      const right = set.right ?? {};
      rows.push({
        setNumber,
        side: 'left',
        reps: left.reps,
        weightLb: left.weightLb,
        durationSeconds: left.durationSeconds,
        distanceM: left.distanceM,
      });
      rows.push({
        setNumber,
        side: 'right',
        reps: right.reps,
        weightLb: right.weightLb,
        durationSeconds: right.durationSeconds,
        distanceM: right.distanceM,
      });
    } else {
      rows.push({
        setNumber,
        side: 'bilateral',
        reps: set.reps,
        weightLb: set.weightLb,
        durationSeconds: set.durationSeconds,
        distanceM: set.distanceM,
      });
    }
  });
  return rows;
}

export function useLogs(coachId) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coachId) {
      setLogs([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // No coach_id on logs; RLS scopes the rows to this coach via the
    // parent workout, matching the existing select.
    supabase
      .from('logs')
      .select(LOG_SELECT)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setLogs([]);
          setLoading(false);
          return;
        }
        setLogs((data ?? []).map(fromRow));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coachId]);

  // Write a performed block and its concrete sets. Upserts the parent
  // on the block_id unique index (one log per block), then replaces the
  // child set_logs as a batch, then re-reads the hydrated row so local
  // state matches the DB exactly. Expects:
  //   { workoutId, blockId, exId, date, source?, unit?, modified?,
  //     notes?, prescriptionSide, sets[] }
  const saveLog = async (payload) => {
    const parentRow = toLogRow(payload);

    const { data: savedParent, error: parentError } = await supabase
      .from('logs')
      .upsert(parentRow, { onConflict: 'block_id' })
      .select('id')
      .single();
    if (parentError) {
      console.error('saveLog parent failed', parentError);
      throw new Error(`Failed to save log: ${parentError.message}`);
    }
    const logId = savedParent.id;

    // Replace children: clear the old set rows, then insert the freshly
    // expanded concrete rows.
    const { error: clearError } = await supabase
      .from('set_logs')
      .delete()
      .eq('log_id', logId);
    if (clearError) {
      throw new Error(`Log saved but clearing old sets failed: ${clearError.message}`);
    }

    const setRows = buildSetRows(payload.prescriptionSide, payload.sets)
      .map(s => toSetRow(s, logId));
    if (setRows.length > 0) {
      const { error: setError } = await supabase
        .from('set_logs')
        .insert(setRows);
      if (setError) {
        throw new Error(`Log saved but sets failed to save: ${setError.message}`);
      }
    }

    const { data: full, error: readError } = await supabase
      .from('logs')
      .select(LOG_SELECT)
      .eq('id', logId)
      .single();
    if (readError) {
      throw new Error(`Log saved but reload failed: ${readError.message}`);
    }
    const saved = fromRow(full);

    setLogs(prev => {
      const idx = prev.findIndex(l => l.id === saved.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    return saved;
  };

  // Back-compat alias so existing App.jsx call sites keep resolving
  // until PR3/PR4 rewire them to saveLog with the new payload shape.
  const createLog = saveLog;

  const deleteLog = async (id) => {
    const { error: deleteError } = await supabase
      .from('logs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete log: ${deleteError.message}`);
    }

    // set_logs rows cascade-delete with the parent.
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  return { logs, loading, error, saveLog, createLog, deleteLog };
}
