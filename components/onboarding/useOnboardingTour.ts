import { useCallback, useEffect, useState } from 'react';
import { auth } from '../../services/firebase';
import { getUserProfile, updateUserOnboardingStatus } from '../../services/dataService';

type UseOnboardingTourOptions = {
    storageKey?: string;
    enabled?: boolean;
    stepCount?: number;
    autoStart?: boolean;
};

const isOnboardingComplete = (state: any) => {
    if (!state) return false;
    if (state === true) return true;
    if (typeof state === 'string') {
        return state === 'completed' || state === 'skipped';
    }
    if (typeof state === 'object') {
        return state.status === 'completed' || state.status === 'skipped' || state.completed === true;
    }
    return false;
};

export const useOnboardingTour = (tourKey: string, options: UseOnboardingTourOptions = {}) => {
    const { storageKey = `onboarding_${tourKey}_v1`, enabled = true, stepCount, autoStart = false } = options;
    const [showWelcome, setShowWelcome] = useState(false);
    const [onboardingActive, setOnboardingActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        if (!enabled) return;
        let isMounted = true;

        const checkOnboarding = async () => {
            let localStatus: string | null = null;
            try {
                localStatus = localStorage.getItem(storageKey);
            } catch {
                // Ignore storage failures
            }
            if (localStatus) return;

            if (auth.currentUser?.uid) {
                try {
                    const profile = await getUserProfile(auth.currentUser.uid);
                    const onboardingState = profile?.preferences?.onboarding?.[tourKey];
                    if (!isOnboardingComplete(onboardingState) && isMounted) {
                        if (autoStart) {
                            setShowWelcome(false);
                            setOnboardingActive(true);
                            setStepIndex(0);
                        } else {
                            setShowWelcome(true);
                        }
                    }
                } catch (error) {
                    if (!isMounted) return;
                    if (autoStart) {
                        setShowWelcome(false);
                        setOnboardingActive(true);
                        setStepIndex(0);
                    } else {
                        setShowWelcome(true);
                    }
                    console.warn('Failed to load onboarding status', error);
                }
            } else if (isMounted) {
                if (autoStart) {
                    setShowWelcome(false);
                    setOnboardingActive(true);
                    setStepIndex(0);
                } else {
                    setShowWelcome(true);
                }
            }
        };

        void checkOnboarding();

        return () => {
            isMounted = false;
        };
    }, [autoStart, enabled, storageKey, tourKey]);

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
        setShowWelcome(false);
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
        setShowWelcome(false);
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
        showWelcome,
        onboardingActive,
        stepIndex,
        setStepIndex,
        start,
        skip,
        finish
    };
};
