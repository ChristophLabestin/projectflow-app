// App settings toggle "ProjectFlow newsletter" (Settings → Notifications). Double opt-in like the landing form.
//   callable platformNewsletterPreference { action: 'get' | 'subscribe' | 'unsubscribe', lang? }
//   → { status: 'none' | 'pending' | 'confirmed' | 'unsubscribed' | 'bounced', mailSent?: boolean }
import * as functions from 'firebase-functions/v1';
import { EMAIL_SECRETS } from '../email-logic';
import { clientIp, consumeRateLimits } from '../public-rate-limit';
import { FAST_START } from '../runtime-options';
import { parseEmail, subscriberId, toLang } from './logic';
import type { SubscriberDoc } from './logic';
import { requestOptin, sendOptinMail, subscribers, unsubscribe } from './store';

const REGION = 'europe-west3';

export const platformNewsletterPreference = functions.region(REGION).runWith({ ...FAST_START, secrets: EMAIL_SECRETS }).https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const email = parseEmail(context.auth?.token?.email);
    if (!email) throw new functions.https.HttpsError('failed-precondition', 'Your account has no email address.');
    const id = subscriberId(email);
    const statusOf = async () => {
        const doc = (await subscribers().doc(id).get()).data() as SubscriberDoc | undefined;
        return doc?.lists?.newsletter?.status || 'none';
    };
    const action = String(data?.action || 'get');
    const req = context.rawRequest;
    const evidence = { ip: req ? clientIp(req as any) : undefined, userAgent: String(req?.headers?.['user-agent'] || ''), by: uid };

    if (action === 'get') return { status: await statusOf() };
    if (action === 'subscribe') {
        if (!(await consumeRateLimits([{ scope: 'newsletter_app_uid', key: uid, max: 3, windowMs: 3_600_000 }]))) {
            throw new functions.https.HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
        }
        const lang = toLang(data?.lang);
        const out = await requestOptin({ email, list: 'newsletter', lang, source: 'app', name: String(context.auth?.token?.name || '').slice(0, 120), uid, evidence });
        if (out.token) await sendOptinMail(email, 'newsletter', lang, out.token, process.env.NEWSLETTER_SITE_URL || undefined);
        return { status: out.already ? 'confirmed' : 'pending', mailSent: !!out.token };
    }
    if (action === 'unsubscribe') {
        await unsubscribe(id, 'newsletter', { ...evidence, via: 'app' });
        return { status: await statusOf() };
    }
    throw new functions.https.HttpsError('invalid-argument', 'Unknown action.');
});
