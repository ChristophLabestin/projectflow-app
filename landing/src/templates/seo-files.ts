import { site } from '../content/site';
import { APP_URL, MCP_URL, SITE_URL, pages, urlFor, type PageDef } from './pages';

/**
 * Files generated at build time from the page list and the site copy, so they never drift:
 * sitemap.xml (indexable pages with hreflang) and llms.txt (https://llmstxt.org – a Markdown map for LLMs).
 */
const INDEXABLE: PageDef['kind'][] = ['home', 'imprint', 'privacy', 'terms', 'docsMcp', 'waitlist'];

export const sitemapXml = (lastmod: string): string => {
    const entries = pages.filter((p) => INDEXABLE.includes(p.kind)).map((p) => {
        const alt = (['de', 'en'] as const).map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}${urlFor(p.kind, l)}"/>`).join('');
        const priority = p.kind === 'home' ? '1.0' : p.kind === 'docsMcp' ? '0.7' : '0.3';
        return `  <url><loc>${SITE_URL}${p.url}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority>${alt}<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${urlFor(p.kind, 'de')}"/></url>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
};

export const llmsTxt = (): string => {
    const en = site.en;
    const p = en.pricing;
    const plan = (key: string) => p.plans.find((x) => x.key === key)!;
    const price = (key: string) => {
        const x = plan(key);
        if (key === 'free') return 'free forever';
        if (key === 'org') return `${p.onRequest.toLowerCase()} (${p.onRequestUnit.toLowerCase()})`;
        const unit = key === 'team' ? 'per seat per month' : 'per month';
        return `€${x.monthly} ${unit} billed monthly, €${x.yearly} ${unit} billed yearly`;
    };
    const url = (kind: PageDef['kind'], lang: 'de' | 'en') => `${SITE_URL}${urlFor(kind, lang)}`;
    return `# ProjectFlow

> ${en.meta.description} Made in Germany. German and English.

ProjectFlow is a multi-tenant project management app: an inbox for everything that comes in, boards with status, priority and owners, a focus mode for the task at hand, initiatives and sprints, Flows for structured ideation, and an MCP server so AI clients (Claude, ChatGPT, Codex, Cursor, VS Code, Gemini CLI) can work in a workspace with the user's own permissions.

## Product

- [Homepage (English)](${url('home', 'en')}): overview, how it works, apps, AI & MCP, pricing, FAQ
- [Startseite (Deutsch)](${url('home', 'de')}): same content in German
- [Web app](${APP_URL}): sign in or create a free account
- [Desktop app](${APP_URL}/download): macOS and Windows

## Pricing

${p.plans.map((x) => `- ${x.name}: ${price(x.key)}. ${x.desc} Includes: ${x.features.join('; ')}.`).join('\n')}
- ${p.included.title}: ${p.included.items.join('; ')}.
- ${p.note}

## Docs

- [Connect AI clients via MCP](${url('docsMcp', 'en')}): MCP server URL ${MCP_URL}, OAuth sign-in, setup per client, available tools and permissions
- [KI-Clients verbinden (MCP, Deutsch)](${url('docsMcp', 'de')})

## FAQ

${en.faq.items.map((f) => `- **${f.q}** ${f.a}`).join('\n')}

## Legal

- [Imprint](${url('imprint', 'en')}) · [Impressum](${url('imprint', 'de')})
- [Privacy policy](${url('privacy', 'en')}) · [Datenschutzerklärung](${url('privacy', 'de')})
- [Terms](${url('terms', 'en')}) · [AGB](${url('terms', 'de')})
- Contact: hello@getprojectflow.com
`;
};
