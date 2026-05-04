import React from 'react';
import { useSession } from './useSession.js';
import LoginScreen from './LoginScreen.jsx';

function AuthGate({ children }) {
  const { session, loading } = useSession();

  if (loading) {
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
        Loading…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return children;
}

export default AuthGate;
