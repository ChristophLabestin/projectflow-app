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
            // Board lives between the act copy (left) and the chapter nav (right), measured from the real layout,
            // so cards never run under the text or the "Ordnen / Fokus …" labels at any width.
            const sr = stage.getBoundingClientRect();
            // Ink of the act copy (text line boxes and buttons), not the block width of the paragraphs.
            const ink = (el: HTMLElement) => {
                if (el.matches('.btn')) return [el.getBoundingClientRect()];
                const range = document.createRange();
                range.selectNodeContents(el);
                return Array.from(range.getClientRects());
            };
            const copyRight = Math.max(0, ...acts.slice(1).flatMap((a) => $$('h2, p, li, .btn', a).flatMap(ink))
                .filter((r) => r.width > 0).map((r) => r.right - sr.left));
            const navRect = $('.story__nav', stage)?.getBoundingClientRect();
            const navLeft = navRect && navRect.width > 0 ? navRect.left - sr.left : W - 72;
            x0 = Math.max(copyRight + 48, W * 0.3); x1 = navLeft - 32; y0 = HEADER + 76; y1 = H - 40;
        }
        const cw = Math.min(260, (x1 - x0 - gap * (cols - 1)) / cols);
        geoCache = { W, H, x0, y0, x1, y1, cw, gap, cols };
        stage.style.setProperty('--cw', `${cw}px`);
        return geoCache;
    };
    const resetGeo = () => { geoCache = null; poseCache.clear(); };
    ScrollTrigger.addEventListener('refreshInit', resetGeo);

    const boardW = (g: Geo) => g.cols * g.cw + (g.cols - 1) * g.gap;
    const boardX = (g: Geo) => g.x0 + Math.max(0, (g.x1 - g.x0 - boardW(g)) / 2);
    /** Board is vertically centred in the work area (tallest column decides). */
    const boardY = (g: Geo) => {
        const rows = Math.max(...[0, 1, 2, 3].map((c) => cards.filter((card) => colOf(card, true) === c).length));
        const h = 36 + rows * (CARD_H + 8);
        return g.y0 + Math.max(0, (g.y1 - g.y0 - h) / 2);
    };

    /** Bottom edge of the board area that is actually shown (rows below y1 are faded out). */
    const boardBottom = (g: Geo) => {
        const rows = Math.max(...[0, 1, 2, 3].map((c) => cards.filter((card) => colOf(card, true) === c).length));
        let shown = 0;
        for (let r = 0; r < rows; r += 1) {
            if (boardY(g) + 36 + r * (CARD_H + 8) + CARD_H <= g.y1 + 30) shown = r + 1;
        }
        return boardY(g) + 36 + shown * (CARD_H + 8) - 8;
    };

    /** Ink boxes of the hero copy (words, text lines, buttons) in stage coordinates, padded. */
    const copyRects = () => {
        const sr = stage.getBoundingClientRect();
        const pad = 14;
        const rects: DOMRect[] = [];
        $$('.word', acts[0]).forEach((w) => rects.push(w.getBoundingClientRect()));
        $$('.act__text, .act__platforms', acts[0]).forEach((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            rects.push(...Array.from(range.getClientRects()));
        });
        $$('.act__ctas .btn', acts[0]).forEach((b) => rects.push(b.getBoundingClientRect()));
        return rects.filter((r) => r.width > 0).map((r) => ({
            left: r.left - sr.left - pad, right: r.right - sr.left + pad, top: r.top - sr.top - pad, bottom: r.bottom - sr.top + pad,
        }));
    };

    /** Pose of every visible card in act k – computed once per layout (cleared on refresh with the geometry). */
    const poseCache = new Map<number, Pose[]>();
    const poses = (k: number): Pose[] => {
        let cached = poseCache.get(k);
        if (!cached) { cached = computePoses(k); poseCache.set(k, cached); }
        return cached;
    };
    const computePoses = (k: number): Pose[] => {
        const g = geo();
        if (k === 0) {
            const pts = mobile ? NOISE_MOBILE : NOISE_DESKTOP;
            const s = mobile ? 0.8 : 1;
            const w = g.cw * s + 12; // rotation + shadow margin
            const h = CARD_H * s + 12;
            const blocks = copyRects();
            const hits = (x: number, y: number) => blocks.find((b) => x < b.right && x + w > b.left && y < b.bottom && y + h > b.top);
            const inside = (x: number, y: number) => x >= 0 && x + w <= g.W && y >= HEADER && y + h <= g.H;
            const placed: { x: number; y: number }[] = [];
            const crowded = (x: number, y: number) => placed.some((p) => {
                const ox = Math.min(x + w, p.x + w) - Math.max(x, p.x);
                const oy = Math.min(y + h, p.y + h) - Math.max(y, p.y);
                return ox > 0 && oy > 0 && (ox * oy) / (w * h) > 0.3;
            });
            return cards.map((_, i) => {
                const [nx, ny, r] = pts[i % pts.length];
                let x = nx * (g.W - g.cw * s);
                let y = ny * (g.H - CARD_H);
                // Keep headline, text and buttons readable: move a fragment just clear of whatever it would cover.
                const b = hits(x, y);
                if (b) {
                    const options = [
                        { x: b.left - w, y }, { x: b.right, y }, { x, y: b.bottom }, { x, y: b.top - h },
                    ].filter((o) => inside(o.x, o.y) && !hits(o.x, o.y))
                        .sort((p1, p2) => Math.hypot(p1.x - x, p1.y - y) - Math.hypot(p2.x - x, p2.y - y));
                    if (!options.length) return { x, y, r, s, o: 0 };
                    ({ x, y } = options[0]);
                }
                // Avoid fragments piling up on each other after being pushed out of the copy.
                if (crowded(x, y)) {
                    const alt = [-0.7, 0.7, -1.4, 1.4].map((f) => ({ x: x + f * w, y }))
                        .find((o) => inside(o.x, o.y) && !hits(o.x, o.y) && !crowded(o.x, o.y));
                    if (!alt) return { x, y, r, s, o: 0 };
                    ({ x, y } = alt);
                }
                placed.push({ x, y });
                return { x, y, r, s, o: 1 };
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

    // Act 0 pose lives inside the timeline so it is re-measured on every refresh (fonts, resize).
    cards.forEach((card, i) => {
        const pose0 = {
            x: () => poses(0)[i].x, y: () => poses(0)[i].y, rotation: () => poses(0)[i].r,
            scale: () => poses(0)[i].s, autoAlpha: () => poses(0)[i].o, transformOrigin: '0 0',
        };
        gsap.set(card, pose0);
        tl.set(card, pose0, 0);
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
            return boardBottom(g) + 12;
        };
        // Phones: one toast, and only if it fits between the board and the copy.
        const fits = () => !mobile || ty() + toast.offsetHeight <= geo().y1 + 24;
        if (mobile && i > 0) { gsap.set(toast, { display: 'none' }); return; }
        tl.fromTo(toast, { autoAlpha: 0, x: () => tx() + 24, y: ty },
            { autoAlpha: () => (fits() ? 1 : 0), x: tx, y: ty, duration: 0.35, ease: 'power3.out', immediateRender: false }, at(4) + 0.45 + i * 0.15);
    });
    // Act 5 – the board sits in a real app frame; the phone joins; cards become clickable.
    const frameBox = () => {
        const g = geo();
        return { x: boardX(g) - 16, y: boardY(g) - 56, w: boardW(g) + 32, h: boardBottom(g) - boardY(g) + 76 };
    };
    /** The phone sits below the column with the fewest cards, so it never covers a card. */
    const phonePos = () => {
        const g = geo();
        const counts = [0, 1, 2, 3].map((c) => cards.filter((card) => colOf(card, true) === c).length);
        const col = counts.slice(0, g.cols).reduce((best, n, c) => (n < counts[best] ? c : best), 0);
        const pw = phone.offsetWidth;
        const ph = phone.offsetHeight;
        const top = boardY(g) + 36 + counts[col] * (CARD_H + 8) + 16;
        // Uniform scale only (keeps the device proportions); fits the column width and the space below the cards.
        const sc = Math.min(1, (g.cw + g.gap) / pw, Math.max(0.5, (g.H - top - 32) / ph));
        return {
            x: boardX(g) + col * (g.cw + g.gap) + (g.cw - pw) / 2,
            y: Math.min(top, g.H - ph * sc - 28),
            s: sc,
        };
    };
    tl.to(toasts, { autoAlpha: 0, duration: 0.3 }, at(5))
        .fromTo(frame, { autoAlpha: 0, x: () => frameBox().x, y: () => frameBox().y, width: () => frameBox().w, height: () => frameBox().h, scale: 1.03 },
            { autoAlpha: mobile ? 0 : 1, x: () => frameBox().x, y: () => frameBox().y, width: () => frameBox().w, height: () => frameBox().h, scale: 1, duration: 0.5, immediateRender: false }, at(5) + 0.1)
        .fromTo(phone, { autoAlpha: 0, x: () => phonePos().x, y: () => phonePos().y + 60, scale: () => phonePos().s, transformOrigin: '50% 0' },
            { autoAlpha: 1, x: () => phonePos().x, y: () => phonePos().y, scale: () => phonePos().s, duration: 0.5, ease: 'power3.out', immediateRender: false }, at(5) + 0.3)
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
        onToggle: (self) => stage.classList.toggle('is-active', self.isActive),
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

/* ==================================================================== roles (tabs) */

/** Role tabs: click and arrow keys always work; with motion they also advance gently while the section scrolls by. */
function roleTabs(): ((i: number) => void) | undefined {
    const root = $('[data-roles]');
    if (!root) return undefined;
    const tabs = $$<HTMLButtonElement>('[data-role-tab]', root);
    const panels = $$('[data-role-panel]', root);
    const boards = $$('[data-role-board]', root);
    let current = 0;
    const select = (i: number, focus = false) => {
        current = i;
        tabs.forEach((t, n) => {
            t.setAttribute('aria-selected', String(n === i));
            t.tabIndex = n === i ? 0 : -1;
        });
        panels.forEach((p, n) => { p.hidden = n !== i; });
        boards.forEach((b, n) => b.classList.toggle('is-on', n === i));
        if (focus) tabs[i].focus();
    };
    tabs.forEach((t, n) => {
        t.addEventListener('click', () => { root.dataset.touched = '1'; select(n); });
        t.addEventListener('keydown', (e) => {
            const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            root.dataset.touched = '1';
            select((current + step + tabs.length) % tabs.length, true);
        });
    });
    return (i: number) => { if (!root.dataset.touched && i !== current) select(i); };
}

function rolesScroll(select: (i: number) => void) {
    const root = $('[data-roles]');
    if (!root) return;
    const count = $$('[data-role-tab]', root).length;
    ScrollTrigger.create({
        trigger: root, start: 'top 55%', end: 'bottom 45%',
        onUpdate: (self) => select(Math.min(count - 1, Math.floor(self.progress * count))),
    });
}

/* ==================================================================== MCP scene */

/** Elements of the MCP scene and their start state (prompt hidden, call/result/card/log out, read-only). */
function mcpParts() {
    const root = $('[data-mcp]');
    if (!root) return null;
    const parts = {
        root,
        chars: $$('.ch', root),
        call: $('[data-mcp-call]', root)!,
        result: $('[data-mcp-result]', root)!,
        card: $('[data-mcp-card]', root)!,
        log: $('[data-mcp-log]', root)!,
        write: $('[data-mcp-write]', root)!,
        count: $('[data-mcp-count]', root),
    };
    gsap.set(parts.chars, { opacity: 0 });
    gsap.set([parts.call, parts.result, parts.log], { autoAlpha: 0, y: 8 });
    gsap.set(parts.card, { autoAlpha: 0, x: -40, scale: 0.96 });
    return parts;
}

/** Desktop: the one pinned scene after the story – scroll types the prompt, the tool call runs, the card lands. */
function mcpPinned() {
    const section = $('[data-mcp-section]');
    const p = mcpParts();
    if (!section || !p) return undefined;
    section.classList.add('is-pinned');
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
        .to(p.chars, { opacity: 1, duration: 0.02, stagger: 0.02 }, 0)
        .to(p.call, { autoAlpha: 1, y: 0, duration: 0.25 })
        .to(p.result, { autoAlpha: 1, y: 0, duration: 0.25 }, '+=0.15')
        .to(p.card, { autoAlpha: 1, x: 0, scale: 1, duration: 0.35, ease: 'back.out(1.6)' }, '<+0.1')
        .to(p.log, { autoAlpha: 1, y: 0, duration: 0.25 }, '+=0.1')
        .to({}, { duration: 0.3 });
    const st = ScrollTrigger.create({
        trigger: section, start: () => `top top+=${HEADER}`, end: '+=140%',
        pin: true, scrub: 0.5, animation: tl, invalidateOnRefresh: true,
        onUpdate: (self) => {
            p.write.classList.toggle('is-on', self.progress > 0.55);
            if (p.count) p.count.textContent = self.progress > 0.62 ? '3' : '2';
        },
    });
    return () => { st.kill(); tl.kill(); section.classList.remove('is-pinned'); };
}

/** Phones/tablets: plays once when the scene scrolls in (no pin). */
function mcpOnce() {
    const p = mcpParts();
    if (!p) return undefined;
    if (p.count) p.count.textContent = '2';
    const tl = gsap.timeline({ paused: true, defaults: { ease: motion.ease } })
        .to(p.chars, { opacity: 1, duration: 0.01, stagger: 0.028 }, 0)
        .to(p.call, { autoAlpha: 1, y: 0, duration: motion.dur3 }, '+=0.2')
        .to(p.result, { autoAlpha: 1, y: 0, duration: motion.dur3 }, '+=0.4')
        .call(() => p.write.classList.add('is-on'))
        .to(p.card, { autoAlpha: 1, x: 0, scale: 1, duration: motion.dur4, ease: motion.easeSpring }, '<+0.2')
        .call(() => { if (p.count) p.count.textContent = '3'; })
        .to(p.log, { autoAlpha: 1, y: 0, duration: motion.dur3 }, '+=0.2');
    const st = ScrollTrigger.create({ trigger: p.root, start: 'top 70%', once: true, onEnter: () => tl.play() });
    return () => { st.kill(); tl.kill(); };
}

/* ==================================================================== apps, features, closing */

/** Desktop: the two app cards drift a little against each other while scrolling. */
function appsDrift() {
    const els = $$('[data-drift]');
    const tweens = els.map((el) => gsap.fromTo(el, { y: 24 * Number(el.dataset.drift) }, {
        y: -24 * Number(el.dataset.drift), ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
    }));
    return () => tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); gsap.set(t.targets(), { clearProps: 'transform' }); });
}

