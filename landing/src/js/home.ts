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
    // Floating fragments drift at their own depth.
    $$('.float', stage).forEach((el) => {
        gsap.to(el, {
            y: -Number(el.dataset.depth ?? 1) * 50, ease: 'none',
            scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: true },
        });
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
    const root = $('[data-flow]');
    if (!root) return;
    const line = $('[data-flow-line]', root);
    if (line) {
        gsap.fromTo(line, { scaleX: 0 }, {
            scaleX: 1, ease: 'none',
            scrollTrigger: { trigger: root, start: 'top 75%', end: 'bottom 60%', scrub: 0.5 },
        });
    }

    const steps = $$('.flow__step', root);
    // 1 · capture: the text is typed, then the card drops into the inbox.
    const typed = $<HTMLElement>('[data-type]', steps[0]);
    const pop1 = $('[data-flow-pop]', steps[0]);
    if (typed && pop1) {
        const text = typed.dataset.type ?? '';
        typed.textContent = '';
        gsap.set(pop1, { autoAlpha: 0, y: -8 });
        onEnter(steps[0], () => {
            let i = 0;
            const id = window.setInterval(() => {
                typed.textContent = text.slice(0, ++i);
                if (i >= text.length) {
                    window.clearInterval(id);
                    gsap.to(pop1, { autoAlpha: 1, y: 0, duration: motion.dur3, ease: motion.easeSpring });
                }
            }, 45);
        });
    }
    // 2 · plan: the task slides to the top of Today.
    const pop2 = $('[data-flow-pop]', steps[1]);
    if (pop2) {
        gsap.set(pop2, { autoAlpha: 0, x: -16 });
        onEnter(steps[1], () => gsap.to(pop2, { autoAlpha: 1, x: 0, duration: motion.dur4, ease: motion.ease, delay: 0.3 }));
    }
    // 3 · focus: the ring runs, the clock counts.
    const ring = $<SVGCircleElement>('[data-flow-ring]', steps[2]);
    const clock = $('[data-flow-clock]', steps[2]);
    if (ring) {
        gsap.set(ring, { strokeDashoffset: 100 });
        onEnter(steps[2], () => {
            gsap.to(ring, { strokeDashoffset: 25, duration: 1.6, ease: motion.easeInOut, delay: 0.2 });
            countTo(clock, 0, 18 * 60 + 42, (v) => `${pad(Math.floor(v / 60))}:${pad(Math.round(v) % 60)}`, 1.6);
        });
    }
    // 4 · done: checked, progress moves on.
    const box = $('[data-flow-check]', steps[3]);
    const bar = $('[data-flow-bar]', steps[3]);
    if (box && bar) {
        box.classList.remove('is-checked');
        bar.style.setProperty('--p', '0.58');
        const pct = $('[data-flow-pct]', steps[3]);
        if (pct) pct.textContent = '58';
        onEnter(steps[3], () => window.setTimeout(() => {
            checkOff(box);
            bar.style.setProperty('--p', '0.64');
            countTo(pct, 58, 64, (v) => String(Math.round(v)));
        }, 400));
    }
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
    flowScene();
    featuresScene();
    passkeyScene();
    captureScene();
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
