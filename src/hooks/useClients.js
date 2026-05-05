import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useClients(coachId) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coachId) {
      setClients([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('clients')
      .select('id, coach_id, name, age, level, goals, injuries, equipment, archived, archived_at')
      .eq('coach_id', coachId)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setLoading(false);
          return;
        }
        setClients(data ?? []);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coachId]);

  return { clients, loading, error };
}
