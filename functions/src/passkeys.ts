import * as functions from 'firebase-functions/v1';
import { FAST_START } from './runtime-options';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
    PublicKeyCredentialCreationOptionsJSON,
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
    AuthenticatorTransport,
} from '@simplewebauthn/server';

interface AuthenticatorDevice {
    credentialPublicKey: Buffer;
    credentialID: Buffer;
    counter: number;
    transports?: AuthenticatorTransport[];
}

import { db, auth } from './init';
import { FieldValue } from 'firebase-admin/firestore';

const REGION = 'europe-west3'; // Frankfurt
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const isChallengeExpired = (createdAt: unknown): boolean => {
    const millis = (createdAt as any)?.toMillis?.();
    // A challenge without a readable timestamp is treated as expired.
    return typeof millis !== 'number' || Date.now() - millis > CHALLENGE_TTL_MS;
};

const toClientError = (error: any, fallback: string): functions.https.HttpsError =>
    error instanceof functions.https.HttpsError ? error : new functions.https.HttpsError('internal', fallback);

// Relying Party configuration.
// A passkey is bound to the hostname it was created on (the RP ID), so every
// production host the app is served from must be allow-listed here. Defaults
// cover the project's Firebase Hosting domains plus the custom domain; override
// with a comma-separated PASSKEY_ORIGINS env var if hosting changes.
const RP_NAME = 'ProjectFlow';
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const FIREBASE_PROJECT = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';

// Native iOS app. Passkeys created through ASAuthorization use the associated domain as RP ID
// (webcredentials:app.getprojectflow.com) and iOS reports `https://<rpID>` as the clientDataJSON origin,
// so the native client must send `origin: 'https://app.getprojectflow.com'` (or `client: 'ios'`).
// It stays on the allow-list even when PASSKEY_ORIGINS overrides the web origins.
export const NATIVE_APP_ORIGIN = 'https://app.getprojectflow.com';
// Admin console (admin/): its own RP ID — app passkeys are bound to app.getprojectflow.com and do not carry over.
export const ADMIN_CONSOLE_ORIGIN = 'https://admin.getprojectflow.com';

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/$/, '');

const PROD_ORIGINS = Array.from(new Set([
    ...(process.env.PASSKEY_ORIGINS
        || [
            FIREBASE_PROJECT && `https://${FIREBASE_PROJECT}.web.app`,
            FIREBASE_PROJECT && `https://${FIREBASE_PROJECT}.firebaseapp.com`,
            NATIVE_APP_ORIGIN,
            ADMIN_CONSOLE_ORIGIN
        ].filter(Boolean).join(','))
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean),
    NATIVE_APP_ORIGIN
]));

/**
 * Resolve the WebAuthn Relying Party ID + expected origin for a request.
 *
 * The client passes its `window.location.origin` (web) or `https://app.getprojectflow.com` (iOS).
 * Allow-listed production origins and local development hosts (localhost / 127.0.0.1) use that origin
 * and its hostname as the RP ID, so passkeys work on every host the app is served from. Anything else
 * falls back to the first production origin, so a remote caller cannot inject an arbitrary relying
 * party. `client: 'ios'` without an origin selects the native origin explicitly.
 */
const resolveRp = (clientOrigin?: string, client?: unknown): { rpID: string; origin: string } => {
    const requested = clientOrigin || (client === 'ios' ? NATIVE_APP_ORIGIN : undefined);
    if (requested) {
        try {
            const url = new URL(requested);
            const isLocalDev = isEmulator && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
            if (isLocalDev || PROD_ORIGINS.includes(url.origin)) {
                return { rpID: url.hostname, origin: url.origin };
            }
        } catch {
            // Malformed origin — ignore and fall through to the defaults below.
        }
    }
    if (isEmulator) {
        return { rpID: 'localhost', origin: clientOrigin || 'http://localhost:3000' };
    }
    const fallback = new URL(PROD_ORIGINS[0]);
    return { rpID: fallback.hostname, origin: fallback.origin };
};

