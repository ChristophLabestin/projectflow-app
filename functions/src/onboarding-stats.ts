import { Timestamp } from 'firebase-admin/firestore';

import { db } from './init';

const MAX_SINCE_DAYS = 3650;

// Option ids of the onboarding survey (shared contract with web/ios; keep in sync
// with web/utils/onboardingSurvey.ts). Unknown ids are counted under "other".
const SINGLE_QUESTIONS = ['role', 'teamSize', 'industry', 'source', 'previousTool'] as const;
const MULTI_QUESTIONS = ['useCases'] as const;
const PLATFORMS = ['web', 'ios'] as const;

type Counts = Record<string, number>;
export type OnboardingStats = {
    total: number;
    sinceDays: number | null;
    platforms: Counts;
    questions: Record<string, Counts>;
};

/**
 * Aggregated onboarding survey answers (users/{uid}/private/onboarding.survey) for the admin console
 * (adminApi action `onboarding.stats`; the gate there checks the platform admin). `days` = answers per day.
 */
export const computeOnboardingStats = async (rawSinceDays: unknown): Promise<OnboardingStats & { days: Record<string, number> }> => {
    const rawDays = Number(rawSinceDays);
    const sinceDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), MAX_SINCE_DAYS) : null;
    const since = sinceDays ? Timestamp.fromMillis(Date.now() - sinceDays * 86_400_000) : Timestamp.fromMillis(0);

    const snapshot = await db.collectionGroup('private').where('survey.answeredAt', '>=', since).select('survey').get();

    const stats: OnboardingStats & { days: Record<string, number> } = {
        total: 0,
        sinceDays,
        platforms: Object.fromEntries(PLATFORMS.map((platform) => [platform, 0])),
        questions: {},
        days: {},
    };
    const bump = (counts: Counts, key: string) => { counts[key] = (counts[key] || 0) + 1; };

    snapshot.forEach((doc) => {
        const survey = doc.get('survey');
        if (!survey || typeof survey !== 'object') return;
        stats.total += 1;
        bump(stats.platforms, PLATFORMS.includes(survey.platform) ? survey.platform : 'other');
        const answeredAt = survey.answeredAt?.toMillis?.();
        if (answeredAt) bump(stats.days, new Date(answeredAt).toISOString().slice(0, 10));
        for (const question of SINGLE_QUESTIONS) {
            if (typeof survey[question] === 'string') bump((stats.questions[question] ||= {}), survey[question]);
        }
        for (const question of MULTI_QUESTIONS) {
            if (Array.isArray(survey[question])) {
                for (const value of new Set<unknown>(survey[question])) {
                    if (typeof value === 'string') bump((stats.questions[question] ||= {}), value);
                }
            }
        }
    });

    return stats;
};
