import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import wikiEn from '../../locales/wiki-en';
import wikiDe from '../../locales/wiki-de';
import type { WikiT } from './editor/host';

/** Wiki strings live in locales/wiki-{en,de}.ts and ship with the lazy wiki chunk. */
export const translateWiki = (language: string, key: string, params?: Record<string, string | number>, fallback?: (key: string) => string) => {
    const table: Record<string, string> = language === 'de' ? wikiDe : wikiEn;
    let value = table[key] ?? (wikiEn as Record<string, string>)[key] ?? fallback?.(key) ?? key;
    if (params) Object.entries(params).forEach(([name, replacement]) => { value = value.split(`{${name}}`).join(String(replacement)); });
    return value;
};

export const useWikiT = (): WikiT => {
    const { language, t } = useLanguage();
    return React.useCallback(
        (key: string, params?: Record<string, string | number>) => translateWiki(language, key, params, (k) => t(k)),
        [language, t],
    );
};
