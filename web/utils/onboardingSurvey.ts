import type { ProjectTemplateId } from '../types';

/**
 * Onboarding survey contract shared with the iOS app. Option ids are stored in
 * `users/{uid}/private/onboarding.survey` and aggregated by `getOnboardingStats`;
 * never rename them. Labels live in the locales as `onboardingSurvey.<question>.<id>`.
 */
export const SURVEY_OPTIONS = {
    role: ['founder', 'project_manager', 'developer', 'designer', 'marketing', 'agency_freelancer', 'other'],
    useCases: ['client_projects', 'product_development', 'startup', 'marketing', 'team_organization', 'personal'],
    teamSize: ['solo', '2_5', '6_20', '21_50', '50_plus'],
    industry: ['software', 'agency', 'ecommerce', 'consulting', 'education', 'other'],
    source: ['google', 'app_store', 'linkedin', 'instagram_tiktok', 'referral', 'article', 'event', 'other'],
    previousTool: ['asana', 'trello', 'notion', 'jira', 'clickup', 'monday', 'spreadsheet', 'none', 'other'],
} as const;

export type SurveyQuestion = keyof typeof SURVEY_OPTIONS;
export const SURVEY_QUESTIONS = Object.keys(SURVEY_OPTIONS) as SurveyQuestion[];

export type OnboardingSurvey = {
    role?: string;
    useCases?: string[];
    teamSize?: string;
    industry?: string;
    source?: string;
    previousTool?: string;
    platform: 'web' | 'ios';
    answeredAt?: unknown;
};

// First match wins.
const TEMPLATE_BY_USE_CASE: Array<[string, ProjectTemplateId]> = [
    ['startup', 'startup_company_formation'],
    ['client_projects', 'client_delivery'],
    ['product_development', 'software_release'],
    ['marketing', 'marketing_campaign'],
    ['team_organization', 'internal_operations'],
    ['personal', 'blank'],
];

/** Project template suggested by the onboarding use cases, or null without answers. */
export const suggestTemplateId = (useCases?: string[] | null): ProjectTemplateId | null => {
    if (!useCases?.length) return null;
    return TEMPLATE_BY_USE_CASE.find(([useCase]) => useCases.includes(useCase))?.[1] ?? null;
};
