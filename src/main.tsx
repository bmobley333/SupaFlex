import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { RulesProvider } from './context/RulesContext.tsx';
import { initNetworkTelemetry } from './utils/networkTelemetry.ts';

initNetworkTelemetry();

// Global Vite dynamic preload self-healing handler (auto-reloads on stale chunk 404 after Vercel deployment)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Dynamic chunk failed to load (new Vercel deployment detected). Auto-reloading...', event);
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RulesProvider>
      <App />
    </RulesProvider>
  </React.StrictMode>,
);
