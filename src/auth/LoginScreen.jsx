import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
    }
    setSubmitting(false);
  }

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
          <h1 className="display text-3xl font-medium tracking-tight">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              autoComplete="current-password"
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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;
