import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const LOG_SELECT = '*';

export function fromRow(row) {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exId: row.exercise_id,
    date: row.date,
    source: row.source,
    mode: row.mode,
    completed: row.completed,
    actualSets: row.actual_sets,
    actualReps: row.actual_reps,
    actualWeight: row.actual_weight_lb,
    perSet: row.per_set,
    unit: row.unit,
    notes: row.notes,
  };
}

export function toRow(camelLog) {
  const out = {};
  if ('id' in camelLog) out.id = camelLog.id;
  if ('workoutId' in camelLog) out.workout_id = camelLog.workoutId;
  if ('exId' in camelLog) out.exercise_id = camelLog.exId;
  if ('date' in camelLog) out.date = camelLog.date;
  if ('source' in camelLog) out.source = camelLog.source;
  if ('mode' in camelLog) out.mode = camelLog.mode;
  if ('actualSets' in camelLog) out.actual_sets = camelLog.actualSets;
  if ('actualReps' in camelLog) out.actual_reps = camelLog.actualReps;
  if ('actualWeight' in camelLog) out.actual_weight_lb = camelLog.actualWeight;
  if ('perSet' in camelLog) out.per_set = camelLog.perSet;
  if ('unit' in camelLog) out.unit = camelLog.unit;
  if ('completed' in camelLog) out.completed = camelLog.completed;
  if ('notes' in camelLog) out.notes = camelLog.notes;
  return out;
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

  const createLog = async (camelLog) => {
    const row = toRow({ ...camelLog, id: crypto.randomUUID() });

    const { data, error: upsertError } = await supabase
      .from('logs')
      .upsert(row, { onConflict: 'workout_id,exercise_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('createLog failed', upsertError);
      throw new Error(`Failed to save log: ${upsertError.message}`);
    }

    const created = fromRow(data);
    setLogs(prev => {
      const existingIdx = prev.findIndex(
        l => l.workoutId === created.workoutId && l.exId === created.exId
      );
      if (existingIdx >= 0) {
        const next = prev.slice();
        next[existingIdx] = created;
        return next;
      }
      return [...prev, created];
    });
    return created;
  };

  const deleteLog = async (id) => {
    const { error: deleteError } = await supabase
      .from('logs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete log: ${deleteError.message}`);
    }

    setLogs(prev => prev.filter(l => l.id !== id));
  };

  return { logs, loading, error, createLog, deleteLog };
}
