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
                ${s.cards.filter((c) => c.col !== 3).slice(0, 3).map((c) => `<p class="story__phone-row">${check()}<span>${esc(c.title)}</span></p>`).join('')}
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
    return `
<section class="section mcp" id="mcp" aria-labelledby="mcp-title">
    <div class="container mcp__grid">
        <div class="mcp__copy" data-reveal>
            <p class="eyebrow">${esc(m.eyebrow)}</p>
            <h2 class="sec-title" id="mcp-title">${headline(m.title)}</h2>
            <p class="sec-text">${esc(m.text)}</p>
            <ul class="chips">${m.clients.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
            <a class="btn btn--ghost" href="${urlFor('docsMcp', lang)}">${esc(m.cta)}${icon('arrowRight')}</a>
            <p class="fineprint">${esc(m.note)}</p>
        </div>
        <div class="mcp__scene" aria-hidden="true" data-mcp>
            <div class="agent">
                <p class="agent__head">${icon('sparkles')}${esc(m.agent)}</p>
                <p class="agent__prompt" data-mcp-prompt>${esc(m.prompt)}</p>
                <p class="agent__call" data-mcp-call><span class="mono">${esc(m.call)}</span><em>projectflow</em></p>
                <p class="agent__result" data-mcp-result>${icon('check')}${esc(m.result)}</p>
            </div>
            <div class="mini-board">
                <p class="scol__head"><i class="dot dot--open"></i>${esc(m.column)}<em data-mcp-count>3</em></p>
                <div class="mcp-card mcp-card--new" data-mcp-card>${check()}<span><b>${esc(m.card)}</b><span class="scard__meta"><i class="prio prio--high"></i>iOS 2.0</span></span><span class="agent-tag">${icon('sparkles')}</span></div>
                ${t.story.cards.filter((c) => c.col === 0).slice(0, 2).map((c) => `<div class="mcp-card">${check()}<span><b>${esc(c.title)}</b><span class="scard__meta"><i class="prio prio--${c.prio}"></i>${esc(c.project)}</span></span></div>`).join('')}
            </div>
        </div>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ audience, apps, pricing */

const audience = (t: SiteCopy) => `
<section class="section audience" id="teams" aria-labelledby="teams-title">
    <div class="container">
        <header class="sec-head" data-reveal>
            <p class="eyebrow">${esc(t.audience.eyebrow)}</p>
            <h2 class="sec-title" id="teams-title">${headline(t.audience.title)}</h2>
        </header>
        <ul class="audience__grid">
            ${t.audience.items.map((it) => `
            <li class="audience__item" data-reveal data-spot>
                <span class="more__icon">${icon(it.icon as IconName)}</span>
                <h3>${esc(it.title)}</h3>
                <p>${esc(it.text)}</p>
                <ul class="ticks">${it.points.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>
            </li>`).join('')}
        </ul>
    </div>
</section>`;

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
            <article class="app-card app-card--desktop" data-reveal data-spot>
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
            <article class="app-card app-card--iphone" data-reveal data-spot>
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
    const buy = lang === 'de' ? '/kaufen' : '/en/buy';
    const p = t.pricing;
    const price = (plan: (typeof p.plans)[number], yearly: boolean) => (yearly ? plan.yearly : plan.monthly);
    return `
