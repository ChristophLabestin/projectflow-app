import { reauthenticateWithPopup, type AuthProvider, type User } from 'firebase/auth';
import { getDesktopBridge, hasDesktopCapability, isDesktop, type DesktopAuthProvider } from './desktop';
import { DESKTOP_REAUTH_EVENT } from './desktopAuth';

const PROVIDER_KEYS: Record<string, DesktopAuthProvider> = { 'google.com': 'google', 'github.com': 'github', 'apple.com': 'apple' };
const REAUTH_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Re-authentication with an OAuth provider. On the web a popup; in the desktop app (Google/Apple reject
 * embedded browsers) a sign-in in the system browser that comes back via projectflow://auth and refreshes the
 * session of the same account. Afterwards use `auth.currentUser` — the desktop path replaces the User object.
 */
export const reauthenticateWithProvider = async (user: User, provider: AuthProvider): Promise<void> => {
    const key = PROVIDER_KEYS[provider.providerId];
    const bridge = getDesktopBridge();
    if (!isDesktop() || !key || !bridge?.signInExternally || !hasDesktopCapability('external-auth')) {
        await reauthenticateWithPopup(user, provider);
        return;
    }
    await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => finish(new Error('auth/timeout')), REAUTH_TIMEOUT_MS);
        const onResult = (event: Event) => finish((event as CustomEvent<{ error?: string }>).detail?.error ? new Error((event as CustomEvent<{ error?: string }>).detail.error) : null);
        const finish = (error: Error | null) => {
            window.clearTimeout(timer);
            window.removeEventListener(DESKTOP_REAUTH_EVENT, onResult);
            if (error) reject(Object.assign(error, { code: error.message }));
            else resolve();
        };
        window.addEventListener(DESKTOP_REAUTH_EVENT, onResult);
        bridge.signInExternally!(key).catch((error) => finish(error instanceof Error ? error : new Error('auth/internal-error')));
    });
};
