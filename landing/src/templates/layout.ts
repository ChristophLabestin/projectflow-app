import { site, type SiteCopy } from '../content/site';
import { icon, logo } from './icons';
import { APP_URL, SITE_URL, legalUrl, urlFor, type Lang, type PageDef } from './pages';

export const esc = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Display headings: Plus Jakarta's period has a wide left side bearing – pull it in. */
export const headline = (value: string): string => esc(value).replace(/([.!?])(?=\s|$)/g, '<span class="kern">$1</span>');

export const links = {
    register: `${APP_URL}/register`,
    login: `${APP_URL}/login`,
    download: `${APP_URL}/download`,
    app: APP_URL,
};

interface LayoutOptions {
    page: PageDef;
    title: string;
    description: string;
    body: string;
    scripts: string[];
    bodyClass?: string;
    noindex?: boolean;
}

const otherLang = (lang: Lang): Lang => (lang === 'de' ? 'en' : 'de');

/** Counterpart of the current page in the other language. */
const alternateOf = (page: PageDef, lang: Lang): string =>
    page.kind === 'notFound' ? urlFor('home', lang) : urlFor(page.kind, lang);

const structuredData = (t: SiteCopy, lang: Lang): string => JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Organization',
            '@id': `${SITE_URL}/#org`,
            name: 'ProjectFlow',
            url: SITE_URL,
            logo: `${SITE_URL}/icon-512.png`,
        },
        {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            url: SITE_URL,
            name: 'ProjectFlow',
            inLanguage: lang,
            publisher: { '@id': `${SITE_URL}/#org` },
        },
        {
            '@type': 'SoftwareApplication',
            name: 'ProjectFlow',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web, macOS, Windows, iOS',
            url: SITE_URL + urlFor('home', lang),
            description: t.meta.description,
            publisher: { '@id': `${SITE_URL}/#org` },
        },
    ],
});

const header = (page: PageDef, t: SiteCopy): string => {
    const home = urlFor('home', page.lang);
    const anchor = (id: string) => (page.kind === 'home' ? `#${id}` : `${home === '/' ? '' : home}/#${id}`);
    const other = otherLang(page.lang);
    const navItems = [
        ['features', t.nav.product],
        ['platforms', t.nav.platforms],
        ['security', t.nav.security],
    ];
    const docsUrl = urlFor('docsMcp', page.lang);
    const navList = navItems.map(([id, label]) => `<li><a href="${anchor(id)}">${esc(label)}</a></li>`).join('')
        + `<li><a href="${docsUrl}"${page.kind === 'docsMcp' ? ' aria-current="page"' : ''}>${esc(t.nav.docs)}</a></li>`;
    const langLink = `<a class="lang-switch" href="${alternateOf(page, other)}" hreflang="${other}" lang="${other}" aria-label="${other === 'en' ? 'English' : 'Deutsch'}" data-lang="${other}">${other.toUpperCase()}</a>`;
    return `
<header class="site-header" data-header>
    <div class="container site-header__inner">
        <a class="brand" href="${home}" aria-label="${esc(t.a11y.home)}">${logo('brand__logo')}<span class="brand__name">ProjectFlow</span></a>
        <nav class="site-nav" aria-label="${esc(t.a11y.nav)}"><ul>${navList}</ul></nav>
        <div class="site-header__actions">
            ${langLink}
            <a class="btn btn--quiet btn--sm hide-sm" href="${links.login}">${esc(t.nav.login)}</a>
            <a class="btn btn--primary btn--sm hide-xs" href="${links.register}" data-magnetic>${esc(t.nav.start)}</a>
            <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle>
                <span class="sr-only" data-label-open="${esc(t.a11y.menu)}" data-label-close="${esc(t.a11y.close)}">${esc(t.a11y.menu)}</span>
                ${icon('menu', 'menu-toggle__open')}${icon('close', 'menu-toggle__close')}
            </button>
        </div>
    </div>
    <div class="mobile-menu" id="mobile-menu" hidden data-menu>
        <ul>${navList}</ul>
        <div class="mobile-menu__actions">
            <a class="btn btn--ghost" href="${links.login}">${esc(t.nav.login)}</a>
            <a class="btn btn--primary" href="${links.register}">${esc(t.nav.start)}</a>
        </div>
    </div>
</header>`;
};

const footer = (page: PageDef, t: SiteCopy): string => {
    const home = urlFor('home', page.lang);
    const base = page.kind === 'home' ? '' : home === '/' ? '' : home;
    const f = t.footer.links;
    const other = otherLang(page.lang);
    const col = (title: string, items: [string, string][]) => `
        <div class="site-footer__col">
            <h2 class="site-footer__title">${esc(title)}</h2>
            <ul>${items.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join('')}</ul>
        </div>`;
    return `
<footer class="site-footer">
    <div class="container site-footer__inner">
        <div class="site-footer__brand">
            <a class="brand" href="${home}" aria-label="${esc(t.a11y.home)}">${logo('brand__logo')}<span class="brand__name">ProjectFlow</span></a>
            <p>${esc(t.footer.tagline)}</p>
        </div>
        ${col(t.footer.product, [[`${base}/#flow`, f.flow], [`${base}/#features`, f.features], [`${base}/#security`, f.security], [`${base}/#faq`, f.faq], [urlFor('docsMcp', page.lang), f.docs]])}
        ${col(t.footer.platforms, [[links.app, f.web], [links.download, f.desktop], [`${base}/#platforms`, f.ios]])}
        ${col(t.footer.legal, [[legalUrl('imprint', page.lang), f.imprint], [legalUrl('privacy', page.lang), f.privacy], [legalUrl('terms', page.lang), f.terms]])}
    </div>
    <div class="container site-footer__bottom">
        <p>© ${new Date().getFullYear()} ProjectFlow. ${esc(t.footer.rights)} ${esc(t.footer.madeIn)}</p>
        <a class="lang-switch lang-switch--text" href="${alternateOf(page, other)}" hreflang="${other}" lang="${other}" data-lang="${other}">${icon('globe')}${other === 'en' ? 'English' : 'Deutsch'}</a>
    </div>
</footer>`;
};

export function layout({ page, title, description, body, scripts, bodyClass = '', noindex = false }: LayoutOptions): string {
    const t = site[page.lang];
    const canonical = SITE_URL + (page.url === '/' ? '/' : page.url);
    const alternates = page.kind === 'notFound'
        ? ''
        : (['de', 'en'] as Lang[]).map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}${alternateOf(page, l)}">`).join('\n    ')
            + `\n    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${alternateOf(page, 'de')}">`;
    const ogImage = `${SITE_URL}/og-${page.lang}.png`;
    return `<!doctype html>
<html lang="${page.lang}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    ${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}
    ${alternates}
    <meta name="theme-color" content="#f2f2f3">
    <meta name="color-scheme" content="light">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="preload" href="/fonts/pjs-latin.woff2" as="font" type="font/woff2" crossorigin>
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="ProjectFlow">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:locale" content="${page.lang === 'de' ? 'de_DE' : 'en_US'}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${esc(t.meta.ogAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <script>document.documentElement.classList.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion');</script>
    ${page.kind === 'home' ? `<script type="application/ld+json">${structuredData(t, page.lang)}</script>` : ''}
    ${scripts.map((src) => `<script type="module" src="${src}"></script>`).join('\n    ')}
</head>
<body class="${bodyClass}">
    <a class="skip-link" href="#main">${esc(t.a11y.skip)}</a>
    ${header(page, t)}
    <main id="main" tabindex="-1">
${body}
    </main>
    ${footer(page, t)}
</body>
</html>
`;
}

