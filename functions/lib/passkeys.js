"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPasskeyAuthentication = exports.generatePasskeyAuthenticationOptions = exports.verifyPasskeyRegistration = exports.generatePasskeyRegistrationOptions = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const server_1 = require("@simplewebauthn/server");
const init_1 = require("./init");
const REGION = 'europe-west3'; // Frankfurt
// Relying Party Configuration
// Set these in your Firebase Functions environment configuration
// firebase functions:config:set passkeys.rp_id="your-app.com" passkeys.origin="https://your-app.com"
// Or use Google Cloud Run environment variables
const RP_NAME = 'ProjectFlow';
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const RP_ID = process.env.RP_ID || (isEmulator ? 'localhost' : 'app.getprojectflow.com');
const ORIGIN = process.env.ORIGIN || (isEmulator ? 'http://localhost:3000' : 'https://app.getprojectflow.com');
/**
 * Generate Registration Options
 * Called when a signed-in user wants to register a new passkey.
 */
exports.generatePasskeyRegistrationOptions = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        // 1. Ensure user is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to register a passkey.');
        }
        const userId = context.auth.uid;
        const userEmail = context.auth.token.email || 'user@example.com';
        // 2. getUserPasskeys(user) - Retrieve user's existing passkeys to exclude them
        const passkeysSnapshot = await init_1.db.collection('users').doc(userId).collection('passkeys').get();
        const userPasskeys = passkeysSnapshot.docs.map(doc => doc.data());
        // 3. Generate registration options
        const options = await (0, server_1.generateRegistrationOptions)({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: Buffer.from(userId),
            userName: userEmail,
            // Don't prompt if the user already has a passkey on this device
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform', // Enforce platform authenticators (FaceID, TouchID, Windows Hello)? Optional.
            },
            excludeCredentials: userPasskeys.map(passkey => ({
                id: passkey.credentialID.toString('base64url'),
                type: 'public-key',
                transports: passkey.transports,
            })),
        });
        // 4. Save current challenge to Firestore (or Redis/Memcached) for verification step
        // We store it temporarily in a 'challenges' subcollection or just a field on the user doc
        await init_1.db.collection('users').doc(userId).collection('passkey_challenges').doc('current').set({
            challenge: options.challenge,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return options;
    }
    catch (error) {
        console.error('generatePasskeyRegistrationOptions: Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Internal Server Error');
    }
});
/**
 * Verify Registration
 * Called after the user has performed the biometric/security key interaction.
 */
