import { docsMcp, type DocsClient } from '../content/docs-mcp';
import { icon } from './icons';
import { esc, links } from './layout';
import { MCP_URL, urlFor, type Lang } from './pages';

const withUrl = (value: string) => value.replace(/\{url\}/g, MCP_URL);

/** One-click install links (same format as web/components/settings/aiClients.ts). */
const installUrl = (kind: 'cursor' | 'vscode'): string =>
    kind === 'cursor'
        ? `cursor://anysphere.cursor-deeplink/mcp/install?name=ProjectFlow&config=${encodeURIComponent(btoa(JSON.stringify({ url: MCP_URL })))}`
        : `https://vscode.dev/redirect/mcp/install?name=projectflow&config=${encodeURIComponent(JSON.stringify({ type: 'http', url: MCP_URL }))}`;

const codeBlock = (label: string, code: string, copy: string, copied: string) => `
    <figure class="code">
        <figcaption><span>${esc(label)}</span>
            <button type="button" class="copy-btn" data-copy data-copied="${esc(copied)}" aria-label="${esc(`${copy}: ${label}`)}">${icon('copy')}<span>${esc(copy)}</span></button>
        </figcaption>
        <pre><code>${esc(withUrl(code))}</code></pre>
    </figure>`;

export const docsMcpBody = (lang: Lang): string => {
    const d = docsMcp[lang];
    const s = d.sections;
    const ids = Object.keys(s) as (keyof typeof s)[];

    const client = (c: DocsClient) => `
        <article class="client" id="client-${c.id}" aria-labelledby="client-${c.id}-title">
            <h3 id="client-${c.id}-title">${esc(c.name)}</h3>
            <ol class="steps">${c.steps.map((step) => `<li>${esc(withUrl(step))}</li>`).join('')}</ol>
            ${c.install ? `<a class="btn btn--primary btn--sm" href="${esc(installUrl(c.install))}">${icon('download')}${esc(c.install === 'cursor' ? d.installCursor : d.installVscode)}</a>` : ''}
            ${c.snippets.map((sn) => codeBlock(sn.label, sn.code, d.copy, d.copied)).join('')}
        </article>`;

    return `
<div class="docs container">
    <header class="docs__head">
        <nav class="docs__crumbs" aria-label="Breadcrumb"><a href="${urlFor('home', lang)}">ProjectFlow</a><span aria-hidden="true">/</span><span>${esc(d.breadcrumb)}</span><span aria-hidden="true">/</span><span aria-current="page">MCP</span></nav>
        <h1>${esc(d.title)}</h1>
        <p class="docs__lead">${esc(d.lead)}</p>
        <div class="server-url">
            <span class="server-url__label">${esc(d.serverLabel)}</span>
            <code>${esc(MCP_URL)}</code>
            <button type="button" class="copy-btn" data-copy data-copy-text="${esc(MCP_URL)}" data-copied="${esc(d.copied)}" aria-label="${esc(`${d.copy}: ${d.serverLabel}`)}">${icon('copy')}<span>${esc(d.copy)}</span></button>
        </div>
        <ul class="docs__facts">${d.facts.map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>
    </header>

    <div class="docs__layout">
        <nav class="docs__toc" aria-labelledby="docs-toc-title">
            <h2 id="docs-toc-title">${esc(d.toc)}</h2>
            <ol>${ids.map((id) => `<li><a href="#${id}" data-toc="${id}">${esc(s[id])}</a></li>`).join('')}</ol>
        </nav>

        <div class="docs__content">
            <section id="capabilities" aria-labelledby="capabilities-h">
                <h2 id="capabilities-h">${esc(s.capabilities)}</h2>
                <p>${esc(d.capabilitiesIntro)}</p>
                <ul class="tool-groups">
                    ${d.toolGroups.map((g) => `<li><h3>${esc(g.title)}</h3><p>${esc(g.text)}</p><p class="tool-groups__tools">${g.tools.map((tool) => `<code>${esc(tool)}</code>`).join(' ')}</p></li>`).join('')}
                </ul>
            </section>

            <section id="permissions" aria-labelledby="permissions-h">
                <h2 id="permissions-h">${esc(s.permissions)}</h2>
                <p>${esc(d.permissionsIntro)}</p>
                <div class="table-wrap" tabindex="0" role="region" aria-labelledby="permissions-h">
                    <table>
                        <thead><tr>${d.scopeHead.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${d.scopeRows.map((row, r) => {
                                const key = ['projects', 'tasks', 'initiatives'][r];
                                return `<tr><th scope="row">${esc(row)}</th>${['read', 'write', 'delete'].map((a) => `<td class="num"><code>${key}:${a}</code></td>`).join('')}</tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <p class="note">${icon('shield')}<span>${esc(d.scopeNote)}</span></p>
            </section>

            <section id="security" aria-labelledby="security-h">
                <h2 id="security-h">${esc(s.security)}</h2>
                <ul class="bullets">${d.security.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
            </section>

            <section id="setup" aria-labelledby="setup-h">
                <h2 id="setup-h">${esc(s.setup)}</h2>
                <p>${esc(d.setupIntro)}</p>
                <ul class="client-chips">${d.clients.map((c) => `<li><a href="#client-${c.id}">${esc(c.name)}</a></li>`).join('')}</ul>
                <div class="clients">${d.clients.map(client).join('')}</div>
            </section>

            <section id="tokens" aria-labelledby="tokens-h">
                <h2 id="tokens-h">${esc(s.tokens)}</h2>
                <p>${esc(d.tokensIntro)}</p>
                <ol class="steps">${d.tokensSteps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>
                ${d.tokenSnippets.map((sn) => codeBlock(sn.label, sn.code, d.copy, d.copied)).join('')}
            </section>

            <section id="limits" aria-labelledby="limits-h">
                <h2 id="limits-h">${esc(s.limits)}</h2>
                <dl class="limits">${d.limits.map((l) => `<div><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`).join('')}</dl>
            </section>

            <section id="faq" aria-labelledby="faq-h">
                <h2 id="faq-h">${esc(s.faq)}</h2>
                <div class="faq">${d.faq.map((f) => `<details><summary>${esc(f.q)}${icon('plus')}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
                <p class="docs__help">${esc(d.help)} <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a> · <a href="${links.app}/?openSettings=ai">${esc(d.openSettings)}</a></p>
            </section>
        </div>
    </div>
</div>`;
};