/** Feature tiles play their mini UI once (CSS transitions from the start state to the static end state). */
function playOnce() {
    ScrollTrigger.batch('[data-play]', {
        start: 'top 80%', once: true,
        onEnter: (els) => els.forEach((el, i) => window.setTimeout(() => el.classList.add('is-played'), i * 120)),
    });
}

/** Desktop: fragments around the closing logo fly into it as the card scrolls up – the hero's noise, ordered. */
function ctaConverge() {
    const mark = $('[data-converge]');
    if (!mark) return undefined;
    const frags = $$('.cta__frag', mark);
    const logoEl = $('.cta__logo', mark);
    const tl = gsap.timeline({
        scrollTrigger: { trigger: mark.closest('.cta') ?? mark, start: 'top 85%', end: 'center 55%', scrub: 0.6 },
    });
    frags.forEach((f, i) => {
        const a = (i * 45 + 20) * (Math.PI / 180);
        const r = 220 + (i % 3) * 40;
        tl.fromTo(f, { x: Math.cos(a) * r, y: Math.sin(a) * r, rotation: (i % 2 ? 1 : -1) * 14, opacity: 1 },
            { x: 0, y: 0, rotation: 0, scale: 0.4, opacity: 0, ease: 'power2.in' }, i * 0.03);
    });
    if (logoEl) tl.fromTo(logoEl, { scale: 0.86, opacity: 0.4 }, { scale: 1, opacity: 1, ease: 'power2.out' }, 0.15);
    return () => { tl.scrollTrigger?.kill(); tl.kill(); gsap.set([...frags, logoEl], { clearProps: 'all' }); };
}

