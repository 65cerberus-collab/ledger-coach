import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const NOTE_COLUMNS = 'id, client_id, date, ts, body';

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
      .select(NOTE_COLUMNS)
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

  const createNote = async (input) => {
    const { data, error: insertError } = await supabase
      .from('client_notes')
      .insert({ client_id: clientId, ...input })
      .select(NOTE_COLUMNS)
      .single();
    if (insertError) throw insertError;
    setClientNotes(prev => [data, ...prev]);
    return data;
  };

  const deleteNote = async (id) => {
    const { error: deleteError } = await supabase
      .from('client_notes')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;
    setClientNotes(prev => prev.filter(n => n.id !== id));
  };

  return { clientNotes, loading, error, createNote, deleteNote };
}
