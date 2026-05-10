import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const LB_PER_KG = 2.20462;
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

const WORKOUT_SELECT = `
  id, coach_id, client_id, name, date, is_template,
  is_self_directed, completed_at,
  workout_blocks (
    id, workout_id, exercise_id, position, sets, reps,
    weight_lb, rest_seconds, unit, notes, side,
    work_type, duration_seconds
  )
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
    notes: row.notes,
    side: row.side ?? 'bilateral',
    work_type: row.work_type ?? 'reps',
    durationSeconds: row.duration_seconds ?? null,
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
  return out;
}

export function toBlockRow(block, workoutId, position) {
  return {
    workout_id: workoutId,
    exercise_id: block.exId,
    position,
    sets: block.sets,
    reps: block.reps,
    weight_lb: convertToLb(block.weight, block.unit),
    rest_seconds: block.rest,
    unit: block.unit,
    notes: block.notes,
    side: block.side ?? 'bilateral',
    work_type: block.work_type ?? 'reps',
    duration_seconds: block.durationSeconds ?? null,
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

    const created = {
      ...camelWorkout,
      id: workoutId,
      coachId: camelWorkout.coachId ?? coachId,
      blocks,
    };
    setWorkouts(prev => [...prev, created]);
    return created;
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

    const updated = { ...camelWorkout, id, coachId: coachId };
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

  return { workouts, loading, error, createWorkout, updateWorkout, deleteWorkout, completeWorkout, uncompleteWorkout };
}