/* ==================================================================== pricing + shortcuts */

/** Monthly / yearly switch; works with and without motion. */
function billingToggle() {
    const group = $('[data-billing]');
    if (!group) return;
    const options = $$<HTMLButtonElement>('[data-billing-option]', group);
    const prices = $$('[data-price]');
    const units = $$('[data-billing-unit]');
    const animate = prefersMotion();
    const thumb = $('.billing-toggle__thumb', group);
    const placeThumb = () => {
        const active = options.find((o) => o.getAttribute('aria-pressed') === 'true');
        if (!active || !thumb) return;
        thumb.style.setProperty('--thumb-w', `${active.offsetWidth}px`);
        thumb.style.setProperty('--thumb-x', `${active.offsetLeft - 4}px`);
    };
    // First placement without the slide, so the thumb doesn't travel in from the left on load.
    if (thumb) thumb.style.transition = 'none';
    placeThumb();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (thumb) thumb.style.transition = ''; }));
    window.addEventListener('resize', placeThumb);
    document.fonts?.ready.then(placeThumb);
    options.forEach((btn) => btn.addEventListener('click', () => {
        const mode = btn.dataset.billingOption as 'monthly' | 'yearly';
        group.dataset.billing = mode;
        options.forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
        placeThumb();
        units.forEach((u) => { u.textContent = u.dataset[mode] ?? ''; });
        $$<HTMLAnchorElement>('[data-buy-link]').forEach((a) => {
            const url = new URL(a.href);
            url.searchParams.set('interval', mode === 'monthly' ? 'month' : 'year');
            a.href = url.pathname + url.search;
        });
        prices.forEach((el) => {
            const to = Number(el.dataset[mode]);
            const from = Number.parseFloat(el.textContent ?? '0');
            const suffix = '\u00a0€';
            if (!animate || from === to) { el.textContent = `${to}${suffix}`; return; }
            const state = { v: from };
            gsap.to(state, { v: to, duration: motion.dur3, ease: motion.ease, onUpdate: () => { el.textContent = `${Math.round(state.v)}${suffix}`; } });
            gsap.fromTo(el, { y: -6 }, { y: 0, duration: motion.dur3, ease: motion.easeSpring });
        });
    }));
}

