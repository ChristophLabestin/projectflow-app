import { httpsCallable } from 'firebase/functions';
import {
    EmailAuthProvider,
    GithubAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    reauthenticateWithCredential,
    signOut,
} from 'firebase/auth';

import { auth, functions } from '../firebase';
import { reauthenticateWithProvider } from '../reauth';

export type SharedWorkspaceBlocker = { tenantId: string; name: string; memberCount: number };

export class AccountDeletionError extends Error {
    code: 'recent-login-required' | 'owner-of-shared-workspaces' | 'unknown';
    workspaces: SharedWorkspaceBlocker[];

    constructor(code: AccountDeletionError['code'], workspaces: SharedWorkspaceBlocker[] = [], message?: string) {
        super(message || code);
        this.code = code;
        this.workspaces = workspaces;
    }
}

/** Downloads the caller's personal data as a JSON file (Art. 20 GDPR). */
export const exportMyData = async (): Promise<void> => {
    const result = await httpsCallable(functions, 'exportMyData', { timeout: 300000 })({});
    const payload = result.data as { format: 'inline' | 'url'; data?: unknown; url?: string };
    const stamp = new Date().toISOString().slice(0, 10);

    if (payload.format === 'url' && payload.url) {
        window.open(payload.url, '_blank', 'noopener');
        return;
    }

    const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `projectflow-data-export-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
};

/** Permanently deletes the account; throws AccountDeletionError for the expected failure modes. */
export const deleteMyAccount = async (): Promise<void> => {
    try {
        await httpsCallable(functions, 'deleteMyAccount', { timeout: 540000 })({});
    } catch (error: any) {
        const message = String(error?.message || '');
        if (error?.code === 'functions/failed-precondition') {
            if (message.includes('recent-login-required')) throw new AccountDeletionError('recent-login-required');
            if (message.includes('owner-of-shared-workspaces')) {
                throw new AccountDeletionError('owner-of-shared-workspaces', error?.details?.workspaces || []);
            }
        }
        throw new AccountDeletionError('unknown', [], message);
    }
};

export const getReauthMethod = (): 'password' | 'google' | 'github' | 'apple' | null => {
    const ids = auth.currentUser?.providerData.map((p) => p.providerId) || [];
    if (ids.includes('password')) return 'password';
    if (ids.includes('google.com')) return 'google';
    if (ids.includes('github.com')) return 'github';
    if (ids.includes('apple.com')) return 'apple';
    return null;
};

export const reauthenticateCurrentUser = async (password?: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('not-signed-in');
    const method = getReauthMethod();
    if (method === 'password') {
        if (!user.email || !password) throw new Error('password-required');
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else if (method === 'google') {
        await reauthenticateWithProvider(user, new GoogleAuthProvider());
    } else if (method === 'github') {
        await reauthenticateWithProvider(user, new GithubAuthProvider());
    } else if (method === 'apple') {
        await reauthenticateWithProvider(user, new OAuthProvider('apple.com'));
    }
    // Force a fresh ID token so the backend sees the new auth_time (desktop re-auth replaces the User object).
    await (auth.currentUser ?? user).getIdToken(true);
};

export const signOutAfterAccountDeletion = async (): Promise<void> => {
    try {
        await signOut(auth);
    } catch {
        // The auth user no longer exists; the local session is cleared on redirect anyway.
    }
    window.location.assign('/login');
};
