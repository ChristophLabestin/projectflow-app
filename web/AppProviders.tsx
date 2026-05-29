import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { HelpCenterProvider } from './context/HelpCenterContext';
import { LanguageProvider } from './context/LanguageContext';
import { PermissionProvider } from './context/PermissionContext';
import { PinnedProjectProvider } from './context/PinnedProjectContext';
import { PinnedTasksProvider } from './context/PinnedTasksContext';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';

type AppProvidersProps = {
    children: React.ReactNode;
};

export const AppProviders = ({ children }: AppProvidersProps) => (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <LanguageProvider defaultLanguage="en" storageKey="pf-language">
            <PinnedProjectProvider>
                <PinnedTasksProvider>
                    <UIProvider>
                        <HelpCenterProvider>
                            <AuthProvider>
                                <PermissionProvider>
                                    {children}
                                </PermissionProvider>
                            </AuthProvider>
                        </HelpCenterProvider>
                    </UIProvider>
                </PinnedTasksProvider>
            </PinnedProjectProvider>
        </LanguageProvider>
    </ThemeProvider>
);
