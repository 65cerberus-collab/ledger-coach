import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useCoaches(session) {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!session) {
      setCoaches([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('coaches')
      .select('id, name, user_id')
      .eq('user_id', session.user.id)
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setLoading(false);
          return;
        }
        setCoaches(data ?? []);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [session]);

  return { coaches, loading, error };
}
