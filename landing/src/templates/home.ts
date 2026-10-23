import type { SiteCopy } from '../content/site';
import { icon, logo } from './icons';
import { esc, headline, links } from './layout';
import { sectionsRest } from './home-sections';

const prioClass = (prio: string) => `prio prio--${prio}`;

const sectionHead = (eyebrow: string, title: string, text?: string, id?: string) => `
    <header class="section-head" data-reveal>
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h2 class="section-title"${id ? ` id="${id}"` : ''}>${headline(title)}</h2>
        ${text ? `<p class="section-text">${esc(text)}</p>` : ''}
    </header>`;

/** The hero product window: sidebar + Today view, rendered as real markup. */
const appWindow = (t: SiteCopy) => {
    const a = t.app;
    const navIcons = ['sun', 'inbox', 'folder', 'bell'] as const;
    const projectTones = ['open', 'planning', 'done'];
    return `
        <div class="app-window" data-hero-window>
            <div class="app-window__bar"><span></span><span></span><span></span></div>
            <div class="app-window__body">
                <aside class="app-side">
                    <div class="app-side__ws"><span class="app-side__ws-logo">${logo('app-side__logo')}</span>${esc(a.workspace)}</div>
                    <ul class="app-side__nav">
                        ${a.nav.map((label, i) => `<li class="${i === 0 ? 'is-active' : ''}">${icon(navIcons[i])}<span>${esc(label)}</span>${i === 3 ? '<em class="app-badge" data-hero-badge>2</em>' : ''}</li>`).join('')}
                    </ul>
                    <p class="app-side__label">${esc(a.nav[2])}</p>
                    <ul class="app-side__projects">
                        ${a.projects.map((p, i) => `<li><i class="dot dot--${projectTones[i]}"></i>${esc(p)}</li>`).join('')}
                    </ul>
                </aside>
                <div class="app-main">
                    <div class="app-main__head">
                        <div><h3 class="app-main__title">${esc(a.todayTitle)}</h3><p class="app-main__date">${esc(a.todayDate)}</p></div>
                        <div class="app-progress" aria-hidden="true"><span>${esc(a.progress)}</span><b data-hero-progress-label>40 %</b><i><s data-hero-progress style="--p:.4"></s></i></div>
                    </div>
                    <div class="focus-card">
                        <span class="focus-card__label">${icon('timer')}${esc(a.focusLabel)}</span>
                        <p class="focus-card__task">${esc(a.focusTask)}</p>
                        <span class="focus-card__time" data-hero-timer>00:24:13</span>
                    </div>
                    <ul class="task-list">
                        ${a.tasks.map((task, i) => `
                        <li class="task-row" ${i === 1 ? 'data-hero-check' : ''}>
                            <span class="checkbox"><i class="checkbox__fill"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>
                            <span class="task-row__title">${esc(task.title)}</span>
                            <span class="chip">${esc(task.project)}</span>
                            <i class="${prioClass(task.prio)}"></i>
                        </li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>`;
};

const hero = (t: SiteCopy) => `
<section class="hero" aria-labelledby="hero-title">
    <div class="hero__backdrop" aria-hidden="true">
        <div class="hero__grid" data-depth="0.15"></div>
        <div class="hero__glow hero__glow--a" data-depth="0.35"></div>
        <div class="hero__glow hero__glow--b" data-depth="0.6"></div>
    </div>
    <div class="container hero__copy">
        <p class="eyebrow hero-in" style="--i:0">${esc(t.hero.eyebrow)}</p>
        <h1 class="hero__title" id="hero-title">${t.hero.title.map((w, i, all) => `<span class="word"><span class="hero-in" style="--i:${i + 1}">${headline(w)}</span></span>${w.endsWith('.') && i < all.length - 1 ? '<span class="hero__break"></span>' : ''}`).join(' ')}</h1>
        <p class="hero__lead hero-in" style="--i:${t.hero.title.length + 1}">${esc(t.hero.lead)}</p>
        <div class="hero__ctas hero-in" style="--i:${t.hero.title.length + 2}">
            <a class="btn btn--primary btn--lg" href="${links.register}" data-magnetic>${esc(t.hero.primary)}${icon('arrowRight')}</a>
            <a class="btn btn--ghost btn--lg" href="${links.download}" data-magnetic>${icon('download')}${esc(t.hero.secondary)}</a>
        </div>
        <p class="hero__note hero-in" style="--i:${t.hero.title.length + 3}">${icon('key')}${esc(t.hero.note)}</p>
    </div>
    <div class="hero__stage" data-hero-stage role="img" aria-label="${esc(t.a11y.preview)}">
        <div class="hero__tilt" data-tilt aria-hidden="true">
            ${appWindow(t)}
            <div class="float float--notif" data-depth="1.1" data-hero-notif>
                <span class="avatar avatar--l">L</span>
                <div><b>${esc(t.app.notifTitle)}</b><p>${esc(t.app.notifBody)}</p></div>
            </div>
            <div class="float float--timer" data-depth="1.6">
                <svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="ring__value" cx="18" cy="18" r="15" pathLength="100" data-hero-ring/></svg>
                <div><span>${esc(t.app.timerLabel)}</span><b data-hero-timer-short>24:13</b></div>
            </div>
            <div class="float float--done" data-depth="0.8">
                <span class="checkbox is-checked"><i class="checkbox__fill"></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>
                <div><span>${esc(t.app.doneLabel)}</span><b>${esc(t.app.doneTask)}</b></div>
            </div>
        </div>
    </div>
</section>`;

const journey = (t: SiteCopy) => {
    const j = t.journey;
    const stepIcons = ['inbox', 'sun', 'timer', 'check'] as const;
    return `
<section class="journey section" id="journey" aria-labelledby="journey-title">
    <div class="container">${sectionHead(j.eyebrow, j.title, undefined, 'journey-title')}</div>
    <div class="journey__pin" data-journey>
        <div class="container journey__grid">
            <div class="journey__copy">
            <ol class="journey__steps">
                ${j.steps.map((s, i) => `
                <li class="journey__step" data-step="${i}">
                    <span class="journey__num">${icon(stepIcons[i])}<span>${String(i + 1).padStart(2, '0')} · ${esc(s.label)}</span></span>
                    <h3>${headline(s.title)}</h3>
                    <p>${esc(s.text)}</p>
                </li>`).join('')}
            </ol>
            <div class="journey__dots" aria-hidden="true">${j.steps.map((_, i) => `<i data-journey-dot="${i}"></i>`).join('')}</div>
            </div>
            <div class="journey__stage stage" aria-hidden="true">
                <div class="panel">
                    <div class="panel__tabs">
                        <span class="panel__indicator" data-journey-indicator></span>
                        ${[j.inbox, j.today, j.focus, j.done].map((label, i) => `<span class="panel__tab" data-journey-tab="${i}">${icon(stepIcons[i])}<span>${esc(label)}</span></span>`).join('')}
                    </div>
                    <div class="panel__body">
                        <div class="capture-bar" data-journey-capture>${icon('plus')}<span class="capture-bar__text" data-journey-typed>${esc(j.task)}</span><kbd>↵</kbd></div>
                        <ul class="ghost-list" data-journey-ghosts>
                            ${j.others.map((o) => `<li><span class="checkbox"><i class="checkbox__fill"></i><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><span>${esc(o)}</span></li>`).join('')}
                        </ul>
                        <div class="travel-card" data-journey-card>
                            <span class="travel-card__focus" data-journey-focus></span>
                            <span class="checkbox is-checked" data-journey-check><i class="checkbox__fill"></i><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>
                            <div class="travel-card__text">
                                <b class="travel-card__title">${esc(j.task)}<i class="strike" data-journey-strike></i></b>
                                <span class="travel-card__meta"><i class="dot dot--open"></i>${esc(j.project)}</span>
                            </div>
                            <span class="travel-card__states">
                                <em class="state state--capture" data-journey-state="0">${esc(j.captured)}</em>
                                <em class="state state--plan" data-journey-state="1">${icon('calendar')}${esc(j.scheduled)}</em>
                                <em class="state state--focus" data-journey-state="2">${icon('timer')}<span data-journey-clock>00:00</span></em>
                                <em class="state state--done" data-journey-state="3">${icon('check')}${esc(j.completed)}</em>
                            </span>
                        </div>
                        <div class="panel__progress" data-journey-progress>
                            <span>${esc(j.projectProgress)} · ${esc(j.project)}</span>
                            <b><span data-journey-percent>58</span> %</b>
                            <i><s data-journey-bar></s></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>`;
};

const board = (t: SiteCopy) => {
    const b = t.board;
    const tones = ['backlog', 'open', 'in-progress', 'review', 'done'];
    const prios = ['low', 'medium', 'high', 'medium', 'low', 'urgent', 'medium', 'low', 'high'];
    let n = 0;
    return `
<section class="board-section section" id="board" aria-labelledby="board-title">
    <div class="container board-section__grid">
        <div>
            ${sectionHead(b.eyebrow, b.title, b.text, 'board-title')}
            <dl class="stats" data-reveal>
                ${b.stats.map((s) => `<div class="stat"><dt>${esc(s.label)}</dt><dd><span data-count="${s.value}">${s.value}</span>${esc(s.suffix)}</dd></div>`).join('')}
            </dl>
            <p class="fineprint" data-reveal>${esc(b.statsNote)}</p>
        </div>
        <ul class="feature-list" data-reveal-group>
            ${b.features.map((f) => `<li data-reveal><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join('')}
        </ul>
    </div>
    <div class="board-wrap" data-board aria-hidden="true">
        <div class="board" data-board-track>
            ${b.columns.map((col, c) => `
            <div class="board__col board__col--${tones[c]}">
                <div class="board__head"><i class="dot dot--${tones[c]}"></i>${esc(col)}<span>${b.cards[c].length}</span></div>
                ${b.cards[c].map((card) => {
                    const prio = prios[n++ % prios.length];
                    return `<div class="board-card" data-board-card><span class="board-card__title">${esc(card)}</span><span class="board-card__meta"><i class="prio prio--${prio}"></i><span class="avatar avatar--sm avatar--${n % 4}">${'LJMA'[n % 4]}</span></span></div>`;
                }).join('')}
            </div>`).join('')}
        </div>
    </div>
</section>`;
};

export const homeBody = (t: SiteCopy): string => [hero(t), journey(t), board(t), sectionsRest(t)].join('\n');
