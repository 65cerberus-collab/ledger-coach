import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const SELECT_COLS = 'id, name, user_id, archived, archived_at';

const DB_COLUMNS = new Set(['name', 'archived', 'archived_at']);

const CAMEL_TO_SNAKE = {
  archivedAt: 'archived_at',
};

function toDbPayload(input) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    const key = CAMEL_TO_SNAKE[k] || k;
    if (DB_COLUMNS.has(key)) out[key] = v;
  }
  return out;
}

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
      .select(SELECT_COLS)
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

  const updateCoach = async (id, patch) => {
    const payload = toDbPayload(patch);
    if (Object.keys(payload).length === 0) return null;
    const { data, error: updateError } = await supabase
      .from('coaches')
      .update(payload)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (updateError) throw updateError;
    setCoaches(prev => prev.map(c => c.id === id ? data : c));
    return data;
  };

  return { coaches, loading, error, updateCoach };
}
