/** Shapes of brain/plans/newsletter-contract.md (adminApi `newsletter.*`). */
export type ListName = 'waitlist' | 'newsletter';
export type ListStatus = 'pending' | 'confirmed' | 'unsubscribed' | 'bounced';
export type Membership = { status: ListStatus; source: string; requestedAt: number | null; confirmedAt: number | null; unsubscribedAt: number | null; bouncedAt: number | null; consentVersion: string | null } | null;
export type Subscriber = { id: string; email: string; name: string; lang: 'de' | 'en'; source: string; interest: string | null; uid: string | null; status: string; lists: Record<ListName, Membership>; createdAt: number | null; updatedAt: number | null };
export type Audience = { list: ListName; lang: 'de' | 'en' | null; appUsersOnly: boolean; source: string | null };
export type Variant = { subject: string; preheader: string; markdown: string };
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'canceled' | 'failed';
export type Campaign = {
    id: string; title: string; status: CampaignStatus; defaultLang: 'de' | 'en'; variants: Partial<Record<'de' | 'en', Variant>>; audience: Audience;
    scheduledAt: number | null; startedAt: number | null; finishedAt: number | null; createdAt: number | null; updatedAt: number | null; createdBy: string | null;
    stats: { recipients?: number; sent?: number; failed?: number; skipped?: number; suppressed?: number; unsubscribed?: number; ses?: Record<string, number> };
    lastTest: { at: number; emails: string[] } | null;
};

export const LIST_LABEL: Record<ListName, string> = { waitlist: 'Warteliste', newsletter: 'Newsletter' };
export const STATUS_LABEL: Record<string, string> = { pending: 'unbestätigt', confirmed: 'bestätigt', unsubscribed: 'abgemeldet', bounced: 'Bounce' };
export const STATUS_TONE: Record<string, 'green' | 'amber' | 'neutral' | 'red' | 'blue' | 'violet'> = { pending: 'amber', confirmed: 'green', unsubscribed: 'neutral', bounced: 'red' };
export const CAMPAIGN_LABEL: Record<CampaignStatus, string> = { draft: 'Entwurf', scheduled: 'geplant', sending: 'wird gesendet', sent: 'gesendet', canceled: 'abgebrochen', failed: 'fehlgeschlagen' };
export const CAMPAIGN_TONE: Record<CampaignStatus, 'green' | 'amber' | 'neutral' | 'red' | 'blue' | 'violet'> = { draft: 'neutral', scheduled: 'blue', sending: 'violet', sent: 'green', canceled: 'neutral', failed: 'red' };
export const SOURCE_LABEL: Record<string, string> = { landing: 'Landing', app: 'App', onboarding: 'Onboarding', admin: 'Admin', legacy: 'Altbestand' };
