import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProviders } from './AppProviders';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initErrorReporting, installGlobalErrorHandlers } from './services/errorReporting';
import './styles/tailwind-base.css';
import './styles/index.scss';

initErrorReporting();
installGlobalErrorHandlers();

// After a deploy, long-open tabs (and the desktop app, which stays open for days) still reference the old
// hashed chunks, which Hosting no longer serves; reload once to pick up the new build instead of erroring.
const CHUNK_RELOAD_KEY = 'pf_chunk_reload_at';
window.addEventListener('vite:preloadError', (event) => {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - lastReload < 30_000) return;
    event.preventDefault();
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    window.location.reload();
});

// Set <html lang> from the stored preference before first paint; LanguageContext keeps it in sync afterwards.
const storedLanguage = localStorage.getItem('pf-language');
if (storedLanguage === 'en' || storedLanguage === 'de') {
    document.documentElement.lang = storedLanguage;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </React.StrictMode>
);
