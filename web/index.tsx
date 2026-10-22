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
