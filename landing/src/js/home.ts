import '../styles/home.scss';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { finePointer, motion, prefersMotion } from './motion';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
const pad = (n: number) => String(n).padStart(2, '0');

/* ==================================================================== story stage
 * One pinned viewport, 6 acts. Timeline time t runs 0 → 5; the transition into act k starts at k - 1,
 * takes ~0.7 and is then held until k. Every card is the same DOM node in every act; only transform/opacity change.
 */

const ACTS = 5;
const CARD_H = 66;
const HEADER = 64;

interface Pose { x: number; y: number; r: number; s: number; o: number }
interface Geo {
    W: number; H: number;
    x0: number; y0: number; x1: number; y1: number;
    cw: number; gap: number; cols: number;
}

// Hand-placed "noise" positions (normalised, kept clear of the centred headline).
const NOISE_DESKTOP: [number, number, number][] = [
    [0.02, 0.14, -7], [0.85, 0.12, 6], [0.0, 0.40, 5], [0.91, 0.38, -4], [0.04, 0.66, -6], [0.87, 0.63, 5],
    [0.13, 0.93, 4], [0.33, 0.86, -5], [0.53, 0.95, 3], [0.72, 0.87, -6], [0.94, 0.92, 4], [0.19, 0.77, -3],
];
const NOISE_MOBILE: [number, number, number][] = [
    [0.0, 0.095, -6], [0.56, 0.1, 5], [0.06, 0.185, 4], [0.62, 0.19, -4], [0.0, 0.875, 5], [0.54, 0.87, -6], [0.22, 0.94, -3], [0.7, 0.945, 4],
];