exports.verifyPasskeyRegistration = functions.region(REGION).https.onCall(async (data, context) => {
    var _a;
    // 1. Ensure user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to register a passkey.');
    }
    const userId = context.auth.uid;
    const { response, navigatorDetails } = data; // response from client
    // 2. Retrieve expected challenge
    const challengeDoc = await init_1.db.collection('users').doc(userId).collection('passkey_challenges').doc('current').get();
    if (!challengeDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'No registration flow initiated.');
    }
    const expectedChallenge = (_a = challengeDoc.data()) === null || _a === void 0 ? void 0 : _a.challenge;
    // 3. Verify
    let verification;
    try {
        verification = await (0, server_1.verifyRegistrationResponse)({
            response: response,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });
    }
    catch (error) {
        console.error('Passkey registration verification failed', error);
        throw new functions.https.HttpsError('invalid-argument', `Verification failed: ${error.message}`);
    }
    const { verified, registrationInfo } = verification;
    if (verified && registrationInfo) {
        const { publicKey, id, counter } = registrationInfo.credential;
        // 4. Save the new passkey to the user's account
        // Encode credentialID as base64url for storage/transport if needed, but simplewebauthn handles Buffers internally usually
        // Actually simplewebauthn returns Buffers in registrationInfo.
        // We need to store this info to verify future logins
        const newPasskey = {
            credentialPublicKey: Buffer.from(publicKey),
            credentialID: Buffer.from(id, 'base64url'),
            counter,
            transports: response.response.transports,
        };
        // Use a safe ID for the document
        // credentialID is a Buffer, convert to base64url or hex
        const credentialIDBase64 = id;
        await init_1.db.collection('users').doc(userId).collection('passkeys').doc(credentialIDBase64).set(Object.assign(Object.assign({}, newPasskey), { credentialID: Buffer.from(id, 'base64url'), credentialPublicKey: Buffer.from(publicKey), createdAt: admin.firestore.FieldValue.serverTimestamp(), label: `Passkey (${(navigatorDetails === null || navigatorDetails === void 0 ? void 0 : navigatorDetails.platform) || 'Unknown Device'})` }));
        // Cleanup challenge
        await init_1.db.collection('users').doc(userId).collection('passkey_challenges').doc('current').delete();
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
exports.generatePasskeyAuthenticationOptions = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        // data.email is optional.
        // 1. If email is provided, get the user's known passkeys to use as 'allowCredentials'
        // This helps the browser show only relevant passkeys.
        let userId = '';
        let allowCredentials = [];
        if (data.email) {
            try {
                const userRecord = await init_1.auth.getUserByEmail(data.email);
                userId = userRecord.uid;
                const passkeysSnapshot = await init_1.db.collection('users').doc(userId).collection('passkeys').get();
                allowCredentials = passkeysSnapshot.docs.map(doc => {
                    const pData = doc.data();
                    // If saved as Blob/Buffer, convert to base64url string
                    // Firestore generic binary field to buffer:
                    const buf = pData.credentialID instanceof Uint8Array ? Buffer.from(pData.credentialID) : pData.credentialID;
                    return {
                        id: buf.toString('base64url'),
                        type: 'public-key',
                        transports: pData.transports,
                    };
                });
            }
            catch (e) {
                // User not found or error, just proceed with empty allowCredentials
                console.log('User not found by email for passkey options', e);
            }
        }
        // 2. Generate options
        const options = await (0, server_1.generateAuthenticationOptions)({
            rpID: RP_ID,
            allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
            userVerification: 'preferred',
        });
        // 3. Store the challenge.
        await init_1.db.collection('auth_challenges').doc(options.challenge).set({
            challenge: options.challenge,
            userId: userId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return options;
    }
    catch (error) {
        console.error('generatePasskeyAuthenticationOptions: Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Internal Server Error');
    }
});
/**
 * Verify Authentication
 * Called after the user signs in with the passkey.
 */
