import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const ATTENDANCE_SELECT = '*';

export function fromRow(row) {
  return {
    id: row.id,
    workoutId: row.workout_id,
    status: row.status,
    date: row.date,
  };
}

export function toRow(camelAttendance) {
  const out = {};
  if ('id' in camelAttendance) out.id = camelAttendance.id;
  if ('workoutId' in camelAttendance) out.workout_id = camelAttendance.workoutId;
  if ('status' in camelAttendance) out.status = camelAttendance.status;
  if ('date' in camelAttendance) out.date = camelAttendance.date;
  return out;
}

export function useAttendance(coachId) {
  const [attendance, setAttendanceState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coachId) {
      setAttendanceState([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('attendance')
      .select(ATTENDANCE_SELECT)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setAttendanceState([]);
          setLoading(false);
          return;
        }
        setAttendanceState((data ?? []).map(fromRow));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coachId]);

  const setAttendance = async (workoutId, status, date) => {
    const row = toRow({
      id: crypto.randomUUID(),
      workoutId,
      status,
      date,
    });

    const { data, error: upsertError } = await supabase
      .from('attendance')
      .upsert(row, { onConflict: 'workout_id' })
      .select()
      .single();

    if (upsertError) {
      throw new Error(`Failed to save attendance: ${upsertError.message}`);
    }

    const upserted = fromRow(data);
    setAttendanceState(prev => {
      const existingIdx = prev.findIndex(a => a.workoutId === upserted.workoutId);
      if (existingIdx >= 0) {
        const next = prev.slice();
        next[existingIdx] = upserted;
        return next;
      }
      return [...prev, upserted];
    });
    return upserted;
  };

  return { attendance, loading, error, setAttendance };
}
