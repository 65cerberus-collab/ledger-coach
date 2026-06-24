import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { convertFromMeters, convertToMeters, repsOrNull } from './useWorkouts.js';

const EXERCISE_COLUMNS = `
  id, coach_id, name, movement, muscles, equipment, difficulty,
  tags, contraindications, default_sets, default_reps, default_rest,
  default_work_type, default_duration_seconds, default_distance_m,
  default_distance_unit, default_side,
  notes, is_seed
`;

const fromRow = (r) => ({
  id: r.id,
  coachId: r.coach_id,
  name: r.name,
  movement: r.movement,
  muscles: r.muscles ?? [],
  equipment: r.equipment ?? [],
  difficulty: r.difficulty,
  tags: r.tags ?? [],
  contraindications: r.contraindications ?? [],
  defSets: r.default_sets,
  defReps: r.default_reps,
  defRest: r.default_rest,
  defWorkType: r.default_work_type ?? 'reps',
  defDurationSeconds: r.default_duration_seconds ?? null,
  defDistance: convertFromMeters(r.default_distance_m, r.default_distance_unit),
  defDistanceUnit: r.default_distance_unit ?? 'm',
  defSide: r.default_side ?? 'bilateral',
  notes: r.notes,
  isSeed: r.is_seed,
});

const toRow = (input) => {
  const out = {};
  if ('name' in input) out.name = input.name;
  if ('movement' in input) out.movement = input.movement;
  if ('muscles' in input) out.muscles = input.muscles;
  if ('equipment' in input) out.equipment = input.equipment;
  if ('difficulty' in input) out.difficulty = input.difficulty;
  if ('tags' in input) out.tags = input.tags;
  if ('contraindications' in input) out.contraindications = input.contraindications;
  if ('defSets' in input) out.default_sets = input.defSets;
  if ('defReps' in input) out.default_reps = repsOrNull(input.defReps);
  if ('defRest' in input) out.default_rest = input.defRest;
  if ('defWorkType' in input) out.default_work_type = input.defWorkType;
  if ('defDurationSeconds' in input) out.default_duration_seconds = input.defDurationSeconds;
  if ('defDistance' in input) out.default_distance_m = convertToMeters(input.defDistance, input.defDistanceUnit);
  if ('defDistanceUnit' in input) out.default_distance_unit = input.defDistanceUnit;
  if ('defSide' in input) out.default_side = input.defSide;
  if ('notes' in input) out.notes = input.notes;
  return out;
};

export function useExercises(coachId) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coachId) {
      setExercises([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('exercises')
      .select(EXERCISE_COLUMNS)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setExercises([]);
          setLoading(false);
          return;
        }
        setExercises((data ?? []).map(fromRow));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coachId]);

  const createExercise = async (input) => {
    const row = { ...toRow(input), coach_id: coachId, is_seed: false };
    const { data, error: insertError } = await supabase
      .from('exercises')
      .insert(row)
      .select(EXERCISE_COLUMNS)
      .single();
    if (insertError) {
      console.error('createExercise failed:', insertError);
      throw new Error(`Failed to create exercise: ${insertError.message}`);
    }
    const created = fromRow(data);
    setExercises(prev => [...prev, created]);
    return created;
  };

  const updateExercise = async (id, patch) => {
    const target = exercises.find(e => e.id === id);
    if (target?.isSeed) {
      throw new Error('Seed exercises cannot be edited');
    }
    const { data, error: updateError } = await supabase
      .from('exercises')
      .update(toRow(patch))
      .eq('id', id)
      .eq('coach_id', coachId)
      .select(EXERCISE_COLUMNS)
      .single();
    if (updateError) {
      console.error('updateExercise failed:', updateError);
      throw new Error(`Failed to update exercise: ${updateError.message}`);
    }
    const updated = fromRow(data);
    setExercises(prev => prev.map(e => e.id === id ? updated : e));
    return updated;
  };

  const deleteExercise = async (id) => {
    const target = exercises.find(e => e.id === id);
    if (target?.isSeed) {
      throw new Error('Seed exercises cannot be deleted');
    }
    const { error: deleteError } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id)
      .eq('coach_id', coachId);
    if (deleteError) {
      console.error('deleteExercise failed:', deleteError);
      throw new Error(`Failed to delete exercise: ${deleteError.message}`);
    }
    setExercises(prev => prev.filter(e => e.id !== id));
  };

  return { exercises, loading, error, createExercise, updateExercise, deleteExercise };
}
