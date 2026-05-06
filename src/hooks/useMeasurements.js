import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useMeasurements(clientId) {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId) {
      setMeasurements([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('measurements')
      .select('id, client_id, date, type, value_lb, value_in, value_pct, unit, notes')
      .eq('client_id', clientId)
      .order('date', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setLoading(false);
          return;
        }
        setMeasurements(data ?? []);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  return { measurements, loading, error };
}
