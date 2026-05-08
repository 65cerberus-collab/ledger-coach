import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const PROFILE_NAME_MAX = 30;
const PENDING_PROFILE_KEY = 'pendingProfileName';

function WelcomeScreen({ onCreate }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Wipe any stale signup-flow state on entry. If the user reached this screen
  // it means they have zero coaches and the bootstrap path already settled, so
  // a leftover pendingProfileName can only be stale.
  useEffect(() => {
    try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch { /* ignore */ }
  }, []);

  const trimmed = name.trim();
  const tooLong = trimmed.length > PROFILE_NAME_MAX;
  const canSubmit = trimmed.length > 0 && !tooLong && !submitting;

  const displayedError = tooLong
    ? `Profile name must be ${PROFILE_NAME_MAX} characters or fewer.`
    : errorMessage;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      await onCreate({ name: trimmed });
      // On success, AuthGate's coach list updates and this component unmounts
      // as the conditional flips to children. No local cleanup needed.
    } catch {
      setErrorMessage("Couldn't create profile. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-5 py-8"
      style={{ background: 'var(--paper)', color: 'var(--ink)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--line-2)',
          boxShadow: '0 16px 40px rgba(22,20,15,0.08)',
        }}
      >
        <div className="mb-5">
          <div
            className="mono text-[10px] uppercase tracking-widest mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Ledger Coach
          </div>
          <h1 className="display text-3xl font-medium tracking-tight">Welcome</h1>
        </div>

        <div className="flex flex-col gap-3 mb-5 text-sm" style={{ color: 'var(--ink-2)' }}>
          <p>
            You're in. Let's set up your first profile so you can start coaching.
          </p>
          <p>
            A profile is your coaching workspace. It owns its own clients, workouts,
            logs, and attendance. The exercise library is shared across every profile
            you create.
          </p>
          <p>
            Most coaches only ever need one. Some keep more than one to separate
            client books — different gyms, distinct coaching businesses, or
            training and nutrition coaching kept apart. You can add more profiles
            or rename this one anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span
              className="mono text-[10px] uppercase tracking-widest"
              style={{ color: 'var(--muted)' }}
            >
              Profile name
            </span>
            <input
              type="text"
              required
              maxLength={PROFILE_NAME_MAX}
              autoComplete="off"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              disabled={submitting}
              placeholder="e.g. Jordan Blake"
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line-2)',
                color: 'var(--ink)',
              }}
            />
            <span
              className="mono text-[10px]"
              style={{ color: 'var(--muted)' }}
            >
              ≤{PROFILE_NAME_MAX} chars
            </span>
          </label>

          {displayedError && (
            <div
              className="text-sm"
              style={{ color: 'var(--accent)' }}
              role="alert"
            >
              {displayedError}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full mt-2 px-4 py-2.5 rounded-lg text-sm font-medium hover-lift"
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              border: '1px solid var(--ink)',
              opacity: canSubmit ? 1 : 0.45,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Creating…' : 'Create profile'}
          </button>

          <button
            type="button"
            onClick={() => { supabase.auth.signOut(); }}
            disabled={submitting}
            className="text-xs mt-1 underline-offset-2 hover:underline"
            style={{
              color: 'var(--muted)',
              background: 'transparent',
              border: 'none',
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            Signed up under the wrong account? Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export default WelcomeScreen;
