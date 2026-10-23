import '../styles/home.scss';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { finePointer, motion, prefersMotion } from './motion';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
const pad = (n: number) => String(n).padStart(2, '0');

/** Runs `fn` once when `el` scrolls into view. */
const onEnter = (el: Element | null, fn: () => void, start = 'top 80%') => {
    if (el) ScrollTrigger.create({ trigger: el, start, once: true, onEnter: fn });
};

const countTo = (el: HTMLElement | null, from: number, to: number, format: (v: number) => string, duration: number = motion.dur4) => {
    if (!el) return;
    const state = { v: from };
    gsap.to(state, { v: to, duration, ease: motion.ease, onUpdate: () => { el.textContent = format(state.v); } });
};

const checkOff = (box: Element | null | undefined) => {
    if (!box) return;
    box.classList.add('is-checked');
    gsap.fromTo(box, { scale: 0.7 }, { scale: 1, duration: motion.dur3, ease: motion.easeSpring });
};

/* ------------------------------------------------------------------ hero */

function heroLive() {
    const timer = $('[data-hero-timer]');
    const timerShort = $('[data-hero-timer-short]');
    const ring = $<SVGCircleElement>('[data-hero-ring]');
    let seconds = 24 * 60 + 13;
    window.setInterval(() => {
        if (document.hidden) return;
        seconds += 1;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (timer) timer.textContent = `00:${pad(m)}:${pad(s)}`;
        if (timerShort) timerShort.textContent = `${pad(m)}:${pad(s)}`;
        if (ring) ring.style.strokeDashoffset = String(38 - ((seconds % 1500) / 1500) * 38);
    }, 1000);

    const notif = $('[data-hero-notif]');
    if (notif) gsap.fromTo(notif, { autoAlpha: 0, y: -12, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: motion.dur4, ease: motion.easeSpring, delay: 2 });
    const badge = $('[data-hero-badge]');
    if (badge) gsap.fromTo(badge, { scale: 0.4 }, { scale: 1, duration: motion.dur3, ease: motion.easeSpring, delay: 2.15 });

    window.setTimeout(() => {
        const row = $('[data-hero-check]');
        row?.classList.add('is-done');
        checkOff(row?.querySelector('.checkbox'));
        $('[data-hero-progress]')?.style.setProperty('--p', '0.6');
        countTo($('[data-hero-progress-label]'), 40, 60, (v) => `${Math.round(v)} %`);
    }, 3200);
}

function heroScene() {
    const stage = $('[data-hero-stage]');
    const tilt = $('[data-tilt]');
    const win = $('[data-hero-window]');
    if (!stage || !tilt || !win) return;

    // The window straightens out while the hero scrolls away.
    gsap.fromTo(tilt, { rotateX: 12, scale: 0.97 }, {
        rotateX: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top 90%', end: 'top 25%', scrub: 0.4 },
    });
    // Floating fragments drift at their own depth and spread outwards.
    $$('.float', stage).forEach((el, i) => {
        const depth = Number(el.dataset.depth ?? 1);
        gsap.to(el, {
            y: -depth * 90, x: (i % 2 ? -1 : 1) * depth * 40, ease: 'none',
            scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: true },
        });
    });
    // Copy lifts away faster than the window (depth), the glow drifts slower.
    gsap.to('.hero__copy', {
        y: -90, autoAlpha: 0.2, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '55% top', scrub: true },
    });
    gsap.to('.hero__glow', {
        yPercent: 30, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    if (!finePointer()) return;
    const rx = gsap.quickTo(win, 'rotationX', { duration: 0.9, ease: 'power3.out' });
    const ry = gsap.quickTo(win, 'rotationY', { duration: 0.9, ease: 'power3.out' });
    const floats = $$('.float', stage).map((el) => ({ depth: Number(el.dataset.depth ?? 1), x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }) }));
    const hero = $('.hero')!;
    hero.addEventListener('pointermove', (event) => {
        const nx = event.clientX / window.innerWidth - 0.5;
        const ny = event.clientY / window.innerHeight - 0.5;
        ry(nx * 4);
        rx(-ny * 2.5);
        floats.forEach((f) => f.x(nx * f.depth * 14));
    });
    hero.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
        floats.forEach((f) => f.x(0));
    });
}

/* ------------------------------------------------------------------ flow */

