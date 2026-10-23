// Desktop sign-in handoff (OAuth providers in the system browser, see brain/plans/desktop-electron-concept.md §18).
// The desktop shell opens /desktop/auth?challenge=<sha256(verifier)> in the browser; the signed-in page calls
// createDesktopAuthCode and opens projectflow://auth?code=…; the app exchanges code + verifier for a custom token.
// Codes are single use, expire after 2 minutes and are useless without the verifier that never leaves the app.
import * as functions from 'firebase-functions/v1';
import { createHash, randomBytes } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db, auth } from './init';

const REGION = 'europe-west3'; // Frankfurt
const CODES = 'desktop_auth_codes';
const CODE_TTL_MS = 2 * 60 * 1000;
const BASE64URL = /^[A-Za-z0-9_-]{43,128}$/;

const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');

export const createDesktopAuthCode = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const challenge = typeof data?.challenge === 'string' ? data.challenge : '';
    if (!BASE64URL.test(challenge)) throw new functions.https.HttpsError('invalid-argument', 'Invalid challenge.');

    const code = randomBytes(32).toString('base64url');
    // Store only the hash of the code: a leaked document cannot be redeemed.
    await db.collection(CODES).doc(sha256(code)).set({
        uid,
        challenge,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS)
    });
    return { code };
});

export const exchangeDesktopAuthCode = functions.region(REGION).https.onCall(async (data) => {
    const code = typeof data?.code === 'string' ? data.code : '';
    const verifier = typeof data?.verifier === 'string' ? data.verifier : '';
    if (!BASE64URL.test(code) || !BASE64URL.test(verifier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid code.');
    }
    const ref = db.collection(CODES).doc(sha256(code));
    const entry = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        tx.delete(ref);
        return snap.data() as { uid: string; challenge: string; expiresAt: Timestamp };
    });
    if (!entry || entry.expiresAt.toMillis() < Date.now() || entry.challenge !== sha256(verifier)) {
        throw new functions.https.HttpsError('permission-denied', 'Code invalid or expired.');
    }
    const user = await auth.getUser(entry.uid).catch(() => null);
    if (!user || user.disabled) throw new functions.https.HttpsError('permission-denied', 'Account unavailable.');
    return { token: await auth.createCustomToken(entry.uid) };
});
