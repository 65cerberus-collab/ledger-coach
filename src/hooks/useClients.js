import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const SELECT_COLS =
  'id, coach_id, name, age, level, goals, injuries, equipment, archived, archived_at, notes, since';

const DB_COLUMNS = new Set([
  'coach_id', 'name', 'age', 'level', 'goals',
  'injuries', 'equipment', 'archived', 'archived_at',
  'notes', 'since',
]);

const CAMEL_TO_SNAKE = {
  coachId: 'coach_id',
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
      .select(SELECT_COLS)
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

  const createClient = async (input) => {
    const payload = toDbPayload(input);
    if (!payload.coach_id) payload.coach_id = coachId;
    const { data, error: insertError } = await supabase
      .from('clients')
      .insert(payload)
      .select(SELECT_COLS)
      .single();
    if (insertError) throw insertError;
    setClients(prev => [...prev, data]);
    return data;
  };

  const updateClient = async (id, patch) => {
    const payload = toDbPayload(patch);
    if (Object.keys(payload).length === 0) return null;
    const { data, error: updateError } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (updateError) throw updateError;
    setClients(prev => prev.map(c => c.id === id ? data : c));
    return data;
  };

  return { clients, loading, error, createClient, updateClient };
}
