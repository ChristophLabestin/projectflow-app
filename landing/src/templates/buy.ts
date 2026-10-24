import { buyCopy } from '../content/buy';
import { site } from '../content/site';
import { icon, logo } from './icons';
import { esc } from './layout';
import { legalUrl, urlFor, type Lang } from './pages';

/**
 * Checkout shell (/checkout, /en/checkout): slim top bar, step bar (Plan → Konto → Workspace → Zahlung), left the
 * step's headline plus a recap of earlier choices, right the step's question and form. src/js/buy.ts swaps the
 * panes; everything is real form markup so it stays keyboard- and screen-reader-friendly.
 */
export const buyBody = (lang: Lang): string => {
    const c = buyCopy[lang];
    const p = site[lang].pricing;
    const team = p.plans.find((pl) => pl.key === 'team')!;
    const personal = p.plans.find((pl) => pl.key === 'personal')!;
    const home = urlFor('home', lang);
    const copyJson = JSON.stringify({
        ...c,
        legal: { terms: legalUrl('terms', lang), privacy: legalUrl('privacy', lang) },
        prices: {
            personal: { month: personal.monthly, year: personal.yearly },
            team: { month: team.monthly, year: team.yearly },
            ai: { month: p.addon.price, year: p.addon.price },
        },
    }).replace(/</g, '\\u003c');

    const steps = (['plan', 'account', 'workspace', 'payment'] as const).map((id, i) => `
            <li class="ck-stepper__item" data-stepper="${id}">
                <span class="ck-stepper__dot" aria-hidden="true"><span>${i + 1}</span>${icon('check')}</span>
                <span class="ck-stepper__label">${esc(c.stepNames[id])}</span>
            </li>`).join('');

    const planCard = (key: 'personal' | 'team', ic: 'user' | 'users') => `
                    <label class="ck-option">
                        <input type="radio" name="plan" value="${key}">
                        <span class="ck-option__icon">${icon(ic)}</span>
                        <span class="ck-option__body">
                            <b>${esc(c.plan[key].name)}</b>
                            <small>${esc(c.plan[key].text)}</small>
                        </span>
                        <span class="ck-option__price" data-plan-price="${key}"></span>
                    </label>`;

    const terms = esc(c.payment.terms)
        .replace('{terms}', `<a href="${legalUrl('terms', lang)}" target="_blank" rel="noopener">${esc(c.payment.termsLink)}</a>`)
        .replace('{privacy}', `<a href="${legalUrl('privacy', lang)}" target="_blank" rel="noopener">${esc(c.payment.privacyLink)}</a>`);

    return `
<div class="ck" data-buy>
    <script type="application/json" id="buy-copy">${copyJson}</script>
    <header class="ck-top">
        <a class="ck-top__brand" href="${home}">${logo('ck-top__logo')}<span>ProjectFlow</span></a>
        <a class="ck-top__back" href="${home}#pricing">${icon('arrowLeft')}${esc(c.back)}</a>
    </header>

    <nav class="ck-stepper" aria-label="${lang === 'de' ? 'Fortschritt' : 'Progress'}">
        <ol>${steps}
        </ol>
    </nav>

    <noscript><p class="ck-noscript">${lang === 'de' ? 'Für den Kauf wird JavaScript benötigt.' : 'JavaScript is required to purchase.'}</p></noscript>

    <div class="ck-grid">
        <section class="ck-intro" aria-live="polite">
            <p class="ck-eyebrow" data-eyebrow></p>
            <h1 class="ck-headline" data-headline></h1>
            <p class="ck-lead" data-lead></p>
            <div class="ck-recap" data-recap></div>
        </section>

        <section class="ck-panel" aria-labelledby="ck-question">
            <h2 class="ck-question" id="ck-question" data-question tabindex="-1"></h2>
            <form class="ck-form" data-buy-form novalidate>
                <div class="ck-pane" data-pane="plan" hidden>
                    <fieldset class="ck-options">
                        <legend class="sr-only">${esc(c.stepNames.plan)}</legend>
                        ${planCard('personal', 'user')}
                        ${planCard('team', 'users')}
                    </fieldset>
                    <fieldset class="ck-seg">
                        <legend class="sr-only">${esc(c.plan.monthly)} / ${esc(c.plan.yearly)}</legend>
                        <label><input type="radio" name="interval" value="month"><span>${esc(c.plan.monthly)}</span></label>
                        <label><input type="radio" name="interval" value="year"><span>${esc(c.plan.yearly)} <em>${esc(c.plan.save)}</em></span></label>
                    </fieldset>
                    <label class="ck-option ck-option--check">
                        <input type="checkbox" name="ai">
                        <span class="ck-option__icon">${icon('sparkles')}</span>
                        <span class="ck-option__body">
                            <b>${esc(c.plan.aiTitle)} <span class="ck-muted">${esc(c.plan.aiPrice.replace('{p}', `${p.addon.price} €`))}</span></b>
                            <small data-ai-text></small>
                        </span>
                        <span class="ck-option__box" aria-hidden="true">${icon('check')}</span>
                    </label>
                    <p class="ck-note" data-seats-note></p>
                    <button type="button" class="ck-btn" data-next="plan">${esc(c.next)}${icon('arrowRight')}</button>
                </div>

                <div class="ck-pane" data-pane="account" hidden></div>
                <div class="ck-pane" data-pane="workspace" hidden></div>

                <div class="ck-pane" data-pane="payment" hidden>
                    <div class="ck-express" data-express></div>
                    <p class="ck-or" data-or hidden><span>${esc(c.payment.orCard)}</span></p>
                    <div class="ck-payment" data-payment-element><p class="ck-loading">${esc(c.payment.loading)}</p></div>
                    <dl class="ck-totals" data-totals></dl>
                    <label class="ck-check">
                        <input type="checkbox" name="terms" required>
                        <span>${terms}</span>
                    </label>
                    <p class="ck-error" data-pay-error role="alert" hidden></p>
                    <button type="submit" class="ck-btn" data-pay><span>${esc(c.payment.submit)}</span>${icon('arrowRight')}</button>
                    <p class="ck-fine" data-fine></p>
                </div>
            </form>
            <div class="ck-done" data-done hidden></div>
        </section>
    </div>

    <a class="ck-help" href="mailto:hello@getprojectflow.com?subject=Checkout">${icon('help')}${esc(c.help)}</a>
</div>`;
};
