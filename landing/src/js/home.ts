import '../styles/home.scss';
import '../styles/sections.scss';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { finePointer, motion, prefersMotion } from './motion';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

const pad = (n: number) => String(n).padStart(2, '0');

/** Hero: live UI fragments (ticking focus timer, a task gets checked off, a mention arrives). */
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
        if (ring) ring.style.strokeDashoffset = String(40 - ((seconds % 1500) / 1500) * 40);
    }, 1000);

    const notif = $('[data-hero-notif]');
    if (notif) {
        gsap.fromTo(notif, { opacity: 0, y: -14, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: motion.dur4, ease: motion.easeSpring, delay: 2.2 });
        const badge = $('[data-hero-badge]');
        if (badge) gsap.fromTo(badge, { scale: 0.4 }, { scale: 1, duration: motion.dur3, ease: motion.easeSpring, delay: 2.35 });
    }

    const row = $('[data-hero-check]');
    const bar = $('[data-hero-progress]');
    const label = $('[data-hero-progress-label]');
    window.setTimeout(() => {
        row?.classList.add('is-done');
        row?.querySelector('.checkbox')?.classList.add('is-checked');
        if (row) gsap.fromTo(row.querySelector('.checkbox'), { scale: 0.7 }, { scale: 1, duration: motion.dur3, ease: motion.easeSpring });
        bar?.style.setProperty('--p', '0.6');
        if (label) {
            const counter = { v: 40 };
            gsap.to(counter, { v: 60, duration: motion.dur4, ease: motion.ease, onUpdate: () => { label.textContent = `${Math.round(counter.v)} %`; } });
        }
    }, 3400);
}

/** Hero: window tilts into place while scrolling; layers drift at their own depth; cursor tilt. */
function heroScene() {
    const stage = $('[data-hero-stage]');
    const tilt = $('[data-tilt]');
    const win = $('[data-hero-window]');
    if (!stage || !tilt || !win) return;

    gsap.fromTo(tilt, { rotateX: 14, scale: 0.96, y: 0 }, {
        rotateX: 0, scale: 1, y: -40, ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top bottom', end: 'top 20%', scrub: 0.4 },
    });

    $$('.hero [data-depth]').forEach((el) => {
        const depth = Number(el.dataset.depth ?? 0);
        gsap.to(el, {
            yPercent: el.classList.contains('float') ? 0 : depth * 30,
            y: el.classList.contains('float') ? -depth * 60 : 0,
            ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
    });

    if (!finePointer()) return;
    const rx = gsap.quickTo(win, 'rotationX', { duration: motion.dur3 * 1.5, ease: 'power3.out' });
    const ry = gsap.quickTo(win, 'rotationY', { duration: motion.dur3 * 1.5, ease: 'power3.out' });
    const floats = $$('.float', stage).map((el) => ({
        depth: Number(el.dataset.depth ?? 1),
        x: gsap.quickTo(el, 'x', { duration: motion.dur4, ease: 'power3.out' }),
    }));
    const hero = $('.hero')!;
    hero.addEventListener('pointermove', (event) => {
        const nx = event.clientX / window.innerWidth - 0.5;
        const ny = event.clientY / window.innerHeight - 0.5;
        ry(nx * 5);
        rx(-ny * 3);
        floats.forEach((f) => f.x(nx * f.depth * 16));
    });
    hero.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
        floats.forEach((f) => f.x(0));
    });
}

