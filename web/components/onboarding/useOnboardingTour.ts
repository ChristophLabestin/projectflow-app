import { useCallback, useEffect, useState } from 'react';
import { auth } from '../../services/firebase';
import { updateUserOnboardingStatus } from '../../services/dataService';

type UseOnboardingTourOptions = {
    storageKey?: string;
    /** @deprecated Tours never auto-open; kept so existing callers compile. */
    enabled?: boolean;
    stepCount?: number;
    autoStart?: boolean;
};

export const useOnboardingTour = (tourKey: string, options: UseOnboardingTourOptions = {}) => {
    const { storageKey = `onboarding_${tourKey}_v1`, stepCount } = options;
    const [onboardingActive, setOnboardingActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    // Tours never open on their own; the first-run welcome dialog and the
    // dashboard "Getting started" checklist replaced the old welcome prompt.
    // Page tours start explicitly via `start()`.

    useEffect(() => {
        if (!onboardingActive || stepCount === undefined) return;
        if (stepCount <= 0) {
            setOnboardingActive(false);
            return;
        }
        if (stepIndex >= stepCount) {
            setStepIndex(Math.max(0, stepCount - 1));
        }
    }, [onboardingActive, stepCount, stepIndex]);

    const persistStatus = useCallback(async (status: 'completed' | 'skipped') => {
        setOnboardingActive(false);
        setStepIndex(0);
        try {
            localStorage.setItem(storageKey, status);
        } catch {
            // Ignore storage failures
        }
        if (auth.currentUser?.uid) {
            try {
                // Use the dedicated helper to ensure correct nested object structure
                await updateUserOnboardingStatus(auth.currentUser.uid, tourKey, status);
            } catch (error) {
                console.warn('Failed to update onboarding status', error);
            }
        }
    }, [storageKey, tourKey]);

    const start = useCallback(() => {
        setOnboardingActive(true);
        setStepIndex(0);
    }, []);

    const skip = useCallback(() => {
        void persistStatus('skipped');
    }, [persistStatus]);

    const finish = useCallback(() => {
        void persistStatus('completed');
    }, [persistStatus]);

    return {
        onboardingActive,
        stepIndex,
        setStepIndex,
        start,
        skip,
        finish
    };
};
