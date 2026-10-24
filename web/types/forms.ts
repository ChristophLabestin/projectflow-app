// Forms data model (brain/plans/forms-concept.md §4). Schema, answers and quota types live in the
// shared pure module utils/formsLogic.ts; these are the Firestore document shapes around them.

import type {
    FormAnswer,
    FormCondition,
    FormResponseStatus,
    FormSchema,
    FormStatus
} from '../utils/formsLogic';

export type FormAudience = 'public' | 'workspace';
export type FormLayout = 'classic' | 'oneByOne';
export type FormLanguage = 'de' | 'en';

export interface FormThemeBackground {
    type: 'color' | 'gradient' | 'image';
    color?: string;
    gradient?: { from: string; to: string; angle: number };
    imagePath?: string;
}

/** Full public-form theme (§7). Fonts come from a curated, self-hosted list (FORM_FONTS). */
export interface FormTheme {
    preset?: string;
    background: FormThemeBackground;
    surface: string;
    text: string;
    accent: string;
    accentText: string;
    font: string;
    radius: 0 | 8 | 16 | 24;
    fieldStyle: 'sunken' | 'filled' | 'underline';
    density: 'comfortable' | 'compact';
    logoPath?: string;
    coverPath?: string;
}

export interface FormTaskMapping {
    projectId: string;
    initiativeId?: string | null;
    mapping: {
        /** Field id or a template with {{fieldId}} placeholders. */
        title: string;
        description: string[];
        priority?: string | null;
        dueDate?: string | null;
        assigneeIds?: string | null;
        labels?: string | null;
    };
    defaults: { priority?: string; assigneeIds?: string[]; status?: string };
}

export interface FormSettings {
    closesAt?: number | null;
    maxResponses?: number | null;
    onePerMember?: boolean;
    allowGuests?: boolean;
    confirmation: { text?: string; redirectUrl?: string };
    /** Months (1, 3, 6, 12, 24) or null = keep forever. New forms start with 12. */
    retentionMonths: number | null;
    consent?: { text: string; url?: string } | null;
    notifyMemberIds: string[];
    respondentCopy: { enabled: boolean; emailFieldId?: string | null };
    aiTriage: { enabled: boolean; categories: string[] };
    hideBranding?: boolean;
}

export interface FormDoc {
    id: string;
    title: string;
    description?: string;
    status: FormStatus;
    ownerId: string;
    editorIds: string[];
    createdAt: number;
    updatedAt: number;
    audience: FormAudience;
    anonymous: boolean;
    layout: FormLayout;
    language: FormLanguage;
    draft: FormSchema;
    publishedVersion: number | null;
    shareToken: string | null;
    embed: { allowedOrigins: string[] };
    theme: FormTheme | { themeId: string };
    settings: FormSettings;
    actions: { createTask?: FormTaskMapping | null };
    counts: { responses: number; spam: number; lastResponseAt: number | null };
}

export interface FormResponseDoc {
    id: string;
    version: number;
    submittedAt: number;
    status: FormResponseStatus;
    answers: Record<string, FormAnswer>;
    respondent: { uid?: string; email?: string };
    meta: { source: 'link' | 'embed' | 'app' | 'ios'; locale?: string; durationMs?: number };
    taskRef?: { projectId: string; taskId: string } | null;
    triage?: { category?: string; priority?: string; summary?: string; spamScore?: number; lang?: string } | null;
    expireAt?: number | null;
}

/** Workspace legal details on the tenant doc; required before the first public form is published. */
export interface TenantLegal {
    controllerName?: string;
    privacyPolicyUrl?: string;
    imprintUrl?: string;
    contactEmail?: string;
}

export type { FormCondition };