function flowScene() {
    const pin = $('[data-flow-pin]');
    const track = $('[data-flow-track]');
    if (!pin || !track) return;
    const panels = $$('[data-flow-panel]', track);
    const bars = $$('[data-flow-progress]', pin);
    let container: gsap.core.Tween | undefined;

    // Desktop: pin the section and move the panels sideways; mobile keeps the vertical stack.
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1000px)', () => {
        const distance = () => track.scrollWidth - window.innerWidth;
        container = gsap.to(track, {
            x: () => -distance(), ease: 'none',
            scrollTrigger: {
                trigger: pin, start: 'top top', end: () => `+=${distance()}`,
                pin: true, scrub: 0.6, invalidateOnRefresh: true,
                onUpdate: (self) => bars.forEach((bar, i) => {
                    const local = gsap.utils.clamp(0, 1, self.progress * panels.length - i);
                    bar.style.transform = `scaleX(${local})`;
                }),
            },
        });
        // Panels ease in from depth as they approach the centre.
        panels.forEach((panel) => {
            gsap.fromTo(panel, { scale: 0.9, rotateY: -8, transformPerspective: 1400 }, {
                scale: 1, rotateY: 0, ease: 'none',
                scrollTrigger: { trigger: panel, containerAnimation: container, start: 'left 95%', end: 'left 45%', scrub: true },
            });
        });
        return () => { container = undefined; };
    });

    const when = (panel: Element | undefined, fn: () => void) => {
        if (!panel) return;
        if (container) ScrollTrigger.create({ trigger: panel, containerAnimation: container, start: 'left 70%', once: true, onEnter: fn });
        else onEnter(panel, fn, 'top 70%');
    };

    // 1 · capture: the text is typed, then the card drops into the inbox.
    const typed = $<HTMLElement>('[data-type]', panels[0]);
    const pop1 = $('[data-flow-pop]', panels[0]);
    if (typed && pop1) {
        const text = typed.dataset.type ?? '';
        typed.textContent = '';
        gsap.set(pop1, { autoAlpha: 0, y: -10 });
        onEnter(pin, () => {
            let i = 0;
            const id = window.setInterval(() => {
                typed.textContent = text.slice(0, ++i);
                if (i >= text.length) {
                    window.clearInterval(id);
                    gsap.to(pop1, { autoAlpha: 1, y: 0, duration: motion.dur3, ease: motion.easeSpring });
                }
            }, 45);
        }, 'top 40%');
    }
    // 2 · plan: the task slides to the top of Today.
    const pop2 = $('[data-flow-pop]', panels[1]);
    if (pop2) {
        gsap.set(pop2, { autoAlpha: 0, x: -24 });
        when(panels[1], () => gsap.to(pop2, { autoAlpha: 1, x: 0, duration: motion.dur4, ease: motion.easeSpring, delay: 0.2 }));
    }
    // 3 · focus: the ring runs, the clock counts.
    const ring = $<SVGCircleElement>('[data-flow-ring]', panels[2]);
    const clock = $('[data-flow-clock]', panels[2]);
    if (ring) {
        gsap.set(ring, { strokeDashoffset: 100 });
        when(panels[2], () => {
            gsap.to(ring, { strokeDashoffset: 25, duration: 1.6, ease: motion.easeInOut, delay: 0.2 });
            countTo(clock, 0, 18 * 60 + 42, (v) => `${pad(Math.floor(v / 60))}:${pad(Math.round(v) % 60)}`, 1.6);
        });
    }
    // 4 · done: checked, progress moves on.
    const box = $('[data-flow-check]', panels[3]);
    const bar = $('[data-flow-bar]', panels[3]);
    if (box && bar) {
        box.classList.remove('is-checked');
        bar.style.setProperty('--p', '0.58');
        const pct = $('[data-flow-pct]', panels[3]);
        if (pct) pct.textContent = '58';
        when(panels[3], () => window.setTimeout(() => {
            checkOff(box);
            bar.style.setProperty('--p', '0.64');
            countTo(pct, 58, 64, (v) => String(Math.round(v)));
        }, 300));
    }
}

/* ------------------------------------------------------------------ titles, statement */

/** Section titles: words rise out of their masks; eyebrow and text fade up. */
function titlesScene() {
    $$('[data-words]').forEach((title) => {
        const inner = $$('.w > span', title);
        const head = title.closest('.sec-head') ?? title;
        const fades = $$('[data-fade]', head);
        const tl = gsap.timeline({ paused: true })
            .to(fades, { autoAlpha: 1, y: 0, duration: motion.dur4, ease: motion.ease, stagger: 0.1 }, 0)
            .to(inner, { y: 0, duration: 1, ease: motion.ease, stagger: 0.05 }, 0.05);
        onEnter(title, () => tl.play(), 'top 88%');
    });
}

