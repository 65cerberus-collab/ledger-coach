import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const PROFILE_NAME_MAX = 30;
const PENDING_PROFILE_KEY = 'pendingProfileName';

function LoginScreen() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileName, setProfileName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [signupSentTo, setSignupSentTo] = useState(null);

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      const trimmed = profileName.trim();
      if (trimmed.length === 0) {
        setError('Profile name is required.');
        return;
      }
      if (trimmed.length > PROFILE_NAME_MAX) {
        setError(`Profile name must be ${PROFILE_NAME_MAX} characters or fewer.`);
        return;
      }

      setSubmitting(true);
      // Persist the chosen name so the post-verification bootstrap can read it
      // after the email-confirmation round-trip. Survives the redirect because
      // localStorage is per-origin, not per-tab.
      try {
        localStorage.setItem(PENDING_PROFILE_KEY, trimmed);
      } catch {
        // localStorage may be unavailable (private mode, etc). Surface and stop.
        setError('Could not store profile name locally. Please enable site storage and try again.');
        setSubmitting(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch { /* ignore */ }
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }
      setSignupSentTo(email);
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
    }
    setSubmitting(false);
  }

  const heading = mode === 'signup' ? 'Sign up' : 'Sign in';
  const submitLabel = mode === 'signup'
    ? (submitting ? 'Creating account…' : 'Create account')
    : (submitting ? 'Signing in…' : 'Sign in');
  const toggleLabel = mode === 'signup'
    ? 'Already have an account? Sign in'
    : "Don't have an account? Sign up";
  const toggleTarget = mode === 'signup' ? 'signin' : 'signup';

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-5"
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
        <div className="mb-6">
          <div
            className="mono text-[10px] uppercase tracking-widest mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Ledger Coach
          </div>
          <h1 className="display text-3xl font-medium tracking-tight">{heading}</h1>
        </div>

        {signupSentTo ? (
          <div className="flex flex-col gap-4">
            <div className="text-sm" style={{ color: 'var(--ink)' }}>
              <p className="mb-2">Check your email.</p>
              <p style={{ color: 'var(--muted)' }}>
                We sent a confirmation link to <strong style={{ color: 'var(--ink)' }}>{signupSentTo}</strong>.
                Click the link to verify your account, then return here to sign in.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSignupSentTo(null);
                setProfileName('');
                setPassword('');
                switchMode('signin');
              }}
              className="w-full mt-2 px-4 py-2.5 rounded-lg text-sm font-medium hover-lift"
              style={{
                background: 'var(--ink)',
                color: 'var(--paper)',
                border: '1px solid var(--ink)',
                cursor: 'pointer',
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
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
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
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
            )}

            <label className="flex flex-col gap-1.5">
              <span
                className="mono text-[10px] uppercase tracking-widest"
                style={{ color: 'var(--muted)' }}
              >
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--line-2)',
                  color: 'var(--ink)',
                }}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span
                className="mono text-[10px] uppercase tracking-widest"
                style={{ color: 'var(--muted)' }}
              >
                Password
              </span>
              <input
                type="password"
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--line-2)',
                  color: 'var(--ink)',
                }}
              />
            </label>

            {error && (
              <div
                className="text-sm"
                style={{ color: 'var(--danger)' }}
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 px-4 py-2.5 rounded-lg text-sm font-medium hover-lift"
              style={{
                background: 'var(--ink)',
                color: 'var(--paper)',
                border: '1px solid var(--ink)',
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'default' : 'pointer',
              }}
            >
              {submitLabel}
            </button>

            <button
              type="button"
              onClick={() => switchMode(toggleTarget)}
              className="text-xs mt-1 underline-offset-2 hover:underline"
              style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {toggleLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;
