import '../styles/optin.scss';

/**
 * Waitlist/newsletter forms and the double-opt-in confirm page. Plain fetch to the HTTPS functions
 * (functions/src/platform-newsletter/public.ts); no Firebase SDK on these pages.
 * `?api=http://127.0.0.1:5861/demo-projectflow/europe-west3` on localhost points the pages at the emulator.
 */
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const apiOverride = local ? new URLSearchParams(location.search).get('api') : null;
const apiOf = (el: HTMLElement) => apiOverride || el.dataset.optinApi || '';
const loadedAt = Date.now();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const post = async (api: string, fn: string, body: Record<string, unknown>) => {
    const res = await fetch(`${api}/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data: data as Record<string, any> };
};

// --- Signup forms -----------------------------------------------------------
document.querySelectorAll<HTMLFormElement>('[data-optin-form]').forEach((form) => {
    const section = form.closest<HTMLElement>('[data-optin-api]')!;
    const t = JSON.parse(section.dataset.status || '{}') as Record<string, string>;
    const statusEl = form.querySelector<HTMLElement>('[data-optin-status]')!;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const list = form.dataset.optinForm;
    const setStatus = (text: string, kind: 'ok' | 'error' | '') => {
        statusEl.textContent = text;
        statusEl.dataset.kind = kind;
    };
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const email = String(data.get('email') || '').trim();
        const input = form.querySelector<HTMLInputElement>('input[name="email"]')!;
        if (!EMAIL_RE.test(email)) {
            input.setAttribute('aria-invalid', 'true');
            setStatus(t.invalidEmail, 'error');
            input.focus();
            return;
        }
        input.removeAttribute('aria-invalid');
        button.disabled = true;
        setStatus(t.sending, '');
        try {
            const { status } = await post(apiOf(section), list === 'waitlist' ? 'requestWaitlist' : 'requestNewsletterSignup', {
                email,
                name: String(data.get('name') || ''),
                interest: String(data.get('interest') || ''),
                website: String(data.get('website') || ''),
                startedAt: loadedAt,
                lang: section.dataset.lang,
            });
            if (status === 200) {
                setStatus(t.sent.replace('{email}', email), 'ok');
                form.classList.add('is-done');
                form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((el) => { el.disabled = true; });
                return;
            }
            setStatus(status === 400 ? t.invalidEmail : status === 429 ? t.rateLimited : t.error, 'error');
        } catch {
            setStatus(t.error, 'error');
        }
        button.disabled = false;
    });
});

// --- Confirm page -----------------------------------------------------------
const confirmRoot = document.querySelector<HTMLElement>('[data-confirm]');
if (confirmRoot) {
    const c = JSON.parse(confirmRoot.dataset.confirm || '{}') as Record<string, string>;
    const token = new URLSearchParams(location.search).get('t') || '';
    const q = <T extends HTMLElement>(sel: string) => confirmRoot.querySelector<T>(sel)!;
    const title = q('[data-confirm-title]');
    const text = q('[data-confirm-text]');
    const button = q<HTMLButtonElement>('[data-confirm-button]');
    const upsell = q('[data-confirm-upsell]');
    const links = q('[data-confirm-links]');
    const again = q('[data-confirm-again]');
    const lang = confirmRoot.dataset.lang;
    // Keep the token out of the address bar, history and referrers once it is read.
    if (token) history.replaceState(null, '', location.pathname);

    const finish = (message: string, ok: boolean, showAgain = false) => {
        text.textContent = message;
        text.dataset.kind = ok ? 'ok' : 'error';
        button.hidden = true;
        links.hidden = false;
        again.hidden = !showAgain;
    };

    if (!token) {
        title.textContent = c.failTitle;
        finish(c.missing, false, true);
    }

    button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = c.working;
        try {
            const { data } = await post(apiOf(confirmRoot), 'confirmOptin', { action: 'confirm', token });
            const email = data.email || '';
            if (data.result === 'confirmed' || data.result === 'already') {
                title.textContent = data.result === 'already' ? c.alreadyTitle : c.doneTitle;
                finish(data.result === 'already' ? c.already : (data.list === 'waitlist' ? c.confirmedWaitlist : c.confirmedNewsletter).replace('{email}', email), true);
                if (data.newsletterToken) {
                    upsell.hidden = false;
                    const yes = q<HTMLButtonElement>('[data-upsell-yes]');
                    yes.addEventListener('click', async () => {
                        yes.disabled = true;
                        const r = await post(apiOf(confirmRoot), 'confirmOptin', { action: 'addNewsletter', token: data.newsletterToken, lang }).catch(() => null);
                        upsell.innerHTML = '';
                        const p = document.createElement('p');
                        p.textContent = r && r.status === 200 ? c.upsellDone : c.invalid;
                        upsell.append(p);
                    });
                    q('[data-upsell-no]').addEventListener('click', () => { upsell.hidden = true; });
                }
                return;
            }
            title.textContent = c.failTitle;
            finish(data.result === 'expired' ? c.expired : c.invalid, false, true);
        } catch {
            button.disabled = false;
            button.textContent = c.button;
            text.textContent = c.invalid;
        }
    });
}