/** Statement: each word lights up in reading order, coupled to scroll. */
function statementScene() {
    const text = $('[data-statement]');
    if (!text) return;
    gsap.to($$(':scope > span:not(.is-hl)', text), {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: text, start: 'top 80%', end: 'bottom 45%', scrub: 0.5 },
    });
}

/* ------------------------------------------------------------------ features */

function featuresScene() {
    const board = $('[data-board]');
    if (board) {
        const cards = $$('[data-board-card]', board);
        gsap.set(cards, { autoAlpha: 0, y: -20 });
        onEnter(board, () => gsap.to(cards, { autoAlpha: 1, y: 0, duration: motion.dur3, ease: motion.easeSpring, stagger: 0.06 }));
    }

    const subs = $$<HTMLButtonElement>('[data-subtask]');
    const wbBar = $('[data-wb-bar]');
    const update = () => wbBar?.style.setProperty('--p', String(subs.filter((b) => b.classList.contains('is-done')).length / subs.length));
    const toggle = (b: HTMLButtonElement) => {
        b.classList.toggle('is-done');
        b.querySelector('.checkbox')?.classList.toggle('is-checked', b.classList.contains('is-done'));
        update();
    };
    subs.forEach((b) => b.addEventListener('click', () => toggle(b)));
    onEnter(subs[0], () => window.setTimeout(() => subs[1] && !subs[1].classList.contains('is-done') && toggle(subs[1]), 700));

    const notifs = $$('[data-notif]');
    gsap.set(notifs, { autoAlpha: 0, x: 24 });
    onEnter($('[data-notify]'), () => gsap.to(notifs, { autoAlpha: 1, x: 0, duration: motion.dur4, ease: motion.ease, stagger: 0.15 }));

    const ai = $('[data-ai]');
    if (ai) {
        const lines = $$('[data-ai-line]', ai);
        const tl = gsap.timeline({ paused: true })
            .from('.ai__prompt', { autoAlpha: 0, y: 10, duration: motion.dur3, ease: motion.ease })
            .from(lines, { autoAlpha: 0, x: -10, duration: motion.dur3, ease: motion.ease, stagger: 0.18 }, '+=0.3')
            .from('.ai .btn', { autoAlpha: 0, scale: 0.9, duration: motion.dur3, ease: motion.easeSpring });
        onEnter(ai, () => tl.play());
    }

    const planBars = $$('[data-plan-bar]');
    const targets = planBars.map((b) => b.style.getPropertyValue('--p'));
    planBars.forEach((b) => b.style.setProperty('--p', '0'));
    onEnter(planBars[0], () => planBars.forEach((b, i) => window.setTimeout(() => b.style.setProperty('--p', targets[i]), 150 * i)));
}

/* ------------------------------------------------------------------ security, platforms */

function passkeyScene() {
    const root = $('[data-passkey]');
    if (!root) return;
    const tl = gsap.timeline({ paused: true })
        .set('.passkey__ok', { autoAlpha: 0, scale: 0.6 })
        .set('[data-passkey-status]', { autoAlpha: 0, y: 8 })
        .set('.passkey__key', { autoAlpha: 1 })
        .fromTo('[data-passkey-ring]', { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.2, ease: motion.easeInOut })
        .to('.passkey__key', { autoAlpha: 0, scale: 0.6, duration: motion.dur2 })
        .to('.passkey__ok', { autoAlpha: 1, scale: 1, duration: motion.dur3, ease: motion.easeSpring }, '<0.1')
        .to('[data-passkey-status]', { autoAlpha: 1, y: 0, duration: motion.dur3, ease: motion.ease }, '<0.15');
    tl.progress(0).pause();
    onEnter(root, () => tl.play(), 'top 70%');
}

function captureScene() {
    const field = $('[data-capture-text]');
    if (!field) return;
    const text = field.textContent ?? '';
    field.textContent = '';
    onEnter(field, () => {
        let i = 0;
        const id = window.setInterval(() => {
            field.textContent = text.slice(0, ++i);
            if (i >= text.length) window.clearInterval(id);
        }, 55);
    });
}

/* ------------------------------------------------------------------ depth + microinteractions */

/** Bento tiles rise out of depth, column by column, coupled to scroll. */
function tilesScene() {
    $$('[data-tile]').forEach((tile, i) => {
        gsap.fromTo(tile, { y: 90, rotateX: 14, autoAlpha: 0, transformPerspective: 1200, transformOrigin: '50% 100%' }, {
            y: 0, rotateX: 0, autoAlpha: 1, ease: 'power2.out',
            scrollTrigger: { trigger: tile, start: `top ${100 - (i % 3) * 4}%`, end: 'top 62%', scrub: 0.6 },
        });
    });
}

