import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProviders } from './AppProviders';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initErrorReporting } from './services/errorReporting';
import './styles/index.scss';

initErrorReporting();

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
