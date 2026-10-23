import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, connectAuthEmulator, getAuth, setPersistence } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const env = import.meta.env;
export const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';

// Hosting serves /__/auth/handler on every site, so once a custom domain is set up it becomes its own
// auth domain (no third-party storage for Safari). Each host needs its handler URL on the OAuth client.
const SAME_ORIGIN_AUTH_HOSTS = ['admin.getprojectflow.com'];
const host = typeof window !== 'undefined' ? window.location.hostname : '';

export const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-api-key' : undefined),
    authDomain: SAME_ORIGIN_AUTH_HOSTS.includes(host) ? host : env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: useEmulators ? 'demo-projectflow' : env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
// Admin sign-ins live only as long as the tab: closing it ends the console session.
void setPersistence(auth, browserSessionPersistence);
export const functions = getFunctions(app, 'europe-west3');

if (useEmulators) {
    connectAuthEmulator(auth, `http://127.0.0.1:${env.VITE_EMULATOR_AUTH_PORT || 9099}`, { disableWarnings: true });
    connectFunctionsEmulator(functions, '127.0.0.1', Number(env.VITE_EMULATOR_FUNCTIONS_PORT || 5001));
}