exports.verifyPasskeyAuthentication = functions.region(REGION).https.onCall(async (data, context) => {
    // Helper to safely get Buffer from Firestore field (which might be Blob, Buffer, or Uint8Array)
    const toBuffer = (field) => {
        if (!field)
            return Buffer.alloc(0);
        if (Buffer.isBuffer(field))
            return field;
        if (field.toBuffer && typeof field.toBuffer === 'function')
            return field.toBuffer(); // Firestore Blob
        if (field instanceof Uint8Array)
            return Buffer.from(field);
        return Buffer.from(field); // Try standard conversion (e.g. from array or string)
    };
    try {
        const { response } = data;
        const authResponse = response;
        // 1. Retrieve the challenge
        const clientData = JSON.parse(Buffer.from(authResponse.response.clientDataJSON, 'base64').toString('utf-8'));
        const challenge = clientData.challenge; // This is base64url encoded usually
        const challengeDoc = await init_1.db.collection('auth_challenges').doc(challenge).get();
        if (!challengeDoc.exists) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid or expired challenge.');
        }
        const challengeData = challengeDoc.data();
        // 2. Identify the user
        // The credentialID returned tells us which passkey was used.
        // We need to find the user who owns this passkey.
        const credentialID = authResponse.id; // Base64URL string
        let userId = challengeData === null || challengeData === void 0 ? void 0 : challengeData.userId;
        let dbPasskey = null;
        console.log('verifyPasskeyAuthentication: Starting', { credentialID, challengeUserId: userId });
        if (userId) {
            // We expected a specific user
            console.log(`verifyPasskeyAuthentication: Looking up passkey for known user ${userId}`);
            const passkeyDoc = await init_1.db.collection('users').doc(userId).collection('passkeys').doc(credentialID).get();
            if (passkeyDoc.exists) {
                console.log('verifyPasskeyAuthentication: Passkey found via direct lookup');
                const d = passkeyDoc.data();
                dbPasskey = {
                    credentialID: toBuffer(d.credentialID),
                    credentialPublicKey: toBuffer(d.credentialPublicKey),
                    counter: d.counter,
                    transports: d.transports
                };
            }
            else {
                console.log('verifyPasskeyAuthentication: Passkey doc not found at expected path');
            }
        }
        else {
            // Discoverable Credential Flow (User Handle)
            console.log('verifyPasskeyAuthentication: Discoverable flow (no userId in challenge)');
            let foundUserId = null;
            const userHandle = authResponse.response.userHandle;
            if (userHandle) {
                // userHandle is the Base64URL encoded userID (which is the uid string).
                // Decode it.
                try {
                    foundUserId = Buffer.from(userHandle, 'base64url').toString('utf-8');
                    console.log(`verifyPasskeyAuthentication: Decoded userHandle to userId: ${foundUserId}`);
                }
                catch (e) {
                    console.error('verifyPasskeyAuthentication: Failed to decode userHandle', e);
                }
            }
            if (foundUserId) {
                userId = foundUserId;
            }
            else {
                // Try searching via collectionGroup as a fallback if no userHandle
                console.log('verifyPasskeyAuthentication: No userHandle, searching collectionGroup');
                // Try matches for this credentialID
                const querySnapshot = await init_1.db.collectionGroup('passkeys').where('credentialID', '==', Buffer.from(credentialID, 'base64url')).get();
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
            const passkeyDoc = await init_1.db.collection('users').doc(userId).collection('passkeys').doc(credentialID).get();
            if (passkeyDoc.exists) {
                const d = passkeyDoc.data();
                dbPasskey = {
                    credentialID: toBuffer(d.credentialID),
                    credentialPublicKey: toBuffer(d.credentialPublicKey),
                    counter: d.counter,
                    transports: d.transports
                };
            }
            else {
                console.log('verifyPasskeyAuthentication: Passkey doc not found (2nd attempt)');
            }
        }
        if (!dbPasskey) {
            console.error('verifyPasskeyAuthentication: Logic failed to retrieve passkey');
            throw new functions.https.HttpsError('not-found', 'Passkey not found for user.');
        }
        // 3. Verify
        let verification;
        try {
            verification = await (0, server_1.verifyAuthenticationResponse)({
                response: authResponse,
                expectedChallenge: challengeData.challenge,
                expectedOrigin: ORIGIN,
                expectedRPID: RP_ID,
                credential: {
                    id: credentialID,
                    publicKey: dbPasskey.credentialPublicKey,
                    counter: dbPasskey.counter,
                    transports: dbPasskey.transports,
                },
            });
        }
        catch (error) {
            console.error('Passkey verification failed', error);
            throw new functions.https.HttpsError('unauthenticated', `Verification failed: ${error.message}`);
        }
        const { verified, authenticationInfo } = verification;
        if (verified) {
            // Update counter
            await init_1.db.collection('users').doc(userId).collection('passkeys').doc(credentialID).update({
                counter: authenticationInfo.newCounter,
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Delete challenge
            await init_1.db.collection('auth_challenges').doc(challenge).delete();
            // 4. Mint Custom Token
            let customToken;
            try {
                customToken = await init_1.auth.createCustomToken(userId);
            }
            catch (e) {
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
                }
                else {
                    console.error('verifyPasskeyAuthentication: No local service account for fallback');
                    throw e;
                }
            }
            return {
                success: true,
                token: customToken,
            };
        }
        throw new functions.https.HttpsError('unauthenticated', 'Verification failed.');
    }
    catch (error) {
        console.error('verifyPasskeyAuthentication: Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Internal Server Error');
    }
});
//# sourceMappingURL=passkeys.js.map