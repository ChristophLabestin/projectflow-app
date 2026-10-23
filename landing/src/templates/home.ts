import type { SiteCopy } from '../content/site';
import { icon, logo, type IconName } from './icons';
import { esc, headline, links } from './layout';
import { legalUrl, urlFor, type Lang } from './pages';

/* ------------------------------------------------------------------ shared fragments */

const check = (checked = false, attrs = '') =>
    `<span class="checkbox${checked ? ' is-checked' : ''}"${attrs}><i class="checkbox__fill"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>`;

/** Section header: title left, supporting text right (stacks on small screens). */
const head = (id: string, eyebrow: string, title: string, text?: string) => `
    <header class="sec-head" data-reveal>
        <div>
            <p class="eyebrow">${esc(eyebrow)}</p>
            <h2 class="sec-title" id="${id}-title">${headline(title)}</h2>
        </div>
        ${text ? `<p class="sec-text">${esc(text)}</p>` : ''}
    </header>`;

/* ------------------------------------------------------------------ hero */

const appWindow = (t: SiteCopy) => {
    const a = t.app;
    const navIcons: IconName[] = ['sun', 'inbox', 'folder', 'bell'];
    const tones = ['open', 'planning', 'done'];
    return `
        <div class="app-window" data-hero-window>
            <div class="app-window__bar"><span></span><span></span><span></span></div>
            <div class="app-window__body">
                <aside class="app-side">
                    <div class="app-side__ws"><span class="app-side__ws-logo">${logo('app-side__logo')}</span>${esc(a.workspace)}</div>
                    <ul class="app-side__nav">
                        ${a.nav.map((label, i) => `<li class="${i === 0 ? 'is-active' : ''}">${icon(navIcons[i])}<span>${esc(label)}</span>${i === 3 ? '<em class="badge" data-hero-badge>2</em>' : ''}</li>`).join('')}
                    </ul>
                    <p class="app-side__label">${esc(a.nav[2])}</p>
                    <ul class="app-side__nav">
                        ${a.projects.map((p, i) => `<li><i class="dot dot--${tones[i]}"></i><span>${esc(p)}</span></li>`).join('')}
                    </ul>
                </aside>
                <div class="app-main">
                    <div class="app-main__head">
                        <div><h3 class="app-main__title">${esc(a.todayTitle)}</h3><p class="app-main__date">${esc(a.todayDate)}</p></div>
                        <div class="meter"><span>${esc(a.progress)}</span><b data-hero-progress-label>40 %</b><i><s data-hero-progress style="--p:.4"></s></i></div>
                    </div>
                    <div class="focus-card">
                        <span class="focus-card__label">${icon('timer')}${esc(a.focusLabel)}</span>
                        <p class="focus-card__task">${esc(a.focusTask)}</p>
                        <span class="focus-card__time" data-hero-timer>00:24:13</span>
                    </div>
                    <ul class="rows">
                        ${a.tasks.map((task, i) => `
                        <li class="row"${i === 1 ? ' data-hero-check' : ''}>
                            ${check()}
                            <span class="row__title">${esc(task.title)}</span>
                            <span class="chip">${esc(task.project)}</span>
                            <i class="prio prio--${task.prio}"></i>
                        </li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>`;
};

const hero = (t: SiteCopy) => {
    const words = t.hero.title;
    const n = words.length;
    return `
<section class="hero" aria-labelledby="hero-title">
    <div class="hero__backdrop" aria-hidden="true"><div class="hero__grid"></div><div class="hero__glow"></div></div>
    <div class="container hero__copy">
        <p class="eyebrow hero-in" style="--i:0">${esc(t.hero.eyebrow)}</p>
        <h1 class="hero__title" id="hero-title">${words.map((w, i) => `<span class="word"><span class="hero-in" style="--i:${i + 1}">${headline(w)}</span></span>${w.endsWith('.') && i < n - 1 ? '<span class="hero__break"></span>' : ''}`).join(' ')}</h1>
        <p class="hero__lead hero-in" style="--i:${n + 1}">${esc(t.hero.lead)}</p>
        <div class="hero__ctas hero-in" style="--i:${n + 2}">
            <a class="btn btn--primary btn--lg" href="${links.register}" data-magnetic>${esc(t.hero.primary)}${icon('arrowRight')}</a>
            <a class="btn btn--ghost btn--lg" href="${links.download}" data-magnetic>${icon('download')}${esc(t.hero.secondary)}</a>
        </div>
        <p class="hero__note hero-in" style="--i:${n + 3}">${icon('key')}${esc(t.hero.note)}</p>
    </div>
    <div class="hero__stage" data-hero-stage role="img" aria-label="${esc(t.a11y.preview)}">
        <div class="hero__tilt" data-tilt aria-hidden="true">
            ${appWindow(t)}
            <div class="float float--notif" data-depth="1.2" data-hero-notif>
                <span class="avatar">L</span>
                <div><b>${esc(t.app.notifTitle)}</b><p>${esc(t.app.notifBody)}</p></div>
            </div>
            <div class="float float--timer" data-depth="1.6">
                <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="ring__value" cx="18" cy="18" r="15" pathLength="100" data-hero-ring/></svg>
                <div><span>${esc(t.app.timerLabel)}</span><b data-hero-timer-short>24:13</b></div>
            </div>
        </div>
    </div>
    <div class="container">
        <ul class="proof" data-reveal>
            ${t.proof.map((p) => `<li>${icon(p.icon as IconName)}<div><b>${esc(p.title)}</b><span>${esc(p.text)}</span></div></li>`).join('')}
        </ul>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ flow (4 steps) */

const flow = (t: SiteCopy) => {
    const f = t.flow;
    const visuals = [
        // capture
        `<div class="mini mini--capture">
            <div class="mini-input">${icon('plus')}<span data-type="${esc(f.task)}">${esc(f.task)}</span><kbd>↵</kbd></div>
            <div class="mini-card" data-flow-pop>${check()}<span>${esc(f.task)}</span><em class="pill">${esc(f.captured)}</em></div>
        </div>`,
        // plan
        `<div class="mini mini--plan">
            <p class="mini__label">${icon('sun')}${esc(f.today)}</p>
            <div class="mini-card is-new" data-flow-pop>${check()}<span>${esc(f.task)}</span></div>
            ${f.others.map((o) => `<div class="mini-card is-muted">${check()}<span>${esc(o)}</span></div>`).join('')}
        </div>`,
        // focus
        `<div class="mini mini--focus">
            <svg class="ring ring--lg" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="ring__value" cx="18" cy="18" r="15" pathLength="100" data-flow-ring/></svg>
            <div><b class="mono" data-flow-clock>18:42</b><span>${esc(f.task)}</span></div>
        </div>`,
        // done
        `<div class="mini mini--done">
            <div class="mini-card is-done">${check(true, ' data-flow-check')}<span>${esc(f.task)}</span></div>
            <div class="meter meter--wide"><span>${esc(f.progress)}</span><b><span data-flow-pct>64</span> %</b><i><s data-flow-bar style="--p:.64"></s></i></div>
        </div>`,
    ];
    return `
<section class="section flow" id="flow" aria-labelledby="flow-title">
    <div class="container">
        ${head('flow', f.eyebrow, f.title, f.text)}
        <ol class="flow__steps" data-flow>
            <li class="flow__line" aria-hidden="true"><i data-flow-line></i></li>
            ${f.steps.map((s, i) => `
            <li class="flow__step" data-reveal>
                <div class="flow__visual" aria-hidden="true">${visuals[i]}</div>
                <p class="flow__label"><span class="flow__num">${i + 1}</span>${esc(s.label)}</p>
                <h3>${esc(s.title)}</h3>
                <p>${esc(s.text)}</p>
            </li>`).join('')}
        </ol>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ features (bento) */

const features = (t: SiteCopy) => {
    const f = t.features;
    const tones = ['backlog', 'open', 'in-progress', 'review', 'done'];
    const prios = ['low', 'medium', 'high', 'urgent', 'medium', 'low', 'high', 'medium', 'low'];
    let n = 0;
    const toneIcon: Record<string, IconName> = { mention: 'at', assign: 'userPlus', done: 'check' };
    const tile = (cls: string, title: string, text: string, visual: string) => `
        <article class="tile tile--${cls}" data-reveal>
            <div class="tile__copy"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>
            <div class="tile__visual" aria-hidden="true">${visual}</div>
        </article>`;

    const board = `<div class="board" data-board>${f.board.columns.map((col, c) => `
        <div class="board__col">
            <p class="board__head"><i class="dot dot--${tones[c]}"></i>${esc(col)}<span>${f.board.cards[c].length}</span></p>
            ${f.board.cards[c].map((card) => {
                const p = prios[n++ % prios.length];
                return `<div class="board-card${c === 4 ? ' is-done' : ''}" data-board-card><span>${esc(card)}</span><span class="board-card__meta"><i class="prio prio--${p}"></i><span class="avatar avatar--xs avatar--${n % 4}">${'LJMA'[n % 4]}</span></span></div>`;
            }).join('')}
        </div>`).join('')}</div>`;

    const w = f.workbench;
    const workbench = `<div class="wb">
        <p class="wb__title">${esc(w.task)}</p>
        <i class="bar"><s data-wb-bar style="--p:.33"></s></i>
        <ul class="wb__subs">${w.subtasks.map((s, i) => `<li><button type="button" class="wb__sub${i === 0 ? ' is-done' : ''}" tabindex="-1" data-subtask>${check(i === 0)}<span>${esc(s)}</span></button></li>`).join('')}</ul>
        <p class="wb__rel">${icon('alert')}<span>${esc(w.blocked)}</span><b>${esc(w.blockedBy)}</b></p>
    </div>`;

    const notify = `<ul class="notifs" data-notify>${f.notify.items.map((it) => `
        <li class="notif notif--${it.tone}" data-notif><span class="notif__icon">${icon(toneIcon[it.tone])}</span><p><b>${esc(it.who)}</b> ${esc(it.what)}</p><time>${esc(it.when)}</time></li>`).join('')}</ul>`;

    const a = f.ai;
    const ai = `<div class="ai" data-ai>
        <p class="ai__prompt">${icon('sparkles')}${esc(a.prompt)}</p>
        <ul class="ai__lines">${a.answer.map((l) => `<li data-ai-line>${icon('plus')}<span>${esc(l)}</span></li>`).join('')}</ul>
        <span class="btn btn--primary btn--xs">${icon('check')}${esc(a.accept)}</span>
    </div>`;

    const p = f.plan;
    const plan = `<div class="plan">
        ${p.items.map((it) => `<div class="plan__row"><span>${esc(it.name)}</span><b>${Math.round(it.value * 100)} %</b><i class="bar"><s data-plan-bar style="--p:${it.value}"></s></i></div>`).join('')}
        <p class="pill pill--sprint">${icon('flag')}${esc(p.sprint)}</p>
    </div>`;

    return `
<section class="section features" id="features" aria-labelledby="features-title">
    <div class="container">
        ${head('features', f.eyebrow, f.title, f.text)}
        <div class="bento">
            ${tile('board', f.board.title, f.board.text, board)}
            ${tile('workbench', w.title, w.text, workbench)}
            ${tile('notify', f.notify.title, f.notify.text, notify)}
            ${tile('ai', a.title, a.text, ai)}
            ${tile('plan', p.title, p.text, plan)}
        </div>
        <p class="fineprint">${esc(a.note)}</p>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ security (dark band) */

const security = (t: SiteCopy) => {
    const s = t.security;
    const pointIcons: IconName[] = ['key', 'shield', 'users', 'globe'];
    return `
<section class="section security theme-dark" id="security" aria-labelledby="security-title">
    <div class="container">
        ${head('security', s.eyebrow, s.title, s.text)}
        <div class="security__grid">
            <ul class="roles" data-reveal>
                ${s.roles.map((r, i) => `<li><span class="role role--${i}">${esc(r.name)}</span><span>${esc(r.text)}</span></li>`).join('')}
            </ul>
            <div class="passkey" aria-hidden="true" data-passkey data-reveal>
                <div class="passkey__icon">
                    <svg class="passkey__ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100" data-passkey-ring/></svg>
                    ${icon('key', 'passkey__key')}${icon('check', 'passkey__ok')}
                </div>
                <div><b>${esc(s.passkeyTitle)}</b><p>${esc(s.passkeyText)}</p></div>
                <span class="passkey__status" data-passkey-status>${icon('lock')}${esc(s.passkeyOk)}</span>
            </div>
            <ul class="sec-points" data-reveal>
                ${s.points.map((p, i) => `<li>${icon(pointIcons[i])}<div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div></li>`).join('')}
            </ul>
        </div>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ platforms + integrations */

const platforms = (t: SiteCopy, lang: Lang) => {
    const p = t.platforms;
    const hrefs = [links.app, links.download, ''];
    const icons: IconName[] = ['globe', 'monitor', 'phone'];
    const visuals = [
        `<div class="pf-web">${t.features.board.columns.slice(1, 4).map((col, c) => `
            <div class="pf-web__col"><p><i class="dot dot--${['open', 'in-progress', 'review'][c]}"></i>${esc(col)}</p>
            ${t.features.board.cards[c + 1].map((card) => `<span>${esc(card)}</span>`).join('')}</div>`).join('')}</div>`,
        `<div class="pf-desk">
            <div class="pf-desk__bar">${logo('pf-desk__logo')}<span>${icon('timer')}24:13</span></div>
            <div class="capture-pop">
                <p>${icon('command')}${esc(p.capture)}</p>
                <div class="capture-pop__field">${icon('plus')}<span data-capture-text>${esc(p.captureSample)}</span><i class="caret"></i></div>
                <small>${esc(p.captureHint)}</small>
            </div>
        </div>`,
        `<div class="phone">
            <div class="phone__island"></div>
            <div class="phone__widget">
                <p>${icon('sun')}${esc(p.widgetTitle)}<span>${esc(p.widgetCount)}</span></p>
                ${t.app.tasks.slice(0, 3).map((task, i) => `<div class="phone__row">${check(i === 0)}<span>${esc(task.title)}</span></div>`).join('')}
            </div>
            <div class="phone__live">${icon('timer')}<span>${esc(t.app.focusTask)}</span><b>24:13</b></div>
        </div>`,
    ];
    return `
<section class="section platforms" id="platforms" aria-labelledby="platforms-title">
    <div class="container">
        ${head('platforms', p.eyebrow, p.title, p.text)}
        <ul class="pf-cards">
            ${p.items.map((item, i) => `
            <li class="pf-card" data-reveal>
                <div class="pf-card__visual pf-card__visual--${item.key}" aria-hidden="true">${visuals[i]}</div>
                <div class="pf-card__body">
                    <h3><span class="pf-card__icon">${icon(icons[i])}</span>${esc(item.title)}</h3>
                    <p>${esc(item.text)}</p>
                    ${hrefs[i] ? `<a class="link-arrow" href="${hrefs[i]}">${esc(item.cta)}${icon('arrowRight')}</a>` : `<span class="soon">${esc(item.cta)}</span>`}
                </div>
            </li>`).join('')}
        </ul>
        <div class="integrations" data-reveal>
            <div class="integrations__copy">
                <h3>${icon('sparkles')}${esc(p.integrationsTitle)}</h3>
                <p>${esc(p.integrationsText)}</p>
            </div>
            <ul class="integrations__list">${p.integrations.map((name) => `<li>${esc(name)}</li>`).join('')}</ul>
            <a class="btn btn--ghost btn--sm" href="${urlFor('docsMcp', lang)}">${esc(p.integrationsCta)}${icon('arrowRight')}</a>
        </div>
    </div>
</section>`;
};

/* ------------------------------------------------------------------ faq + cta */

const faq = (t: SiteCopy, lang: Lang) => {
    const f = t.faq;
    const fill = (a: string) => esc(a)
        .replace('{privacy}', `<a href="${legalUrl('privacy', lang)}">${esc(f.privacy)}</a>`)
        .replace('{docs}', `<a href="${urlFor('docsMcp', lang)}">${esc(f.docs)}</a>`);
    return `
<section class="section faq" id="faq" aria-labelledby="faq-title">
    <div class="container faq__grid">
        <header class="faq__head" data-reveal>
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
        <div class="cta__card theme-dark" data-reveal>
            <div class="cta__mark" aria-hidden="true">${logo('cta__logo')}</div>
            <div class="cta__copy">
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
    [hero(t), flow(t), features(t), security(t), platforms(t, lang), faq(t, lang), cta(t)].join('\n');
