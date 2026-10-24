import type { SiteCopy, StoryCard } from '../content/site';
import { icon, logo, type IconName } from './icons';
import { esc, headline, links } from './layout';
import { legalUrl, urlFor, type Lang } from './pages';

/* ------------------------------------------------------------------ fragments */

const check = (checked = false) =>
    `<span class="checkbox${checked ? ' is-checked' : ''}"><i class="checkbox__fill"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>`;

const kindIcon: Record<StoryCard['kind'], IconName> = { mail: 'at', chat: 'message', note: 'flag', bug: 'alert', call: 'phone', doc: 'layers' };
const colTone = ['open', 'in-progress', 'review', 'done'];

/** A story card: before capture it shows its origin (mail, chat, …), afterwards it is a task. */
const card = (c: StoryCard, i: number) => `
    <div class="scard${c.hero ? ' scard--hero' : ''}${c.col === 3 ? ' is-done' : ''}" data-card="${i}" data-col="${c.col}"${c.core ? ' data-core' : ''}${c.hero ? ' data-hero' : ''}>
        <div class="scard__inner">
            <span class="scard__kind">${icon(kindIcon[c.kind])}</span>
            ${check(c.col === 3)}
            <span class="scard__body"><b>${esc(c.title)}</b><span class="scard__meta"><i class="prio prio--${c.prio}"></i>${esc(c.project)}</span></span>
            ${c.who ? `<span class="avatar avatar--xs avatar--${'CMJLA'.indexOf(c.who) % 4} scard__who">${c.who}</span>` : ''}
        </div>
    </div>`;

/* ------------------------------------------------------------------ story stage */