export const generatePasskeyRegistrationOptions = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
    try {
        // 1. Ensure user is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to register a passkey.');
        }
        const userId = context.auth.uid;
        const userEmail = context.auth.token.email || 'user@example.com';
        const { rpID, origin } = resolveRp(data?.origin, data?.client);

        // 2. getUserPasskeys(user) - Retrieve user's existing passkeys to exclude them
        const passkeysSnapshot = await db.collection('users').doc(userId).collection('passkeys').get();
        const userPasskeys: AuthenticatorDevice[] = passkeysSnapshot.docs.map(doc => doc.data() as AuthenticatorDevice);

        // 3. Generate registration options
        const options: PublicKeyCredentialCreationOptionsJSON = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID,
            userID: Buffer.from(userId),
            userName: userEmail,
            // Don't prompt if the user already has a passkey on this device
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'required',
                authenticatorAttachment: 'platform', // Enforce platform authenticators (FaceID, TouchID, Windows Hello)? Optional.
            },
            excludeCredentials: userPasskeys.map(passkey => ({
                id: passkey.credentialID.toString('base64url'),
                type: 'public-key' as const,
                transports: passkey.transports,
            })),
        });

        // 4. Save current challenge to Firestore (or Redis/Memcached) for verification step
        // We store it temporarily in a 'challenges' subcollection or just a field on the user doc
        await db.collection('users').doc(userId).collection('passkey_challenges').doc('current').set({
            challenge: options.challenge,
            // Persist the relying party the options were generated for, so the
            // verify step uses the exact same origin/rpID the browser saw.
            origin,
            rpID,
            createdAt: FieldValue.serverTimestamp(),
        });

        return options;
    } catch (error: any) {
        console.error('generatePasskeyRegistrationOptions: Error:', error);
        throw toClientError(error, 'Internal Server Error');
    }
});

/**
 * Verify Registration
 * Called after the user has performed the biometric/security key interaction.
 */
export const verifyPasskeyRegistration = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
    // 1. Ensure user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to register a passkey.');
    }
    const userId = context.auth.uid;
    const { response, navigatorDetails } = data; // response from client

    // 2. Retrieve expected challenge
    const challengeDoc = await db.collection('users').doc(userId).collection('passkey_challenges').doc('current').get();
    if (!challengeDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'No registration flow initiated.');
    }
    const challengeData = challengeDoc.data();
    // Single use: delete right away so it cannot be replayed.
    await challengeDoc.ref.delete();
    if (isChallengeExpired(challengeData?.createdAt)) {
        throw new functions.https.HttpsError('failed-precondition', 'Registration challenge expired.');
    }
    const expectedChallenge = challengeData?.challenge;
    // Prefer the relying party stored with the challenge; fall back to resolving
    // from the client origin for challenges created before this was persisted.
    const { rpID, origin } = challengeData?.origin
        ? { rpID: challengeData.rpID as string, origin: challengeData.origin as string }
        : resolveRp(data?.origin, data?.client);

    // 3. Verify
    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: response as RegistrationResponseJSON,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: true,
        });
    } catch (error: any) {
        console.error('Passkey registration verification failed', error);
        throw new functions.https.HttpsError('invalid-argument', 'Verification failed.');
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
        const { publicKey, id, counter } = registrationInfo.credential;

        // 4. Save the new passkey to the user's account
        // Encode credentialID as base64url for storage/transport if needed, but simplewebauthn handles Buffers internally usually
        // Actually simplewebauthn returns Buffers in registrationInfo.

        // We need to store this info to verify future logins
        const newPasskey: AuthenticatorDevice = {
            credentialPublicKey: Buffer.from(publicKey),
            credentialID: Buffer.from(id, 'base64url'),
            counter,
            transports: response.response.transports,
        };

        // Use a safe ID for the document
        // credentialID is a Buffer, convert to base64url or hex
        const credentialIDBase64 = id;

        await db.collection('users').doc(userId).collection('passkeys').doc(credentialIDBase64).set({
            ...newPasskey,
            credentialID: Buffer.from(id, 'base64url'), // Verify if Firestore supports Buffer or if we need to store as blob/base64
            credentialPublicKey: Buffer.from(publicKey),
            createdAt: FieldValue.serverTimestamp(),
            label: data.deviceName || `Passkey (${navigatorDetails?.platform || 'Unknown Device'})`,
        });

        // Cleanup challenge
        await db.collection('users').doc(userId).collection('passkey_challenges').doc('current').delete();

        return { success: true };
    }

    throw new functions.https.HttpsError('unknown', 'Registration failed.');
});