<section class="section pricing" id="pricing" aria-labelledby="pricing-title">
    <div class="container">
        <header class="pricing__head" data-reveal>
            <p class="eyebrow">${esc(p.eyebrow)} <span class="pill-badge">${esc(p.badge)}</span></p>
            <h2 class="sec-title" id="pricing-title">${headline(p.title)}</h2>
            <p class="sec-text">${esc(p.text)}</p>
            <div class="billing-toggle" role="group" aria-label="${esc(p.monthly)} / ${esc(p.yearly)}" data-billing>
                <button type="button" aria-pressed="false" data-billing-option="monthly">${esc(p.monthly)}</button>
                <button type="button" aria-pressed="true" data-billing-option="yearly">${esc(p.yearly)} <em>${esc(p.save)}</em></button>
                <i class="billing-toggle__thumb" aria-hidden="true"></i>
            </div>
        </header>
        <ul class="plans">
            ${p.plans.map((plan) => {
                const featured = plan.key === 'team';
                const href = plan.key === 'org' ? 'mailto:hello@getprojectflow.com?subject=ProjectFlow%20Organization'
                    : plan.key === 'free' ? links.register : `${buy}?plan=${plan.key}&interval=year`;
                const amount = plan.key === 'org'
                    ? `<span class="plan__from">${esc(p.from)}</span> <b>${plan.yearly}&nbsp;${p.currency}</b>`
                    : `<b data-price data-monthly="${plan.monthly}" data-yearly="${plan.yearly}">${price(plan, true)}&nbsp;${p.currency}</b>`;
                const unit = plan.key === 'free' ? esc(p.forever)
                    : plan.key === 'org' ? `${esc(p.perSeat)}, ${esc(p.billedYearly)}`
                    : `${esc(plan.key === 'personal' ? p.perMonth : p.perSeat)}, <span data-billing-unit data-monthly="${esc(p.billedMonthly)}" data-yearly="${esc(p.billedYearly)}">${esc(p.billedYearly)}</span>`;
                return `
            <li class="plan${featured ? ' plan--featured theme-dark' : ''}" data-reveal data-spot>
                <div class="plan__top">
                    <h3>${esc(plan.name)}${featured ? `<span class="pill-badge pill-badge--light">${esc(p.popular)}</span>` : ''}</h3>
                    <p>${esc(plan.desc)}</p>
                </div>
                <p class="plan__price">${amount}</p>
                <p class="plan__unit">${unit}</p>
                <a class="btn ${featured ? 'btn--primary' : 'btn--ghost'}" href="${href}"${plan.key === 'personal' || plan.key === 'team' ? ' data-buy-link' : ''}>${esc(plan.cta)}${icon('arrowRight')}</a>
                <ul class="ticks">${plan.features.map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>
            </li>`;
            }).join('')}
        </ul>
        <div class="addon" data-reveal data-spot>
            <div class="addon__head">
                <span class="more__icon">${icon('sparkles')}</span>
                <div>
                    <h3>${esc(p.addon.name)}</h3>
                    <p class="addon__price"><b>+${p.addon.price}&nbsp;${p.currency}</b> ${esc(p.addon.unit)}</p>
                </div>
            </div>
            <p class="addon__text">${esc(p.addon.text)}</p>
            <ul class="ticks">${p.addon.points.map((pt) => `<li>${icon('check')}${esc(pt)}</li>`).join('')}</ul>
            <p class="fineprint">${esc(p.addon.note)}</p>
        </div>
        <p class="fineprint pricing__note">${esc(p.note)}</p>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ more, faq, cta */

const more = (t: SiteCopy) => `
<section class="section more" id="more" aria-labelledby="more-title">
    <div class="container">
        <header class="more__head" data-reveal>
            <p class="eyebrow">${esc(t.more.eyebrow)}</p>
            <h2 class="sec-title" id="more-title">${headline(t.more.title)}</h2>
        </header>
        <ul class="more__grid">
            ${t.more.items.map((it) => `<li class="more__item" data-reveal data-spot><span class="more__icon">${icon(it.icon as IconName)}</span><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></li>`).join('')}
        </ul>
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
            ${f.items.map((it) => `<details><summary>${esc(it.q)}${icon('plus')}</summary><p>${fill(it.a)}</p></details>`).join('')}
        </div>
    </div>
</section>`;
};

const cta = (t: SiteCopy) => `
<section class="cta" aria-labelledby="cta-title">
    <div class="container">
        <div class="cta__card theme-dark" data-reveal data-spot>
            <div class="cta__mark" aria-hidden="true">${logo('cta__logo')}</div>
            <div>
                <h2 class="sec-title" id="cta-title">${headline(t.cta.title)}</h2>
                <p>${esc(t.cta.text)}</p>
            </div>
            <div class="cta__actions">
                <a class="btn btn--primary btn--lg" href="${links.register}" data-magnetic>${esc(t.cta.primary)}${icon('arrowRight')}</a>
                <a class="btn btn--ghost btn--lg" href="${links.login}">${esc(t.cta.secondary)}</a>
            </div>
        </div>
    </div>
</section>`;

export const homeBody = (t: SiteCopy, lang: Lang): string =>
    [story(t, lang), audience(t), apps(t), mcp(t, lang), more(t), pricing(t, lang), faq(t, lang), cta(t)].join('\n');
