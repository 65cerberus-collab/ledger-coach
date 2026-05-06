import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const MEASUREMENT_COLUMNS = 'id, client_id, date, type, value_lb, value_in, value_pct, unit, notes';

const fromRow = (r) => ({
  id: r.id,
  clientId: r.client_id,
  date: r.date,
  type: r.type,
  valueLb: r.value_lb,
  valueIn: r.value_in,
  valuePct: r.value_pct,
  unit: r.unit,
  notes: r.notes,
});

const toRow = (input) => {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    switch (k) {
      case 'clientId': out.client_id = v; break;
      case 'valueLb':  out.value_lb  = v; break;
      case 'valueIn':  out.value_in  = v; break;
      case 'valuePct': out.value_pct = v; break;
      default:         out[k] = v;
    }
  }
  return out;
};

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
      .select(MEASUREMENT_COLUMNS)
      .eq('client_id', clientId)
      .order('date', { ascending: true })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
          setLoading(false);
          return;
        }
        setMeasurements((data ?? []).map(fromRow));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  const createMeasurement = async (input) => {
    const { data, error: insertError } = await supabase
      .from('measurements')
      .insert(toRow(input))
      .select(MEASUREMENT_COLUMNS)
      .single();
    if (insertError) throw insertError;
    const row = fromRow(data);
    setMeasurements(prev => [...prev, row]);
    return row;
  };

  const updateMeasurement = async (id, patch) => {
    const { data, error: updateError } = await supabase
      .from('measurements')
      .update(toRow(patch))
      .eq('id', id)
      .select(MEASUREMENT_COLUMNS)
      .single();
    if (updateError) throw updateError;
    const row = fromRow(data);
    setMeasurements(prev => prev.map(m => m.id === id ? row : m));
    return row;
  };

  const deleteMeasurement = async (id) => {
    const { error: deleteError } = await supabase
      .from('measurements')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };

  return { measurements, loading, error, createMeasurement, updateMeasurement, deleteMeasurement };
}
