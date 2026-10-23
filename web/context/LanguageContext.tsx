import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import en from '../locales/en';
import de from '../locales/de';
import { enUS, de as deLocale } from 'date-fns/locale';
import { Locale } from 'date-fns';
import { getUserProfile, updateUserData } from '../services/domain/usersService';
import { getDesktopBridge } from '../services/desktop';

export type Language = 'en' | 'de';
export type DateFormat = 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'd. MMM yyyy' | 'dd.MM.yyyy' | 'MMM d, yyyy' | 'MMMM d, yyyy' | 'd MMMM yyyy' | 'yyyy/MM/dd';

interface LanguageProviderProps {
    children: React.ReactNode;
    defaultLanguage?: Language;
    storageKey?: string;
}

interface LanguageProviderState {
    language: Language;
    setLanguage: (language: Language) => void;
    dateFormat: DateFormat;
    setDateFormat: (format: DateFormat) => void;
    t: (key: string, fallback?: string) => any;
    dateLocale: Locale;
    settingsTranslationsReady: boolean;
    loadSettingsTranslations: () => Promise<void>;
    projectOverviewTranslationsReady: boolean;
    loadProjectOverviewTranslations: () => Promise<void>;
    dashboardTranslationsReady: boolean;
    loadDashboardTranslations: () => Promise<void>;
    financeTranslationsReady: boolean;
    loadFinanceTranslations: () => Promise<void>;
    profileTranslationsReady: boolean;
    loadProfileTranslations: () => Promise<void>;
    teamTranslationsReady: boolean;
    loadTeamTranslations: () => Promise<void>;
    helpTranslationsReady: boolean;
    loadHelpTranslations: () => Promise<void>;
    calendarTranslationsReady: boolean;
    loadCalendarTranslations: () => Promise<void>;
    authActionTranslationsReady: boolean;
    loadAuthActionTranslations: () => Promise<void>;
    authScreenTranslationsReady: boolean;
    loadAuthScreenTranslations: () => Promise<void>;
}

const isValidLanguage = (lang: any): lang is Language => {
    return lang === 'en' || lang === 'de';
};

const LanguageProviderContext = createContext<LanguageProviderState>({
    language: 'en',
    setLanguage: () => null,
    dateFormat: 'MM/dd/yyyy',
    setDateFormat: () => null,
    t: (key: string, fallback?: string) => fallback || key,
    dateLocale: enUS,
    settingsTranslationsReady: true,
    loadSettingsTranslations: async () => undefined,
    projectOverviewTranslationsReady: true,
    loadProjectOverviewTranslations: async () => undefined,
    dashboardTranslationsReady: true,
    loadDashboardTranslations: async () => undefined,
    financeTranslationsReady: true,
    loadFinanceTranslations: async () => undefined,
    profileTranslationsReady: true,
    loadProfileTranslations: async () => undefined,
    teamTranslationsReady: true,
    loadTeamTranslations: async () => undefined,
    helpTranslationsReady: true,
    loadHelpTranslations: async () => undefined,
    calendarTranslationsReady: true,
    loadCalendarTranslations: async () => undefined,
    authActionTranslationsReady: true,
    loadAuthActionTranslations: async () => undefined,
    authScreenTranslationsReady: true,
    loadAuthScreenTranslations: async () => undefined,
});

