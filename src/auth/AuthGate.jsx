import React, { useEffect, useRef, useState } from 'react';
import { useSession } from './useSession.js';
import { useCoaches } from '../hooks/useCoaches.js';
import LoginScreen from './LoginScreen.jsx';
import WelcomeScreen from './WelcomeScreen.jsx';
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
  const { coaches, loading: coachesLoading, createCoach } = useCoaches(session);
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

        // Route the insert through useCoaches.createCoach so the hook's
        // local coaches state updates atomically with the row insert. A
        // raw supabase.insert here would create a row that useCoaches's
        // own SELECT (running in parallel) might miss, leaving coaches=[]
        // post-bootstrap and causing WelcomeScreen to flash for a user
        // who already has a profile. last_used_at is stamped by App.jsx's
        // currentCoachId reconciliation effect on first dashboard render.
        try {
          await createCoach({ name: pendingName });
        } catch (insertErr) {
          // 23505 = unique violation on coaches_user_id_name_key. Means a
          // parallel bootstrap (another tab, another device, a retry that
          // raced our own existence check) inserted the row between our
          // check above and this insert. The row exists — that's the
          // desired end state — so treat it as success and fall through
          // to clear the pending key. Surface any other error.
          const isRaceLoss =
            insertErr?.code === '23505' ||
            /coaches_user_id_name_key/i.test(insertErr?.message ?? '');
          if (!isRaceLoss) throw insertErr;
        }

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
  if (coachesLoading) return <LoadingShell />;
  if (coaches.length === 0) return <WelcomeScreen onCreate={createCoach} />;

  return children;
}

export default AuthGate;
