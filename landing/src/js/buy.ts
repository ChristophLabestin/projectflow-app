import '../styles/buy.scss';
import { createApi, type BuyUser, type Intent, type Interval, type OAuthKind, type Plan, type Workspace } from './buy-api';

/*
 * Checkout wizard: plan → account → workspace → payment (Stripe Express Checkout + Payment Element) → done.
 * One pane at a time; the left column shows the step's headline and a recap of earlier choices. Steps are history
 * entries, so the browser back button walks back through the checkout.
 */

type StepId = 'plan' | 'account' | 'workspace' | 'payment';
const ORDER: StepId[] = ['plan', 'account', 'workspace', 'payment'];
const APP_URL = 'https://app.getprojectflow.com';

/* eslint-disable @typescript-eslint/no-explicit-any */
function start(root: HTMLElement, c: any) {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    const api = createApi();
    const $ = <T extends HTMLElement = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector<T>(sel)!;
    const $$ = <T extends HTMLElement = HTMLElement>(sel: string, scope: ParentNode = root) => Array.from(scope.querySelectorAll<T>(sel));
    const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
    const money = (cents: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(cents / 100);
    /** Whole euros without decimals ("5 €"), for list prices. */
    const price = (cents: number) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
    const seatText = (n: number) => (n === 1 ? c.payment.seatOne : c.payment.seats.replace('{n}', String(n)));
    const clampSeats = (n: number) => Math.min(50, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));
    const date = (v: string | number | null | undefined) => (v ? new Date(v).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
    const errorText = (e: any) => c.errors[e?.code] ?? c.errors[e?.message] ?? c.errors[String(e?.message ?? '').replace(/^.*?(billing-[a-z-]+).*$/, '$1')] ?? c.errors.generic;
    const svg = (name: string) => iconSvg[name] ?? '';

    const params = new URLSearchParams(location.search);
    const state = {
        plan: (params.get('plan') === 'personal' ? 'personal' : 'team') as Plan,
        interval: (params.get('interval') === 'month' ? 'month' : 'year') as Interval,
        // Team seats booked up front (min. the full members of the chosen workspace, max. 50).
        seats: clampSeats(Number(params.get('seats') ?? 1)),
        user: null as BuyUser | null,
        workspaces: [] as Workspace[],
        // Links from the app pass ?tenant= to preselect the workspace (ignored if it is not an open team workspace of the user).
        tenantId: (params.get('step') === 'done' ? '' : params.get('tenant') ?? '') as string,
        newTeamName: '',
        intent: null as Intent | null,
        current: 'plan' as StepId,
    };

    // Workspaces are fetched once per user and as early as possible (right after sign-in), so the workspace step is
    // usually ready when it opens; the callable can be slow on a cold start.
    let workspacesReq: Promise<Workspace[]> | null = null;
    const loadWorkspaces = () => {
        workspacesReq ??= api.workspaces(lang).catch((e) => { workspacesReq = null; throw e; });
        return workspacesReq;
    };

    if (api.mock) root.insertAdjacentHTML('afterbegin', `<p class="ck-demo">${esc(c.demo)}</p>`);

    const form = $<HTMLFormElement>('[data-buy-form]');
    const question = $('[data-question]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------------------------------------------------------- navigation */
    const go = (target: StepId, push = true) => {
        let id = target;
        if (ORDER.indexOf(id) > 1 && !state.user) id = 'account';
        state.current = id;
        const idx = ORDER.indexOf(id);
        ORDER.forEach((s, i) => {
            $(`[data-pane="${s}"]`).hidden = s !== id;
            const item = $(`[data-stepper="${s}"]`);
            item.classList.toggle('is-done', i < idx);
            item.classList.toggle('is-active', i === idx);
            if (i === idx) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
        });
        const intro = c.intro[id];
        $('[data-eyebrow]').textContent = c.stepNames[id];
        $('[data-headline]').textContent = intro.headline;
        $('[data-lead]').textContent = intro.lead;
        question.textContent = intro.question;
        const back = $<HTMLButtonElement>('[data-back]');
        back.hidden = idx === 0;
        back.dataset.target = ORDER[Math.max(0, idx - 1)];
        renderRecap();
        if (push) history.pushState({ step: id }, '', location.href);
        if (id === 'plan') renderPlan();
        if (id === 'account') renderAccount();
        if (id === 'workspace') void renderWorkspaces();
        if (id === 'payment') void preparePayment();
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        question.focus({ preventScroll: true });
    };
    $('[data-back]').addEventListener('click', (e) => go((e.currentTarget as HTMLElement).dataset.target as StepId));
    window.addEventListener('popstate', (e) => {
        const step = (e.state?.step ?? 'plan') as StepId;
        if (ORDER.includes(step) && $('[data-done]').hidden) go(step, false);
    });

    /* ---------------------------------------------------------------- recap (left) */
    /** Recap of the plan as it will be billed: total per billing period, then how it adds up. */
    const planLines = () => {
        const yearly = state.interval === 'year';
        const months = yearly ? 12 : 1;
        const seats = state.plan === 'team' ? state.seats : 1;
        const perSeat = c.prices[state.plan][state.interval] * months * 100;
        const total = c.recap.total.replace('{amount}', money(perSeat * seats)).replace('{unit}', yearly ? c.plan.perYearShort : c.plan.perMonthShort);
        const billed = yearly ? c.recap.billedYearly : c.recap.billedMonthly;
        const detail = state.plan === 'team'
            ? c.recap.seatsDetail.replace('{n}', String(seats)).replace('{p}', price(perSeat)).replace('{billed}', billed)
            : yearly ? c.recap.personalYear.replace('{m}', price(c.prices.personal.year * 100)).replace('{billed}', billed) : billed;
        return [total, detail];
    };
    const renderRecap = () => {
        const idx = ORDER.indexOf(state.current);
        const ws = state.workspaces.find((w) => w.tenantId === state.tenantId);
        const item = (step: StepId, title: string, body: string) => `
            <div class="ck-recap__item">
                <div class="ck-recap__head"><h3>${esc(title)}</h3>
                    <button type="button" class="ck-edit" data-edit="${step}">${esc(c.edit)}${svg('pencil')}<span class="sr-only">: ${esc(title)}</span></button></div>
                ${body}
            </div>`;
        const parts: string[] = [];
        if (idx > 0) {
            parts.push(item('plan', c.recap.plan, `
                <div class="ck-recap__plan"><span class="ck-recap__tile">${svg(state.plan === 'team' ? 'users' : 'user')}</span>
                <div><b>${esc(c.plan[state.plan].name)}${state.plan === 'team' ? ` · ${esc(seatText(state.seats))}` : ''}</b>
                ${planLines().map((l) => `<span>${esc(l)}</span>`).join('')}</div></div>`));
        }
        if (idx > 1 && state.user) parts.push(item('account', c.recap.account, `<p class="ck-recap__line">${svg('mail')}${esc(state.user.email ?? '')}</p>`));
        if (idx > 2) parts.push(item('workspace', c.recap.workspace, `<p class="ck-recap__line">${svg('users')}${esc(ws?.workspaceType === 'personal' ? c.workspace.personalName : ws?.name ?? (state.tenantId === 'new' ? state.newTeamName : ''))}</p>`));
        const recap = $('[data-recap]');
        recap.innerHTML = parts.join('');
        recap.hidden = !parts.length;
        $$('[data-edit]', recap).forEach((b) => b.addEventListener('click', () => go(b.dataset.edit as StepId)));
    };

    /* ---------------------------------------------------------------- 1 · plan */
    const planInputs = $$<HTMLInputElement>('input[name="plan"]');
    const intervalInputs = $$<HTMLInputElement>('input[name="interval"]');
    const seatsInput = $<HTMLInputElement>('input[name="seats"]');
    planInputs.forEach((i) => { i.checked = i.value === state.plan; });
    intervalInputs.forEach((i) => { i.checked = i.value === state.interval; });
    seatsInput.value = String(state.seats);

    const renderPlan = () => {
        const team = state.plan === 'team';
        const months = state.interval === 'year' ? 12 : 1;
        const seats = team ? state.seats : 1;
        $$('[data-plan-amount]').forEach((el) => { el.textContent = price(c.prices[el.dataset.planAmount as Plan][state.interval] * 100); });
        $('[data-seats]').hidden = !team;
        seatsInput.value = String(state.seats);
        $<HTMLButtonElement>('[data-seat-step="-1"]').disabled = state.seats <= 1;
        $<HTMLButtonElement>('[data-seat-step="1"]').disabled = state.seats >= 50;
        const name = c.plan[state.plan].name;
        const perMonth = c.prices[state.plan].year * 100;
        const suffix = team ? ` ${c.plan.perSeatSuffix}` : '';
        $('[data-interval-note]').textContent = (state.interval === 'year' ? c.plan.intervalNoteYear : c.plan.intervalNoteMonth)
            .replace('{plan}', name).replace('{year}', `${price(perMonth * 12)}${suffix}`).replace('{month}', price(perMonth));
        const interval = state.interval === 'year' ? c.payment.perYear : c.payment.perMonth;
        $('[data-sum-label]').textContent = c.plan.sumLabel.replace('{plan}', team ? `${name} · ${seatText(seats)}` : name).replace('{interval}', interval);
        $('[data-sum-amount]').textContent = money(c.prices[state.plan][state.interval] * months * 100 * seats);
        $('[data-sum-unit]').textContent = state.interval === 'year' ? c.plan.perYearShort : c.plan.perMonthShort;
    };
    const syncPlan = () => {
        state.plan = (planInputs.find((i) => i.checked)?.value ?? 'team') as Plan;
        state.interval = (intervalInputs.find((i) => i.checked)?.value ?? 'year') as Interval;
        state.seats = clampSeats(Number(seatsInput.value));
        const url = new URL(location.href);
        url.searchParams.set('plan', state.plan);
        url.searchParams.set('interval', state.interval);
        if (state.plan === 'team' && state.seats > 1) url.searchParams.set('seats', String(state.seats)); else url.searchParams.delete('seats');
        url.searchParams.delete('ai');
        history.replaceState(history.state, '', url);
        state.intent = null;
        renderPlan();
    };
    [...planInputs, ...intervalInputs, seatsInput].forEach((i) => i.addEventListener('change', syncPlan));
    $$<HTMLButtonElement>('[data-seat-step]').forEach((b) => b.addEventListener('click', () => {
        seatsInput.value = String(clampSeats(state.seats + Number(b.dataset.seatStep)));
        syncPlan();
    }));
    $('[data-next="plan"]').addEventListener('click', () => go('account'));

    /* ---------------------------------------------------------------- 2 · account */
    let authMode: 'signIn' | 'register' = 'register';
    const renderAccount = () => {
        const box = $('[data-pane="account"]');
        if (state.user) {
            box.innerHTML = `
                <div class="ck-user"><span class="ck-user__avatar">${esc((state.user.name || state.user.email || '?').slice(0, 1).toUpperCase())}</span>
                <span><small>${esc(c.account.signedInAs)}</small><b>${esc(state.user.email ?? '')}</b></span>
                <button type="button" class="ck-link" data-signout>${esc(c.account.signOut)}</button></div>
                <button type="button" class="ck-btn" data-next-account>${esc(c.next)}${svg('arrowRight')}</button>`;
            $('[data-signout]', box).addEventListener('click', () => void api.signOut());
            $('[data-next-account]', box).addEventListener('click', () => go('workspace'));
            return;
        }
        const reg = authMode === 'register';
        box.innerHTML = `
            <div class="ck-social">
                <button type="button" class="ck-btn ck-btn--ghost" data-oauth="google" aria-label="${esc(c.account.withProvider.replace('{p}', 'Google'))}">${googleIcon}<span>Google</span></button>
                <button type="button" class="ck-btn ck-btn--ghost" data-oauth="apple" aria-label="${esc(c.account.withProvider.replace('{p}', 'Apple'))}">${appleIcon}<span>Apple</span></button>
                <button type="button" class="ck-btn ck-btn--ghost" data-oauth="github" aria-label="${esc(c.account.withProvider.replace('{p}', 'GitHub'))}">${githubIcon}<span>GitHub</span></button>
            </div>
            <p class="ck-or"><span>${esc(c.account.orEmail)}</span></p>
            <div class="ck-fields">
                ${reg ? `<label class="ck-field"><span>${esc(c.account.name)}</span><input name="name" autocomplete="name" placeholder="${esc(c.account.namePlaceholder)}"></label>` : ''}
                <label class="ck-field"><span>${esc(c.account.email)}</span><input name="email" type="email" autocomplete="email" placeholder="${esc(c.account.emailPlaceholder)}" required></label>
                <label class="ck-field"><span>${esc(c.account.password)}</span><input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="8" required>${reg ? `<small>${esc(c.account.passwordHint)}</small>` : ''}</label>
            </div>
            <p class="ck-error" data-auth-error role="alert" hidden></p>
            <button type="button" class="ck-btn" data-auth-submit>${esc(reg ? c.account.submitRegister : c.account.submitSignIn)}${svg('arrowRight')}</button>
            <p class="ck-switch">${esc(reg ? c.account.toSignIn : c.account.toRegister)} <button type="button" class="ck-link" data-mode="${reg ? 'signIn' : 'register'}">${esc(reg ? c.account.toSignInLink : c.account.toRegisterLink)}</button>${reg ? '' : ` · <button type="button" class="ck-link" data-reset>${esc(c.account.forgot)}</button>`}</p>`;
        const err = $('[data-auth-error]', box);
        const fail = (e: unknown) => { err.hidden = false; err.textContent = errorText(e); };
        const busy = async (btn: HTMLButtonElement, fn: () => Promise<void>) => {
            btn.disabled = true;
            err.hidden = true;
            try { await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; }
        };
        $<HTMLButtonElement>('[data-mode]', box).addEventListener('click', (e) => {
            authMode = (e.currentTarget as HTMLElement).dataset.mode as typeof authMode;
            renderAccount();
            box.querySelector<HTMLInputElement>('input')?.focus();
        });
        const field = (n: string) => (box.querySelector<HTMLInputElement>(`input[name="${n}"]`)?.value ?? '').trim();
        $$<HTMLButtonElement>('[data-oauth]', box).forEach((btn) => btn.addEventListener('click', () => void busy(btn, () => api.oauth(btn.dataset.oauth as OAuthKind))));
        $<HTMLButtonElement>('[data-auth-submit]', box).addEventListener('click', (e) => void busy(e.currentTarget as HTMLButtonElement, () => (
            reg ? api.register(field('name'), field('email'), $<HTMLInputElement>('input[name="password"]', box).value)
                : api.signIn(field('email'), $<HTMLInputElement>('input[name="password"]', box).value))));
        box.querySelector<HTMLButtonElement>('[data-reset]')?.addEventListener('click', (e) => void busy(e.currentTarget as HTMLButtonElement, async () => {
            await api.reset(field('email'));
            err.hidden = false;
            err.textContent = c.account.resetSent;
        }));
    };
    let firstAuth = true;
    api.onUser((user) => {
        state.user = user;
        state.workspaces = [];
        workspacesReq = null;
        // Signed in: warm up the workspace list and Stripe while the visitor is still on the account step.
        if (user) {
            void loadWorkspaces().catch(() => { /* shown when the step opens */ });
            void prepareStripe().catch(() => { /* retried on the payment step */ });
        }
        // The first callback is the restored session: just refresh the visible pane, don't jump ahead.
        if (firstAuth) {
            firstAuth = false;
            if (state.current === 'account') renderAccount();
            if (!$('[data-done]').hidden) void renderReceipt();
            return;
        }
        if (state.current === 'account') { if (user) go('workspace'); else renderAccount(); } else if (!user && ORDER.indexOf(state.current) > 1) go('account');
    });

    /* ---------------------------------------------------------------- 3 · workspace */
    const subscribed = (w: Workspace) => Boolean(w.hasSubscription || w.billingExempt) || ['active', 'past_due'].includes(String(w.status));
    const renderWorkspaces = async () => {
        const box = $('[data-pane="workspace"]');
        box.innerHTML = `<div class="ck-skeleton" aria-busy="true"><span class="sr-only">${esc(c.workspace.loading)}</span><i></i><i></i><i class="is-btn"></i></div>`;
        void prepareStripe();
        try {
            if (!state.workspaces.length) state.workspaces = await loadWorkspaces();
        } catch (e) {
            box.innerHTML = `<p class="ck-error" role="alert">${esc(errorText(e))}</p>`;
            return;
        }
        if (state.plan === 'personal') {
            const personal = state.workspaces.find((w) => w.workspaceType === 'personal');
            state.tenantId = personal?.tenantId ?? '';
            box.innerHTML = personal && subscribed(personal)
                ? `<p class="ck-note">${esc(c.workspace.personalSubscribed)}</p>
                    <a class="ck-btn" href="${APP_URL}/?openSettings=billing">${esc(c.done.openApp)}${svg('arrowRight')}</a>`
                : `<div class="ck-option is-static"><span class="ck-option__icon">${svg('user')}</span>
                    <span class="ck-option__body"><b>${esc(c.workspace.personalTitle)}</b><small>${esc(c.workspace.personalInfo)}</small></span></div>
                    <button type="button" class="ck-btn" data-next-ws ${state.tenantId ? '' : 'disabled'}>${esc(c.next)}${svg('arrowRight')}</button>`;
        } else {
            const teams = state.workspaces.filter((w) => w.workspaceType === 'team');
            if (!state.tenantId || !teams.some((t) => t.tenantId === state.tenantId && !subscribed(t))) {
                state.tenantId = teams.find((t) => !subscribed(t))?.tenantId ?? 'new';
            }
            const meta = (w: Workspace) => [
                `${w.memberCount ?? 1} ${c.workspace.members[(w.memberCount ?? 1) === 1 ? 0 : 1]}`,
                w.status === 'trialing' && w.trialEndsAt ? c.workspace.trialUntil.replace('{d}', date(w.trialEndsAt)) : '',
                subscribed(w) ? (w.billingExempt ? c.workspace.internal : c.workspace.subscribed) : '',
            ].filter(Boolean).join(' · ');
            box.innerHTML = `
                <fieldset class="ck-options"><legend class="sr-only">${esc(c.intro.workspace.question)}</legend>
                ${teams.map((w) => `
                    <label class="ck-option${subscribed(w) ? ' is-disabled' : ''}">
                        <input type="radio" name="ws" value="${esc(w.tenantId)}" ${subscribed(w) ? 'disabled' : ''} ${state.tenantId === w.tenantId ? 'checked' : ''}>
                        <span class="ck-option__icon">${svg('users')}</span>
                        <span class="ck-option__body"><b>${esc(w.name)}</b><small>${esc(meta(w))}</small></span>
                    </label>`).join('')}
                <label class="ck-option">
                    <input type="radio" name="ws" value="new" ${state.tenantId === 'new' ? 'checked' : ''}>
                    <span class="ck-option__icon">${svg('plus')}</span>
                    <span class="ck-option__body"><b>${esc(c.workspace.newTeam)}</b><small>${esc(c.plan.trialNote)}</small></span>
                </label>
                </fieldset>
                <label class="ck-field" data-new-name ${state.tenantId === 'new' ? '' : 'hidden'}><span>${esc(c.workspace.newTeamName)}</span><input name="wsName" placeholder="${esc(c.workspace.newTeamPlaceholder)}" value="${esc(state.newTeamName)}" autocomplete="organization"></label>
                <p class="ck-error" data-ws-error role="alert" hidden></p>
                <button type="button" class="ck-btn" data-next-ws>${esc(c.next)}${svg('arrowRight')}</button>`;
            $$<HTMLInputElement>('input[name="ws"]', box).forEach((i) => i.addEventListener('change', () => {
                state.tenantId = i.value;
                $('[data-new-name]', box).hidden = i.value !== 'new';
            }));
        }
        box.querySelector<HTMLButtonElement>('[data-next-ws]')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const err = box.querySelector<HTMLElement>('[data-ws-error]');
            if (state.plan === 'team' && state.tenantId === 'new') {
                state.newTeamName = ($<HTMLInputElement>('input[name="wsName"]', box).value || '').trim();
                if (!state.newTeamName) { if (err) { err.hidden = false; err.textContent = c.errors.nameRequired; } return; }
                // Nothing is created here: the name travels with the subscription request, and the backend creates
                // the workspace only once the card is saved (an abandoned checkout leaves nothing behind).
            }
            // Seats can't go below the workspace's full members; raise them and show it in the recap.
            const chosen = state.workspaces.find((w) => w.tenantId === state.tenantId);
            if (state.plan === 'team' && chosen && (chosen.memberCount ?? 1) > state.seats) {
                seatsInput.value = String(clampSeats(chosen.memberCount ?? 1));
                syncPlan();
            }
            go('payment');
        });
    };

    /* ---------------------------------------------------------------- 4 · payment */
    let stripe: any = null;
    let elements: any = null;
    const payError = $('[data-pay-error]');
    const terms = $<HTMLInputElement>('input[name="terms"]');
    const showPayError = (text: string) => { payError.hidden = false; payError.textContent = text; };
    const earlyStart = $<HTMLInputElement>('input[name="earlyStart"]');
    terms.addEventListener('change', () => { if (terms.checked) payError.hidden = true; });
    earlyStart.addEventListener('change', () => { if (earlyStart.checked && terms.checked) payError.hidden = true; });
    /** Both boxes ticked? Otherwise shows the error, focuses the first open box and returns false. */
    const consentGiven = () => {
        const missing = !terms.checked ? terms : !earlyStart.checked ? earlyStart : null;
        if (!missing) return true;
        showPayError(missing === terms ? c.errors.termsRequired : c.errors.earlyStartRequired);
        missing.focus();
        return false;
    };

    const loadStripe = () => new Promise<any>((resolve, reject) => {
        if ((window as any).Stripe) { resolve((window as any).Stripe); return; }
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.onload = () => resolve((window as any).Stripe);
        s.onerror = reject;
        document.head.append(s);
    });

    /** Stripe.js and the publishable key load in the background (page start, workspace step), not after the intent. */
    let stripeReq: Promise<any> | null = null;
    const prepareStripe = (): Promise<any> => {
        if (api.mock) return Promise.resolve(null);
        stripeReq ??= Promise.all([loadStripe(), api.publishableKey()])
            .then(([StripeCtor, pk]) => StripeCtor(pk, { locale: lang }))
            .catch((e) => { stripeReq = null; throw e; });
        return stripeReq;
    };

    const renderTotals = () => {
        const s = state.intent?.summary;
        const months = state.interval === 'year' ? 12 : 1;
        const ws = state.workspaces.find((w) => w.tenantId === state.tenantId);
        const seats = state.plan === 'team' ? (s?.lines[0]?.quantity ?? Math.max(state.seats, ws?.memberCount ?? 1)) : 1;
        const planAmount = s?.lines[0]?.amount ?? c.prices[state.plan][state.interval] * months * 100 * seats;
        // Extra server lines (e.g. an AI add-on booked in the app) are shown as they come.
        const extras = s ? s.lines.slice(1) : [];
        const subtotal = s?.subtotal ?? planAmount;
        const tax = s?.tax ?? 0;
        const total = s?.total ?? subtotal;
        const per = state.interval === 'year' ? c.payment.perYear : c.payment.perMonth;
        const billed = state.interval === 'year' ? c.payment.yearlyBilled : c.payment.monthlyBilled;
        const planName = `${c.plan[state.plan].name}${state.plan === 'team' ? `, ${seatText(seats)}` : ''}`;
        const rows = [`<div><dt>${esc(c.payment.subtotal.replace('{plan}', planName).replace('{interval}', per))}</dt><dd>${money(planAmount)}</dd></div>`];
        extras.forEach((l) => rows.push(`<div><dt>${esc(l.label)}</dt><dd>${money(l.amount)}</dd></div>`));
        if (tax > 0) rows.push(`<div><dt>${esc(c.payment.vat.replace('{r}', String(Math.round((tax / subtotal) * 100))))}</dt><dd>${money(tax)}</dd></div>`);
        const trialEnd = s?.trialEnd ?? state.intent?.trialEnd ?? null;
        const due = s?.amountDue ?? (trialEnd ? 0 : total);
        const note = trialEnd && !due
            ? c.payment.dueTrial.replace('{d}', date(trialEnd))
            : c.payment.dueNow.replace('{Interval}', billed).replace('{interval}', billed);
        $('[data-totals]').innerHTML = `${rows.join('')}
            <div class="ck-totals__total"><dt>${esc(c.payment.total)}</dt><dd>${money(total)}</dd></div>
            <p class="ck-totals__note">${esc(note)}${tax > 0 ? '' : `<br>${esc(c.payment.taxNote)}`}</p>`;
        $('[data-fine]').textContent = state.interval === 'year' ? c.payment.fineYearly : c.payment.fineMonthly;
        if (trialEnd && !due) $('[data-lead]').textContent = c.intro.payment.leadTrial.replace('{d}', date(trialEnd));
    };

    /** Stripe Appearance API fed from the live design tokens, so colours and radii match the page. */
    const appearance = () => {
        const css = getComputedStyle(document.body);
        const v = (name: string) => css.getPropertyValue(name).trim();
        return {
            theme: 'stripe',
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
                borderRadius: '10px',
                spacingUnit: '4px',
            },
            rules: {
                '.Input': { border: `1px solid ${v('--color-surface-border')}`, boxShadow: 'none', padding: '13px 14px' },
                '.Input:focus': { borderColor: v('--color-text-main'), boxShadow: `0 0 0 3px rgba(${v('--color-text-main-rgb')}, 0.12)` },
                '.Tab': { border: `1px solid ${v('--color-surface-border')}`, boxShadow: 'none' },
                '.Tab--selected, .Tab--selected:hover': { borderColor: v('--color-text-main'), boxShadow: `0 0 0 1px ${v('--color-text-main')}` },
                '.Label': { fontWeight: '500', fontSize: '14px', marginBottom: '6px' },
            },
        };
    };

    /** The workspace the purchase is for; a new one gets its ID from the subscription request. */
    const paidTenant = () => (state.tenantId === 'new' ? state.intent?.tenantId ?? '' : state.tenantId);
    const returnUrl = () => {
        const url = new URL(location.pathname, location.origin);
        url.searchParams.set('step', 'done');
        url.searchParams.set('tenant', paidTenant());
        url.searchParams.set('plan', state.plan);
        return url.toString();
    };
    // The subscription request runs while the form is already visible (Stripe "deferred intent"): the elements
    // render from the expected mode/amount and are confirmed against the real client secret on submit.
    let intentReq: Promise<Intent> | null = null;
    const confirm = async () => {
        const { error: submitError } = await elements.submit();
        if (submitError) throw submitError;
        const intent = await intentReq!;
        // The consent is stored server-side before anything is confirmed; without it nothing is charged.
        await api.consent(intent.subscriptionId, lang).catch((e) => { throw new Error(errorText(e)); });
        const fn = intent.intentType === 'setup' ? stripe.confirmSetup : stripe.confirmPayment;
        const { error } = await fn.call(stripe, { elements, clientSecret: intent.clientSecret, confirmParams: { return_url: returnUrl() }, redirect: 'if_required' });
        if (error) throw error;
        void showDone(paidTenant(), 'succeeded');
    };

    /** What the server will most likely ask for: a team workspace still in a long trial only saves the card. */
    const expectedMode = () => {
        const ws = state.workspaces.find((w) => w.tenantId === state.tenantId);
        const trialEnd = Number(ws?.trialEndsAt ? new Date(ws.trialEndsAt).getTime() : 0);
        const setup = state.plan === 'team' && (state.tenantId === 'new' || (ws?.status === 'trialing' && trialEnd - Date.now() > 48 * 3600e3));
        const months = state.interval === 'year' ? 12 : 1;
        const seats = state.plan === 'team' ? Math.max(state.seats, ws?.memberCount ?? 1) : 1;
        return setup ? { mode: 'setup' as const } : { mode: 'subscription' as const, amount: c.prices[state.plan][state.interval] * months * 100 * seats };
    };

    const preparePayment = async () => {
        payError.hidden = true;
        const mount = $('[data-payment-element]');
        const express = $('[data-express]');
        const or = $('[data-or]');
        mount.innerHTML = `<div class="ck-skeleton ck-skeleton--pay" aria-busy="true"><span class="sr-only">${esc(c.payment.loading)}</span><i></i><i></i><i class="is-half"></i><i class="is-half"></i></div>`;
        express.innerHTML = '';
        express.hidden = false;
        or.hidden = true;
        state.intent = null;
        renderTotals();
        const isNew = state.plan === 'team' && state.tenantId === 'new';
        intentReq = api.intent({
            ...(isNew ? { newWorkspace: { name: state.newTeamName, language: lang } } : { tenantId: state.tenantId }),
            plan: state.plan, interval: state.interval, seats: state.plan === 'team' ? state.seats : undefined, language: lang,
        });
        intentReq.catch(() => { /* handled below */ });
        try {
            if (api.mock) {
                express.innerHTML = '<div class="ck-mock ck-mock--wallet">Apple Pay · Google Pay</div>';
                or.hidden = false;
                mount.innerHTML = `<div class="ck-mock">${lang === 'de' ? 'Hier erscheint das Stripe-Zahlungsformular (Karte, SEPA).' : 'The Stripe payment form appears here (card, SEPA).'}</div>`;
                state.intent = await intentReq;
                renderTotals();
                return;
            }
            stripe = await prepareStripe();
            const expected = expectedMode();
            elements = stripe.elements({
                ...expected,
                currency: 'eur',
                appearance: appearance(),
                // Same self-hosted variable font as the page (served with CORS for the Stripe iframe).
                fonts: [{ family: 'Plus Jakarta Sans', src: `url(${location.origin}/fonts/pjs-latin.woff2)`, weight: '200 800' }],
            });
            // Apple Pay / Google Pay on top; the terms checkbox must be ticked before the wallet sheet opens.
            const expressEl = elements.create('expressCheckout', { buttonHeight: 52, buttonType: { applePay: 'subscribe', googlePay: 'subscribe' } });
            expressEl.on('ready', ({ availablePaymentMethods }: any) => { or.hidden = !availablePaymentMethods; express.hidden = !availablePaymentMethods; });
            expressEl.on('click', (event: any) => {
                if (!consentGiven()) return;
                event.resolve();
            });
            expressEl.on('confirm', async () => {
                try { await confirm(); } catch (e: any) { showPayError(e?.message ?? errorText(e)); }
            });
            expressEl.mount(express);
            mount.innerHTML = '';
            elements.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } }).mount(mount);

            state.intent = await intentReq;
            renderTotals();
            if (state.intent.intentType === 'none') { mount.innerHTML = ''; express.hidden = true; or.hidden = true; return; }
            // Align the form with what the server actually created (mode and first amount).
            const mode = state.intent.intentType === 'setup' ? 'setup' : 'subscription';
            const amount = state.intent.summary?.amountDue ?? state.intent.summary?.total;
            if (mode !== expected.mode || (mode === 'subscription' && amount && amount !== (expected as { amount?: number }).amount)) {
                elements.update(mode === 'setup' ? { mode } : { mode, amount });
            }
        } catch (e) {
            mount.innerHTML = '';
            showPayError(errorText(e));
        }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (state.current !== 'payment') return;
        if (!consentGiven()) return;
        const btn = $<HTMLButtonElement>('[data-pay]');
        const label = $('span', btn);
        btn.disabled = true;
        label.textContent = c.payment.processing;
        payError.hidden = true;
        try {
            if (api.mock || state.intent?.intentType === 'none') {
                if (state.intent) await api.consent(state.intent.subscriptionId, lang).catch((e) => { throw new Error(errorText(e)); });
                await new Promise((r) => window.setTimeout(r, 700));
                void showDone(paidTenant(), 'succeeded');
                return;
            }
            await confirm();
        } catch (e: any) {
            showPayError(e?.message ?? errorText(e));
        } finally {
            btn.disabled = false;
            label.textContent = c.payment.submit;
        }
    });

    /* ---------------------------------------------------------------- done */
    let doneStatus: { status: string; active?: boolean; interval?: string; aiAddonSeats?: number } | null = null;
    let doneTenant = '';
    /** Receipt on the confirmation screen; filled from the session state, then from the server once known. */
    const renderReceipt = async () => {
        const box = root.querySelector<HTMLElement>('[data-receipt]');
        if (!box) return;
        if (state.user && !state.workspaces.length) state.workspaces = await loadWorkspaces().catch(() => []);
        const ws = state.workspaces.find((w) => w.tenantId === doneTenant);
        const interval = (doneStatus?.interval as Interval | undefined) ?? state.interval;
        const trialEnd = state.intent?.summary?.trialEnd ?? state.intent?.trialEnd ?? (ws?.status === 'trialing' ? ws.trialEndsAt : null);
        const statusText = !doneStatus?.active ? c.done.statusPending
            : doneStatus.status === 'trialing' && trialEnd ? c.done.statusTrial.replace('{d}', date(trialEnd)) : c.done.statusActive;
        const rows: [string, string][] = [[c.done.rowPlan, `${c.plan[state.plan].name}${state.plan === 'team' ? ` · ${seatText(state.seats)}` : ''} · ${interval === 'year' ? c.plan.yearly : c.plan.monthly}`]];
        if (ws) rows.push([c.done.rowWorkspace, ws.workspaceType === 'personal' ? c.workspace.personalName : ws.name]);
        else if (state.newTeamName) rows.push([c.done.rowWorkspace, state.newTeamName]);
        if (state.user?.email) rows.push([c.done.rowAccount, state.user.email]);
        box.innerHTML = `${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
            <div><dt>${esc(c.done.rowStatus)}</dt><dd><span class="ck-pill${doneStatus?.active ? ' is-ok' : ''}">${esc(statusText)}</span></dd></div>`;
    };

    const showDone = async (tenantId: string, redirectStatus: string | null) => {
        doneTenant = tenantId;
        root.classList.add('is-finished');
        form.hidden = true;
        question.hidden = true;
        $('[data-back]').hidden = true;
        $('[data-recap]').hidden = true;
        ORDER.forEach((s) => { const it = $(`[data-stepper="${s}"]`); it.classList.add('is-done'); it.classList.remove('is-active'); it.removeAttribute('aria-current'); });
        const done = $('[data-done]');
        done.hidden = false;
        $('.ck-intro').insertAdjacentHTML('afterbegin', `<div class="ck-done__icon">${svg(redirectStatus === 'failed' ? 'close' : 'check')}</div>`);
        window.scrollTo(0, 0);
        if (redirectStatus === 'failed') {
            root.classList.add('is-failed');
            $('[data-eyebrow]').textContent = c.stepNames.payment;
            $('[data-headline]').textContent = c.done.failedTitle;
            $('[data-lead]').textContent = c.done.failed;
            done.innerHTML = `<a class="ck-btn" href="${location.pathname}?plan=${state.plan}&interval=${state.interval}">${esc(c.done.retry)}${svg('arrowRight')}</a>`;
            return;
        }
        $('[data-eyebrow]').textContent = c.done.eyebrow;
        $('[data-headline]').textContent = c.done.title;
        $('[data-lead]').textContent = c.done.text;
        const appLink = `${APP_URL}/?tenant=${encodeURIComponent(tenantId)}&openSettings=billing`;
        done.innerHTML = `
            <dl class="ck-receipt" data-receipt></dl>
            <a class="ck-btn" href="${appLink}">${esc(c.done.openApp)}${svg('arrowRight')}</a>
            <p class="ck-fine">${esc(c.done.manage)}</p>`;
        void renderReceipt();
        $<HTMLElement>('.ck-btn', done).focus({ preventScroll: true });
        // Wait for the webhook to activate the plan (max ~30 s).
        for (let i = 0; i < 15; i += 1) {
            try {
                doneStatus = await api.status(tenantId, state.plan) as typeof doneStatus;
                if (doneStatus?.active) break;
            } catch { /* keep polling */ }
            await new Promise((r) => window.setTimeout(r, 2000));
        }
        // A new workspace only exists once the webhook ran; reload the list for the receipt.
        workspacesReq = null;
        state.workspaces = [];
        void renderReceipt();
    };

    /* ---------------------------------------------------------------- boot */
    renderPlan();
    if (params.get('step') === 'done' && params.get('tenant')) {
        const status = params.get('redirect_status');
        void showDone(params.get('tenant')!, status === 'failed' ? 'failed' : status);
    } else {
        // Always start with the plan step (preselected from the pricing CTA), so the choice is visible once more.
        history.replaceState({ step: 'plan' }, '', location.href);
        go('plan', false);
    }
}

const ICON = (d: string) => `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const iconSvg: Record<string, string> = {
    check: ICON('<path d="M20 6 9 17l-5-5"/>'),
    arrowRight: ICON('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
    plus: ICON('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    close: ICON('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    mail: ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    users: ICON('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    user: ICON('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>'),
    pencil: ICON('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
};
const googleIcon = '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>';

const appleIcon = '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.37 12.7c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.77-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.27-1.6 2.78-.41 6.9 1.15 9.16.77 1.1 1.68 2.34 2.87 2.3 1.15-.05 1.59-.75 2.98-.75 1.39 0 1.78.75 3 .72 1.24-.02 2.02-1.12 2.78-2.23.88-1.28 1.24-2.52 1.26-2.59-.03-.01-2.42-.93-2.44-3.66zM14.1 5.94c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z"/></svg>';
const githubIcon = '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>';

// Boot last: start() renders synchronously and needs the icon constants above.
const root = document.querySelector<HTMLElement>('[data-buy]');
const copyEl = document.getElementById('buy-copy');
if (root && copyEl) start(root, JSON.parse(copyEl.textContent ?? '{}'));