/**
 * Generate Authentication Options
 * Called when a user wants to sign in.
 * Note: Since the user is NOT logged in yet, we can't rely on context.auth.
 * However, typical passkey flows often need a username first (autofill assistance).
 * For "Discoverable Credentials" (resident keys), we don't strictly need a username, but simplewebauthn usually generates options.
 *
 * We allow passing an email if known, otherwise we generate options for "empty" (discoverable).
 */
export const generatePasskeyAuthenticationOptions = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
    try {
        // data.email is optional.

        // 1. If email is provided, get the user's known passkeys to use as 'allowCredentials'
        // This helps the browser show only relevant passkeys.
        let userId = '';
        let allowCredentials: {
            id: string; // Base64URL
            type: 'public-key';
            transports?: AuthenticatorTransport[];
        }[] = [];

        if (data.email) {
            try {
                const userRecord = await auth.getUserByEmail(data.email);
                userId = userRecord.uid;

                const passkeysSnapshot = await db.collection('users').doc(userId).collection('passkeys').get();


                allowCredentials = passkeysSnapshot.docs.map(doc => {
                    const pData = doc.data();
                    // If saved as Blob/Buffer, convert to base64url string
                    // Firestore generic binary field to buffer:
                    const buf = pData.credentialID instanceof Uint8Array ? Buffer.from(pData.credentialID) : pData.credentialID;

                    return {
                        id: buf.toString('base64url'),
                        type: 'public-key' as const,
                        transports: pData.transports,
                    }
                });

            } catch (e) {
                // User not found or error, just proceed with empty allowCredentials
                console.log('User not found by email for passkey options', e);
            }
        }

        // 2. Generate options
        const { rpID, origin } = resolveRp(data?.origin, data?.client);
        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
            userVerification: 'required',
        });

        // 3. Store the challenge.
        await db.collection('auth_challenges').doc(options.challenge).set({
            challenge: options.challenge,
            userId: userId || null, // If we knew the user
            // Persist the relying party so verification matches what the browser saw.
            origin,
            rpID,
            createdAt: FieldValue.serverTimestamp(),
        });

        return options;
    } catch (error: any) {
        console.error('generatePasskeyAuthenticationOptions: Error:', error);
        throw toClientError(error, 'Internal Server Error');
    }
});


/**
 * Verify Authentication
 * Called after the user signs in with the passkey.
 */