/** Journey: pinned 4-step story; a task travels Inbox → Today → Focus → Done. */
function journeyScene() {
    const pin = $('[data-journey]');
    if (!pin) return;
    const steps = $$('.journey__step', pin);
    const card = $('[data-journey-card]', pin)!;
    const body = $('.panel__body', pin)!;
    const states = $$('[data-journey-state]', pin);
    const check = $('[data-journey-check]', pin)!;
    const checkPath = $<SVGPathElement>('[data-journey-check] path', pin)!;
    const fill = $('[data-journey-check] .checkbox__fill', pin)!;
    const clock = $('[data-journey-clock]', pin)!;
    const percent = $('[data-journey-percent]', pin)!;
    const ghosts = $('[data-journey-ghosts]', pin)!;
    const capture = $('[data-journey-capture]', pin)!;
    const progress = $('[data-journey-progress]', pin)!;

    const slot = 74; // card height + gap
    // Focus: centred in the free space above the progress block.
    const focusY = () => (body.clientHeight - progress.offsetHeight - 12 - card.offsetHeight) / 2 - 64;
    const doneY = () => body.clientHeight - progress.offsetHeight - card.offsetHeight - 16 - 64;

    gsap.set(steps, { autoAlpha: 0, y: 24 });
    gsap.set(steps[0], { autoAlpha: 1, y: 0 });
    gsap.set('[data-journey-indicator]', { xPercent: 0 });
    gsap.set('[data-journey-typed]', { clipPath: 'inset(0 100% 0 0)' });
    gsap.set(card, { autoAlpha: 0, y: -12, scale: 0.96 });
    gsap.set(states, { autoAlpha: 0 });
    gsap.set(states[0], { autoAlpha: 1 });
    gsap.set(fill, { opacity: 0 });
    gsap.set(checkPath, { strokeDashoffset: 24 });
    gsap.set('[data-journey-strike]', { scaleX: 0 });
    gsap.set('[data-journey-focus]', { autoAlpha: 0 });
    gsap.set('[data-journey-bar]', { scaleX: 0.58 });
    gsap.set(ghosts, { y: slot });

    const tabs = $$('[data-journey-tab]', pin);
    const dots = $$('[data-journey-dot]', pin);
    const setTab = (i: number) => {
        tabs.forEach((t, n) => t.classList.toggle('is-active', n === i));
        dots.forEach((d, n) => d.classList.toggle('is-active', n === i));
    };
    setTab(0);

    const stepTo = (tl: gsap.core.Timeline, from: number, to: number, at: number) => {
        tl.to(steps[from], { autoAlpha: 0, y: -24, duration: 0.3 }, at)
            .fromTo(steps[to], { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.3, immediateRender: false }, at + 0.15)
            .to('[data-journey-indicator]', { xPercent: to * 100, duration: 0.4, ease: motion.easeInOut }, at)
            .to(states[from], { autoAlpha: 0, duration: 0.2 }, at)
            .to(states[to], { autoAlpha: 1, duration: 0.2 }, at + 0.2)
            .call(() => setTab(to), undefined, at + 0.2);
    };

    const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: () => `+=${window.innerHeight * 3.2}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
                const i = Math.min(3, Math.floor(self.progress * 4.4 - 0.2));
                setTab(Math.max(0, i));
            },
        },
    });

    // 0 — capture: text is typed, the card drops into the inbox
    tl.to('[data-journey-typed]', { clipPath: 'inset(0 0% 0 0)', duration: 0.5 }, 0.05)
        .to(card, { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: motion.ease }, 0.55);

    // 1 — plan: input clears, card moves to the top of Today
    stepTo(tl, 0, 1, 1);
    tl.to(capture, { autoAlpha: 0, y: -12, duration: 0.3 }, 1)
        .to(card, { y: -64, duration: 0.5, ease: motion.easeInOut }, 1.1)
        .to(ghosts, { y: 10, duration: 0.5, ease: motion.easeInOut }, 1.1);

    // 2 — focus: everything else steps back, the clock runs
    stepTo(tl, 1, 2, 2);
    tl.to(ghosts, { autoAlpha: 0, y: 24, duration: 0.3 }, 2)
        .to(card, { y: focusY, scale: 1.04, duration: 0.5, ease: motion.easeInOut }, 2.05)
        .to('[data-journey-focus]', { autoAlpha: 1, duration: 0.3 }, 2.1)
        .to({ s: 0 }, {
            s: 25 * 60 - 1, duration: 0.75,
            onUpdate() {
                const s = Math.round((this.targets()[0] as { s: number }).s);
                clock.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
            },
        }, 2.2);

    // 3 — done: checked, struck through, progress moves
    stepTo(tl, 2, 3, 3);
    tl.to('[data-journey-focus]', { autoAlpha: 0, duration: 0.25 }, 3)
        .to(fill, { opacity: 1, duration: 0.15 }, 3.05)
        .to(checkPath, { strokeDashoffset: 0, duration: 0.25 }, 3.1)
        .fromTo(check, { scale: 0.8 }, { scale: 1, duration: 0.25, ease: motion.easeSpring, immediateRender: false }, 3.1)
        .to('[data-journey-strike]', { scaleX: 1, duration: 0.3 }, 3.2)
        .to(card, { y: doneY, scale: 1, duration: 0.5, ease: motion.easeInOut }, 3.35)
        .fromTo(ghosts, { y: -40 }, { autoAlpha: 1, y: -64, duration: 0.4, immediateRender: false }, 3.35)
        .to('[data-journey-bar]', { scaleX: 0.64, duration: 0.4 }, 3.5)
        .to({ p: 58 }, {
            p: 64, duration: 0.4,
            onUpdate() { percent.textContent = String(Math.round((this.targets()[0] as { p: number }).p)); },
        }, 3.5)
        .to({}, { duration: 0.4 });
}

/** Board: cards land column by column as the section scrolls in; the board pans sideways. */
function boardScene() {
    const wrap = $('[data-board]');
    const track = $('[data-board-track]');
    if (!wrap || !track) return;
    const cards = $$('[data-board-card]', wrap);

    gsap.fromTo(cards, { autoAlpha: 0, y: -36, rotate: -1.5 }, {
        autoAlpha: 1, y: 0, rotate: 0, ease: motion.ease, stagger: 0.12, duration: 1,
        scrollTrigger: { trigger: wrap, start: 'top 85%', end: 'center 45%', scrub: 0.6 },
    });

    const overflow = () => Math.max(40, (track.scrollWidth - window.innerWidth) / 2 + 24);
    gsap.fromTo(track, { x: () => overflow() }, {
        x: () => -overflow(), ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true },
    });
}


/** Workbench: subtasks can be checked with the mouse; one completes itself on enter. */
function workbenchScene() {
    const buttons = $$<HTMLButtonElement>('[data-subtask]');
    const count = $('[data-sub-count]');
    const bar = $('[data-sub-bar]');
    const update = () => {
        const done = buttons.filter((b) => b.classList.contains('is-done')).length;
        if (count) count.textContent = `${done}/${buttons.length}`;
        bar?.style.setProperty('--p', String(done / buttons.length));
    };
    const toggle = (b: HTMLButtonElement) => {
        b.classList.toggle('is-done');
        b.querySelector('.checkbox')?.classList.toggle('is-checked', b.classList.contains('is-done'));
        update();
    };
    buttons.forEach((b) => b.addEventListener('click', () => toggle(b)));
    if (buttons[2]) {
        ScrollTrigger.create({
            trigger: '.detail', start: 'top 55%', once: true,
            onEnter: () => window.setTimeout(() => !buttons[2].classList.contains('is-done') && toggle(buttons[2]), 500),
        });
    }
}

/** Notifications: rows arrive one by one, the bell rings, the first one is read. */
function notifyScene() {
    const panel = $('[data-notify]');
    if (!panel) return;
    const rows = $$('[data-notif]', panel);
    const counters = [$('[data-unread]'), $('[data-bell-count]')];
    gsap.set(rows, { autoAlpha: 0, x: 32 });
    ScrollTrigger.create({
        trigger: panel, start: 'top 70%', once: true,
        onEnter: () => {
            gsap.to(rows, { autoAlpha: 1, x: 0, duration: motion.dur4, ease: motion.ease, stagger: 0.14 });
            gsap.fromTo('[data-bell]', { rotate: 0 }, { keyframes: { rotate: [0, 14, -12, 8, -5, 0] }, duration: 0.9, ease: 'power1.inOut', delay: 0.3 });
            window.setTimeout(() => {
                rows[0]?.classList.remove('is-unread');
                counters.forEach((c) => { if (c) c.textContent = '3'; });
                gsap.fromTo(counters, { scale: 0.6 }, { scale: 1, duration: motion.dur3, ease: motion.easeSpring });
            }, 2200);
        },
    });
    rows.forEach((row) => row.addEventListener('click', () => row.classList.toggle('is-unread')));
}

/** AI: the prompt is "sent", the suggestion streams in line by line. */
function aiScene() {
    const root = $('[data-ai]');
    if (!root) return;
    const lines = $$('[data-ai-line]', root);
    const tl = gsap.timeline({ paused: true });
    tl.from('.ai__prompt', { autoAlpha: 0, y: 16, duration: motion.dur3, ease: motion.ease })
        .from('.ai__answer', { autoAlpha: 0, y: 16, duration: motion.dur3, ease: motion.ease }, '+=0.35')
        .from(lines, { autoAlpha: 0, x: -12, duration: motion.dur3, ease: motion.ease, stagger: 0.18 }, '-=0.2')
        .from('.ai__accept', { autoAlpha: 0, scale: 0.9, duration: motion.dur3, ease: motion.easeSpring });
    ScrollTrigger.create({ trigger: root, start: 'top 75%', once: true, onEnter: () => tl.play() });
}

/** Passkey: the ring scans, the key turns into a check, the status appears. */
function passkeyScene() {
    const root = $('[data-passkey]');
    if (!root) return;
    const tl = gsap.timeline({ paused: true });
    tl.set('.passkey__ok', { autoAlpha: 0, scale: 0.6 })
        .set('[data-passkey-status]', { autoAlpha: 0, y: 8 })
        .set('.passkey__key', { autoAlpha: 1, scale: 1 })
        .fromTo('[data-passkey-ring]', { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.2, ease: motion.easeInOut })
        .to('.passkey__key', { autoAlpha: 0, scale: 0.6, duration: motion.dur2 })
        .to('.passkey__ok', { autoAlpha: 1, scale: 1, duration: motion.dur3, ease: motion.easeSpring }, '<0.1')
        .to('[data-passkey-status]', { autoAlpha: 1, y: 0, duration: motion.dur3, ease: motion.ease }, '<0.15');
    tl.progress(0).pause();
    ScrollTrigger.create({ trigger: root, start: 'top 70%', once: true, onEnter: () => tl.play() });
}

/** Platforms: devices drift at their own depth; quick capture types a task. */
function platformsScene() {
    const devices = $('[data-devices]');
    if (!devices) return;
    $$('[data-depth]', devices).forEach((el) => {
        const depth = Number(el.dataset.depth ?? 0);
        gsap.fromTo(el, { y: depth * 40 }, {
            y: -depth * 20, ease: 'none',
            scrollTrigger: { trigger: devices, start: 'top bottom', end: 'bottom top', scrub: true },
        });
    });
    const field = $('[data-capture-text]', devices);
    if (!field) return;
    const text = field.textContent ?? '';
    field.textContent = '';
    ScrollTrigger.create({
        trigger: devices, start: 'top 65%', once: true,
        onEnter: () => {
            let i = 0;
            const id = window.setInterval(() => {
                field.textContent = text.slice(0, ++i);
                if (i >= text.length) window.clearInterval(id);
            }, 55);
        },
    });
}

/** Generic vertical parallax for decorative layers: data-parallax="<px>". */
function parallax() {
    $$('[data-parallax]').forEach((el) => {
        const dist = Number(el.dataset.parallax ?? 0);
        gsap.fromTo(el, { y: -dist / 2 }, {
            y: dist / 2, ease: 'none',
            scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
    });
}

/** Header switches to the dark tokens while it sits over a dark section. */
function headerTheme() {
    const header = $('[data-header]');
    if (!header) return;
    $$('main section.theme-dark').forEach((section) => {
        ScrollTrigger.create({
            trigger: section,
            start: 'top 32px',
            end: 'bottom 32px',
            toggleClass: { targets: header, className: 'is-dark' },
        });
    });
}

/** Counters count up once when they enter the viewport. */
function counters() {
    $$('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count);
        const state = { v: 0 };
        el.textContent = '0';
        ScrollTrigger.create({
            trigger: el,
            start: 'top 90%',
            once: true,
            onEnter: () => gsap.to(state, {
                v: target, duration: 1.4, ease: motion.ease,
                onUpdate: () => { el.textContent = String(Math.round(state.v)); },
            }),
        });
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
    journeyScene();
    boardScene();
    workbenchScene();
    notifyScene();
    aiScene();
    passkeyScene();
    platformsScene();
    parallax();
    headerTheme();
    counters();
    reveals();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

// Dev-only hook so scroll scenes can be verified in a hidden/background preview (no rAF there).
if (import.meta.env.DEV) Object.assign(window, { __motion: { gsap, ScrollTrigger } });
