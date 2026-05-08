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
    weight_lb, rest_seconds, unit, notes
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

  return { workouts, loading, error };
}
