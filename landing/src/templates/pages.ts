export type Lang = 'de' | 'en';
export type PageKind = 'home' | 'imprint' | 'privacy' | 'terms' | 'notFound';

export interface PageDef {
    kind: PageKind;
    lang: Lang;
    /** Public URL (Firebase Hosting cleanUrls). */
    url: string;
    /** Output file relative to landing/. */
    file: string;
}

export const SITE_URL = 'https://getprojectflow.com';
export const APP_URL = 'https://app.getprojectflow.com';

export const pages: PageDef[] = [
    { kind: 'home', lang: 'de', url: '/', file: 'index.html' },
    { kind: 'home', lang: 'en', url: '/en', file: 'en/index.html' },
    { kind: 'imprint', lang: 'de', url: '/impressum', file: 'impressum/index.html' },
    { kind: 'imprint', lang: 'en', url: '/en/imprint', file: 'en/imprint/index.html' },
    { kind: 'privacy', lang: 'de', url: '/datenschutz', file: 'datenschutz/index.html' },
    { kind: 'privacy', lang: 'en', url: '/en/privacy', file: 'en/privacy/index.html' },
    { kind: 'terms', lang: 'de', url: '/agb', file: 'agb/index.html' },
    { kind: 'terms', lang: 'en', url: '/en/terms', file: 'en/terms/index.html' },
    { kind: 'notFound', lang: 'de', url: '/404', file: '404.html' },
];

export const urlFor = (kind: PageKind, lang: Lang): string =>
    pages.find((p) => p.kind === kind && p.lang === lang)?.url
    ?? pages.find((p) => p.kind === 'home' && p.lang === lang)!.url;
