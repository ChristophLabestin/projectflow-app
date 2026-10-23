import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { readOnboarding, writeOnboarding, writeOnboardingSurvey, type OnboardingState } from '../services/domain/userPrivateData';
import type { OnboardingSurvey } from '../utils/onboardingSurvey';

// Shared across the welcome dialog and the dashboard checklist so both react to
// the same update without refetching.
let cache: { uid: string; state: OnboardingState | null } | null = null;
const listeners = new Set<(state: OnboardingState | null) => void>();

const publish = (uid: string, state: OnboardingState | null) => {
    cache = { uid, state };
    listeners.forEach((listener) => listener(state));
};

/** First-run state; `null` for accounts that predate onboarding (they see nothing). */
export const useOnboarding = () => {
    const { user } = useAuth();
    const uid = user?.uid;
    const [state, setState] = useState<OnboardingState | null>(cache && cache.uid === uid ? cache.state : null);
    const [loaded, setLoaded] = useState(Boolean(cache && cache.uid === uid));

    useEffect(() => {
        if (!uid) return;
        const listener = (next: OnboardingState | null) => setState(next);
        listeners.add(listener);
        if (!cache || cache.uid !== uid) {
            readOnboarding(uid)
                .then((next) => publish(uid, next))
                .catch(() => publish(uid, null))
                .finally(() => setLoaded(true));
        } else {
            setLoaded(true);
        }
        return () => { listeners.delete(listener); };
    }, [uid]);

    const update = useCallback(async (patch: OnboardingState) => {
        if (!uid) return;
        publish(uid, { ...(cache?.state || {}), ...patch });
        await writeOnboarding(uid, patch).catch((error) => console.warn('Could not save onboarding state', error));
    }, [uid]);

    const saveSurvey = useCallback(async (survey: Omit<OnboardingSurvey, 'platform' | 'answeredAt'>) => {
        if (!uid) return;
        publish(uid, { ...(cache?.state || {}), survey: { ...survey, platform: 'web' } });
        await writeOnboardingSurvey(uid, survey).catch((error) => console.warn('Could not save onboarding survey', error));
    }, [uid]);

    return { onboarding: state, loaded, update, saveSurvey };
};
