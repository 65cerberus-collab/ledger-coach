import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useClientNotes(clientId) {
  const [clientNotes, setClientNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId) {
      setClientNotes([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('client_notes')
      .select('id, client_id, date, ts, body')
      .eq('client_id', clientId)
      .order('ts', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setLoading(false);
          return;
        }
        setClientNotes(data ?? []);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  return { clientNotes, loading, error };
}
