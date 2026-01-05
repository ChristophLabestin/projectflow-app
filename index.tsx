import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { UIProvider } from './context/UIContext';
import { HelpCenterProvider } from './context/HelpCenterContext';
import { PinnedTasksProvider } from './context/PinnedTasksContext';
import { PinnedProjectProvider } from './context/PinnedProjectContext';
import './styles/index.scss';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <LanguageProvider defaultLanguage="en" storageKey="pf-language">
        <PinnedProjectProvider>
          <PinnedTasksProvider>
            <UIProvider>
              <HelpCenterProvider>
                <App />
              </HelpCenterProvider>
            </UIProvider>
          </PinnedTasksProvider>
        </PinnedProjectProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
