import { httpsCallable } from 'firebase/functions';

import { auth, functions } from './firebase';

export type OnboardingStats = {
    total: number;
    sinceDays: number | null;
    platforms: Record<string, number>;
    questions: Record<string, Record<string, number>>;
};

export const fetchOnboardingStats = async (sinceDays?: number): Promise<OnboardingStats> => {
    const fn = httpsCallable<{ sinceDays?: number }, OnboardingStats>(functions, 'getOnboardingStats');
    const result = await fn(sinceDays ? { sinceDays } : {});
    return result.data;
};

/** True when the signed-in user's token carries the `platformAdmin` custom claim. */
export const hasPlatformAdminClaim = async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    const token = await current.getIdTokenResult();
    return token.claims.platformAdmin === true;
};
