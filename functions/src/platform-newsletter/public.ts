// Public double-opt-in endpoints for the landing page (getprojectflow.com). Plain HTTPS + CORS, no Firebase SDK on the page.
//   POST requestWaitlist         { email, name?, interest?, lang, website (honeypot), startedAt }
//   POST requestNewsletterSignup { email, name?, lang, website, startedAt }
//   POST confirmOptin            { action: 'confirm', token } | { action: 'addNewsletter', token, lang }
// Contract: brain/plans/newsletter-contract.md
import * as functions from 'firebase-functions/v1';
import type { Request, Response } from 'express';
import { EMAIL_SECRETS } from '../email-logic';
import { corsMiddleware } from '../corsConfig';
import { clientIp, consumeRateLimits, signupRateLimitRules } from '../public-rate-limit';
import { FAST_START } from '../runtime-options';
import { cleanText, looksLikeBot, parseEmail, toLang } from './logic';
import type { ListId } from './logic';
import { addNewsletterFromWaitlist, confirmOptin as confirmToken, requestOptin, sendOptinMail } from './store';

const REGION = 'europe-west3';
const runtime = { ...FAST_START, secrets: EMAIL_SECRETS };

const evidenceOf = (req: Request) => ({ ip: clientIp(req as any), userAgent: String(req.headers['user-agent'] || '') });

/** Landing origin for the confirm link (emulator: the local landing dev server). */
const siteBase = () => process.env.NEWSLETTER_SITE_URL || undefined;

const handleSignup = (list: ListId) => (req: Request, res: Response) => corsMiddleware(req, res, async () => {
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'method-not-allowed' });
        return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const email = parseEmail(body.email);
    if (!email) {
        res.status(400).json({ success: false, error: 'invalid-email' });
        return;
    }
    // Bots get the same answer as humans, but nothing is stored or sent.
    if (looksLikeBot(body)) {
        res.status(200).json({ success: true });
        return;
    }
    if (!(await consumeRateLimits(signupRateLimitRules(list, clientIp(req as any), email)))) {
        res.status(429).json({ success: false, error: 'rate-limited' });
        return;
    }
    try {
        const lang = toLang(body.lang);
        const out = await requestOptin({
            email,
            list,
            lang,
            source: 'landing',
            name: cleanText(body.name, 120),
            interest: list === 'waitlist' ? cleanText(body.interest, 300) : '',
            evidence: evidenceOf(req),
        });
        if (out.token) await sendOptinMail(email, list, lang, out.token, siteBase());
        // Same response for new and already confirmed addresses (no enumeration).
        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error(`${list} signup failed`, error?.name, error?.message);
        res.status(500).json({ success: false, error: 'internal' });
    }
});

export const requestWaitlist = functions.region(REGION).runWith(runtime).https.onRequest(handleSignup('waitlist'));
export const requestNewsletterSignup = functions.region(REGION).runWith(runtime).https.onRequest(handleSignup('newsletter'));

export const confirmOptin = functions.region(REGION).runWith(FAST_START).https.onRequest((req, res) => corsMiddleware(req, res, async () => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'method-not-allowed' });
        return;
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    // Guessing tokens is pointless (192 bit), but cap hammering anyway.
    if (!(await consumeRateLimits([{ scope: 'optin_confirm_ip', key: clientIp(req as any), max: 60, windowMs: 3_600_000 }]))) {
        res.status(429).json({ success: false, error: 'rate-limited' });
        return;
    }
    try {
        if (body.action === 'addNewsletter') {
            const result = await addNewsletterFromWaitlist(token, toLang(body.lang), evidenceOf(req));
            res.status(result === 'invalid' ? 400 : 200).json({ success: result !== 'invalid', result });
            return;
        }
        const out = await confirmToken(token, evidenceOf(req));
        res.status(out.result === 'invalid' ? 400 : 200).json({ success: out.result === 'confirmed' || out.result === 'already', ...out });
    } catch (error: any) {
        console.error('confirmOptin failed', error?.name, error?.message);
        res.status(500).json({ success: false, error: 'internal' });
    }
}));
