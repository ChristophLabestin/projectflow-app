import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import en from '../locales/en';
import de from '../locales/de';
import { enUS, de as deLocale } from 'date-fns/locale';
import { Locale } from 'date-fns';
import { getUserProfile, updateUserData } from '../services/domain/usersService';

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
    legalTranslationsReady: boolean;
    loadLegalTranslations: () => Promise<void>;
    flowStageTranslationsReady: boolean;
    loadFlowStageTranslations: () => Promise<void>;
    socialTranslationsReady: boolean;
    loadSocialTranslations: () => Promise<void>;
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
    taskPageTranslationsReady: boolean;
    loadTaskPageTranslations: () => Promise<void>;
    calendarTranslationsReady: boolean;
    loadCalendarTranslations: () => Promise<void>;
    inviteLandingTranslationsReady: boolean;
    loadInviteLandingTranslations: () => Promise<void>;
    authActionTranslationsReady: boolean;
    loadAuthActionTranslations: () => Promise<void>;
    authScreenTranslationsReady: boolean;
    loadAuthScreenTranslations: () => Promise<void>;
    projectInviteTranslationsReady: boolean;
    loadProjectInviteTranslations: () => Promise<void>;
    joinLinkTranslationsReady: boolean;
    loadJoinLinkTranslations: () => Promise<void>;
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
    legalTranslationsReady: true,
    loadLegalTranslations: async () => undefined,
    flowStageTranslationsReady: true,
    loadFlowStageTranslations: async () => undefined,
    socialTranslationsReady: true,
    loadSocialTranslations: async () => undefined,
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
    taskPageTranslationsReady: true,
    loadTaskPageTranslations: async () => undefined,
    calendarTranslationsReady: true,
    loadCalendarTranslations: async () => undefined,
    inviteLandingTranslationsReady: true,
    loadInviteLandingTranslations: async () => undefined,
    authActionTranslationsReady: true,
    loadAuthActionTranslations: async () => undefined,
    authScreenTranslationsReady: true,
    loadAuthScreenTranslations: async () => undefined,
    projectInviteTranslationsReady: true,
    loadProjectInviteTranslations: async () => undefined,
    joinLinkTranslationsReady: true,
    loadJoinLinkTranslations: async () => undefined,
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
    const [legalTranslations, setLegalTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [flowStageTranslations, setFlowStageTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [socialTranslations, setSocialTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [settingsTranslations, setSettingsTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [projectOverviewTranslations, setProjectOverviewTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [dashboardTranslations, setDashboardTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [financeTranslations, setFinanceTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [profileTranslations, setProfileTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [teamTranslations, setTeamTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [taskPageTranslations, setTaskPageTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [calendarTranslations, setCalendarTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [inviteLandingTranslations, setInviteLandingTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [authActionTranslations, setAuthActionTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [authScreenTranslations, setAuthScreenTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [projectInviteTranslations, setProjectInviteTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [joinLinkTranslations, setJoinLinkTranslations] = useState<Partial<Record<Language, Record<string, any>>>>({});
    const [legalTranslationsReady, setLegalTranslationsReady] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return false;
        }
        return !window.location.pathname.startsWith('/legal');
    });
    const [flowStageTranslationsReady, setFlowStageTranslationsReady] = useState<boolean>(false);

    const hasLegalTranslations = Boolean(legalTranslations.en && legalTranslations.de);
    const hasFlowStageTranslations = Boolean(flowStageTranslations.en && flowStageTranslations.de);
    const hasSocialTranslations = Boolean(socialTranslations.en && socialTranslations.de);
    const hasSettingsTranslations = Boolean(settingsTranslations.en && settingsTranslations.de);
    const hasProjectOverviewTranslations = Boolean(projectOverviewTranslations.en && projectOverviewTranslations.de);
    const hasDashboardTranslations = Boolean(dashboardTranslations.en && dashboardTranslations.de);
    const hasFinanceTranslations = Boolean(financeTranslations.en && financeTranslations.de);
    const hasProfileTranslations = Boolean(profileTranslations.en && profileTranslations.de);
    const hasTeamTranslations = Boolean(teamTranslations.en && teamTranslations.de);
    const hasTaskPageTranslations = Boolean(taskPageTranslations.en && taskPageTranslations.de);
    const hasCalendarTranslations = Boolean(calendarTranslations.en && calendarTranslations.de);
    const hasInviteLandingTranslations = Boolean(inviteLandingTranslations.en && inviteLandingTranslations.de);
    const hasAuthActionTranslations = Boolean(authActionTranslations.en && authActionTranslations.de);
    const hasAuthScreenTranslations = Boolean(authScreenTranslations.en && authScreenTranslations.de);
    const hasProjectInviteTranslations = Boolean(projectInviteTranslations.en && projectInviteTranslations.de);
    const hasJoinLinkTranslations = Boolean(joinLinkTranslations.en && joinLinkTranslations.de);
    const loadLegalTranslations = useCallback(async () => {
        if (hasLegalTranslations) {
            setLegalTranslationsReady(true);
            return;
        }

        const [{ en: nextLegalEn }, { de: nextLegalDe }] = await Promise.all([
            import('../locales/legal-en'),
            import('../locales/legal-de')
        ]);

        setLegalTranslations({
            en: nextLegalEn,
            de: nextLegalDe
        });
        setLegalTranslationsReady(true);
    }, [hasLegalTranslations]);
    const loadFlowStageTranslations = useCallback(async () => {
        if (hasFlowStageTranslations) {
            setFlowStageTranslationsReady(true);
            return;
        }

        const [{ default: nextFlowStagesEn }, { default: nextFlowStagesDe }] = await Promise.all([
            import('../locales/flow-stages-en'),
            import('../locales/flow-stages-de')
        ]);

        setFlowStageTranslations({
            en: nextFlowStagesEn,
            de: nextFlowStagesDe
        });
        setFlowStageTranslationsReady(true);
    }, [hasFlowStageTranslations]);
    const [socialTranslationsReady, setSocialTranslationsReady] = useState<boolean>(false);
    const [settingsTranslationsReady, setSettingsTranslationsReady] = useState<boolean>(false);
    const [projectOverviewTranslationsReady, setProjectOverviewTranslationsReady] = useState<boolean>(false);
    const [dashboardTranslationsReady, setDashboardTranslationsReady] = useState<boolean>(false);
    const [financeTranslationsReady, setFinanceTranslationsReady] = useState<boolean>(false);
    const [profileTranslationsReady, setProfileTranslationsReady] = useState<boolean>(false);
    const [teamTranslationsReady, setTeamTranslationsReady] = useState<boolean>(false);
    const [taskPageTranslationsReady, setTaskPageTranslationsReady] = useState<boolean>(false);
    const [calendarTranslationsReady, setCalendarTranslationsReady] = useState<boolean>(false);
    const [inviteLandingTranslationsReady, setInviteLandingTranslationsReady] = useState<boolean>(false);
    const [authActionTranslationsReady, setAuthActionTranslationsReady] = useState<boolean>(false);
    const [authScreenTranslationsReady, setAuthScreenTranslationsReady] = useState<boolean>(false);
    const [projectInviteTranslationsReady, setProjectInviteTranslationsReady] = useState<boolean>(false);
    const [joinLinkTranslationsReady, setJoinLinkTranslationsReady] = useState<boolean>(false);
    const loadSocialTranslations = useCallback(async () => {
        if (hasSocialTranslations) {
            setSocialTranslationsReady(true);
            return;
        }

        const [{ default: nextSocialEn }, { default: nextSocialDe }] = await Promise.all([
            import('../locales/social-en'),
            import('../locales/social-de')
        ]);

        setSocialTranslations({
            en: nextSocialEn,
            de: nextSocialDe
        });
        setSocialTranslationsReady(true);
    }, [hasSocialTranslations]);
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
    const loadTaskPageTranslations = useCallback(async () => {
        if (hasTaskPageTranslations) {
            setTaskPageTranslationsReady(true);
            return;
        }

        const [{ default: nextTasksPageEn }, { default: nextTasksPageDe }] = await Promise.all([
            import('../locales/tasks-page-en'),
            import('../locales/tasks-page-de')
        ]);

        setTaskPageTranslations({
            en: nextTasksPageEn,
            de: nextTasksPageDe
        });
        setTaskPageTranslationsReady(true);
    }, [hasTaskPageTranslations]);
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
    const loadInviteLandingTranslations = useCallback(async () => {
        if (hasInviteLandingTranslations) {
            setInviteLandingTranslationsReady(true);
            return;
        }

        const [{ default: nextInviteLandingEn }, { default: nextInviteLandingDe }] = await Promise.all([
            import('../locales/invite-landing-en'),
            import('../locales/invite-landing-de')
        ]);

        setInviteLandingTranslations({
            en: nextInviteLandingEn,
            de: nextInviteLandingDe
        });
        setInviteLandingTranslationsReady(true);
    }, [hasInviteLandingTranslations]);
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
    const loadProjectInviteTranslations = useCallback(async () => {
        if (hasProjectInviteTranslations) {
            setProjectInviteTranslationsReady(true);
            return;
        }

        const [{ default: nextProjectInviteEn }, { default: nextProjectInviteDe }] = await Promise.all([
            import('../locales/project-invite-en'),
            import('../locales/project-invite-de')
        ]);

        setProjectInviteTranslations({
            en: nextProjectInviteEn,
            de: nextProjectInviteDe
        });
        setProjectInviteTranslationsReady(true);
    }, [hasProjectInviteTranslations]);
    const loadJoinLinkTranslations = useCallback(async () => {
        if (hasJoinLinkTranslations) {
            setJoinLinkTranslationsReady(true);
            return;
        }

        const [{ default: nextJoinLinkEn }, { default: nextJoinLinkDe }] = await Promise.all([
            import('../locales/join-link-en'),
            import('../locales/join-link-de')
        ]);

        setJoinLinkTranslations({
            en: nextJoinLinkEn,
            de: nextJoinLinkDe
        });
        setJoinLinkTranslationsReady(true);
    }, [hasJoinLinkTranslations]);

    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem(storageKey);
        return isValidLanguage(stored) ? stored : defaultLanguage;
    });
    const [dateFormat, setDateFormatState] = useState<DateFormat>(
        () => (localStorage.getItem('pf-date-format') as DateFormat) || 'MM/dd/yyyy'
    );

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
    }, [storageKey, defaultLanguage, language]); // Added 'language' to deps to avoid stale closure if valid fallback logic needed, though less critical here

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const t = useMemo(() => {
        return (key: string, fallback?: string) => {
            // Defensive access: ensure we have a valid translation object
            const targetLang = isValidLanguage(language) ? language : 'en';
            const currentTranslations = translations[targetLang] || translations.en;
            const currentLegalTranslations = legalTranslations[targetLang];
            const currentFlowStageTranslations = flowStageTranslations[targetLang];
            const currentSocialTranslations = socialTranslations[targetLang];
            const currentSettingsTranslations = settingsTranslations[targetLang];
            const currentProjectOverviewTranslations = projectOverviewTranslations[targetLang];
            const currentDashboardTranslations = dashboardTranslations[targetLang];
            const currentFinanceTranslations = financeTranslations[targetLang];
            const currentProfileTranslations = profileTranslations[targetLang];
            const currentTeamTranslations = teamTranslations[targetLang];
            const currentTaskPageTranslations = taskPageTranslations[targetLang];
            const currentCalendarTranslations = calendarTranslations[targetLang];
            const currentInviteLandingTranslations = inviteLandingTranslations[targetLang];
            const currentAuthActionTranslations = authActionTranslations[targetLang];
            const currentAuthScreenTranslations = authScreenTranslations[targetLang];
            const currentProjectInviteTranslations = projectInviteTranslations[targetLang];
            const currentJoinLinkTranslations = joinLinkTranslations[targetLang];

            // 1. Try direct lookup (fast path for flat keys)
            if (currentTranslations && currentTranslations[key] !== undefined) {
                return currentTranslations[key];
            }
            if (currentLegalTranslations && currentLegalTranslations[key] !== undefined) {
                return currentLegalTranslations[key];
            }
            if (currentFlowStageTranslations && currentFlowStageTranslations[key] !== undefined) {
                return currentFlowStageTranslations[key];
            }
            if (currentSocialTranslations && currentSocialTranslations[key] !== undefined) {
                return currentSocialTranslations[key];
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
            if (currentTaskPageTranslations && currentTaskPageTranslations[key] !== undefined) {
                return currentTaskPageTranslations[key];
            }
            if (currentCalendarTranslations && currentCalendarTranslations[key] !== undefined) {
                return currentCalendarTranslations[key];
            }
            if (currentInviteLandingTranslations && currentInviteLandingTranslations[key] !== undefined) {
                return currentInviteLandingTranslations[key];
            }
            if (currentAuthActionTranslations && currentAuthActionTranslations[key] !== undefined) {
                return currentAuthActionTranslations[key];
            }
            if (currentAuthScreenTranslations && currentAuthScreenTranslations[key] !== undefined) {
                return currentAuthScreenTranslations[key];
            }
            if (currentProjectInviteTranslations && currentProjectInviteTranslations[key] !== undefined) {
                return currentProjectInviteTranslations[key];
            }
            if (currentJoinLinkTranslations && currentJoinLinkTranslations[key] !== undefined) {
                return currentJoinLinkTranslations[key];
            }

            // 2. Try nested lookup (for structured legal keys)
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

            if (currentLegalTranslations) {
                value = currentLegalTranslations;
                for (const part of parts) {
                    if (value && typeof value === 'object' && part in value) {
                        value = value[part];
                    } else {
                        value = undefined;
                        break;
                    }
                }

                if (value !== undefined) return value;
            }

            // 3. Fallback to English (Deep)
            // If we are already on English, no need to retry
            if (targetLang === 'en') {
                return fallback || key;
            }

            const englishTranslations = translations.en;
            const englishLegalTranslations = legalTranslations.en;
            const englishFlowStageTranslations = flowStageTranslations.en;
            const englishSocialTranslations = socialTranslations.en;
            const englishSettingsTranslations = settingsTranslations.en;
            const englishProjectOverviewTranslations = projectOverviewTranslations.en;
            const englishDashboardTranslations = dashboardTranslations.en;
            const englishFinanceTranslations = financeTranslations.en;
            const englishProfileTranslations = profileTranslations.en;
            const englishTeamTranslations = teamTranslations.en;
            const englishTaskPageTranslations = taskPageTranslations.en;
            const englishCalendarTranslations = calendarTranslations.en;
            const englishInviteLandingTranslations = inviteLandingTranslations.en;
            const englishAuthActionTranslations = authActionTranslations.en;
            const englishAuthScreenTranslations = authScreenTranslations.en;
            const englishProjectInviteTranslations = projectInviteTranslations.en;
            const englishJoinLinkTranslations = joinLinkTranslations.en;
            // 3a. Direct English lookup
            if (englishTranslations[key] !== undefined) {
                return englishTranslations[key];
            }
            if (englishLegalTranslations && englishLegalTranslations[key] !== undefined) {
                return englishLegalTranslations[key];
            }
            if (englishFlowStageTranslations && englishFlowStageTranslations[key] !== undefined) {
                return englishFlowStageTranslations[key];
            }
            if (englishSocialTranslations && englishSocialTranslations[key] !== undefined) {
                return englishSocialTranslations[key];
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
            if (englishTaskPageTranslations && englishTaskPageTranslations[key] !== undefined) {
                return englishTaskPageTranslations[key];
            }
            if (englishCalendarTranslations && englishCalendarTranslations[key] !== undefined) {
                return englishCalendarTranslations[key];
            }
            if (englishInviteLandingTranslations && englishInviteLandingTranslations[key] !== undefined) {
                return englishInviteLandingTranslations[key];
            }
            if (englishAuthActionTranslations && englishAuthActionTranslations[key] !== undefined) {
                return englishAuthActionTranslations[key];
            }
            if (englishAuthScreenTranslations && englishAuthScreenTranslations[key] !== undefined) {
                return englishAuthScreenTranslations[key];
            }
            if (englishProjectInviteTranslations && englishProjectInviteTranslations[key] !== undefined) {
                return englishProjectInviteTranslations[key];
            }
            if (englishJoinLinkTranslations && englishJoinLinkTranslations[key] !== undefined) {
                return englishJoinLinkTranslations[key];
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

            if (englishLegalTranslations) {
                value = englishLegalTranslations;
                for (const part of parts) {
                    if (value && typeof value === 'object' && part in value) {
                        value = value[part];
                    } else {
                        value = undefined;
                        break;
                    }
                }
            }

            return value !== undefined ? value : (fallback || key);
        };
    }, [authActionTranslations, authScreenTranslations, calendarTranslations, dashboardTranslations, financeTranslations, flowStageTranslations, joinLinkTranslations, language, legalTranslations, profileTranslations, projectInviteTranslations, projectOverviewTranslations, settingsTranslations, socialTranslations, taskPageTranslations, teamTranslations, translations]);

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
                legalTranslationsReady,
                loadLegalTranslations,
                flowStageTranslationsReady,
                loadFlowStageTranslations,
                socialTranslationsReady,
                loadSocialTranslations,
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
                taskPageTranslationsReady,
                loadTaskPageTranslations,
                calendarTranslationsReady,
                loadCalendarTranslations,
                inviteLandingTranslationsReady,
                loadInviteLandingTranslations,
                authActionTranslationsReady,
                loadAuthActionTranslations,
                authScreenTranslationsReady,
                loadAuthScreenTranslations,
                projectInviteTranslationsReady,
                loadProjectInviteTranslations,
                joinLinkTranslationsReady,
                loadJoinLinkTranslations
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
