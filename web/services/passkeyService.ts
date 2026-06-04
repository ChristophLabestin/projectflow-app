import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { functions } from './firebase';
import { httpsCallable, httpsCallableFromURL } from 'firebase/functions';
import { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';

const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const FUNCTIONS_DOMAIN = 'https://app.getprojectflow.com';

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

/**
 * Login with a passkey.
 * @param email Optional email to help identify the user (for non-discoverable credentials)
 * @returns Custom Auth Token if successful
 */
export const loginWithPasskey = async (email?: string) => {
    try {
        // 1. Get options from server
        const generateOptionsFn = getFunction<{ email?: string, origin: string }, PublicKeyCredentialRequestOptionsJSON>('generatePasskeyAuthenticationOptions');
        const optionsResp = await generateOptionsFn({ email, origin: CLIENT_ORIGIN });
        const options = optionsResp.data;

        // 2. Start authentication on browser
        const authenticationResponse = await startAuthentication({ optionsJSON: options });

        // 3. Send response to server for verification
        const verifyFn = getFunction<{ response: AuthenticationResponseJSON, email?: string, origin: string }, { success: boolean, token: string }>('verifyPasskeyAuthentication');
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

export const setAutoPrompt = (enabled: boolean) => {
    if (enabled) {
        localStorage.setItem(AUTO_PROMPT_KEY, 'true');
    } else {
        localStorage.removeItem(AUTO_PROMPT_KEY);
    }
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
