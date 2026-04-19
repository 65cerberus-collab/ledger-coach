import React from 'react';
import ReactDOM from 'react-dom/client';
import CoachApp from './App.jsx';
import './storage-shim.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CoachApp />
  </React.StrictMode>
);
