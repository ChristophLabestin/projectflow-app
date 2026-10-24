import { optinCopy, OPTIN_API } from '../content/optin';
import { icon } from './icons';
import { esc, headline } from './layout';
import { legalUrl, urlFor, type Lang } from './pages';

/**
 * Waitlist (/warteliste, /en/waitlist) with a separate newsletter-only form, and the double-opt-in confirm page
 * (/bestaetigen, /en/confirm). src/js/optin.ts posts to the endpoints in functions/src/platform-newsletter/public.ts.
 */
const privacyNote = (lang: Lang) => {
    const w = optinCopy[lang].waitlist;
    return esc(w.privacy).replace('{privacy}', `<a href="${legalUrl('privacy', lang)}">${esc(w.privacyLink)}</a>`);
};

const honeypot = (lang: Lang, id: string) => `
            <div class="optin__hp" aria-hidden="true">
                <label for="${id}-website">${esc(optinCopy[lang].waitlist.honeypot)}</label>
                <input id="${id}-website" name="website" type="text" tabindex="-1" autocomplete="off">
            </div>`;

const statusData = (lang: Lang) => esc(JSON.stringify(optinCopy[lang].status));

export const waitlistBody = (lang: Lang): string => {
    const c = optinCopy[lang];
    const w = c.waitlist;
    return `
<section class="optin container" data-optin-api="${OPTIN_API}" data-lang="${lang}" data-status="${statusData(lang)}">
    <div class="optin__intro">
        <p class="eyebrow">${esc(w.eyebrow)}</p>
        <h1 class="optin__title">${headline(w.title)}</h1>
        <p class="optin__lead">${esc(w.text)}</p>
        <ul class="optin__points">${w.points.map((p) => `<li>${icon('check')}<span>${esc(p)}</span></li>`).join('')}</ul>
    </div>
    <div class="optin__card">
        <form class="optin__form" data-optin-form="waitlist" novalidate>
            <label class="optin__field">
                <span>${esc(w.email)}</span>
                <input name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254" placeholder="${esc(w.emailPlaceholder)}">
            </label>
            <label class="optin__field">
                <span>${esc(w.name)} <small>${esc(w.optional)}</small></span>
                <input name="name" type="text" autocomplete="name" maxlength="120" placeholder="${esc(w.namePlaceholder)}">
            </label>
            <label class="optin__field">
                <span>${esc(w.interest)} <small>${esc(w.optional)}</small></span>
                <select name="interest">
                    <option value="">${esc(w.interestNone)}</option>
                    ${w.interestOptions.map((o) => `<option>${esc(o)}</option>`).join('')}
                </select>
            </label>${honeypot(lang, 'wl')}
            <p class="optin__consent">${esc(w.consent)} ${privacyNote(lang)}</p>
            <button class="btn btn--primary optin__submit" type="submit">${esc(w.submit)}${icon('arrowRight')}</button>
            <p class="optin__status" role="status" aria-live="polite" data-optin-status></p>
        </form>
    </div>
</section>
<section class="optin-news container" data-optin-api="${OPTIN_API}" data-lang="${lang}" data-status="${statusData(lang)}">
    <div class="optin-news__inner">
        <div>
            <h2 class="optin-news__title">${esc(c.newsletter.title)}</h2>
            <p>${esc(c.newsletter.text)}</p>
        </div>
        <form class="optin-news__form" data-optin-form="newsletter" novalidate>
            <label class="optin__field optin__field--inline">
                <span class="sr-only">${esc(w.email)}</span>
                <input name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254" placeholder="${esc(w.emailPlaceholder)}">
                <button class="btn btn--ghost" type="submit">${esc(c.newsletter.submit)}</button>
            </label>${honeypot(lang, 'nl')}
            <p class="optin__consent">${esc(c.newsletter.consent)} ${privacyNote(lang)}</p>
            <p class="optin__status" role="status" aria-live="polite" data-optin-status></p>
        </form>
    </div>
</section>`;
};

export const confirmBody = (lang: Lang): string => {
    const c = optinCopy[lang].confirm;
    return `
<section class="optin optin--confirm container" data-optin-api="${OPTIN_API}" data-lang="${lang}" data-confirm="${esc(JSON.stringify(c))}">
    <div class="optin__card optin__card--center">
        <p class="eyebrow">${esc(c.eyebrow)}</p>
        <h1 class="optin__title optin__title--sm" data-confirm-title>${headline(c.title)}</h1>
        <p class="optin__lead" data-confirm-text>${esc(c.text)}</p>
        <button class="btn btn--primary" type="button" data-confirm-button>${esc(c.button)}</button>
        <div class="optin__upsell" data-confirm-upsell hidden>
            <h2>${esc(c.upsellTitle)}</h2>
            <p>${esc(c.upsellText)}</p>
            <p class="optin__consent">${esc(optinCopy[lang].newsletter.consent)} ${privacyNote(lang)}</p>
            <div class="optin__actions">
                <button class="btn btn--primary" type="button" data-upsell-yes>${esc(c.upsellButton)}</button>
                <button class="btn btn--quiet" type="button" data-upsell-no>${esc(c.upsellNo)}</button>
            </div>
        </div>
        <div class="optin__actions" data-confirm-links hidden>
            <a class="btn btn--ghost" href="${urlFor('waitlist', lang)}" data-confirm-again hidden>${esc(c.again)}</a>
            <a class="btn btn--quiet" href="${urlFor('home', lang)}">${esc(c.home)}</a>
        </div>
    </div>
</section>`;
};