const story = (t: SiteCopy, lang: Lang) => {
    const s = t.story;
    const acts = s.acts;
    const ctas = (cls = '') => `
        <div class="act__ctas ${cls}">
            <a class="btn btn--primary btn--lg" href="${links.register}" data-magnetic>${esc(s.primary)}${icon('arrowRight')}</a>
            <a class="btn btn--ghost btn--lg" href="${links.download}" data-magnetic>${icon('download')}${esc(s.secondary)}</a>
        </div>`;
    const cols = [0, 1, 2, 3].map((c) => {
        const cards = s.cards.map((cd, i) => ({ cd, i })).filter(({ cd }) => cd.col === c);
        return `
            <div class="scol" data-col="${c}">
                <p class="scol__head" data-col-head="${c}"><i class="dot dot--${colTone[c]}"></i><span class="scol__name" data-desktop="${esc(s.columns[c])}">${esc(s.columns[c])}</span><em data-col-count="${c}">${cards.length}</em></p>
                ${cards.map(({ cd, i }) => card(cd, i)).join('')}
            </div>`;
    }).join('');

    return `
<section class="story" id="story" aria-labelledby="act-0-title">
    <div class="story__pin" data-story>
        <div class="story__canvas" aria-hidden="true" data-canvas>
            <div class="story__grid"></div>
            <p class="story__inbox" data-inbox-head>${icon('inbox')}${esc(s.inbox)}<em>${s.cards.length}</em></p>
            <div class="story__board" data-board>${cols}</div>
            <div class="story__veil" data-veil></div>
            <div class="focus-panel" data-focus>
                <p class="focus-panel__label">${icon('timer')}${esc(s.focusLabel)}</p>
                <p class="focus-panel__title">${esc(s.cards[0].title)}</p>
                <div class="focus-panel__clock">
                    <svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle class="ring__value" cx="18" cy="18" r="15" pathLength="100" data-focus-ring/></svg>
                    <b class="mono" data-focus-clock>24:13</b>
                </div>
                <p class="focus-panel__hint">${esc(s.focusHint)}</p>
            </div>
            <ul class="toasts" data-toasts>
                ${s.notifications.map((n, i) => `<li class="toast" data-toast><span class="avatar avatar--${i + 1}">${n.who[0]}</span><p><b>${esc(n.who)}</b> ${esc(n.what)}</p></li>`).join('')}
            </ul>
            <div class="story__frame" data-frame>
                <div class="story__frame-bar"><span></span><span></span><span></span><em>app.getprojectflow.com</em></div>
            </div>
            <div class="story__phone" data-phone>
                <div class="phone__island"></div>
                <p class="story__phone-title">${icon('sun')}${lang === 'en' ? 'Today' : 'Heute'}</p>
                ${s.cards.filter((c) => c.col !== 3).slice(0, 5).map((c) => `<p class="story__phone-row">${check()}<span>${esc(c.title)}</span></p>`).join('')}
                <p class="story__phone-live">${icon('timer')}<span>${esc(s.cards[0].title)}</span><b>24:13</b></p>
            </div>
        </div>

        <div class="story__copy">
            ${acts.map((a, i) => i === 0 ? `
            <div class="act act--hero" id="act-0" data-act="0">
                <h1 class="act__title act__title--hero" id="act-0-title">${a.title.split(' ').map((w, n) => `<span class="word"><span class="hero-in" style="--i:${n}">${headline(w)}</span></span>`).join(' ')}</h1>
                <p class="act__text hero-in" style="--i:9">${esc(a.text)}</p>
                ${ctas('hero-in')}
                <p class="act__platforms hero-in" style="--i:11">${icon('monitor')}${esc(s.platforms)}</p>
            </div>` : `
            <div class="act" id="act-${i}" data-act="${i}">
                <p class="act__num"><span>${String(i).padStart(2, '0')}</span>${esc(a.label)}</p>
                <h2 class="act__title">${headline(a.title)}</h2>
                <p class="act__text">${esc(a.text)}</p>
                ${i === acts.length - 1 ? ctas() : ''}
            </div>`).join('')}
        </div>

        <nav class="story__nav" aria-label="${esc(t.a11y.storyNav)}">
            <ol>${acts.map((a, i) => `<li><a href="#act-${i}" data-goto="${i}" aria-label="${String(i).padStart(2, '0')} ${esc(a.label)}"${i === 0 ? ' aria-current="step"' : ''}><span aria-hidden="true">${esc(a.label)}</span></a></li>`).join('')}</ol>
        </nav>
        <a class="story__skip" href="#mcp">${esc(t.a11y.skipStory)}</a>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ MCP scene */

const mcp = (t: SiteCopy, lang: Lang) => {
    const m = t.mcp;
    // The prompt is always in the DOM (readable without JS); the scene reveals it character by character.
    const prompt = Array.from(m.prompt).map((ch) => `<span class="ch">${esc(ch)}</span>`).join('');
    const win = (label: string) => `<p class="mcp-window"><i></i><i></i><i></i><span>${esc(label)}</span></p>`;
    return `
<section class="section mcp" id="mcp" aria-labelledby="mcp-title" data-mcp-section>
    <div class="container">
        <header class="mcp__head" data-reveal>
            <p class="eyebrow">${esc(m.eyebrow)}</p>
            <h2 class="sec-title" id="mcp-title">${headline(m.title)}</h2>
            <p class="sec-text">${esc(m.text)}</p>
            <div class="mcp__meta">
                <ul class="chips">${m.clients.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
                <a class="btn btn--ghost btn--sm" href="${urlFor('docsMcp', lang)}">${esc(m.cta)}${icon('arrowRight')}</a>
            </div>
        </header>
        <div class="mcp-stage" aria-hidden="true" data-mcp>
            <div class="mcp-pane mcp-chat">
                ${win(m.agent)}
                <div class="mcp-chat__body">
                    <p class="msg msg--user" data-mcp-prompt>${prompt}<i class="caret"></i></p>
                    <div class="msg msg--ai" data-mcp-reply><span class="msg__avatar">${icon('sparkles')}</span><p>${esc(m.reply)}</p></div>
                    <div class="tool" data-mcp-call>
                        <p class="tool__head"><span class="mono">projectflow · ${esc(m.call)}</span><em>MCP</em></p>
                        <dl>${m.params.map(([k, v]) => `<div data-mcp-param><dt class="mono">${esc(String(k))}</dt><dd class="mono">"${esc(String(v))}"</dd></div>`).join('')}</dl>
                    </div>
                    <p class="tool-result" data-mcp-result>${icon('check')}${esc(m.result)}</p>
                </div>
            </div>
            <div class="mcp-link">
                <svg viewBox="0 0 120 12" preserveAspectRatio="none"><path class="mcp-link__track" d="M0 6 H120"/><path class="mcp-link__flow" d="M0 6 H120" data-mcp-flow/></svg>
                <span class="mcp-link__chip" data-mcp-chip>${icon('lock')}${esc(m.connector)}</span>
            </div>
            <div class="mcp-pane mcp-board">
                ${win(m.board)}
                <div class="mcp-board__body">
                    <p class="scol__head"><i class="dot dot--open"></i>${esc(m.column)}<em data-mcp-count>3</em></p>
                    <div class="mcp-card mcp-card--new" data-mcp-card>${check()}<span><b>${esc(m.card)}</b><span class="scard__meta"><i class="prio prio--high"></i>iOS 2.0</span></span><span class="agent-tag">${icon('sparkles')}</span></div>
                    ${t.story.cards.filter((c) => c.col === 0).slice(0, 2).map((c) => `<div class="mcp-card">${check()}<span><b>${esc(c.title)}</b><span class="scard__meta"><i class="prio prio--${c.prio}"></i>${esc(c.project)}</span></span></div>`).join('')}
                    <p class="mcp-activity" data-mcp-log>${icon('sparkles')}<span>${esc(m.activity)}</span><time>${esc(m.activityTime)}</time></p>
                    <div class="mcp-perms" data-mcp-perms>
                        <p>${esc(m.permsTitle)}</p>
                        <ul>${m.perms.map(([label, ok]) => `<li class="${ok ? 'is-ok' : 'is-no'}">${icon(ok ? 'check' : 'close')}${esc(String(label))}</li>`).join('')}</ul>
                    </div>
                </div>
            </div>
        </div>
        <p class="fineprint mcp__note">${esc(m.note)}</p>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ audience, apps, pricing */

const audience = (t: SiteCopy) => {
    const a = t.audience;
    const card = (c: (typeof a.boards)[number][number]) => `
                    <div class="role-card"><i class="prio prio--${c.prio}"></i><span><b>${esc(c.title)}</b><small>${esc(c.project)}</small></span><em>${esc(c.tag)}</em></div>`;
    return `
<section class="section audience" id="teams" aria-labelledby="teams-title" data-roles>
    <div class="container audience__grid">
        <div class="audience__copy">
            <header data-reveal>
                <p class="eyebrow">${esc(a.eyebrow)}</p>
                <h2 class="sec-title" id="teams-title">${headline(a.title)}</h2>
            </header>
            <div class="role-tabs" role="tablist" aria-label="${esc(a.eyebrow)}" data-reveal>
                ${a.items.map((it, i) => `<button type="button" role="tab" id="role-tab-${i}" aria-controls="role-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-role-tab="${i}">${icon(it.icon as IconName)}<span>${esc(it.title)}</span></button>`).join('')}
            </div>
            ${a.items.map((it, i) => `
            <div class="role-panel" role="tabpanel" id="role-panel-${i}" aria-labelledby="role-tab-${i}" data-role-panel="${i}"${i === 0 ? '' : ' hidden'}>
                <p>${esc(it.text)}</p>
                <ul class="ticks">${it.points.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>
            </div>`).join('')}
        </div>
        <div class="role-stage" aria-hidden="true" data-reveal>
            ${a.boards.map((b, i) => `
            <div class="role-board${i === 0 ? ' is-on' : ''}" data-role-board="${i}">${b.map(card).join('')}
            </div>`).join('')}
        </div>
    </div>
</section>`;
};

const apps = (t: SiteCopy) => {
    const a = t.apps;
    return `
<section class="section apps" id="apps" aria-labelledby="apps-title">
    <div class="container">
        <header class="sec-head sec-head--split" data-reveal>
            <div>
                <p class="eyebrow">${esc(a.eyebrow)}</p>
                <h2 class="sec-title" id="apps-title">${headline(a.title)}</h2>
            </div>
            <p class="sec-text">${esc(a.text)}</p>
        </header>
        <div class="apps__grid">
            <article class="app-card app-card--desktop" data-reveal data-spot data-drift="-1">
                <div class="app-card__copy">
                    <h3>${icon('monitor')}${esc(a.desktop.title)}</h3>
                    <p>${esc(a.desktop.text)}</p>
                </div>
                <ul class="shortcuts" data-shortcuts>
                    ${a.desktop.shortcuts.map((sc) => `<li><span class="keys">${sc.keys.map((k) => `<kbd>${esc(k)}</kbd>`).join('')}</span><span>${esc(sc.label)}</span></li>`).join('')}
                </ul>
                <p class="fineprint">${esc(a.desktop.note)}</p>
                <a class="btn btn--primary" href="${links.download}">${icon('download')}${esc(a.desktop.cta)}</a>
            </article>
            <article class="app-card app-card--iphone" data-reveal data-spot data-drift="1">
                <div class="app-card__copy">
                    <h3>${icon('phone')}${esc(a.iphone.title)}</h3>
                    <p>${esc(a.iphone.text)}</p>
                </div>
                <ul class="ticks">${a.iphone.points.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>
                <span class="soon">${icon('phone')}${esc(a.iphone.cta)}</span>
            </article>
        </div>
    </div>
</section>`;
};

const pricing = (t: SiteCopy, lang: Lang) => {
    const buy = lang === 'de' ? '/checkout' : '/en/checkout';
    const p = t.pricing;
    const column = (plan: (typeof p.plans)[number]) => {
        const featured = plan.key === 'team';
        const href = plan.key === 'org' ? 'mailto:hello@getprojectflow.com?subject=ProjectFlow%20Organization'
            : plan.key === 'free' ? links.register : `${buy}?plan=${plan.key}&interval=year`;
        const amount = plan.key === 'org'
            ? `<b class="price-col__request">${esc(p.onRequest)}</b>`
            : `<b data-price data-monthly="${plan.monthly}" data-yearly="${plan.yearly}">${plan.yearly}&nbsp;${p.currency}</b>`;
        const unit = plan.key === 'free' ? esc(p.forever)
            : plan.key === 'org' ? esc(p.onRequestUnit)
            : `${esc(plan.key === 'personal' ? p.perMonth : p.perSeat)}, <span data-billing-unit data-monthly="${esc(p.billedMonthly)}" data-yearly="${esc(p.billedYearly)}">${esc(p.billedYearly)}</span>`;
        return `
            <li class="price-col${featured ? ' is-featured' : ''}" aria-labelledby="plan-${plan.key}">
                <div class="price-col__name">
                    <h3 id="plan-${plan.key}">${esc(plan.name)}</h3>
                    ${featured ? `<span class="price-col__badge">${esc(p.popular)}</span>` : ''}
                </div>
                <p class="price-col__desc">${esc(plan.desc)}</p>
                <p class="price-col__price">${amount}</p>
                <p class="price-col__unit">${unit}</p>
                <a class="price-col__cta${featured ? ' is-primary' : ''}" href="${href}"${plan.key === 'personal' || plan.key === 'team' ? ' data-buy-link' : ''}>${esc(plan.cta)}${icon('arrowRight')}</a>
                <ul class="price-col__list">${plan.features.map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>
            </li>`;
    };
    return `
<section class="section pricing" id="pricing" aria-labelledby="pricing-title">
    <div class="container">
        <header class="pricing__head" data-reveal>
            <div class="pricing__intro">
                <p class="eyebrow">${esc(p.eyebrow)}</p>
                <h2 class="pricing__title" id="pricing-title">${esc(p.title)}</h2>
                <p class="pricing__lead">${esc(p.text)}</p>
            </div>
            <div class="pricing__switch">
                <div class="billing-toggle" role="group" aria-label="${esc(p.monthly)} / ${esc(p.yearly)}" data-billing>
                    <button type="button" aria-pressed="false" data-billing-option="monthly">${esc(p.monthly)}</button>
                    <button type="button" aria-pressed="true" data-billing-option="yearly">${esc(p.yearly)}</button>
                    <i class="billing-toggle__thumb" aria-hidden="true"></i>
                </div>
                <p class="pricing__save">${esc(p.saveHint)}</p>
            </div>
        </header>
        <ul class="price-grid" data-reveal>
            ${p.plans.map(column).join('')}
        </ul>
        <div class="price-included" data-reveal>
            <h3>${esc(p.included.title)}</h3>
            <ul>${p.included.items.map((it) => `<li>${icon('check')}${esc(it)}</li>`).join('')}</ul>
        </div>
        <p class="pricing__note">${esc(p.note)}</p>
    </div>
</section>`;
};

const more = (t: SiteCopy, lang: Lang) => {
    const items = t.more.items;
    const de = lang === 'de';
    // One small, true-to-the-app UI per tile; it plays once when the tile scrolls in (see playOnce in home.ts).
    const minis: Record<string, string> = {
        layers: `<ul class="mini-subtasks">${(de ? ['Wireframes', 'Copy prüfen', 'Freigabe einholen'] : ['Wireframes', 'Review copy', 'Get sign-off']).map((x, i) => `<li style="--i:${i}">${check()}<span>${esc(x)}</span></li>`).join('')}</ul>`,
        sparkles: `<p class="mini-ai"><span class="mini-ai__text">${de ? 'Kunde wünscht kürzere Ladezeiten und ein klareres Onboarding …' : 'Client wants faster load times and a clearer onboarding …'}</span><span class="mini-ai__chip">${icon('sparkles')}${de ? 'Zusammengefasst: 2 Unteraufgaben' : 'Summarised: 2 subtasks'}</span></p>`,
        flag: `<div class="mini-sprint"><p><b>Sprint 14</b><span>68&nbsp;%</span></p><i class="mini-sprint__bar"><i></i></i><p class="mini-sprint__meta">${de ? '17 von 25 erledigt' : '17 of 25 done'}</p></div>`,
        sun: `<div class="mini-focus"><span class="mini-focus__ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"></circle><circle class="mini-focus__arc" cx="18" cy="18" r="15"></circle></svg></span><span><b>${de ? 'Im Fokus' : 'In focus'}</b><small>24:13</small></span></div>`,
    };
    return `
<section class="section more" id="more" aria-labelledby="more-title">
    <div class="container">
        <header class="more__head" data-reveal>
            <p class="eyebrow">${esc(t.more.eyebrow)}</p>
            <h2 class="sec-title" id="more-title">${headline(t.more.title)}</h2>
        </header>
        <ul class="bento">
            ${items.map((it, i) => `<li class="bento__tile bento__tile--${i}" data-reveal data-spot data-play>
                <div class="bento__ui" aria-hidden="true">${minis[it.icon] ?? ''}</div>
                <h3>${icon(it.icon as IconName)}${esc(it.title)}</h3>
                <p>${esc(it.text)}</p>
            </li>`).join('')}
        </ul>
    </div>
</section>`;
};

const trust = (t: SiteCopy, lang: Lang) => `
<section class="section trust" id="trust" aria-labelledby="trust-title">
    <div class="container">
        <header class="trust__head" data-reveal>
            <p class="eyebrow">${esc(t.trust.eyebrow)}</p>
            <h2 class="sec-title" id="trust-title">${esc(t.trust.title)}</h2>
        </header>
        <ul class="trust__list" data-reveal>
            ${t.trust.items.map((it) => `<li><span class="trust__icon">${icon(it.icon as IconName)}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></li>`).join('')}
        </ul>
        <p class="trust__more"><a href="${legalUrl('privacy', lang)}">${esc(t.trust.more)}${icon('arrowRight')}</a></p>
    </div>
</section>`;

const faq = (t: SiteCopy, lang: Lang) => {
    const f = t.faq;
    const fill = (a: string) => esc(a)
        .replace('{privacy}', `<a href="${legalUrl('privacy', lang)}">${esc(f.privacy)}</a>`)
        .replace('{docs}', `<a href="${urlFor('docsMcp', lang)}">${esc(f.docs)}</a>`);
    return `
<section class="section faq" id="faq" aria-labelledby="faq-title">
    <div class="container faq__grid">
        <header data-reveal>
            <p class="eyebrow">${esc(f.eyebrow)}</p>
            <h2 class="sec-title" id="faq-title">${headline(f.title)}</h2>
        </header>
        <div class="faq__list" data-reveal>
            ${f.items.map((it) => `<details name="faq" data-faq><summary>${esc(it.q)}${icon('plus')}</summary><p>${fill(it.a)}</p></details>`).join('')}
        </div>
    </div>
</section>`;
};

const cta = (t: SiteCopy) => {
    // Two rows of finished story tasks glide past the closing statement – the hero's noise, now done.
    const cards = t.story.cards.map((c) => `<li class="cta-card"><span class="checkbox is-done">${icon('check')}</span><span><b>${esc(c.title)}</b><small><i class="prio prio--${c.prio}"></i>${esc(c.project)}</small></span></li>`);
    const row = (items: string[], dir: 'l' | 'r') => `
        <div class="cta-row cta-row--${dir}" aria-hidden="true"><ul class="cta-row__track">${items.join('')}${items.join('')}</ul></div>`;
    const half = Math.ceil(cards.length / 2);
    return `
<section class="cta theme-dark" aria-labelledby="cta-title">
    ${row(cards.slice(0, half), 'l')}
    <div class="container cta__inner" data-reveal>
        <span class="cta__logo-wrap" aria-hidden="true">${logo('cta__logo')}</span>
        <h2 class="cta__title" id="cta-title">${esc(t.cta.title)}</h2>
        <p class="cta__text">${esc(t.cta.text)}</p>
        <div class="cta__actions">
            <a class="btn btn--primary btn--lg" href="${links.register}" data-magnetic>${esc(t.cta.primary)}${icon('arrowRight')}</a>
            <a class="btn btn--ghost btn--lg" href="${links.login}">${esc(t.cta.secondary)}</a>
        </div>
        <ul class="cta__points">${t.cta.points.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>
    </div>
    ${row(cards.slice(half), 'r')}
</section>`;
};

export const homeBody = (t: SiteCopy, lang: Lang): string =>
    [story(t, lang), audience(t), mcp(t, lang), apps(t), more(t, lang), trust(t, lang), pricing(t, lang), faq(t, lang), cta(t)].join('\n');
