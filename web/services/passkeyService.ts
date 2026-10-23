import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { functions } from './firebase';
import { httpsCallable, httpsCallableFromURL } from 'firebase/functions';
import { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';

const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
// Passkey functions are exposed through same-origin Hosting rewrites (see
// firebase.json), so every hosting domain calls its own backend.
const FUNCTIONS_DOMAIN = location.origin;

// The relying party (rpID/origin) WebAuthn is bound to is the page's own origin.
// We forward it so the backend can verify against the exact origin the browser
// used — this is what lets passkeys work on localhost as well as production.
const CLIENT_ORIGIN = location.origin;

// Helper to get callable based on environment
const getFunction = <RequestData = unknown, ResponseData = unknown>(name: string) => {
    if (isLocalhost) {
        return httpsCallable<RequestData, ResponseData>(functions, name);
    } else {
        return httpsCallableFromURL<RequestData, ResponseData>(functions, `${FUNCTIONS_DOMAIN}/${name}`);
    }
};

/**
 * Register a new passkey for the current user.
 */
export const registerPasskey = async (deviceName?: string) => {
    try {
        // 1. Get options from server
        const generateOptionsFn = getFunction<{ origin: string }, PublicKeyCredentialCreationOptionsJSON>('generatePasskeyRegistrationOptions');
        const optionsResp = await generateOptionsFn({ origin: CLIENT_ORIGIN });
        const options = optionsResp.data;

        // 2. Start registration on browser
        const registrationResponse = await startRegistration({ optionsJSON: options });

        // 3. Send response to server for verification
        const verifyFn = getFunction<{ response: RegistrationResponseJSON, navigatorDetails: any, deviceName?: string, origin: string }, { success: boolean }>('verifyPasskeyRegistration');
        const verificationResp = await verifyFn({
            response: registrationResponse,
            navigatorDetails: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            },
            deviceName,
            origin: CLIENT_ORIGIN
        });

        if (verificationResp.data.success) {
            console.log('Passkey registered successfully!');
            return true;
        } else {
            throw new Error('Verification returned failure status');
        }

    } catch (error: any) {
        console.error('Passkey registration error:', error);
        throw error;
    }
};

type AuthOptionsRequest = { email?: string, origin: string };
type VerifyAuthRequest = { response: AuthenticationResponseJSON, email?: string, origin: string } | { warmup: true };

// Challenges expire after 5 minutes on the server; reuse a prefetched one only
// while it is clearly still valid.
const PREFETCH_MAX_AGE_MS = 4 * 60 * 1000;
let prefetchedOptions: { promise: Promise<PublicKeyCredentialRequestOptionsJSON>, fetchedAt: number } | null = null;

const fetchAuthenticationOptions = async (email?: string) => {
    const generateOptionsFn = getFunction<AuthOptionsRequest, PublicKeyCredentialRequestOptionsJSON>('generatePasskeyAuthenticationOptions');
    const optionsResp = await generateOptionsFn({ email, origin: CLIENT_ORIGIN });
    return optionsResp.data;
};

const takePrefetchedOptions = () => {
    const prefetched = prefetchedOptions;
    // Single use: a challenge is consumed by the verify call either way.
    prefetchedOptions = null;
    if (!prefetched || Date.now() - prefetched.fetchedAt > PREFETCH_MAX_AGE_MS) return null;
    return prefetched.promise;
};

/**
 * Prepares a passkey sign-in while the login screen is open: fetches a
 * (discoverable) challenge and wakes the verify function, so the click only
 * waits for the WebAuthn dialog instead of two function cold starts.
 */
export const preparePasskeyLogin = () => {
    if (!prefetchedOptions || Date.now() - prefetchedOptions.fetchedAt > PREFETCH_MAX_AGE_MS) {
        const promise = fetchAuthenticationOptions();
        promise.catch(() => {
            if (prefetchedOptions?.promise === promise) prefetchedOptions = null;
        });
        prefetchedOptions = { promise, fetchedAt: Date.now() };
    }
    void getFunction<VerifyAuthRequest, unknown>('verifyPasskeyAuthentication')({ warmup: true }).catch(() => undefined);
};

/**
 * Login with a passkey.
 * @param email Optional email to help identify the user (for non-discoverable credentials)
 * @returns Custom Auth Token if successful
 */
export const loginWithPasskey = async (email?: string) => {
    try {
        // 1. Get options from server (prefetched challenge when no email narrows the credentials)
        const prefetched = email ? null : takePrefetchedOptions();
        const options = (prefetched ? await prefetched.catch(() => null) : null) ?? await fetchAuthenticationOptions(email);

        // 2. Start authentication on browser
        const authenticationResponse = await startAuthentication({ optionsJSON: options });

        // 3. Send response to server for verification
        const verifyFn = getFunction<VerifyAuthRequest, { success: boolean, token: string }>('verifyPasskeyAuthentication');
        const verificationResp = await verifyFn({
            response: authenticationResponse,
            email, // Send email back just in case
            origin: CLIENT_ORIGIN
        });

        if (verificationResp.data.success && verificationResp.data.token) {
            return verificationResp.data.token;
        } else {
            throw new Error('Verification failed or no token returned');
        }

    } catch (error: any) {
        console.error('Passkey login error:', error);
        throw error;
    }
};

const AUTO_PROMPT_KEY = 'projectflow_passkey_autoprompt';

export const shouldAutoPrompt = (): boolean => {
    return localStorage.getItem(AUTO_PROMPT_KEY) === 'true';
};

/**
 * Check if the user has any passkeys registered.
 * Uses dynamic imports to avoid circular dependencies.
 */
export const checkPasskeyExists = async (uid: string): Promise<boolean> => {
    try {
        const { getFirestore, collection, getDocs, query, limit } = await import('firebase/firestore');
        const db = getFirestore();
        const passkeysRef = collection(db, 'users', uid, 'passkeys');
        const q = query(passkeysRef, limit(1));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking passkey existence:', error);
        return false;
    }
};