function storyScene(mobile: boolean) {
    const stage = $('[data-story]');
    if (!stage) return undefined;
    const header = $('[data-header]');
    const allCards = $$('[data-card]', stage);
    const cards = mobile ? allCards.filter((c) => c.hasAttribute('data-core')) : allCards;
    const hero = $('[data-hero]', stage)!;
    const heads = $$('[data-col-head]', stage);
    const acts = $$('[data-act]', stage);
    const navLinks = $$<HTMLAnchorElement>('[data-goto]', stage);
    const inboxHead = $('[data-inbox-head]', stage)!;
    const veil = $('[data-veil]', stage)!;
    const focus = $('[data-focus]', stage)!;
    const toasts = $$('[data-toast]', stage);
    const frame = $('[data-frame]', stage)!;
    const phone = $('[data-phone]', stage)!;
    const counts = $$('[data-col-count]', stage);

    // Board column per card (mobile folds the statuses into "open" and "done").
    const colOf = (card: HTMLElement, heroDone: boolean) => {
        const col = heroDone && card === hero ? 3 : Number(card.dataset.col);
        return mobile ? (col === 3 ? 1 : 0) : col;
    };
    const headCol = (h: HTMLElement) => {
        const c = Number(h.dataset.colHead);
        if (!mobile) return c;
        return c === 3 ? 1 : c === 0 ? 0 : -1;
    };

    let geoCache: Geo | null = null;
    const geo = (): Geo => {
        if (geoCache) return geoCache;
        const W = stage.clientWidth;
        const H = stage.clientHeight;
        const cols = mobile ? 2 : 4;
        const gap = mobile ? 8 : 12;
        let x0: number; let x1: number; let y0: number; let y1: number;
        if (mobile) {
            const copyH = Math.max(...acts.slice(1).map((a) => a.offsetHeight));
            x0 = 16; x1 = W - 16; y0 = HEADER + 24; y1 = H - copyH - 72;
        } else {
            x0 = Math.max(W * 0.37, 420); x1 = W - Math.max(72, (W - 1240) / 2 + 40); y0 = HEADER + 76; y1 = H - 40;
        }
        const cw = Math.min(260, (x1 - x0 - gap * (cols - 1)) / cols);
        geoCache = { W, H, x0, y0, x1, y1, cw, gap, cols };
        stage.style.setProperty('--cw', `${cw}px`);
        return geoCache;
    };
    const resetGeo = () => { geoCache = null; };
    ScrollTrigger.addEventListener('refreshInit', resetGeo);

    const boardW = (g: Geo) => g.cols * g.cw + (g.cols - 1) * g.gap;
    const boardX = (g: Geo) => g.x0 + Math.max(0, (g.x1 - g.x0 - boardW(g)) / 2);
    /** Board is vertically centred in the work area (tallest column decides). */
    const boardY = (g: Geo) => {
        const rows = Math.max(...[0, 1, 2, 3].map((c) => cards.filter((card) => colOf(card, true) === c).length));
        const h = 36 + rows * (CARD_H + 8);
        return g.y0 + Math.max(0, (g.y1 - g.y0 - h) / 2);
    };

    /** Pose of every visible card in act k. */
    const poses = (k: number): Pose[] => {
        const g = geo();
        if (k === 0) {
            const pts = mobile ? NOISE_MOBILE : NOISE_DESKTOP;
            return cards.map((_, i) => {
                const [nx, ny, r] = pts[i % pts.length];
                return { x: nx * (g.W - g.cw * (mobile ? 0.8 : 1)), y: ny * (g.H - CARD_H), r, s: mobile ? 0.8 : 1, o: 1 };
            });
        }
        if (k === 1) {
            const s = Math.min(mobile ? 1.5 : 1.3, (g.x1 - g.x0) / g.cw);
            const w = g.cw * s;
            const x = g.x0 + (g.x1 - g.x0 - w) / 2;
            return cards.map((_, i) => {
                const y = g.y0 + 40 + i * (CARD_H * s + 8);
                return { x, y, r: 0, s, o: y + CARD_H * s > g.y1 ? 0 : 1 };
            });
        }
        const heroDone = k >= 4;
        const heroHidden = k === 3; // the hero card turns into the focus panel
        const fill = [0, 0, 0, 0];
        const bx = boardX(g);
        return cards.map((card) => {
            const col = colOf(card, heroDone);
            const row = fill[col]++;
            const y = boardY(g) + 36 + row * (CARD_H + 8);
            const hidden = (heroHidden && card === hero) || y + CARD_H > g.y1 + 30;
            return { x: bx + col * (g.cw + g.gap), y, r: 0, s: 1, o: hidden ? 0 : 1 };
        });
    };

    // ---------------------------------------------------------------- timeline
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut', duration: 0.7 } });
    const at = (k: number) => k - 1;

    cards.forEach((card, i) => {
        gsap.set(card, {
            x: () => poses(0)[i].x, y: () => poses(0)[i].y, rotation: () => poses(0)[i].r,
            scale: () => poses(0)[i].s, transformOrigin: '0 0', autoAlpha: 1,
        });
    });
    gsap.set([inboxHead, ...heads, veil, ...toasts, frame, phone], { autoAlpha: 0 });
    gsap.set(focus, { autoAlpha: 0 });

    for (let k = 1; k <= ACTS; k += 1) {
        cards.forEach((card, i) => {
            tl.to(card, {
                x: () => poses(k)[i].x, y: () => poses(k)[i].y, rotation: () => poses(k)[i].r,
                scale: () => poses(k)[i].s, autoAlpha: () => poses(k)[i].o,
            }, at(k) + (k <= 2 ? i * 0.012 : 0));
        });
        tl.to(acts[k - 1], { autoAlpha: 0, y: -24, duration: 0.3, ease: 'power1.in' }, at(k))
            .fromTo(acts[k], { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, at(k) + 0.32);
    }

    const inboxX = () => {
        const g = geo();
        const w = g.cw * Math.min(mobile ? 1.5 : 1.3, (g.x1 - g.x0) / g.cw);
        return g.x0 + (g.x1 - g.x0 - w) / 2;
    };

    // Act 1 – fragments become tasks; inbox header appears.
    tl.to($$('.scard__kind', stage), { autoAlpha: 0, duration: 0.3 }, 0.15)
        .to($$('.scard .checkbox', stage), { autoAlpha: 1, duration: 0.3 }, 0.3)
        .fromTo(inboxHead, { autoAlpha: 0, x: inboxX, y: () => geo().y0 }, { autoAlpha: 1, x: inboxX, y: () => geo().y0, duration: 0.3, immediateRender: false }, 0.35)
        .to(inboxHead, { autoAlpha: 0, duration: 0.25 }, at(2));
    // Act 2 – column heads.
    heads.forEach((h) => {
        tl.fromTo(h, { autoAlpha: 0, x: () => boardX(geo()) + Math.max(0, headCol(h)) * (geo().cw + geo().gap), y: () => boardY(geo()) },
            { autoAlpha: headCol(h) < 0 ? 0 : 1, x: () => boardX(geo()) + Math.max(0, headCol(h)) * (geo().cw + geo().gap), y: () => boardY(geo()), duration: 0.4, immediateRender: false }, at(2) + 0.3);
    });
    // Act 3 – focus: stage goes dark, the hero card becomes the focus panel.
    const focusPos = () => {
        const g = geo();
        return { x: g.x0 + (g.x1 - g.x0 - focus.offsetWidth) / 2, y: g.y0 + Math.max(0, (g.y1 - g.y0 - focus.offsetHeight) / 2) };
    };
    tl.to(veil, { autoAlpha: 0.94, duration: 0.5 }, at(3))
        .fromTo(focus, { x: () => focusPos().x, y: () => focusPos().y + 30, scale: 0.85, autoAlpha: 0 },
            { x: () => focusPos().x, y: () => focusPos().y, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'power3.out', immediateRender: false }, at(3) + 0.2)
        .fromTo($('[data-focus-ring]', focus), { strokeDashoffset: 95 }, { strokeDashoffset: 30, duration: 0.8, ease: 'none', immediateRender: false }, at(3) + 0.2)
    // Act 4 – back to light; hero lands in "done"; the team shows up.
        .to(focus, { autoAlpha: 0, scale: 0.9, duration: 0.35 }, at(4))
        .to(veil, { autoAlpha: 0, duration: 0.45 }, at(4) + 0.05)
        .to($$('.scard__who', stage), { autoAlpha: 1, duration: 0.3, stagger: 0.04 }, at(4) + 0.4);
    toasts.forEach((toast, i) => {
        const tx = () => geo().x1 - toast.offsetWidth;
        const ty = () => {
            const g = geo();
            if (!mobile) return Math.max(HEADER + 12, boardY(g) - 132) + i * 60;
            const rows = Math.max(...[0, 1].map((c) => cards.filter((card) => colOf(card, true) === c).length));
            return Math.min(boardY(g) + 36 + rows * (CARD_H + 8) + 4, g.y1 - 40);
        };
        if (mobile && i > 0) { gsap.set(toast, { display: 'none' }); return; }
        tl.fromTo(toast, { autoAlpha: 0, x: () => tx() + 24, y: ty },
            { autoAlpha: 1, x: tx, y: ty, duration: 0.35, ease: 'power3.out', immediateRender: false }, at(4) + 0.45 + i * 0.15);
    });
    // Act 5 – the board sits in a real app frame; the phone joins; cards become clickable.
    const frameBox = () => {
        const g = geo();
        const rows = Math.max(...[0, 1, 2, 3].map((c) => cards.filter((card) => colOf(card, true) === c).length));
        return { x: boardX(g) - 16, y: boardY(g) - 56, w: boardW(g) + 32, h: 36 + rows * (CARD_H + 8) + 72 };
    };
    tl.to(toasts, { autoAlpha: 0, duration: 0.3 }, at(5))
        .fromTo(frame, { autoAlpha: 0, x: () => frameBox().x, y: () => frameBox().y, width: () => frameBox().w, height: () => frameBox().h, scale: 1.03 },
            { autoAlpha: 1, x: () => frameBox().x, y: () => frameBox().y, width: () => frameBox().w, height: () => frameBox().h, scale: 1, duration: 0.5, immediateRender: false }, at(5) + 0.1)
        .fromTo(phone, { autoAlpha: 0, x: () => geo().x1 - 200, y: () => geo().y1 - 230 },
            { autoAlpha: 1, x: () => geo().x1 - 200, y: () => geo().y1 - 290, duration: 0.5, ease: 'power3.out', immediateRender: false }, at(5) + 0.3)
        .to({}, { duration: 0.3 }, ACTS - 0.3);

    // ---------------------------------------------------------------- discrete, reversible states
    const heroBox = $('.checkbox', hero);
    let last = '';
    const applyState = (t: number) => {
        const dark = t > at(3) + 0.25 && t < at(4) + 0.15;
        const heroDone = t > at(4) + 0.25;
        const live = t > ACTS - 0.35;
        const act = t < 0.35 ? 0 : Math.min(ACTS, Math.floor(t + 0.35));
        const key = `${dark}${heroDone}${live}${act}${t > at(2) + 0.4}`;
        if (key === last) return;
        last = key;
        stage.classList.toggle('is-dark', dark);
        header?.classList.toggle('is-dark', dark);
        stage.classList.toggle('is-live', live);
        stage.classList.toggle('is-board', t > at(2) + 0.4);
        hero.classList.toggle('is-done', heroDone);
        heroBox?.classList.toggle('is-checked', heroDone);
        navLinks.forEach((a, i) => (i === act ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
        const fill = [0, 0, 0, 0];
        cards.forEach((c) => { fill[c === hero && heroDone ? 3 : Number(c.dataset.col)] += 1; });
        counts.forEach((el) => {
            const c = Number(el.dataset.colCount);
            el.textContent = String(mobile ? (c === 3 ? fill[3] : fill[0] + fill[1] + fill[2]) : fill[c]);
        });
    };

    const actLen = () => window.innerHeight * (mobile ? 0.68 : 0.92);
    const st = ScrollTrigger.create({
        trigger: stage,
        start: 'top top',
        end: () => `+=${actLen() * ACTS}`,
        pin: true,
        scrub: 0.5,
        animation: tl,
        invalidateOnRefresh: true,
        onUpdate: (self) => applyState(self.progress * ACTS),
    });
    applyState(0);

    // Chapter navigation jumps to the held state of an act.
    const onNav = (event: Event) => {
        event.preventDefault();
        const k = Number((event.currentTarget as HTMLElement).dataset.goto);
        window.scrollTo({ top: st.start + ((k === 0 ? 0 : k - 0.1) / ACTS) * (st.end - st.start), behavior: 'smooth' });
    };
    navLinks.forEach((a) => a.addEventListener('click', onNav));

    // Last act: the board is usable – cards can be checked off.
    const onCard = (event: Event) => {
        const card = event.currentTarget as HTMLElement;
        if (!stage.classList.contains('is-live')) return;
        const done = !card.classList.contains('is-done');
        card.classList.toggle('is-done', done);
        $('.checkbox', card)?.classList.toggle('is-checked', done);
        gsap.fromTo($('.scard__inner', card), { scale: 0.96 }, { scale: 1, duration: motion.dur3, ease: motion.easeSpring });
    };
    cards.forEach((card) => card.addEventListener('click', onCard));

    // Act 0: fragments drift away from the cursor.
    let onMove: ((e: PointerEvent) => void) | undefined;
    let onLeave: (() => void) | undefined;
    if (finePointer()) {
        const movers = cards.map((card) => {
            const inner = $('.scard__inner', card)!;
            return { card, x: gsap.quickTo(inner, 'x', { duration: 0.8, ease: 'power3.out' }), y: gsap.quickTo(inner, 'y', { duration: 0.8, ease: 'power3.out' }) };
        });
        onMove = (event) => {
            const calm = st.progress > 0.02;
            movers.forEach((m) => {
                if (calm) { m.x(0); m.y(0); return; }
                const r = m.card.getBoundingClientRect();
                const dx = r.left + r.width / 2 - event.clientX;
                const dy = r.top + r.height / 2 - event.clientY;
                const d = Math.hypot(dx, dy) || 1;
                const push = Math.max(0, 1 - d / 260) * 36;
                m.x((dx / d) * push);
                m.y((dy / d) * push);
            });
        };
        onLeave = () => movers.forEach((m) => { m.x(0); m.y(0); });
        stage.addEventListener('pointermove', onMove);
        stage.addEventListener('pointerleave', onLeave);
    }

    // The focus clock keeps ticking.
    const clock = $('[data-focus-clock]', focus);
    let seconds = 24 * 60 + 13;
    const id = window.setInterval(() => {
        if (document.hidden || !clock) return;
        seconds += 1;
        clock.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
    }, 1000);

    return () => {
        window.clearInterval(id);
        ScrollTrigger.removeEventListener('refreshInit', resetGeo);
        navLinks.forEach((a) => a.removeEventListener('click', onNav));
        cards.forEach((card) => card.removeEventListener('click', onCard));
        if (onMove) stage.removeEventListener('pointermove', onMove);
        if (onLeave) stage.removeEventListener('pointerleave', onLeave);
        stage.classList.remove('is-dark', 'is-live');
        header?.classList.remove('is-dark');
    };
}

/* ==================================================================== MCP scene */

function mcpScene() {
    const root = $('[data-mcp]');
    if (!root) return;
    const prompt = $('[data-mcp-prompt]', root)!;
    const text = prompt.textContent ?? '';
    const call = $('[data-mcp-call]', root);
    const result = $('[data-mcp-result]', root);
    const card = $('[data-mcp-card]', root);
    const count = $('[data-mcp-count]', root);
    gsap.set([call, result], { autoAlpha: 0, y: 8 });
    gsap.set(card, { autoAlpha: 0, x: -40, scale: 0.96 });
    if (count) count.textContent = '2';
    prompt.textContent = '';
    ScrollTrigger.create({
        trigger: root, start: 'top 70%', once: true,
        onEnter: () => {
            let i = 0;
            const id = window.setInterval(() => {
                prompt.textContent = text.slice(0, ++i);
                if (i < text.length) return;
                window.clearInterval(id);
                gsap.timeline()
                    .to(call, { autoAlpha: 1, y: 0, duration: motion.dur3, ease: motion.ease }, 0.2)
                    .to(result, { autoAlpha: 1, y: 0, duration: motion.dur3, ease: motion.ease }, 0.9)
                    .to(card, { autoAlpha: 1, x: 0, scale: 1, duration: motion.dur4, ease: motion.easeSpring }, 1.1)
                    .call(() => { if (count) count.textContent = '3'; }, undefined, 1.2);
            }, 28);
        },
    });
}

/* ==================================================================== small things */

function spotlights() {
    if (!finePointer()) return;
    $$('[data-spot]').forEach((el) => {
        el.addEventListener('pointermove', (event) => {
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mx', `${event.clientX - r.left}px`);
            el.style.setProperty('--my', `${event.clientY - r.top}px`);
            el.classList.add('is-lit');
        });
        el.addEventListener('pointerleave', () => el.classList.remove('is-lit'));
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
    ScrollTrigger.config({ ignoreMobileResize: true });
    document.documentElement.classList.add('is-ready');
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1000px)', () => storyScene(false));
    mm.add('(max-width: 999px)', () => storyScene(true));
    mcpScene();
    spotlights();
    reveals();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

// Dev-only hook so scenes can be verified in a hidden/background preview (no rAF there).
if (import.meta.env.DEV) Object.assign(window, { __motion: { gsap, ScrollTrigger } });
