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
        },
    }).replace(/</g, '\\u003c');

    const steps = (['plan', 'account', 'workspace', 'payment'] as const).map((id, i) => `
            <li class="ck-stepper__item${i === 0 ? ' is-active' : ''}" data-stepper="${id}"${i === 0 ? ' aria-current="step"' : ''}>
                <span class="ck-stepper__dot" aria-hidden="true"><span>${i + 1}</span>${icon('check')}</span>
                <span class="ck-stepper__label">${esc(c.stepNames[id])}</span>
            </li>`).join('');

    const planCard = (key: 'personal' | 'team', ic: 'user' | 'users') => `
                    <label class="ck-option ck-option--plan">
                        <input type="radio" name="plan" value="${key}">
                        <span class="ck-option__radio" aria-hidden="true"></span>
                        <span class="ck-option__icon">${icon(ic)}</span>
                        <span class="ck-option__body">
                            <b>${esc(c.plan[key].name)}</b>
                            <small>${esc(c.plan[key].text)}</small>
                        </span>
                        <span class="ck-option__price"><b data-plan-amount="${key}">${key === 'team' ? team.yearly : personal.yearly}&nbsp;€</b> ${esc(c.plan[key].unit)}</span>
                    </label>`;

    const terms = esc(c.payment.terms)
        .replace('{terms}', `<a href="${legalUrl('terms', lang)}" target="_blank" rel="noopener">${esc(c.payment.termsLink)}</a>`)
        .replace('{privacy}', `<a href="${legalUrl('privacy', lang)}" target="_blank" rel="noopener">${esc(c.payment.privacyLink)}</a>`);
    // The cancellation policy (Widerrufsbelehrung) is Annex 1 of the AGB (heading id from legal-markdown slug, AGB v4).
    const withdrawalUrl = `${legalUrl('terms', lang)}#${lang === 'de' ? 'anlage-1-widerrufsbelehrung' : 'annex-1-withdrawal-policy'}`;
    const earlyStart = esc(c.payment.earlyStart)
        .replace('{withdrawal}', `<a href="${withdrawalUrl}" target="_blank" rel="noopener">${esc(c.payment.withdrawalLink)}</a>`);

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
            <p class="ck-eyebrow" data-eyebrow>${esc(c.stepNames.plan)}</p>
            <h1 class="ck-headline" data-headline>${esc(c.intro.plan.headline)}</h1>
            <p class="ck-lead" data-lead>${esc(c.intro.plan.lead)}</p>
            <div class="ck-recap" data-recap></div>
            <p class="ck-intro__foot">${esc(c.plan.pricesNet)}</p>
        </section>

        <section class="ck-panel" aria-labelledby="ck-question">
            <button type="button" class="ck-back" data-back hidden>${icon('arrowLeft')}${esc(c.backStep)}</button>
            <h2 class="ck-question" id="ck-question" data-question tabindex="-1">${esc(c.intro.plan.question)}</h2>
            <form class="ck-form" data-buy-form novalidate>
                <div class="ck-pane" data-pane="plan">
                    <fieldset class="ck-options">
                        <legend class="sr-only">${esc(c.stepNames.plan)}</legend>
                        ${planCard('personal', 'user')}
                        ${planCard('team', 'users')}
                    </fieldset>
                    <div class="ck-seats" data-seats hidden>
                        <div class="ck-seats__text">
                            <label for="ck-seats-input">${esc(c.plan.seats)}</label>
                            <small>${esc(c.plan.seatsHint)}</small>
                        </div>
                        <div class="ck-counter">
                            <button type="button" data-seat-step="-1" aria-label="${esc(c.plan.seatsLess)}">−</button>
                            <input id="ck-seats-input" name="seats" type="number" min="1" max="50" step="1" inputmode="numeric" value="1">
                            <button type="button" data-seat-step="1" aria-label="${esc(c.plan.seatsMore)}">+</button>
                        </div>
                    </div>
                    <div class="ck-interval">
                        <p class="ck-label" id="ck-interval-label">${esc(c.plan.intervalLabel)}</p>
                        <div class="ck-seg" role="radiogroup" aria-labelledby="ck-interval-label">
                            <label><input type="radio" name="interval" value="month"><span>${esc(c.plan.monthly)}</span></label>
                            <label><input type="radio" name="interval" value="year"><span>${esc(c.plan.yearly)}</span></label>
                        </div>
                        <p class="ck-note" data-interval-note></p>
                    </div>
                    <div class="ck-plan-sum">
                        <b data-sum-label></b>
                        <span><b data-sum-amount></b> <span data-sum-unit></span></span>
                    </div>
                    <button type="button" class="ck-btn" data-next="plan">${esc(c.plan.nextPlan)}${icon('arrowRight')}</button>
                    <p class="ck-fine">${esc(c.plan.checkLater)}</p>
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
                    <label class="ck-check">
                        <input type="checkbox" name="earlyStart" required>
                        <span>${earlyStart}</span>
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