export function LanguageProvider({
    children,
    defaultLanguage = 'en',
    storageKey = 'pf-language',
}: LanguageProviderProps) {
    const translations = useMemo<Record<Language, Record<string, any>>>(() => ({
        en,
        de,
    }), []);
    const [settingsTranslations, setSettingsTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [projectOverviewTranslations, setProjectOverviewTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [dashboardTranslations, setDashboardTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [financeTranslations, setFinanceTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [profileTranslations, setProfileTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [teamTranslations, setTeamTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [helpTranslations, setHelpTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [calendarTranslations, setCalendarTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [authActionTranslations, setAuthActionTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [authScreenTranslations, setAuthScreenTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const hasSettingsTranslations = Boolean(settingsTranslations.en && settingsTranslations.de);
    const hasProjectOverviewTranslations = Boolean(projectOverviewTranslations.en && projectOverviewTranslations.de);
    const hasDashboardTranslations = Boolean(dashboardTranslations.en && dashboardTranslations.de);
    const hasFinanceTranslations = Boolean(financeTranslations.en && financeTranslations.de);
    const hasProfileTranslations = Boolean(profileTranslations.en && profileTranslations.de);
    const hasTeamTranslations = Boolean(teamTranslations.en && teamTranslations.de);
    const hasHelpTranslations = Boolean(helpTranslations.en && helpTranslations.de);
    const hasCalendarTranslations = Boolean(calendarTranslations.en && calendarTranslations.de);
    const hasAuthActionTranslations = Boolean(authActionTranslations.en && authActionTranslations.de);
    const hasAuthScreenTranslations = Boolean(authScreenTranslations.en && authScreenTranslations.de);
    const [settingsTranslationsReady, setSettingsTranslationsReady] = useState<boolean>(false);
    const [projectOverviewTranslationsReady, setProjectOverviewTranslationsReady] = useState<boolean>(false);
    const [dashboardTranslationsReady, setDashboardTranslationsReady] = useState<boolean>(false);
    const [financeTranslationsReady, setFinanceTranslationsReady] = useState<boolean>(false);
    const [profileTranslationsReady, setProfileTranslationsReady] = useState<boolean>(false);
    const [teamTranslationsReady, setTeamTranslationsReady] = useState<boolean>(false);
    const [helpTranslationsReady, setHelpTranslationsReady] = useState<boolean>(false);
    const [calendarTranslationsReady, setCalendarTranslationsReady] = useState<boolean>(false);
    const [authActionTranslationsReady, setAuthActionTranslationsReady] = useState<boolean>(false);
    const [authScreenTranslationsReady, setAuthScreenTranslationsReady] = useState<boolean>(false);
    const loadSettingsTranslations = useCallback(async () => {
        if (hasSettingsTranslations) {
            setSettingsTranslationsReady(true);
            return;
        }

        const [{ default: nextSettingsEn }, { default: nextSettingsDe }] = await Promise.all([
            import('../locales/settings-en'),
            import('../locales/settings-de')
        ]);

        setSettingsTranslations({
            en: nextSettingsEn,
            de: nextSettingsDe
        });
        setSettingsTranslationsReady(true);
    }, [hasSettingsTranslations]);
    const loadProjectOverviewTranslations = useCallback(async () => {
        if (hasProjectOverviewTranslations) {
            setProjectOverviewTranslationsReady(true);
            return;
        }

        const [{ default: nextProjectOverviewEn }, { default: nextProjectOverviewDe }] = await Promise.all([
            import('../locales/project-overview-en'),
            import('../locales/project-overview-de')
        ]);

        setProjectOverviewTranslations({
            en: nextProjectOverviewEn,
            de: nextProjectOverviewDe
        });
        setProjectOverviewTranslationsReady(true);
    }, [hasProjectOverviewTranslations]);
    const loadDashboardTranslations = useCallback(async () => {
        if (hasDashboardTranslations) {
            setDashboardTranslationsReady(true);
            return;
        }

        const [{ default: nextDashboardEn }, { default: nextDashboardDe }] = await Promise.all([
            import('../locales/dashboard-en'),
            import('../locales/dashboard-de')
        ]);

        setDashboardTranslations({
            en: nextDashboardEn,
            de: nextDashboardDe
        });
        setDashboardTranslationsReady(true);
    }, [hasDashboardTranslations]);
    const loadFinanceTranslations = useCallback(async () => {
        if (hasFinanceTranslations) {
            setFinanceTranslationsReady(true);
            return;
        }

        const [{ default: nextFinanceEn }, { default: nextFinanceDe }] = await Promise.all([
            import('../locales/finance-en'),
            import('../locales/finance-de')
        ]);

        setFinanceTranslations({
            en: nextFinanceEn,
            de: nextFinanceDe
        });
        setFinanceTranslationsReady(true);
    }, [hasFinanceTranslations]);
    const loadProfileTranslations = useCallback(async () => {
        if (hasProfileTranslations) {
            setProfileTranslationsReady(true);
            return;
        }

        const [{ default: nextProfileEn }, { default: nextProfileDe }] = await Promise.all([
            import('../locales/profile-en'),
            import('../locales/profile-de')
        ]);

        setProfileTranslations({
            en: nextProfileEn,
            de: nextProfileDe
        });
        setProfileTranslationsReady(true);
    }, [hasProfileTranslations]);
    const loadTeamTranslations = useCallback(async () => {
        if (hasTeamTranslations) {
            setTeamTranslationsReady(true);
            return;
        }

        const [{ default: nextTeamEn }, { default: nextTeamDe }] = await Promise.all([
            import('../locales/team-en'),
            import('../locales/team-de')
        ]);

        setTeamTranslations({
            en: nextTeamEn,
            de: nextTeamDe
        });
        setTeamTranslationsReady(true);
    }, [hasTeamTranslations]);
    const loadHelpTranslations = useCallback(async () => {
        if (hasHelpTranslations) {
            setHelpTranslationsReady(true);
            return;
        }

        const [{ default: nextHelpEn }, { default: nextHelpDe }] = await Promise.all([
            import('../locales/help-en'),
            import('../locales/help-de')
        ]);

        setHelpTranslations({
            en: nextHelpEn,
            de: nextHelpDe
        });
        setHelpTranslationsReady(true);
    }, [hasHelpTranslations]);
    const loadCalendarTranslations = useCallback(async () => {
        if (hasCalendarTranslations) {
            setCalendarTranslationsReady(true);
            return;
        }

        const [{ default: nextCalendarEn }, { default: nextCalendarDe }] = await Promise.all([
            import('../locales/calendar-en'),
            import('../locales/calendar-de')
        ]);

        setCalendarTranslations({
            en: nextCalendarEn,
            de: nextCalendarDe
        });
        setCalendarTranslationsReady(true);
    }, [hasCalendarTranslations]);
    const loadAuthActionTranslations = useCallback(async () => {
        if (hasAuthActionTranslations) {
            setAuthActionTranslationsReady(true);
            return;
        }

        const [{ default: nextAuthActionEn }, { default: nextAuthActionDe }] = await Promise.all([
            import('../locales/auth-action-en'),
            import('../locales/auth-action-de')
        ]);

        setAuthActionTranslations({
            en: nextAuthActionEn,
            de: nextAuthActionDe
        });
        setAuthActionTranslationsReady(true);
    }, [hasAuthActionTranslations]);
    const loadAuthScreenTranslations = useCallback(async () => {
        if (hasAuthScreenTranslations) {
            setAuthScreenTranslationsReady(true);
            return;
        }

        const [{ default: nextAuthScreenEn }, { default: nextAuthScreenDe }] = await Promise.all([
            import('../locales/auth-screen-en'),
            import('../locales/auth-screen-de')
        ]);

        setAuthScreenTranslations({
            en: nextAuthScreenEn,
            de: nextAuthScreenDe
        });
        setAuthScreenTranslationsReady(true);
    }, [hasAuthScreenTranslations]);

    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem(storageKey);
        if (isValidLanguage(stored)) return stored;
        // Desktop app: the shell remembers the last language even when the browser profile is new.
        const desktopLanguage = getDesktopBridge()?.language;
        return isValidLanguage(desktopLanguage) ? desktopLanguage : defaultLanguage;
    });

    // Language changes in another tab / desktop window (shared localStorage) apply here too.
    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey && isValidLanguage(event.newValue)) setLanguageState(event.newValue);
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [storageKey]);
    // Without an explicit preference the date format follows the UI language (de -> dd.MM.yyyy).
    const [dateFormatPreference, setDateFormatState] = useState<DateFormat | null>(
        () => (localStorage.getItem('pf-date-format') as DateFormat) || null
    );
    const dateFormat: DateFormat = dateFormatPreference ?? (language === 'de' ? 'dd.MM.yyyy' : 'MM/dd/yyyy');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            try {
                const profile = await getUserProfile(user.uid);

                // Sync Language
                const profileLanguage = profile?.language;

                // Strict validation for profile language
                if (isValidLanguage(profileLanguage)) {
                    setLanguageState(profileLanguage);
                    localStorage.setItem(storageKey, profileLanguage);
                } else {
                    // Fallback logic
                    const stored = localStorage.getItem(storageKey);
                    if (isValidLanguage(stored) && stored !== language) {
                        // no-op, relying on local storage
                    }
                }

                // Sync Date Format
                const profileDateFormat = profile?.dateFormat as DateFormat | undefined;
                if (profileDateFormat) {
                    setDateFormatState(profileDateFormat);
                    localStorage.setItem('pf-date-format', profileDateFormat);
                }
            } catch (e) {
                console.warn('Failed to sync settings from profile', e);
            }
        });
        return () => unsubscribe();
    // Runs per sign-in only: re-subscribing on every language change re-read the profile before the new value was
    // written and flipped the language back (and, via the storage event, in every other desktop window).
    }, [storageKey, defaultLanguage]);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const t = useMemo(() => {
        return (key: string, fallback?: string) => {
            // Defensive access: ensure we have a valid translation object
            const targetLang = isValidLanguage(language) ? language : 'en';
            const currentTranslations = translations[targetLang] || translations.en;
            const currentSettingsTranslations = settingsTranslations[targetLang];
            const currentProjectOverviewTranslations = projectOverviewTranslations[targetLang];
            const currentDashboardTranslations = dashboardTranslations[targetLang];
            const currentFinanceTranslations = financeTranslations[targetLang];
            const currentProfileTranslations = profileTranslations[targetLang];
            const currentTeamTranslations = teamTranslations[targetLang];
            const currentHelpTranslations = helpTranslations[targetLang];
            const currentCalendarTranslations = calendarTranslations[targetLang];
            const currentAuthActionTranslations = authActionTranslations[targetLang];
            const currentAuthScreenTranslations = authScreenTranslations[targetLang];

            // 1. Try direct lookup (fast path for flat keys)
            if (currentTranslations && currentTranslations[key] !== undefined) {
                return currentTranslations[key];
            }
            if (currentSettingsTranslations && currentSettingsTranslations[key] !== undefined) {
                return currentSettingsTranslations[key];
            }
            if (currentProjectOverviewTranslations && currentProjectOverviewTranslations[key] !== undefined) {
                return currentProjectOverviewTranslations[key];
            }
            if (currentDashboardTranslations && currentDashboardTranslations[key] !== undefined) {
                return currentDashboardTranslations[key];
            }
            if (currentFinanceTranslations && currentFinanceTranslations[key] !== undefined) {
                return currentFinanceTranslations[key];
            }
            if (currentProfileTranslations && currentProfileTranslations[key] !== undefined) {
                return currentProfileTranslations[key];
            }
            if (currentTeamTranslations && currentTeamTranslations[key] !== undefined) {
                return currentTeamTranslations[key];
            }
            if (currentHelpTranslations && currentHelpTranslations[key] !== undefined) {
                return currentHelpTranslations[key];
            }
            if (currentCalendarTranslations && currentCalendarTranslations[key] !== undefined) {
                return currentCalendarTranslations[key];
            }
            if (currentAuthActionTranslations && currentAuthActionTranslations[key] !== undefined) {
                return currentAuthActionTranslations[key];
            }
            if (currentAuthScreenTranslations && currentAuthScreenTranslations[key] !== undefined) {
                return currentAuthScreenTranslations[key];
            }

            // 2. Try nested lookup (for structured keys)
            const parts = key.split('.');
            let value: any = currentTranslations;

            for (const part of parts) {
                if (value && typeof value === 'object' && part in value) {
                    value = value[part];
                } else {
                    value = undefined;
                    break;
                }
            }

            if (value !== undefined) return value;


            // 3. Fallback to English (Deep)
            // If we are already on English, no need to retry
            if (targetLang === 'en') {
                return fallback || key;
            }

            const englishTranslations = translations.en;
            const englishSettingsTranslations = settingsTranslations.en;
            const englishProjectOverviewTranslations = projectOverviewTranslations.en;
            const englishDashboardTranslations = dashboardTranslations.en;
            const englishFinanceTranslations = financeTranslations.en;
            const englishProfileTranslations = profileTranslations.en;
            const englishTeamTranslations = teamTranslations.en;
            const englishHelpTranslations = helpTranslations.en;
            const englishCalendarTranslations = calendarTranslations.en;
            const englishAuthActionTranslations = authActionTranslations.en;
            const englishAuthScreenTranslations = authScreenTranslations.en;
            // 3a. Direct English lookup
            if (englishTranslations[key] !== undefined) {
                return englishTranslations[key];
            }
            if (englishSettingsTranslations && englishSettingsTranslations[key] !== undefined) {
                return englishSettingsTranslations[key];
            }
            if (englishProjectOverviewTranslations && englishProjectOverviewTranslations[key] !== undefined) {
                return englishProjectOverviewTranslations[key];
            }
            if (englishDashboardTranslations && englishDashboardTranslations[key] !== undefined) {
                return englishDashboardTranslations[key];
            }
            if (englishFinanceTranslations && englishFinanceTranslations[key] !== undefined) {
                return englishFinanceTranslations[key];
            }
            if (englishProfileTranslations && englishProfileTranslations[key] !== undefined) {
                return englishProfileTranslations[key];
            }
            if (englishTeamTranslations && englishTeamTranslations[key] !== undefined) {
                return englishTeamTranslations[key];
            }
            if (englishHelpTranslations && englishHelpTranslations[key] !== undefined) {
                return englishHelpTranslations[key];
            }
            if (englishCalendarTranslations && englishCalendarTranslations[key] !== undefined) {
                return englishCalendarTranslations[key];
            }
            if (englishAuthActionTranslations && englishAuthActionTranslations[key] !== undefined) {
                return englishAuthActionTranslations[key];
            }
            if (englishAuthScreenTranslations && englishAuthScreenTranslations[key] !== undefined) {
                return englishAuthScreenTranslations[key];
            }

            // 3b. Nested English lookup
            value = englishTranslations;
            for (const part of parts) {
                if (value && typeof value === 'object' && part in value) {
                    value = value[part];
                } else {
                    value = undefined;
                    break;
                }
            }

            if (value !== undefined) return value;


            return value !== undefined ? value : (fallback || key);
        };
    }, [authActionTranslations, authScreenTranslations, calendarTranslations, dashboardTranslations, financeTranslations, helpTranslations, language, profileTranslations, projectOverviewTranslations, settingsTranslations, teamTranslations, translations]);

    const setLanguage = (nextLanguage: Language) => {
        localStorage.setItem(storageKey, nextLanguage);
        setLanguageState(nextLanguage);
        if (auth.currentUser) {
            updateUserData(auth.currentUser.uid, { language: nextLanguage }).catch(err =>
                console.error('Failed to sync language to profile', err)
            );
        }
    };

    const setDateFormat = (nextFormat: DateFormat) => {
        localStorage.setItem('pf-date-format', nextFormat);
        setDateFormatState(nextFormat);
        if (auth.currentUser) {
            updateUserData(auth.currentUser.uid, { dateFormat: nextFormat }).catch(err =>
                console.error('Failed to sync date format to profile', err)
            );
        }
    };

    const dateLocale = language === 'de' ? deLocale : enUS;

    return (
        <LanguageProviderContext.Provider
            value={{
                language,
                setLanguage,
                dateFormat,
                setDateFormat,
                t,
                dateLocale,
                settingsTranslationsReady,
                loadSettingsTranslations,
                projectOverviewTranslationsReady,
                loadProjectOverviewTranslations,
                dashboardTranslationsReady,
                loadDashboardTranslations,
                financeTranslationsReady,
                loadFinanceTranslations,
                profileTranslationsReady,
                loadProfileTranslations,
                teamTranslationsReady,
                loadTeamTranslations,
                helpTranslationsReady,
                loadHelpTranslations,
                calendarTranslationsReady,
                loadCalendarTranslations,
                authActionTranslationsReady,
                loadAuthActionTranslations,
                authScreenTranslationsReady,
                loadAuthScreenTranslations,
            }}
        >
            {children}
        </LanguageProviderContext.Provider>
    );
}

export const useLanguage = () => {
    const context = useContext(LanguageProviderContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
