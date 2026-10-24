import '../styles/buy.scss';
import { createApi, type BuyUser, type Intent, type Interval, type Plan, type Workspace } from './buy-api';

/* Checkout: order panel (plan, interval, AI add-on) + account → workspace → payment (Stripe Payment Element) → done. */

type StepId = 'account' | 'workspace' | 'payment';
const ORDER: StepId[] = ['account', 'workspace', 'payment'];
const APP_URL = 'https://app.getprojectflow.com';

const root = document.querySelector<HTMLElement>('[data-buy]');
const copyEl = document.getElementById('buy-copy');

/* eslint-disable @typescript-eslint/no-explicit-any */
function start(root: HTMLElement, c: any) {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    const api = createApi();
    const $ = <T extends HTMLElement = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector<T>(sel)!;
    const $$ = <T extends HTMLElement = HTMLElement>(sel: string, scope: ParentNode = root) => Array.from(scope.querySelectorAll<T>(sel));
    const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
    const money = (cents: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
    const date = (v: string | number | null | undefined) => (v ? new Date(v).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
    const errorText = (e: any) => c.errors[e?.code] ?? c.errors[String(e?.message ?? '').replace(/^.*?(billing-[a-z-]+).*$/, '$1')] ?? c.errors.generic;

    const params = new URLSearchParams(location.search);
    const state = {
        plan: (params.get('plan') === 'personal' ? 'personal' : 'team') as Plan,
        interval: (params.get('interval') === 'month' ? 'month' : 'year') as Interval,
        ai: params.get('ai') === '1',
        user: null as BuyUser | null,
        workspaces: [] as Workspace[],
        // Links from the app pass ?tenant= to preselect the workspace (ignored if it is not an open team workspace of the user).
        tenantId: (params.get('step') === 'done' ? '' : params.get('tenant') ?? '') as string,
        newTeamName: '',
        intent: null as Intent | null,
        current: 'account' as StepId,
        done: new Set<StepId>(),
        started: false,
    };

    if (api.mock) root.insertAdjacentHTML('afterbegin', `<p class="co-demo">${lang === 'de' ? 'Demo-Modus: keine echte Anmeldung, keine Zahlung.' : 'Demo mode: no real sign-in, no payment.'}</p>`);

    const darkQuery = matchMedia('(prefers-color-scheme: dark)');

    // Order panel: always open on desktop, a collapsible bar on mobile.
    const fold = $<HTMLDetailsElement>('[data-order-fold]');
    const wide = matchMedia('(min-width: 900px)');
    const syncFold = () => { fold.open = wide.matches; };
    syncFold();
    wide.addEventListener('change', syncFold);

    /* ---------------------------------------------------------------- step navigation */
    const form = $<HTMLFormElement>('[data-buy-form]');
    const go = (id: StepId) => {
        state.current = id;
        ORDER.forEach((s) => {
            const sec = $(`[data-step="${s}"]`);
            const active = s === id;
            const reachable = ORDER.indexOf(s) < ORDER.indexOf(id);
            sec.classList.toggle('is-active', active);
            sec.classList.toggle('is-done', reachable);
            $('[data-step-body]', sec).hidden = !active;
            $('[data-edit]', sec).hidden = !reachable;
            if (active) $<HTMLElement>('h2', sec).setAttribute('tabindex', '-1');
        });
        const head = $<HTMLElement>(`[data-step="${id}"] h2`);
        head.focus({ preventScroll: true });
        if (state.started) head.closest('.co-step')!.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        if (id === 'account') renderAccount();
        if (id === 'workspace') void renderWorkspaces();
        if (id === 'payment') void preparePayment();
    };
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => go(b.dataset.edit as StepId)));
    const summarize = (id: StepId, text: string) => { $('[data-step-summary]', $(`[data-step="${id}"]`)).textContent = text; };

    /* ---------------------------------------------------------------- order panel */
    const planInputs = $$<HTMLInputElement>('input[name="plan"]');
    const intervalInputs = $$<HTMLInputElement>('input[name="interval"]');
    const aiInput = $<HTMLInputElement>('input[name="ai"]');
    planInputs.forEach((i) => { i.checked = i.value === state.plan; });
    intervalInputs.forEach((i) => { i.checked = i.value === state.interval; });
    aiInput.checked = state.ai;

    const syncPlan = () => {
        state.plan = (planInputs.find((i) => i.checked)?.value ?? 'team') as Plan;
        state.interval = (intervalInputs.find((i) => i.checked)?.value ?? 'year') as Interval;
        state.ai = aiInput.checked;
        const team = state.plan === 'team';
        $('[data-plan-name]').textContent = team ? c.plan.team.name : c.plan.personal.name;
        $('[data-plan-text]').textContent = team ? c.plan.team.text : c.plan.personal.text;
        $('[data-unit-price]').textContent = money(c.prices[state.plan][state.interval] * 100);
        $('[data-unit-label]').textContent = `${team ? c.units.perSeat : c.units.perMonth}, ${state.interval === 'year' ? c.units.billedYearly : c.units.billedMonthly}`;
        $('[data-ai-text]').textContent = team ? c.order.aiHint : c.order.aiHintPersonal;
        $('[data-term-text]').textContent = state.interval === 'year' ? c.payment.termYearly : c.payment.termMonthly;
        const url = new URL(location.href);
        url.searchParams.set('plan', state.plan);
        url.searchParams.set('interval', state.interval);
        if (state.ai) url.searchParams.set('ai', '1'); else url.searchParams.delete('ai');
        history.replaceState(null, '', url);
        state.intent = null;
        renderSummary();
    };
    [...planInputs, ...intervalInputs, aiInput].forEach((i) => i.addEventListener('change', () => {
        const before = state.plan;
        syncPlan();
        // Plan type decides the workspace; interval/add-on only need a fresh intent.
        if (before !== state.plan && state.current === 'payment') go('workspace');
        else if (state.current === 'workspace' && before !== state.plan) void renderWorkspaces();
        else if (state.current === 'payment') void preparePayment();
    }));

    /* ---------------------------------------------------------------- summary */
    const renderSummary = () => {
        const lines = $('[data-summary-lines]');
        const per = state.interval === 'year' ? c.summary.perYear : c.summary.perMonth;
        const months = state.interval === 'year' ? 12 : 1;
        let rows: { label: string; qty: number; amount: number }[];
        let subtotal: number;
        if (state.intent?.summary) {
            rows = state.intent.summary.lines.map((l) => ({ label: l.label, qty: l.quantity, amount: l.amount }));
            subtotal = state.intent.summary.subtotal;
        } else {
            const ws = state.workspaces.find((w) => w.tenantId === state.tenantId);
            const seats = state.plan === 'team' ? Math.max(1, ws?.memberCount ?? 1) : 1;
            const unit = c.prices[state.plan][state.interval] * months * 100;
            rows = [{ label: state.plan === 'team' ? 'Team' : 'Personal', qty: seats, amount: unit * seats }];
            if (state.ai) rows.push({ label: c.summary.ai, qty: 1, amount: c.prices.ai[state.interval] * months * 100 });
            subtotal = rows.reduce((s, r) => s + r.amount, 0);
        }
        const ws = state.workspaces.find((w) => w.tenantId === state.tenantId);
        lines.innerHTML = rows.map((r, i) => `<div><dt>${esc(r.label)}${i === 0 && state.plan === 'team' ? `<span>${r.qty} ${r.qty === 1 ? c.summary.seat : c.summary.seats} × ${money(r.amount / Math.max(1, r.qty))}</span>` : ''}</dt><dd>${money(r.amount)}</dd></div>`).join('');
        $('[data-seats-hint]').textContent = state.plan === 'team' ? (ws ? c.order.seatsHint : `${c.order.seatsNew} ${c.order.seatsHint}`) : '';
        $('[data-seats-hint]').hidden = state.plan !== 'team';
        const total = `${money(subtotal)} ${per}`;
        $('[data-summary-total]').textContent = total;
        $('[data-bar-total]').textContent = total;
        const trialEnd = state.intent?.summary?.trialEnd ?? state.intent?.trialEnd
            ?? (state.plan === 'team' ? (ws ? (ws.status === 'trialing' ? ws.trialEndsAt : null) : Date.now() + 14 * 864e5) : null);
        const due = state.intent?.summary?.amountDue ?? (trialEnd ? 0 : subtotal);
        $('[data-due-amount]').textContent = money(due);
        $('[data-trial-badge]').hidden = !(state.plan === 'team' && trialEnd);
        $('[data-due-note]').textContent = trialEnd && !due
            ? c.order.afterTrial.replace('{amount}', total).replace('{d}', date(trialEnd))
            : c.order.renews.replace('{interval}', state.interval === 'year' ? c.order.yearly : c.order.monthly);
    };

    /* ---------------------------------------------------------------- 2 · account */
    let authMode: 'signIn' | 'register' = 'register';
    const renderAccount = () => {
        const box = $('[data-account]');
        if (state.user) {
            box.innerHTML = `
                <p class="co-user"><span class="co-user__avatar">${esc((state.user.name || state.user.email || '?').slice(0, 1).toUpperCase())}</span>
                <span>${esc(c.account.signedInAs)} <b>${esc(state.user.email ?? '')}</b></span>
                <button type="button" class="btn btn--quiet btn--sm" data-signout>${esc(c.account.signOut)}</button></p>
                <button type="button" class="btn btn--primary" data-next-account>${esc(c.next)}</button>`;
            $('[data-signout]', box).addEventListener('click', () => void api.signOut());
            $('[data-next-account]', box).addEventListener('click', () => go('workspace'));
            return;
        }
        const reg = authMode === 'register';
        box.innerHTML = `
            <div class="co-tabs" role="tablist">
                <button type="button" role="tab" aria-selected="${reg}" data-mode="register">${esc(c.account.register)}</button>
                <button type="button" role="tab" aria-selected="${!reg}" data-mode="signIn">${esc(c.account.signIn)}</button>
            </div>
            <button type="button" class="btn btn--ghost co-google" data-google>${googleIcon}${esc(c.account.google)}</button>
            <p class="co-or"><span>${esc(c.account.or)}</span></p>
            <div class="co-fields">
                ${reg ? `<label class="co-field"><span>${esc(c.account.name)}</span><input name="name" autocomplete="name"></label>` : ''}
                <label class="co-field"><span>${esc(c.account.email)}</span><input name="email" type="email" autocomplete="email" required></label>
                <label class="co-field"><span>${esc(c.account.password)}</span><input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" required>${reg ? `<small>${esc(c.account.passwordHint)}</small>` : ''}</label>
            </div>
            <p class="co-error" data-auth-error role="alert" hidden></p>
            <div class="co-actions">
                <button type="button" class="btn btn--primary" data-auth-submit>${esc(reg ? c.account.submitRegister : c.account.submitSignIn)}</button>
                ${reg ? '' : `<button type="button" class="btn btn--quiet btn--sm" data-reset>${esc(c.account.forgot)}</button>`}
            </div>`;
        const err = $('[data-auth-error]', box);
        const fail = (e: unknown) => { err.hidden = false; err.textContent = errorText(e); };
        const busy = async (btn: HTMLButtonElement, fn: () => Promise<void>) => {
            btn.disabled = true;
            err.hidden = true;
            try { await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; }
        };
        $$<HTMLButtonElement>('[data-mode]', box).forEach((b) => b.addEventListener('click', () => { authMode = b.dataset.mode as typeof authMode; renderAccount(); }));
        const field = (n: string) => ($<HTMLInputElement>(`input[name="${n}"]`, box)?.value ?? '').trim();
        $<HTMLButtonElement>('[data-google]', box).addEventListener('click', (e) => void busy(e.currentTarget as HTMLButtonElement, () => api.google()));
        $<HTMLButtonElement>('[data-auth-submit]', box).addEventListener('click', (e) => void busy(e.currentTarget as HTMLButtonElement, () => (
            reg ? api.register(field('name'), field('email'), $<HTMLInputElement>('input[name="password"]', box).value)
                : api.signIn(field('email'), $<HTMLInputElement>('input[name="password"]', box).value))));
        box.querySelector<HTMLButtonElement>('[data-reset]')?.addEventListener('click', (e) => void busy(e.currentTarget as HTMLButtonElement, async () => {
            await api.reset(field('email'));
            err.hidden = false;
            err.textContent = c.account.resetSent;
        }));
    };
    api.onUser((user) => {
        state.user = user;
        state.workspaces = [];
        if (user) summarize('account', user.email ?? '');
        if (state.current === 'account') {
            renderAccount();
            if (user) go('workspace');
        } else if (!user && ORDER.indexOf(state.current) > 1) go('account');
    });

    /* ---------------------------------------------------------------- 3 · workspace */
    const subscribed = (w: Workspace) => Boolean(w.hasSubscription || w.billingExempt) || ['active', 'past_due'].includes(String(w.status));
    const renderWorkspaces = async () => {
        const box = $('[data-workspace]');
        box.innerHTML = `<p class="co-loading">${esc(c.workspace.loading)}</p>`;
        try {
            if (!state.workspaces.length) state.workspaces = await api.workspaces(lang);
        } catch (e) {
            box.innerHTML = `<p class="co-error" role="alert">${esc(errorText(e))}</p>`;
            return;
        }
        if (state.plan === 'personal') {
            const personal = state.workspaces.find((w) => w.workspaceType === 'personal');
            state.tenantId = personal?.tenantId ?? '';
            // Changes to a running subscription (interval, AI seats) happen in the app, never implicitly here.
            box.innerHTML = personal && subscribed(personal)
                ? `<p class="co-note">${esc(c.workspace.personalSubscribed)}</p>
                    <a class="btn btn--primary" href="${APP_URL}/?openSettings=billing">${esc(c.done.openApp)}</a>`
                : `<p class="co-note">${esc(c.workspace.personalInfo)}</p>
                    <button type="button" class="btn btn--primary" data-next-ws ${state.tenantId ? '' : 'disabled'}>${esc(c.next)}</button>`;
        } else {
            const teams = state.workspaces.filter((w) => w.workspaceType === 'team');
            if (!state.tenantId || !teams.some((t) => t.tenantId === state.tenantId && !subscribed(t))) {
                state.tenantId = teams.find((t) => !subscribed(t))?.tenantId ?? 'new';
            }
            box.innerHTML = `
                <fieldset class="co-ws"><legend>${esc(c.workspace.chooseTeam)}</legend>
                ${teams.length ? '' : `<p class="co-note">${esc(c.workspace.none)}</p>`}
                ${teams.map((w) => `
                    <label class="co-ws__item${subscribed(w) ? ' is-disabled' : ''}">
                        <input type="radio" name="ws" value="${esc(w.tenantId)}" ${subscribed(w) ? 'disabled' : ''} ${state.tenantId === w.tenantId ? 'checked' : ''}>
                        <span><b>${esc(w.name)}</b><small>${w.memberCount ?? 1} ${c.workspace.members[(w.memberCount ?? 1) === 1 ? 0 : 1]}${w.status === 'trialing' && w.trialEndsAt ? ` · ${esc(c.workspace.trialUntil.replace('{d}', date(w.trialEndsAt)))}` : ''}${subscribed(w) ? ` · ${esc(w.billingExempt ? c.workspace.internal : c.workspace.subscribed)}` : ''}</small></span>
                    </label>`).join('')}
                <label class="co-ws__item"><input type="radio" name="ws" value="new" ${state.tenantId === 'new' ? 'checked' : ''}><span><b>${esc(c.workspace.newTeam)}</b></span></label>
                <label class="co-field co-ws__name" data-new-name ${state.tenantId === 'new' ? '' : 'hidden'}><span>${esc(c.workspace.newTeamName)}</span><input name="wsName" placeholder="${esc(c.workspace.newTeamPlaceholder)}" value="${esc(state.newTeamName)}" autocomplete="organization"></label>
                </fieldset>
                <p class="co-error" data-ws-error role="alert" hidden></p>
                <button type="button" class="btn btn--primary" data-next-ws>${esc(c.next)}</button>`;
            $$<HTMLInputElement>('input[name="ws"]', box).forEach((i) => i.addEventListener('change', () => {
                state.tenantId = i.value;
                $('[data-new-name]', box).hidden = i.value !== 'new';
                renderSummary();
            }));
        }
        renderSummary();
        $<HTMLButtonElement>('[data-next-ws]', box).addEventListener('click', async (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const err = box.querySelector<HTMLElement>('[data-ws-error]');
            if (state.plan === 'team' && state.tenantId === 'new') {
                state.newTeamName = ($<HTMLInputElement>('input[name="wsName"]', box).value || '').trim();
                if (!state.newTeamName) { if (err) { err.hidden = false; err.textContent = c.errors.nameRequired; } return; }
                btn.disabled = true;
                try {
                    state.tenantId = await api.createTeam(state.newTeamName, lang);
                    state.workspaces = await api.workspaces(lang);
                } catch (ex) {
                    if (err) { err.hidden = false; err.textContent = errorText(ex); }
                    btn.disabled = false;
                    return;
                }
            }
            const ws = state.workspaces.find((w) => w.tenantId === state.tenantId);
            summarize('workspace', ws?.name ?? '');
            go('payment');
        });
    };

    /* ---------------------------------------------------------------- 4 · payment */
    let stripe: any = null;
    let elements: any = null;
    const payError = $('[data-pay-error]');
    const showPayError = (text: string) => { payError.hidden = false; payError.textContent = text; };

    const loadStripe = () => new Promise<any>((resolve, reject) => {
        if ((window as any).Stripe) { resolve((window as any).Stripe); return; }
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = () => resolve((window as any).Stripe);
        s.onerror = reject;
        document.head.append(s);
    });

    /** Stripe Appearance API fed from the live design tokens, so light/dark and radii match the page. */
    const appearance = () => {
        const css = getComputedStyle(document.body);
        const v = (name: string) => css.getPropertyValue(name).trim();
        const dark = darkQuery.matches;
        return {
            theme: dark ? 'night' : 'stripe',
            labels: 'above',
            variables: {
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontSizeBase: '15px',
                colorPrimary: v('--color-primary'),
                colorBackground: v('--color-surface-card'),
                colorText: v('--color-text-main'),
                colorTextSecondary: v('--color-text-muted'),
                colorTextPlaceholder: v('--color-text-subtle'),
                colorDanger: v('--color-status-blocked-text'),
                borderRadius: v('--radius-md'),
                spacingUnit: '4px',
            },
            rules: {
                '.Input': { border: `1px solid ${v('--color-surface-border')}`, boxShadow: 'none', padding: '12px 14px' },
                '.Input:focus': { borderColor: v('--color-text-main'), boxShadow: `0 0 0 3px rgba(${v('--color-text-main-rgb')}, 0.12)` },
                '.Tab': { border: `1px solid ${v('--color-surface-border')}`, boxShadow: 'none' },
                '.Tab:hover': { borderColor: v('--color-surface-border-hover') },
                '.Tab--selected, .Tab--selected:hover': { borderColor: v('--color-text-main'), boxShadow: `0 0 0 1px ${v('--color-text-main')}` },
                '.Label': { fontWeight: '600', fontSize: '13px' },
            },
        };
    };
    darkQuery.addEventListener('change', () => elements?.update({ appearance: appearance() }));

    const preparePayment = async () => {
        payError.hidden = true;
        const mount = $('[data-payment-element]');
        mount.innerHTML = `<p class="co-loading">${esc(c.payment.loading)}</p>`;
        try {
            state.intent = await api.intent({ tenantId: state.tenantId, plan: state.plan, interval: state.interval, aiAddon: state.ai, language: lang });
            renderSummary();
            const trialEnd = state.intent.summary?.trialEnd ?? state.intent.trialEnd;
            const trial = $('[data-trial]');
            trial.hidden = !trialEnd;
            trial.textContent = trialEnd ? c.payment.trialHint.replace('{d}', date(trialEnd)) : '';
            if (api.mock || state.intent.intentType === 'none') {
                mount.innerHTML = state.intent.intentType === 'none' ? '' : `<div class="co-mock-card">${lang === 'de' ? 'Hier erscheint das Stripe-Zahlungsformular (Karte, SEPA, Apple Pay, Google Pay).' : 'The Stripe payment form appears here (card, SEPA, Apple Pay, Google Pay).'}</div>`;
                return;
            }
            const StripeCtor = await loadStripe();
            stripe = StripeCtor(await api.publishableKey(), { locale: lang });
            elements = stripe.elements({
                clientSecret: state.intent.clientSecret,
                appearance: appearance(),
                // Same self-hosted variable font as the page (served with CORS for the Stripe iframe).
                fonts: [{ family: 'Plus Jakarta Sans', src: `url(${location.origin}/fonts/pjs-latin.woff2)`, weight: '200 800' }],
            });
            mount.innerHTML = '';
            elements.create('payment', { layout: 'tabs' }).mount(mount);
        } catch (e) {
            mount.innerHTML = '';
            showPayError(errorText(e));
        }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (state.current !== 'payment') return;
        const terms = $<HTMLInputElement>('input[name="terms"]');
        if (!terms.checked) { showPayError(c.errors.termsRequired); terms.focus(); return; }
        const btn = $<HTMLButtonElement>('[data-pay]');
        btn.disabled = true;
        btn.lastChild!.textContent = c.payment.processing;
        payError.hidden = true;
        const returnUrl = new URL(location.pathname, location.origin);
        returnUrl.searchParams.set('step', 'done');
        returnUrl.searchParams.set('tenant', state.tenantId);
        returnUrl.searchParams.set('plan', state.plan);
        try {
            if (api.mock || state.intent?.intentType === 'none') {
                await new Promise((r) => window.setTimeout(r, 700));
                void showDone(state.tenantId, 'succeeded');
                return;
            }
            const confirm = state.intent?.intentType === 'setup' ? stripe.confirmSetup : stripe.confirmPayment;
            const { error } = await confirm.call(stripe, { elements, confirmParams: { return_url: returnUrl.toString() }, redirect: 'if_required' });
            if (error) throw error;
            void showDone(state.tenantId, 'succeeded');
        } catch (e: any) {
            showPayError(e?.message ?? errorText(e));
        } finally {
            btn.disabled = false;
            btn.lastChild!.textContent = c.payment.submit;
        }
    });

    /* ---------------------------------------------------------------- done */
    const showDone = async (tenantId: string, redirectStatus: string | null) => {
        form.hidden = true;
        $$<HTMLInputElement>('.co-order input').forEach((i) => { i.disabled = true; });
        const done = $('[data-done]');
        done.hidden = false;
        const appLink = `${APP_URL}/?tenant=${encodeURIComponent(tenantId)}&openSettings=billing`;
        if (redirectStatus === 'failed') {
            done.innerHTML = `<h2>${esc(c.done.failed)}</h2><a class="btn btn--primary" href="${location.pathname}?plan=${state.plan}&interval=${state.interval}">${esc(c.done.retry)}</a>`;
            return;
        }
        done.innerHTML = `<div class="co-done__icon">${checkIcon}</div><h2 tabindex="-1">${esc(c.done.title)}</h2><p data-done-status>${esc(c.done.pending)}</p><a class="btn btn--primary btn--lg" href="${appLink}">${esc(c.done.openApp)}</a>`;
        $<HTMLElement>('h2', done).focus();
        // Wait for the webhook to activate the plan (max ~30 s), then confirm.
        for (let i = 0; i < 15; i += 1) {
            try {
                const s = await api.status(tenantId, state.plan);
                if (s.active) { $('[data-done-status]', done).textContent = c.done.text; return; }
            } catch { /* keep polling */ }
            await new Promise((r) => window.setTimeout(r, 2000));
        }
        $('[data-done-status]', done).textContent = c.done.text;
    };

    /* ---------------------------------------------------------------- boot */
    syncPlan();
    if (params.get('step') === 'done' && params.get('tenant')) {
        const status = params.get('redirect_status');
        void showDone(params.get('tenant')!, status === 'failed' ? 'failed' : status);
    } else {
        go('account');
        state.started = true;
        window.scrollTo(0, 0);
    }
}

const checkIcon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const googleIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';

// Boot last: start() renders synchronously and needs the icon constants above.
if (root && copyEl) start(root, JSON.parse(copyEl.textContent ?? '{}'));