/** Desktop shortcuts light up one after another, like keys being pressed. */
function shortcutsScene() {
    const list = $('[data-shortcuts]');
    if (!list) return;
    const items = $$('li', list);
    let i = 0;
    let id = 0;
    ScrollTrigger.create({
        trigger: list, start: 'top 85%', end: 'bottom 15%',
        onToggle: (self) => {
            window.clearInterval(id);
            items.forEach((it) => it.classList.remove('is-hot'));
            if (!self.isActive) return;
            id = window.setInterval(() => {
                items.forEach((it, n) => it.classList.toggle('is-hot', n === i % items.length));
                i += 1;
            }, 1400);
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

const selectRole = roleTabs();

if (prefersMotion()) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    document.documentElement.classList.add('is-ready');
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1000px)', () => storyScene(false));
    mm.add('(max-width: 999px)', () => storyScene(true));
    // After the story exactly one more pinned scene (MCP, desktop); everything else scrolls freely.
    mm.add('(min-width: 1000px)', () => {
        const cleanups = [mcpPinned(), appsDrift(), ctaConverge()];
        return () => cleanups.forEach((c) => c?.());
    });
    mm.add('(max-width: 999px)', () => mcpOnce());
    if (selectRole) rolesScroll(selectRole);
    playOnce();
    shortcutsScene();
    spotlights();
    reveals();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

billingToggle();

// Dev-only hook so scenes can be verified in a hidden/background preview (no rAF there).
if (import.meta.env.DEV) Object.assign(window, { __motion: { gsap, ScrollTrigger } });
