import { buyCopy } from '../content/buy';
import { site } from '../content/site';
import { icon } from './icons';
import { esc } from './layout';
import { legalUrl, type Lang } from './pages';

/**
 * Checkout shell (/checkout, /en/checkout). Left: order panel (plan, interval, seats, AI add-on, total, due today),
 * collapsible on mobile. Right: account → workspace → payment as one calm accordion. src/js/buy.ts drives it;
 * everything is real form markup so it stays keyboard- and screen-reader-friendly.
 */
export const buyBody = (lang: Lang): string => {
    const c = buyCopy[lang];
    const p = site[lang].pricing;
    const team = p.plans.find((pl) => pl.key === 'team')!;
    const personal = p.plans.find((pl) => pl.key === 'personal')!;
    const copyJson = JSON.stringify({
        ...c,
        legal: { terms: legalUrl('terms', lang), privacy: legalUrl('privacy', lang) },
        units: { perSeat: p.perSeat, perMonth: p.perMonth, billedYearly: p.billedYearly, billedMonthly: p.billedMonthly },
        prices: {
            personal: { month: personal.monthly, year: personal.yearly },
            team: { month: team.monthly, year: team.yearly },
            ai: { month: p.addon.price, year: p.addon.price },
        },
    }).replace(/</g, '\\u003c');

    const seg = (name: string, legend: string, options: { value: string; label: string; extra?: string }[], cls: string) => `
        <fieldset class="co-seg ${cls}">
            <legend class="sr-only">${esc(legend)}</legend>
            ${options.map((o) => `<label><input type="radio" name="${name}" value="${o.value}"><span>${esc(o.label)}${o.extra ? ` <em>${esc(o.extra)}</em>` : ''}</span></label>`).join('')}
        </fieldset>`;

    const step = (n: number, id: string, title: string, body: string) => `
        <section class="co-step" id="step-${id}" data-step="${id}" aria-labelledby="step-${id}-title">
            <header class="co-step__head">
                <span class="co-step__num" aria-hidden="true"><span>${n}</span>${icon('check')}</span>
                <div class="co-step__title">
                    <h2 id="step-${id}-title">${esc(title)}</h2>
                    <p class="co-step__summary" data-step-summary></p>
                </div>
                <button type="button" class="co-step__edit" data-edit="${id}" hidden>${esc(c.edit)}<span class="sr-only">: ${esc(title)}</span></button>
            </header>
            <div class="co-step__body" data-step-body hidden>${body}</div>
        </section>`;

    const terms = esc(c.payment.terms)
        .replace('{terms}', `<a href="${legalUrl('terms', lang)}" target="_blank" rel="noopener">${esc(c.payment.termsLink)}</a>`)
        .replace('{privacy}', `<a href="${legalUrl('privacy', lang)}" target="_blank" rel="noopener">${esc(c.payment.privacyLink)}</a>`);

    return `
<div class="co" data-buy>
    <script type="application/json" id="buy-copy">${copyJson}</script>
    <noscript><p class="co-noscript">${lang === 'de' ? 'Für den Kauf wird JavaScript benötigt.' : 'JavaScript is required to purchase.'}</p></noscript>

    <aside class="co-order" aria-labelledby="co-title">
        <details class="co-fold" data-order-fold open>
            <summary class="co-fold__bar">
                <span>${esc(c.order.toggle)}</span>
                <b data-bar-total></b>
                ${icon('chevronDown', 'co-fold__chev')}
            </summary>
            <div class="co-order__body">
                <h1 class="co-eyebrow" id="co-title">${esc(c.title)}</h1>
                ${seg('plan', c.order.plan, [{ value: 'personal', label: c.plan.personal.name }, { value: 'team', label: c.plan.team.name }], 'co-seg--plan')}

                <div class="co-hero">
                    <p class="co-hero__name"><span data-plan-name></span><span class="co-badge" data-trial-badge hidden>${esc(c.summary.trialBadge)}</span></p>
                    <p class="co-hero__text" data-plan-text></p>
                    <p class="co-hero__price"><b data-unit-price></b><span data-unit-label></span></p>
                </div>

                ${seg('interval', c.order.billing, [{ value: 'month', label: c.plan.monthly }, { value: 'year', label: c.plan.yearly, extra: c.plan.save }], 'co-seg--interval')}

                <dl class="co-lines" data-summary-lines></dl>
                <p class="co-hint" data-seats-hint></p>

                <label class="co-switch">
                    <span class="co-switch__text">
                        <b>${icon('sparkles')}${esc(c.summary.ai)} <span class="co-switch__price">+${p.addon.price}&nbsp;€ ${esc(p.addon.unit)}</span></b>
                        <small data-ai-text></small>
                    </span>
                    <input type="checkbox" name="ai" role="switch">
                    <span class="co-switch__track" aria-hidden="true"></span>
                </label>

                <div class="co-total">
                    <p><span>${esc(c.summary.subtotal)}</span><b data-summary-total></b></p>
                    <p class="co-total__vat">${esc(c.summary.vat)}</p>
                </div>
                <div class="co-due">
                    <p><span>${esc(c.summary.dueToday)}</span><b data-due-amount></b></p>
                    <p class="co-due__note" data-due-note></p>
                </div>
                <p class="co-fine">${esc(c.summary.vatNote)}</p>
            </div>
        </details>
        <ul class="co-trust">
            <li>${icon('lock')}${esc(c.trust[0])}</li>
            <li>${icon('calendar')}${esc(c.trust[1])}</li>
            <li>${icon('file')}${esc(c.trust[2])}</li>
        </ul>
    </aside>

    <div class="co-main">
        <form class="co-steps" data-buy-form novalidate>
            ${step(1, 'account', c.account.title, `<div data-account></div>`)}
            ${step(2, 'workspace', c.workspace.title, `<div data-workspace></div>`)}
            ${step(3, 'payment', c.payment.title, `
                <p class="co-trial" data-trial hidden></p>
                <div class="co-payment" data-payment-element><p class="co-loading">${esc(c.payment.loading)}</p></div>
                <label class="co-check">
                    <input type="checkbox" name="terms" required>
                    <span>${terms}</span>
                </label>
                <p class="co-error" data-pay-error role="alert" hidden></p>
                <button type="submit" class="btn btn--primary btn--lg co-submit" data-pay>${icon('lock')}<span>${esc(c.payment.submit)}</span></button>
                <ul class="co-legal">
                    <li data-term-text>${esc(c.payment.termYearly)}</li>
                    <li>${esc(c.payment.cancelHint)}</li>
                </ul>`)}
        </form>
        <section class="co-done" data-done hidden aria-live="polite"></section>
    </div>
</div>`;
};
