import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { getUserProfile, updateUserData } from '../services/dataService';
import { onAuthStateChanged } from 'firebase/auth';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
}

interface ThemeProviderState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
    theme: 'light',
    setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = 'light',
    storageKey = 'vite-ui-theme',
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    );

    // Sync theme from Cloud on Login
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const profile = await getUserProfile(user.uid);
                    // If cloud has a theme and it differs from current, apply it
                    // cast profile type manually or check field existence
                    // @ts-ignore
                    if (profile?.theme && (profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'system')) {
                        setTheme(profile.theme as Theme);
                        localStorage.setItem(storageKey, profile.theme);
                    }
                } catch (e) {
                    console.warn("Failed to sync theme from profile", e);
                }
            }
        });
        return () => unsubscribe();
    }, [storageKey]);

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
                .matches
                ? 'dark'
                : 'light';

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme]);

    const value = {
        theme,
        setTheme: (newTheme: Theme) => {
            localStorage.setItem(storageKey, newTheme);
            setTheme(newTheme);

            // Sync to Cloud
            if (auth.currentUser) {
                updateUserData(auth.currentUser.uid, { theme: newTheme }).catch(err =>
                    console.error("Failed to sync theme to cloud", err)
                );
            }
        },
    };

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);

    if (context === undefined)
        throw new Error('useTheme must be used within a ThemeProvider');

    return context;
};
