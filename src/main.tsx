import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './ui/theme/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startRealTimeLoop } from './state/loop';
import { AppRoot } from './ui/layout/AppRoot';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing from index.html');
const root = createRoot(rootEl);

if (import.meta.env.VITE_E2E) {
  // Test build: deterministic time via window.__pumpops, optional ?fixture= gallery (docs/TESTING.md §3).
  void import('./testing/install').then(({ installTestHooks }) => {
    installTestHooks(root);
  });
} else {
  // Installed to a home screen, the app should still open offline (PWA, M6). Production only:
  // a service worker in dev would serve stale modules.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    });
  }
  startRealTimeLoop();
  root.render(
    <StrictMode>
      <AppRoot />
    </StrictMode>,
  );
}
