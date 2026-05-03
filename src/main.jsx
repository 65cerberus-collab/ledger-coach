import React from 'react';
import ReactDOM from 'react-dom/client';
import CoachApp from './App.jsx';
import './storage-shim.js';
import './lib/supabase.js'; // Phase 3 Step 1: validates env wiring at startup; real usage lands in Step 2

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CoachApp />
  </React.StrictMode>
);
