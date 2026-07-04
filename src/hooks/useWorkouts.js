import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const LB_PER_KG = 2.20462;
const M_PER_YD = 0.9144;
const round2 = (n) => Math.round(n * 100) / 100;

export function convertToLb(weight, unit) {
  if (weight == null) return null;
  if (unit === 'kg') return round2(Number(weight) * LB_PER_KG);
  return weight;
}

export function convertFromLb(weightLb, unit) {
  if (weightLb == null) return null;
  if (unit === 'kg') return round2(Number(weightLb) / LB_PER_KG);
  return weightLb;
}

// Distance is stored canonically in meters; display/entry is m or yd.
export function convertToMeters(value, unit) {
  if (value == null || value === '') return null;
  if (unit === 'yd') return round2(Number(value) * M_PER_YD);
  return round2(Number(value));
}

export function convertFromMeters(meters, unit) {
  if (meters == null) return null;
  if (unit === 'yd') return round2(Number(meters) / M_PER_YD);
  return Number(meters);
}

// Reps is a smallint column; coerce any input to a whole number or null
// (empty, blank, or non-numeric becomes null — never a partial parse).
export function repsOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

const WORKOUT_SELECT = `
  id, coach_id, client_id, name, date, is_template,
  is_self_directed, completed_at, notes,
  workout_blocks (
    id, workout_id, exercise_id, position, sets, reps,
    weight_lb, rest_seconds, unit, notes, side,
    work_type, duration_seconds, distance_m, distance_unit,
    group_id, group_position
  )
`;

const BLOCK_SELECT = `
  id, workout_id, exercise_id, position, sets, reps,
  weight_lb, rest_seconds, unit, notes, side,
  work_type, duration_seconds, distance_m, distance_unit,
  group_id, group_position
`;

function blockFromRow(row) {
  return {
    _id: row.id,
    exId: row.exercise_id,
    sets: row.sets,
    reps: row.reps,
    rest: row.rest_seconds,
    weight: convertFromLb(row.weight_lb, row.unit),
    unit: row.unit,
    notes: row.notes ?? null,
    side: row.side ?? 'bilateral',
    work_type: row.work_type ?? 'reps',
    durationSeconds: row.duration_seconds ?? null,
    distance: convertFromMeters(row.distance_m, row.distance_unit),
    distanceUnit: row.distance_unit ?? 'm',
    groupId: row.group_id ?? null,
    groupPosition: row.group_position ?? null,
  };
}

