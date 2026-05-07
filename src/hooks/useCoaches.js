import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const SELECT_COLS = 'id, name, user_id, archived, archived_at, last_used_at';

const DB_COLUMNS = new Set(['name', 'archived', 'archived_at', 'last_used_at']);

const CAMEL_TO_SNAKE = {
  archivedAt: 'archived_at',
  lastUsedAt: 'last_used_at',
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
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })
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

  const createCoach = async ({ name }) => {
    if (!session) throw new Error('createCoach: no session');
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('createCoach: name required');
    const { data, error: insertError } = await supabase
      .from('coaches')
      .insert({ name: trimmed, user_id: session.user.id })
      .select(SELECT_COLS)
      .single();
    if (insertError) throw insertError;
    setCoaches(prev => [data, ...prev]);
    return data;
  };

  const updateLastUsed = async (id) => {
    if (!id) return null;
    const { data, error: updateError } = await supabase
      .from('coaches')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (updateError) throw updateError;
    setCoaches(prev => prev.map(c => c.id === id ? data : c));
    return data;
  };

  return { coaches, loading, error, createCoach, updateCoach, updateLastUsed };
}
