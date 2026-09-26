import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { HelpCenterProvider } from './context/HelpCenterContext';
import { LanguageProvider } from './context/LanguageContext';
import { PermissionProvider } from './context/PermissionContext';
import { PinnedProjectProvider } from './context/PinnedProjectContext';
import { PinnedTasksProvider } from './context/PinnedTasksContext';
import { ThemeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';
import { WorkspaceProvider } from './context/WorkspaceContext';

type AppProvidersProps = {
    children: React.ReactNode;
};

// Auth and workspace resolution come first so every tenant-scoped provider
// below mounts with a resolved active workspace.
export const AppProviders = ({ children }: AppProvidersProps) => (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <LanguageProvider defaultLanguage="en" storageKey="pf-language">
            <AuthProvider>
                <WorkspaceProvider>
                    <PinnedProjectProvider>
                        <PinnedTasksProvider>
                            <UIProvider>
                                <HelpCenterProvider>
                                    <PermissionProvider>
                                        {children}
                                    </PermissionProvider>
                                </HelpCenterProvider>
                            </UIProvider>
                        </PinnedTasksProvider>
                    </PinnedProjectProvider>
                </WorkspaceProvider>
            </AuthProvider>
        </LanguageProvider>
    </ThemeProvider>
);
