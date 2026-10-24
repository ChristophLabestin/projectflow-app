export type Lang = 'de' | 'en';
export type PageKind = 'home' | 'imprint' | 'privacy' | 'terms' | 'docsMcp' | 'buy' | 'waitlist' | 'confirm' | 'notFound';

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
/** Public MCP endpoint. Switch to https://mcp.getprojectflow.com/mcp once that domain is live. */
export const MCP_URL = 'https://app.getprojectflow.com/mcp';

/**
 * Legal texts live only in the app (versioned in Firestore, published under /admin/legal).
 * 'app-link': footer links go to app.getprojectflow.com/legal/<type> (fallback until the API is live).
 * 'api': the landing renders /impressum etc. itself from GET /api/legal/<type>?lang=… at runtime.
 */
export const LEGAL_SOURCE = 'api' as 'app-link' | 'api';
export type LegalKind = 'imprint' | 'privacy' | 'terms';
export const legalApiUrl = (kind: LegalKind, lang: Lang) => `${APP_URL}/api/legal/${kind}?lang=${lang}`;
export const legalAppUrl = (kind: LegalKind) => `${APP_URL}/legal/${kind}`;

const allPages: PageDef[] = [
    { kind: 'home', lang: 'de', url: '/', file: 'index.html' },
    { kind: 'home', lang: 'en', url: '/en', file: 'en/index.html' },
    { kind: 'imprint', lang: 'de', url: '/impressum', file: 'impressum/index.html' },
    { kind: 'imprint', lang: 'en', url: '/en/imprint', file: 'en/imprint/index.html' },
    { kind: 'privacy', lang: 'de', url: '/datenschutz', file: 'datenschutz/index.html' },
    { kind: 'privacy', lang: 'en', url: '/en/privacy', file: 'en/privacy/index.html' },
    { kind: 'terms', lang: 'de', url: '/agb', file: 'agb/index.html' },
    { kind: 'terms', lang: 'en', url: '/en/terms', file: 'en/terms/index.html' },
    { kind: 'docsMcp', lang: 'de', url: '/docs/mcp', file: 'docs/mcp/index.html' },
    { kind: 'docsMcp', lang: 'en', url: '/en/docs/mcp', file: 'en/docs/mcp/index.html' },
    { kind: 'buy', lang: 'de', url: '/checkout', file: 'checkout/index.html' },
    { kind: 'buy', lang: 'en', url: '/en/checkout', file: 'en/checkout/index.html' },
    { kind: 'waitlist', lang: 'de', url: '/warteliste', file: 'warteliste/index.html' },
    { kind: 'waitlist', lang: 'en', url: '/en/waitlist', file: 'en/waitlist/index.html' },
    { kind: 'confirm', lang: 'de', url: '/bestaetigen', file: 'bestaetigen/index.html' },
    { kind: 'confirm', lang: 'en', url: '/en/confirm', file: 'en/confirm/index.html' },
    { kind: 'notFound', lang: 'de', url: '/404', file: '404.html' },
];

export const pages: PageDef[] = allPages.filter(
    (p) => LEGAL_SOURCE === 'api' || !['imprint', 'privacy', 'terms'].includes(p.kind),
);

export const urlFor = (kind: PageKind, lang: Lang): string =>
    pages.find((p) => p.kind === kind && p.lang === lang)?.url
    ?? pages.find((p) => p.kind === 'home' && p.lang === lang)!.url;

export const legalUrl = (kind: LegalKind, lang: Lang): string =>
    LEGAL_SOURCE === 'api' ? urlFor(kind, lang) : legalAppUrl(kind);