export const verifyPasskeyAuthentication = functions.region(REGION).runWith(FAST_START).https.onCall(async (data, context) => {
    // Helper to safely get Buffer from Firestore field (which might be Blob, Buffer, or Uint8Array)
    const toBuffer = (field: any): Buffer => {
        if (!field) return Buffer.alloc(0);
        if (Buffer.isBuffer(field)) return field;
        if (field.toBuffer && typeof field.toBuffer === 'function') return field.toBuffer(); // Firestore Blob
        if (field instanceof Uint8Array) return Buffer.from(field);
        return Buffer.from(field); // Try standard conversion (e.g. from array or string)
    };

    // The login screen pings this function so the instance is warm (and its
    // Firestore channel open) by the time a real verification arrives.
    if (data?.warmup === true) {
        await db.collection('auth_challenges').doc('_warmup').get().catch(() => undefined);
        return { success: false, warmup: true };
    }

    try {
        const { response } = data;
        const authResponse = response as AuthenticationResponseJSON;

        // 1. Retrieve the challenge
        const clientData = JSON.parse(Buffer.from(authResponse.response.clientDataJSON, 'base64').toString('utf-8'));
        const challenge = clientData.challenge; // This is base64url encoded usually

        const challengeDoc = await db.collection('auth_challenges').doc(challenge).get();
        if (!challengeDoc.exists) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid or expired challenge.');
        }
        const challengeData = challengeDoc.data();
        // Single use: delete right away so it cannot be replayed. The exists
        // precondition makes concurrent replays of the same challenge fail;
        // the delete runs alongside the passkey lookup and is awaited before
        // the signature is verified.
        const consumeChallenge = challengeDoc.ref.delete({ exists: true }).catch(() => {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid or expired challenge.');
        });
        consumeChallenge.catch(() => undefined);
        if (isChallengeExpired(challengeData?.createdAt)) {
            await consumeChallenge;
            throw new functions.https.HttpsError('invalid-argument', 'Invalid or expired challenge.');
        }

        // 2. Identify the user
        // The credentialID returned tells us which passkey was used.
        // We need to find the user who owns this passkey.

        const credentialID = authResponse.id; // Base64URL string
        let userId = challengeData?.userId;
        let dbPasskey: AuthenticatorDevice | null = null;

        console.log('verifyPasskeyAuthentication: Starting', { credentialID, challengeUserId: userId });

        if (userId) {
            // We expected a specific user
            console.log(`verifyPasskeyAuthentication: Looking up passkey for known user ${userId}`);
            const passkeyDoc = await db.collection('users').doc(userId).collection('passkeys').doc(credentialID).get();
            if (passkeyDoc.exists) {
                console.log('verifyPasskeyAuthentication: Passkey found via direct lookup');
                const d = passkeyDoc.data();
                dbPasskey = {
                    credentialID: toBuffer(d!.credentialID),
                    credentialPublicKey: toBuffer(d!.credentialPublicKey),
                    counter: d!.counter,
                    transports: d!.transports
                };
            } else {
                console.log('verifyPasskeyAuthentication: Passkey doc not found at expected path');
            }
        } else {
            // Discoverable Credential Flow (User Handle)
            console.log('verifyPasskeyAuthentication: Discoverable flow (no userId in challenge)');

            let foundUserId: string | null = null;
            const userHandle = authResponse.response.userHandle;

            if (userHandle) {
                // userHandle is the Base64URL encoded userID (which is the uid string).
                // Decode it.
                try {
                    foundUserId = Buffer.from(userHandle, 'base64url').toString('utf-8');
                    console.log(`verifyPasskeyAuthentication: Decoded userHandle to userId: ${foundUserId}`);
                } catch (e) {
                    console.error('verifyPasskeyAuthentication: Failed to decode userHandle', e);
                }
            }

            if (foundUserId) {
                userId = foundUserId;
            } else {
                // Try searching via collectionGroup as a fallback if no userHandle
                console.log('verifyPasskeyAuthentication: No userHandle, searching collectionGroup');
                // Try matches for this credentialID
                const querySnapshot = await db.collectionGroup('passkeys').where('credentialID', '==', Buffer.from(credentialID, 'base64url')).get();
                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    // doc.ref.parent.parent is the user doc
                    const userDoc = doc.ref.parent.parent;
                    if (userDoc) {
                        userId = userDoc.id;
                        console.log(`verifyPasskeyAuthentication: Found passkey via collectionGroup for user ${userId}`);
                    }
                }
            }
        }

        // If we still don't have a user, and we can't find the passkey, fail.
        if (!userId) {
            console.error('verifyPasskeyAuthentication: User could not be identified.');
            throw new functions.https.HttpsError('not-found', 'User could not be identified from passkey.');
        }

        // Retrieve passkey if not already
        if (!dbPasskey) {
            console.log(`verifyPasskeyAuthentication: Retrieving passkey for user ${userId}`);
            const passkeyDoc = await db.collection('users').doc(userId).collection('passkeys').doc(credentialID).get();
            if (passkeyDoc.exists) {
                const d = passkeyDoc.data();
                dbPasskey = {
                    credentialID: toBuffer(d!.credentialID),
                    credentialPublicKey: toBuffer(d!.credentialPublicKey),
                    counter: d!.counter,
                    transports: d!.transports
                };
            } else {
                console.log('verifyPasskeyAuthentication: Passkey doc not found (2nd attempt)');
            }
        }

        if (!dbPasskey) {
            console.error('verifyPasskeyAuthentication: Logic failed to retrieve passkey');
            throw new functions.https.HttpsError('not-found', 'Passkey not found for user.');
        }

        await consumeChallenge;

        // 3. Verify
        let verification;
        try {
            // Prefer the relying party stored with the challenge; fall back to
            // resolving from the client origin for older challenges.
            const { rpID, origin } = challengeData?.origin
                ? { rpID: challengeData.rpID as string, origin: challengeData.origin as string }
                : resolveRp(data?.origin, data?.client);

            verification = await verifyAuthenticationResponse({
                response: authResponse,
                expectedChallenge: challengeData!.challenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                requireUserVerification: true,
                credential: {
                    id: credentialID,
                    publicKey: new Uint8Array(dbPasskey.credentialPublicKey),
                    counter: dbPasskey.counter,
                    transports: dbPasskey.transports as any,
                },
            });
        } catch (error: any) {
            console.error('Passkey verification failed', error);
            throw new functions.https.HttpsError('unauthenticated', 'Verification failed.');
        }

        const { verified, authenticationInfo } = verification;

        if (verified) {
            // Update counter (in parallel with minting the token; both must succeed)
            const counterUpdate = db.collection('users').doc(userId).collection('passkeys').doc(credentialID).update({
                counter: authenticationInfo.newCounter,
                lastUsedAt: FieldValue.serverTimestamp(),
            });
            counterUpdate.catch(() => undefined);

            // 4. Mint Custom Token
            let customToken: string;
            try {
                customToken = await auth.createCustomToken(userId);
            } catch (e: any) {
                console.warn('verifyPasskeyAuthentication: auth.createCustomToken failed, attempting manual signing fallback', e);
                // Fallback: Manual JWT signing if SDK fails due to IAM permissions but we have the key locally
                // This requires 'jsonwebtoken' package
                const { serviceAccount } = require('./init');
                if (serviceAccount && serviceAccount.private_key && serviceAccount.client_email) {
                    const jwt = require('jsonwebtoken');
                    const algorithm = 'RS256';
                    const now = Math.floor(Date.now() / 1000);
                    const payload = {
                        iss: serviceAccount.client_email,
                        sub: serviceAccount.client_email,
                        aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
                        iat: now,
                        exp: now + 3600,
                        uid: userId,
                        claims: {}
                    };
                    customToken = jwt.sign(payload, serviceAccount.private_key, { algorithm });
                    console.log('verifyPasskeyAuthentication: Manual JWT signing successful');
                } else {
                    console.error('verifyPasskeyAuthentication: No local service account for fallback');
                    throw e;
                }
            }

            await counterUpdate;

            return {
                success: true,
                token: customToken,
            };
        }

        throw new functions.https.HttpsError('unauthenticated', 'Verification failed.');

    } catch (error: any) {
        console.error('verifyPasskeyAuthentication: Error:', error);
        throw toClientError(error, 'Internal Server Error');
    }
});
