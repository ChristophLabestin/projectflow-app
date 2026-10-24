import { buyCopy } from '../content/buy';
import { site } from '../content/site';
import { icon } from './icons';
import { esc } from './layout';
import { legalUrl, type Lang } from './pages';

/**
 * Purchase page shell. src/js/buy.ts drives the steps (plan → account → workspace → payment → done);
 * everything here is real form markup so it stays keyboard- and screen-reader-friendly.
 */
export const buyBody = (lang: Lang): string => {
    const c = buyCopy[lang];
    const p = site[lang].pricing;
    const team = p.plans.find((pl) => pl.key === 'team')!;
    const personal = p.plans.find((pl) => pl.key === 'personal')!;
    const copyJson = JSON.stringify({ ...c, legal: { terms: legalUrl('terms', lang), privacy: legalUrl('privacy', lang) }, prices: {
        personal: { month: personal.monthly, year: personal.yearly },
        team: { month: team.monthly, year: team.yearly },
        ai: { month: p.addon.price, year: p.addon.price },
    } }).replace(/</g, '\\u003c');

    const planOption = (key: 'personal' | 'team', name: string, text: string, month: number, year: number) => `
        <label class="buy-plan">
            <input type="radio" name="plan" value="${key}"${key === 'team' ? ' checked' : ''}>
            <span class="buy-plan__body">
                <span class="buy-plan__name">${esc(name)}</span>
                <span class="buy-plan__text">${esc(text)}</span>
            </span>
            <span class="buy-plan__price"><b data-plan-price="${key}" data-month="${month}" data-year="${year}">${year}&nbsp;€</b><small data-plan-unit="${key}">${key === 'team' ? esc(p.perSeat) : esc(p.perMonth)}</small></span>
        </label>`;

    const step = (n: number, id: string, title: string, body: string) => `
        <section class="buy-step" id="step-${id}" data-step="${id}" aria-labelledby="step-${id}-title">
            <header class="buy-step__head">
                <span class="buy-step__num" aria-hidden="true">${n}</span>
                <h2 id="step-${id}-title">${esc(title)}</h2>
                <p class="buy-step__summary" data-step-summary></p>
                <button type="button" class="buy-step__edit" data-edit="${id}" hidden>${esc(c.edit)}</button>
            </header>
            <div class="buy-step__body" data-step-body>${body}</div>
        </section>`;

    const terms = esc(c.payment.terms)
        .replace('{terms}', `<a href="${legalUrl('terms', lang)}" target="_blank" rel="noopener">${esc(c.payment.termsLink)}</a>`)
        .replace('{privacy}', `<a href="${legalUrl('privacy', lang)}" target="_blank" rel="noopener">${esc(c.payment.privacyLink)}</a>`);

    return `
<div class="buy container" data-buy>
    <script type="application/json" id="buy-copy">${copyJson}</script>
    <header class="buy__head">
        <h1>${esc(c.title)}</h1>
        <p>${esc(c.lead)}</p>
    </header>
    <noscript><p class="buy__noscript">${lang === 'de' ? 'Für den Kauf wird JavaScript benötigt.' : 'JavaScript is required to purchase.'}</p></noscript>
    <div class="buy__layout">
        <form class="buy__steps" data-buy-form novalidate>
            ${step(1, 'plan', c.plan.title, `
                <fieldset class="buy-plans">
                    <legend class="sr-only">${esc(c.plan.title)}</legend>
                    ${planOption('personal', c.plan.personal.name, c.plan.personal.text, personal.monthly, personal.yearly)}
                    ${planOption('team', c.plan.team.name, c.plan.team.text, team.monthly, team.yearly)}
                </fieldset>
                <fieldset class="buy-interval">
                    <legend class="sr-only">${esc(c.plan.monthly)} / ${esc(c.plan.yearly)}</legend>
                    <label><input type="radio" name="interval" value="month"><span>${esc(c.plan.monthly)}</span></label>
                    <label><input type="radio" name="interval" value="year" checked><span>${esc(c.plan.yearly)} <em>${esc(c.plan.save)}</em></span></label>
                </fieldset>
                <label class="buy-check buy-ai">
                    <input type="checkbox" name="ai">
                    <span><b>${icon('sparkles')}${esc(c.plan.aiTitle)} · +${p.addon.price}&nbsp;€ ${esc(p.addon.unit)}</b><small data-ai-text>${esc(c.plan.aiTextTeam)}</small></span>
                </label>
                <p class="buy-note" data-seats-note>${esc(c.plan.seatsNote)}</p>
                <button type="button" class="btn btn--primary" data-next="plan">${esc(c.next)}${icon('arrowRight')}</button>`)}
            ${step(2, 'account', c.account.title, `<div data-account></div>`)}
            ${step(3, 'workspace', c.workspace.title, `<div data-workspace></div>`)}
            ${step(4, 'payment', c.payment.title, `
                <div class="buy-trial" data-trial hidden></div>
                <div class="buy-payment" data-payment-element><p class="buy-loading">${esc(c.payment.loading)}</p></div>
                <ul class="buy-legal">
                    <li data-term-text>${esc(c.payment.termYearly)}</li>
                    <li>${esc(c.payment.cancelHint)}</li>
                </ul>
                <label class="buy-check buy-terms">
                    <input type="checkbox" name="terms" required>
                    <span>${terms}</span>
                </label>
                <p class="buy-error" data-pay-error role="alert" hidden></p>
                <button type="submit" class="btn btn--primary btn--lg buy-submit" data-pay>${icon('lock')}${esc(c.payment.submit)}</button>
                <p class="buy-secure">${icon('shield')}${esc(c.payment.secure)}</p>`)}
            <section class="buy-done" data-done hidden aria-live="polite"></section>
        </form>

        <aside class="buy-summary" aria-labelledby="summary-title" data-summary>
            <h2 id="summary-title">${esc(c.summary.title)}</h2>
            <dl class="buy-summary__lines" data-summary-lines></dl>
            <p class="buy-summary__total"><span>${esc(c.summary.subtotal)}</span><b data-summary-total></b></p>
            <p class="buy-summary__vat">${esc(c.summary.vat)}</p>
            <p class="buy-summary__due" data-summary-due></p>
            <p class="fineprint">${esc(c.summary.vatNote)}</p>
        </aside>
    </div>
</div>`;
};
