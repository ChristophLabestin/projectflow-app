/**
 * Cookie consent for Google Analytics. Nothing is loaded and no cookie is set until the visitor accepts;
 * declining is as easy as accepting. The choice is stored locally and can be changed via the footer link.
 * Inert when no measurement ID is configured (src/content/analytics.ts) – then the banner isn't rendered.
 */
type Choice = 'granted' | 'denied';
const KEY = 'pf-consent-v1';

const banner = document.querySelector<HTMLElement>('[data-consent]');
const id = banner?.dataset.ga ?? '';

const stored = (): Choice | null => {
    try {
        const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { analytics?: Choice } | null;
        return value?.analytics ?? null;
    } catch {
        return null;
    }
};

declare global {
    interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void }
}

let loaded = false;
function loadAnalytics() {
    if (loaded || !id) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    // gtag must push the `arguments` object, not an array.
    window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.append(script);
}

/** Withdrawal: stop measuring and remove the GA cookies of this domain. */
function clearAnalytics() {
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((name) => name.startsWith('_ga')).forEach((name) => {
        const host = location.hostname;
        [host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`].forEach((domain) => {
            document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`;
        });
        document.cookie = `${name}=; Max-Age=0; path=/`;
    });
}

function show() {
    if (!banner) return;
    banner.hidden = false;
    banner.querySelector<HTMLButtonElement>('[data-consent-choice="denied"]')?.focus({ preventScroll: true });
}

if (banner && id) {
    banner.querySelectorAll<HTMLButtonElement>('[data-consent-choice]').forEach((button) => button.addEventListener('click', () => {
        const choice = button.dataset.consentChoice as Choice;
        const before = stored();
        localStorage.setItem(KEY, JSON.stringify({ analytics: choice, at: new Date().toISOString() }));
        banner.hidden = true;
        if (choice === 'granted') loadAnalytics();
        else if (before === 'granted') { clearAnalytics(); location.reload(); }
    }));
    document.querySelectorAll('[data-consent-open]').forEach((link) => link.addEventListener('click', show));
    const choice = stored();
    if (choice === 'granted') loadAnalytics();
    else if (!choice) show();
}

export {};
