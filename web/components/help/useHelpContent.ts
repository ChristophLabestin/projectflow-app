import { useEffect, useState } from 'react';
import { useLanguage, type Language } from '../../context/LanguageContext';
import type { HelpContent } from './helpTypes';

// Each language is its own lazy chunk (`help-content-<lang>` in vite.config.ts); loaded once per session.
const loaders: Record<Language, () => Promise<{ default: HelpContent }>> = {
    en: () => import('../../locales/help/articles-en'),
    de: () => import('../../locales/help/articles-de')
};
const cache: Partial<Record<Language, HelpContent>> = {};
const pending: Partial<Record<Language, Promise<HelpContent>>> = {};

export const loadHelpContent = (language: Language): Promise<HelpContent> => {
    if (cache[language]) return Promise.resolve(cache[language]!);
    if (!pending[language]) {
        pending[language] = loaders[language]().then(module => {
            cache[language] = module.default;
            return module.default;
        });
    }
    return pending[language]!;
};

/** Help content for the active language; `null` until loaded. Pass `enabled: false` to defer the fetch. */
export const useHelpContent = (enabled = true): HelpContent | null => {
    const { language } = useLanguage();
    const [content, setContent] = useState<HelpContent | null>(() => cache[language] ?? null);

    useEffect(() => {
        if (!enabled) return;
        let active = true;
        setContent(cache[language] ?? null);
        void loadHelpContent(language).then(next => {
            if (active) setContent(next);
        });
        return () => {
            active = false;
        };
    }, [enabled, language]);

    return enabled ? content : null;
};
