import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/browser';

/**
 * Register a new passkey for the current user.
 */
export const registerPasskey = async () => {
    try {
        // 1. Get options from server
        const generateOptionsFn = httpsCallable<void, PublicKeyCredentialCreationOptionsJSON>(functions, 'generatePasskeyRegistrationOptions');
        const optionsResp = await generateOptionsFn();
        const options = optionsResp.data;

        // 2. Start registration on browser
        const registrationResponse = await startRegistration({ optionsJSON: options });

        // 3. Send response to server for verification
        const verifyFn = httpsCallable<{ response: RegistrationResponseJSON, navigatorDetails: any }, { success: boolean }>(functions, 'verifyPasskeyRegistration');
        const verificationResp = await verifyFn({
            response: registrationResponse,
            navigatorDetails: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            }
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
        const generateOptionsFn = httpsCallable<{ email?: string }, PublicKeyCredentialRequestOptionsJSON>(functions, 'generatePasskeyAuthenticationOptions');
        const optionsResp = await generateOptionsFn({ email });
        const options = optionsResp.data;

        // 2. Start authentication on browser
        const authenticationResponse = await startAuthentication({ optionsJSON: options });

        // 3. Send response to server for verification
        const verifyFn = httpsCallable<{ response: AuthenticationResponseJSON, email?: string }, { success: boolean, token: string }>(functions, 'verifyPasskeyAuthentication');
        const verificationResp = await verifyFn({
            response: authenticationResponse,
            email // Send email back just in case
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