export function fromRow(row) {
  const blocks = (row.workout_blocks ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(blockFromRow);

  return {
    id: row.id,
    coachId: row.coach_id,
    clientId: row.client_id,
    name: row.name,
    date: row.date,
    isTemplate: row.is_template,
    isSelfDirected: row.is_self_directed,
    completedAt: row.completed_at,
    notes: row.notes ?? null,
    blocks,
  };
}

export function toWorkoutRow(workout) {
  const out = {};
  if ('id' in workout) out.id = workout.id;
  if ('coachId' in workout) out.coach_id = workout.coachId;
  if ('clientId' in workout) out.client_id = workout.clientId;
  if ('name' in workout) out.name = workout.name;
  if ('date' in workout) out.date = workout.date;
  if ('isTemplate' in workout) out.is_template = workout.isTemplate;
  if ('isSelfDirected' in workout) out.is_self_directed = workout.isSelfDirected;
  if ('completedAt' in workout) out.completed_at = workout.completedAt;
  if ('notes' in workout) out.notes = workout.notes;
  return out;
}

export function toBlockRow(block, workoutId, position) {
  return {
    workout_id: workoutId,
    exercise_id: block.exId,
    position,
    sets: block.sets,
    reps: repsOrNull(block.reps),
    weight_lb: convertToLb(block.weight, block.unit),
    rest_seconds: block.rest,
    unit: block.unit,
    notes: block.notes ?? null,
    side: block.side ?? 'bilateral',
    work_type: block.work_type ?? 'reps',
    duration_seconds: block.durationSeconds ?? null,
    distance_m: convertToMeters(block.distance, block.distanceUnit),
    distance_unit: block.distanceUnit ?? 'm',
    group_id: block.groupId ?? null,
    group_position: block.groupPosition ?? null,
  };
}

export function useWorkouts(coachId) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coachId) {
      setWorkouts([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('workouts')
      .select(WORKOUT_SELECT)
      .eq('coach_id', coachId)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setWorkouts([]);
          setLoading(false);
          return;
        }
        setWorkouts((data ?? []).map(fromRow));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coachId]);

  const createWorkout = async (camelWorkout) => {
    const workoutId = crypto.randomUUID();

    const workoutRow = toWorkoutRow({
      ...camelWorkout,
      id: workoutId,
      coachId: camelWorkout.coachId ?? coachId,
    });

    const { error: insertWorkoutError } = await supabase
      .from('workouts')
      .insert(workoutRow);
    if (insertWorkoutError) {
      throw new Error(`Failed to create workout: ${insertWorkoutError.message}`);
    }

    const blocks = camelWorkout.blocks ?? [];
    if (blocks.length > 0) {
      const blockRows = blocks.map((b, i) => toBlockRow(b, workoutId, i));
      const { error: insertBlocksError } = await supabase
        .from('workout_blocks')
        .insert(blockRows);
      if (insertBlocksError) {
        throw new Error(`Workout created but blocks failed to save: ${insertBlocksError.message}`);
      }
    }

    // Re-read the created workout so its blocks carry their real database ids.
    // Needed to log against those blocks in the same session (e.g. solo
    // self-logging), since block ids are generated server-side on insert.
    const { data: createdRow, error: refetchError } = await supabase
      .from('workouts')
      .select(WORKOUT_SELECT)
      .eq('id', workoutId)
      .single();
    if (refetchError) {
      throw new Error(`Workout created but could not be re-read: ${refetchError.message}`);
    }

    const created = fromRow(createdRow);
    setWorkouts(prev => [...prev, created]);
    return created;
  };

  // Append a single block to an existing workout without disturbing the others.
  // Inserts one row and reads it back so the returned block carries its real
  // database id (safe to log against immediately, and never re-generates the
  // ids of blocks already present, unlike updateWorkout's delete-and-reinsert).
  const addBlock = async (workoutId, block) => {
    const target = workouts.find(w => w.id === workoutId);
    const position = target ? target.blocks.length : 0;
    const blockRow = toBlockRow(block, workoutId, position);

    const { data, error: insertBlockError } = await supabase
      .from('workout_blocks')
      .insert(blockRow)
      .select(BLOCK_SELECT)
      .single();
    if (insertBlockError) {
      throw new Error(`Failed to add exercise: ${insertBlockError.message}`);
    }

    const hydrated = blockFromRow(data);
    setWorkouts(prev => prev.map(w => w.id === workoutId
      ? { ...w, blocks: [...w.blocks, hydrated] }
      : w));
    return hydrated;
  };

  const updateWorkout = async (id, camelWorkout) => {
    const fullRow = toWorkoutRow(camelWorkout);
    const { id: _id, coach_id: _coach, ...patch } = fullRow;

    const { error: updateError } = await supabase
      .from('workouts')
      .update(patch)
      .eq('id', id)
      .eq('coach_id', coachId);
    if (updateError) {
      throw new Error(`Failed to update workout: ${updateError.message}`);
    }

    const { error: deleteBlocksError } = await supabase
      .from('workout_blocks')
      .delete()
      .eq('workout_id', id);
    if (deleteBlocksError) {
      throw new Error(`Failed to clear workout blocks: ${deleteBlocksError.message}`);
    }

    const blocks = camelWorkout.blocks ?? [];
    if (blocks.length > 0) {
      const blockRows = blocks.map((b, i) => toBlockRow(b, id, i));
      const { error: insertBlocksError } = await supabase
        .from('workout_blocks')
        .insert(blockRows);
      if (insertBlocksError) {
        throw new Error(`Failed to save workout blocks: ${insertBlocksError.message}`);
      }
    }

    // Re-read the workout so its blocks carry their real database ids after the
    // delete-and-reinsert above (block ids are generated server-side). Without
    // this, logging against a freshly edited or newly added block in the same
    // session writes a stale or null block_id.
    const { data: updatedRow, error: refetchError } = await supabase
      .from('workouts')
      .select(WORKOUT_SELECT)
      .eq('id', id)
      .single();
    if (refetchError) {
      throw new Error(`Workout updated but could not be re-read: ${refetchError.message}`);
    }

    const updated = fromRow(updatedRow);
    setWorkouts(prev => prev.map(w => w.id === id ? updated : w));
    return updated;
  };

  const deleteWorkout = async (id) => {
    const { error: deleteError } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id)
      .eq('coach_id', coachId);
    if (deleteError) {
      throw new Error(`Failed to delete workout: ${deleteError.message}`);
    }
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const completeWorkout = async (id) => {
    const { data, error: updateError } = await supabase
      .from('workouts')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('coach_id', coachId)
      .select(WORKOUT_SELECT)
      .single();
    if (updateError) {
      console.error('completeWorkout failed', updateError);
      throw new Error(`Failed to complete workout: ${updateError.message}`);
    }
    const updated = fromRow(data);
    setWorkouts(prev => prev.map(w => w.id === id ? updated : w));
    return updated;
  };

  const uncompleteWorkout = async (id) => {
    const { data, error: updateError } = await supabase
      .from('workouts')
      .update({ completed_at: null })
      .eq('id', id)
      .eq('coach_id', coachId)
      .select(WORKOUT_SELECT)
      .single();
    if (updateError) {
      console.error('uncompleteWorkout failed', updateError);
      throw new Error(`Failed to uncomplete workout: ${updateError.message}`);
    }
    const updated = fromRow(data);
    setWorkouts(prev => prev.map(w => w.id === id ? updated : w));
    return updated;
  };

  return { workouts, loading, error, createWorkout, addBlock, updateWorkout, deleteWorkout, completeWorkout, uncompleteWorkout };
}
