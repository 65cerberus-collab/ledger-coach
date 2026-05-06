import React, { useEffect, useRef, useState } from 'react';
import { useSession } from './useSession.js';
import LoginScreen from './LoginScreen.jsx';
import { supabase } from '../lib/supabase.js';

const PENDING_PROFILE_KEY = 'pendingProfileName';

function LoadingShell({ label = 'Loading…' }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        color: 'var(--ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
        fontSize: '14px',
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </div>
  );
}

function AuthGate({ children }) {
  const { session, loading } = useSession();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState(null);
  const ranForUserRef = useRef(null);

  useEffect(() => {
    if (!session) {
      ranForUserRef.current = null;
      setBootstrapError(null);
      return;
    }
    // Run the bootstrap at most once per signed-in user. If it failed, the user
    // can reload to retry — pendingProfileName is left in localStorage on
    // failure so the retry has the data it needs.
    if (ranForUserRef.current === session.user.id) return;

    let pendingName;
    try {
      pendingName = localStorage.getItem(PENDING_PROFILE_KEY);
    } catch {
      pendingName = null;
    }
    if (!pendingName) {
      ranForUserRef.current = session.user.id;
      return;
    }

    ranForUserRef.current = session.user.id;
    setBootstrapping(true);
    setBootstrapError(null);

    (async () => {
      try {
        const { data: existing, error: fetchErr } = await supabase
          .from('coaches')
          .select('id')
          .eq('user_id', session.user.id);
        if (fetchErr) throw fetchErr;

        if ((existing ?? []).length > 0) {
          // User already has at least one profile. Drop the pending name —
          // they presumably signed up earlier and we already inserted, or
          // they got into a weird half-state. Either way, don't double-insert.
          try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch { /* ignore */ }
          setBootstrapping(false);
          return;
        }

        const { error: insertErr } = await supabase
          .from('coaches')
          .insert({
            user_id: session.user.id,
            name: pendingName,
            last_used_at: new Date().toISOString(),
          });
        if (insertErr) throw insertErr;

        try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch { /* ignore */ }
        setBootstrapping(false);
      } catch (err) {
        // Allow a retry on the next mount/session change. Leave the pending
        // name in localStorage so the next attempt has the data.
        ranForUserRef.current = null;
        setBootstrapError(err?.message ?? String(err));
        setBootstrapping(false);
      }
    })();
  }, [session]);

  if (loading) return <LoadingShell />;
  if (!session) return <LoginScreen />;
  if (bootstrapping) return <LoadingShell label="Setting up your profile…" />;
  if (bootstrapError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--paper)',
          color: 'var(--ink)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '14px', maxWidth: '420px', textAlign: 'center' }}>
          We couldn't finish setting up your profile.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', maxWidth: '420px', textAlign: 'center' }}>
          {bootstrapError}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'var(--ink)',
            color: 'var(--paper)',
            border: '1px solid var(--ink)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return children;
}

export default AuthGate;