/** Cards: light follows the cursor; a slight 3D tilt towards it. */
function spotlights() {
    if (!finePointer()) return;
    $$('[data-spot]').forEach((card) => {
        const tiltable = card.matches('[data-pf]');
        const rx = tiltable ? gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' }) : null;
        const ry = tiltable ? gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' }) : null;
        if (tiltable) gsap.set(card, { transformPerspective: 1000 });
        card.addEventListener('pointermove', (event) => {
            const r = card.getBoundingClientRect();
            const x = (event.clientX - r.left) / r.width;
            const y = (event.clientY - r.top) / r.height;
            card.style.setProperty('--mx', `${x * 100}%`);
            card.style.setProperty('--my', `${y * 100}%`);
            card.classList.add('is-lit');
            rx?.((0.5 - y) * 4);
            ry?.((x - 0.5) * 5);
        });
        card.addEventListener('pointerleave', () => {
            card.classList.remove('is-lit');
            rx?.(0);
            ry?.(0);
        });
    });
}

/** Security: the light canvas fades into the dark band; roles and points slide in. */
function securityScene() {
    const section = $('#security');
    if (!section) return;
    gsap.fromTo('[data-veil]', { opacity: 1 }, {
        opacity: 0, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top 95%', end: 'top 35%', scrub: true },
    });
    const roles = $$('[data-roles] li');
    onEnter(roles[0], () => gsap.to(roles, { autoAlpha: 1, x: 0, duration: motion.dur4, ease: motion.ease, stagger: 0.09 }));
    const points = $$('[data-stagger] > li');
    onEnter(points[0], () => gsap.to(points, { autoAlpha: 1, x: 0, duration: motion.dur4, ease: motion.ease, stagger: 0.08 }), 'top 92%');
    if (finePointer()) {
        section.addEventListener('pointermove', (event) => {
            const r = section.getBoundingClientRect();
            section.style.setProperty('--mx', `${event.clientX - r.left}px`);
            section.style.setProperty('--my', `${event.clientY - r.top}px`);
        });
    }
}

/** Platform cards arrive with staggered depth and keep drifting at their own speed. */
function platformsScene() {
    $$('[data-pf]').forEach((card, i) => {
        gsap.fromTo(card, { y: 60 + i * 40, autoAlpha: 0 }, {
            y: 0, autoAlpha: 1, ease: 'power2.out',
            scrollTrigger: { trigger: card, start: 'top 98%', end: 'top 60%', scrub: 0.6 },
        });
        const visual = $('.pf-card__visual > *', card);
        if (visual) {
            gsap.fromTo(visual, { y: 30 }, {
                y: -10, ease: 'none',
                scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
            });
        }
    });
}

/** CTA card scales into place, the logo mark turns with the scroll. */
function ctaScene() {
    const card = $('[data-cta]');
    if (!card) return;
    gsap.fromTo(card, { scale: 0.92, autoAlpha: 0.4 }, {
        scale: 1, autoAlpha: 1, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top 95%', end: 'top 55%', scrub: 0.5 },
    });
    gsap.fromTo('[data-cta-mark]', { rotate: -25 }, {
        rotate: 15, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
    });
}

function scrollProgress() {
    const bar = $('[data-scroll-progress]');
    if (!bar) return;
    gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
}

/* ------------------------------------------------------------------ global */

/** Header switches to the dark tokens while it sits over a dark section. */
function headerTheme() {
    const header = $('[data-header]');
    if (!header) return;
    $$('main section.theme-dark').forEach((section) => {
        ScrollTrigger.create({ trigger: section, start: 'top 32px', end: 'bottom 32px', toggleClass: { targets: header, className: 'is-dark' } });
    });
}

function reveals() {
    ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%',
        once: true,
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: motion.dur4, ease: motion.ease, stagger: motion.stagger }),
    });
}

if (prefersMotion()) {
    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add('is-ready');
    heroLive();
    heroScene();
    titlesScene();
    statementScene();
    flowScene();
    featuresScene();
    tilesScene();
    spotlights();
    securityScene();
    passkeyScene();
    platformsScene();
    captureScene();
    ctaScene();
    scrollProgress();
    headerTheme();
    reveals();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
} else {
    // Static mode still allows checking subtasks by hand.
    $$<HTMLButtonElement>('[data-subtask]').forEach((b) => b.addEventListener('click', () => {
        b.classList.toggle('is-done');
        b.querySelector('.checkbox')?.classList.toggle('is-checked', b.classList.contains('is-done'));
    }));
}

// Dev-only hook so scenes can be verified in a hidden/background preview (no rAF there).
if (import.meta.env.DEV) Object.assign(window, { __motion: { gsap, ScrollTrigger } });
