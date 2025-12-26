import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';
import { PinnedTasksProvider } from './context/PinnedTasksContext';
import { PinnedProjectProvider } from './context/PinnedProjectContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <PinnedProjectProvider>
        <PinnedTasksProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </PinnedTasksProvider>
      </PinnedProjectProvider>
    </ThemeProvider>
  </React.StrictMode>
);