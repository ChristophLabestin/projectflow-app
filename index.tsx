import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { UIProvider } from './context/UIContext';
import { HelpCenterProvider } from './context/HelpCenterContext';
import { PinnedTasksProvider } from './context/PinnedTasksContext';
import { PinnedProjectProvider } from './context/PinnedProjectContext';
import { AuthProvider } from './context/AuthContext';
import './src/styles/main.scss';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Note: React.StrictMode removed due to incompatibility with Firebase Auth timing
// StrictMode's double-invoke of effects causes Firestore auth sync issues
// This only affects development; production builds don't use StrictMode anyway
const root = createRoot(rootElement);
root.render(
  <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
    <LanguageProvider defaultLanguage="en" storageKey="pf-language">
      <AuthProvider>
        <PinnedProjectProvider>
          <PinnedTasksProvider>
            <UIProvider>
              <HelpCenterProvider>
                <App />
              </HelpCenterProvider>
            </UIProvider>
          </PinnedTasksProvider>
        </PinnedProjectProvider>
      </AuthProvider>
    </LanguageProvider>
  </ThemeProvider>
);
