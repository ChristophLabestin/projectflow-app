import type { SiteCopy } from '../content/site';
import { icon, logo } from './icons';
import { esc, links } from './layout';

const head = (eyebrow: string, title: string, text: string, id: string) => `
    <header class="section-head" data-reveal>
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h2 class="section-title" id="${id}">${esc(title)}</h2>
        <p class="section-text">${esc(text)}</p>
    </header>`;

const check = (checked = false) =>
    `<span class="checkbox${checked ? ' is-checked' : ''}"><i class="checkbox__fill"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>`;

const workbench = (t: SiteCopy) => {
    const w = t.workbench;
    return `
<section class="workbench section" id="workbench" aria-labelledby="workbench-title">
    <div class="container split">
        <div class="split__copy">
            ${head(w.eyebrow, w.title, w.text, 'workbench-title')}
            <ul class="points" data-reveal>
                ${w.points.map((p) => `<li><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></li>`).join('')}
            </ul>
        </div>
        <div class="workbench__ui" aria-hidden="true" data-parallax="-40">
            <div class="detail" data-reveal>
                <div class="detail__head">
                    <span class="pill pill--progress"><i class="dot dot--in-progress"></i>${esc(w.status)}</span>
                    <span class="pill pill--high">${esc(w.prio)}</span>
                    <span class="detail__due">${icon('calendar')}${esc(w.due)}</span>
                </div>
                <h3 class="detail__title">${esc(w.task)}</h3>
                <div class="detail__block">
                    <p class="detail__label">${esc(w.subtasksTitle)} <span data-sub-count>2/4</span></p>
                    <i class="detail__bar"><s data-sub-bar style="--p:.5"></s></i>
                    <ul class="subtasks">
                        ${w.subtasks.map((s, i) => `<li><button type="button" class="subtask${i < 2 ? ' is-done' : ''}" data-subtask tabindex="-1">${check(i < 2)}<span>${esc(s)}</span></button></li>`).join('')}
                    </ul>
                </div>
                <div class="detail__block">
                    <p class="detail__label">${esc(w.relationsTitle)}</p>
                    <ul class="relations">
                        ${w.relations.map((r, i) => `<li class="relation relation--${i === 0 ? 'blocked' : 'related'}">${icon(i === 0 ? 'alert' : 'link')}<span>${esc(r.type)}</span><b>${esc(r.title)}</b></li>`).join('')}
                    </ul>
                </div>
                <div class="detail__block">
                    <p class="detail__label">${esc(w.activityTitle)}</p>
                    <ul class="activity">
                        ${w.activity.map((a, i) => `<li><span class="avatar avatar--sm avatar--${i + 1}">${i === 0 ? 'M' : 'J'}</span>${esc(a)}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    </div>
</section>`;
};

const notify = (t: SiteCopy) => {
    const n = t.notify;
    const toneIcon = { mention: 'at', assign: 'userPlus', done: 'check', warn: 'flag' } as const;
    return `
<section class="notify section" id="notifications" aria-labelledby="notify-title">
    <div class="container split split--reverse">
        <div class="split__copy">
            ${head(n.eyebrow, n.title, n.text, 'notify-title')}
            <ul class="ticks" data-reveal>
                ${n.points.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}
            </ul>
        </div>
        <div class="notify__ui" aria-hidden="true">
            <div class="notif-panel" data-notify>
                <div class="notif-panel__head">
                    <b>${esc(n.panelTitle)}</b>
                    <span class="seg"><span class="is-active">${esc(n.all)}</span><span>${esc(n.unread)} <em data-unread>4</em></span></span>
                </div>
                <p class="notif-panel__group">${esc(n.today)}</p>
                <ul class="notif-list">
                    ${n.items.map((item, i) => `
                    ${i === 3 ? `<li class="notif-panel__group" role="presentation">${esc(n.yesterday)}</li>` : ''}
                    <li class="notif notif--${item.tone} is-unread" data-notif>
                        <span class="notif__icon">${icon(toneIcon[item.tone as keyof typeof toneIcon])}</span>
                        <p><b>${esc(item.who)}</b> ${esc(item.what)}</p>
                        <time>${esc(item.when)}</time>
                        <i class="notif__dot"></i>
                    </li>`).join('')}
                </ul>
            </div>
            <div class="bell" data-bell>${icon('bell')}<em data-bell-count>4</em></div>
        </div>
    </div>
</section>`;
};

const ai = (t: SiteCopy) => {
    const a = t.ai;
    return `
<section class="ai section" id="ai" aria-labelledby="ai-title">
    <div class="container ai__inner">
        ${head(a.eyebrow, a.title, a.text, 'ai-title')}
        <div class="ai__ui" aria-hidden="true" data-ai>
            <div class="ai__prompt">${icon('sparkles')}<span data-ai-prompt>${esc(a.prompt)}</span></div>
            <div class="ai__answer">
                <span class="pill pill--ai">${icon('sparkles')}${esc(a.badge)}</span>
                <p>${esc(a.answerIntro)}</p>
                <ul>${a.answer.map((line) => `<li data-ai-line>${icon('plus')}<span>${esc(line)}</span></li>`).join('')}</ul>
                <span class="btn btn--primary btn--sm ai__accept">${icon('check')}${esc(a.accept)}</span>
            </div>
        </div>
        <p class="fineprint ai__note" data-reveal>${esc(a.note)}</p>
    </div>
</section>`;
};

const security = (t: SiteCopy) => {
    const s = t.security;
    const pointIcons = ['key', 'shield', 'users', 'globe'] as const;
    return `
<section class="security section theme-dark" id="security" aria-labelledby="security-title">
    <div class="security__glow" aria-hidden="true" data-parallax="80"></div>
    <div class="container">
        ${head(s.eyebrow, s.title, s.text, 'security-title')}
        <div class="security__grid">
            <ul class="roles" data-reveal-group>
                ${s.roles.map((r, i) => `<li class="role" data-reveal><span class="role__badge role__badge--${i}">${esc(r.name)}</span><p>${esc(r.text)}</p></li>`).join('')}
            </ul>
            <div class="passkey" aria-hidden="true" data-passkey>
                <div class="passkey__icon">
                    <svg class="passkey__ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100" data-passkey-ring/></svg>
                    ${icon('key', 'passkey__key')}
                    ${icon('check', 'passkey__ok')}
                </div>
                <b>${esc(s.passkeyTitle)}</b>
                <p>${esc(s.passkeyText)}</p>
                <span class="passkey__status" data-passkey-status>${icon('lock')}<span>${esc(s.passkeyOk)}</span></span>
            </div>
        </div>
        <ul class="sec-points" data-reveal-group>
            ${s.points.map((p, i) => `<li data-reveal>${icon(pointIcons[i])}<h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></li>`).join('')}
        </ul>
    </div>
</section>`;
};

const platforms = (t: SiteCopy) => {
    const p = t.platforms;
    const hrefs = [links.app, links.download, ''];
    const icons = ['globe', 'monitor', 'phone'] as const;
    return `
<section class="platforms section" id="platforms" aria-labelledby="platforms-title">
    <div class="container">
        ${head(p.eyebrow, p.title, p.text, 'platforms-title')}
        <div class="devices" aria-hidden="true" data-devices>
            <div class="device device--desktop" data-depth="0.4">
                <div class="device__bar"><span></span><span></span><span></span></div>
                <div class="device__screen">
                    <div class="mini-board">
                        ${[5, 3, 4, 2].map((n, c) => `<div class="mini-board__col">${'<i></i>'.repeat(n - c % 2)}</div>`).join('')}
                    </div>
                </div>
            </div>
            <div class="device device--capture" data-depth="1">
                <div class="capture-pop">
                    <p>${icon('command')}${esc(p.capture)}</p>
                    <div class="capture-pop__field">${icon('plus')}<span data-capture-text>${esc(p.captureSample)}</span><i class="caret"></i></div>
                    <small>${esc(p.captureHint)}</small>
                </div>
            </div>
            <div class="device device--phone" data-depth="0.7">
                <div class="phone">
                    <div class="phone__island"></div>
                    <div class="phone__widget">
                        <p>${icon('sun')}${esc(p.widgetTitle)}<span>${esc(p.widgetCount)}</span></p>
                        ${t.app.tasks.slice(0, 3).map((task, i) => `<div class="phone__row">${check(i === 0)}<span>${esc(task.title)}</span></div>`).join('')}
                    </div>
                    <div class="phone__live">${icon('timer')}<span>${esc(t.app.focusTask)}</span><b>24:13</b></div>
                </div>
            </div>
        </div>
        <ul class="platform-cards" data-reveal-group>
            ${p.items.map((item, i) => `
            <li class="platform-card" data-reveal>
                <span class="platform-card__icon">${icon(icons[i])}</span>
                <h3>${esc(item.title)}</h3>
                <p>${esc(item.text)}</p>
                ${hrefs[i] ? `<a class="link-arrow" href="${hrefs[i]}">${esc(item.cta)}${icon('arrowRight')}</a>` : `<span class="soon">${esc(item.cta)}</span>`}
            </li>`).join('')}
        </ul>
    </div>
</section>`;
};

const cta = (t: SiteCopy) => `
<section class="cta section" aria-labelledby="cta-title">
    <div class="container">
        <div class="cta__card theme-dark" data-reveal>
            <div class="cta__logo" aria-hidden="true" data-parallax="-30">${logo('cta__mark')}</div>
            <h2 class="section-title" id="cta-title">${esc(t.cta.title)}</h2>
            <p class="section-text">${esc(t.cta.text)}</p>
            <div class="cta__actions">
                <a class="btn btn--primary btn--lg" href="${links.register}" data-magnetic>${esc(t.cta.primary)}${icon('arrowRight')}</a>
                <a class="btn btn--ghost btn--lg" href="${links.login}" data-magnetic>${esc(t.cta.secondary)}</a>
            </div>
        </div>
    </div>
</section>`;

/** Sections after the board (workbench, notifications, AI, security, platforms, CTA). */
export const sectionsRest = (t: SiteCopy): string =>
    [workbench(t), notify(t), ai(t), security(t), platforms(t), cta(t)].join('\n');
