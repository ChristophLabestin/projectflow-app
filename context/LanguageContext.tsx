import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile, updateUserData } from '../services/dataService';
import en from '../locales/en';
import de from '../locales/de';
import { enUS, de as deLocale } from 'date-fns/locale';
import { Locale } from 'date-fns';

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
    t: (key: string, fallback?: string) => string;
    dateLocale: Locale;
}

const translations: Record<Language, Record<string, string>> = {
    en,
    de,
};

const initialState: LanguageProviderState = {
    language: 'en',
    setLanguage: () => null,
    dateFormat: 'MM/dd/yyyy',
    setDateFormat: () => null,
    t: (key: string, fallback?: string) => fallback || key,
    dateLocale: enUS,
};

const LanguageProviderContext = createContext<LanguageProviderState>(initialState);

export function LanguageProvider({
    children,
    defaultLanguage = 'en',
    storageKey = 'pf-language',
}: LanguageProviderProps) {
    const [language, setLanguageState] = useState<Language>(
        () => (localStorage.getItem(storageKey) as Language) || defaultLanguage
    );
    const [dateFormat, setDateFormatState] = useState<DateFormat>(
        () => (localStorage.getItem('pf-date-format') as DateFormat) || 'MM/dd/yyyy'
    );

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            try {
                const profile = await getUserProfile(user.uid);

                // Sync Language
                const profileLanguage = profile?.language as Language | undefined;
                const storedLanguage = (localStorage.getItem(storageKey) as Language) || defaultLanguage;
                const normalizedStoredLanguage = (storedLanguage === 'en' || storedLanguage === 'de') ? storedLanguage : defaultLanguage;
                if (profileLanguage === 'en' || profileLanguage === 'de') {
                    setLanguageState(profileLanguage);
                    localStorage.setItem(storageKey, profileLanguage);
                } else if (normalizedStoredLanguage) {
                    updateUserData(user.uid, { language: normalizedStoredLanguage }).catch(err =>
                        console.error('Failed to sync language to profile', err)
                    );
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
    }, [storageKey, defaultLanguage]);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const t = useMemo(() => {
        return (key: string, fallback?: string) => {
            const translated = translations[language]?.[key];
            if (translated) return translated;
            const english = translations.en?.[key];
            return english || fallback || key;
        };
    }, [language]);

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
        <LanguageProviderContext.Provider value={{ language, setLanguage, dateFormat, setDateFormat, t, dateLocale }}>
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
