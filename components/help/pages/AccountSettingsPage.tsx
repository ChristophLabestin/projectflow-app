import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const accountSettingsSections: HelpCenterSectionIndex[] = [
    {
        id: 'team-roles',
        title: 'Team roles',
        summary: 'Define access and responsibility.',
        content: 'Roles control what members can view and edit.',
        keywords: ['roles', 'permissions', 'access']
    },
    {
        id: 'workspace-settings',
        title: 'Workspace settings',
        summary: 'Configure workspace-wide preferences.',
        content: 'Settings manage integrations, branding, and policies.',
        keywords: ['workspace', 'integrations', 'settings']
    },
    {
        id: 'profile-preferences',
        title: 'Profile and preferences',
        summary: 'Personalize your experience.',
        content: 'Update profile details and visibility settings.',
        keywords: ['profile', 'privacy', 'preferences']
    },
    {
        id: 'notifications',
        title: 'Notifications',
        summary: 'Stay informed without overload.',
        content: 'Adjust notification preferences to fit your workflow.',
        keywords: ['notifications', 'alerts']
    }
];

const SectionHeader = ({
    eyebrow,
    title,
    icon
}: {
    eyebrow: string;
    title: string;
    icon: string;
}) => (
    <div className="flex items-start justify-between gap-4">
        <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                {eyebrow}
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">{title}</h3>
        </div>
        <span className="material-symbols-outlined text-[20px] text-[var(--color-text-subtle)]">
            {icon}
        </span>
    </div>
);

const InfoCard = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 text-sm text-[var(--color-text-muted)] leading-relaxed">
        {children}
    </div>
);

const Callout = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
        <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            <div>{children}</div>
        </div>
    </div>
);

const RoleBadge = ({ label }: { label: string }) => (
    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)]">
        {label}
    </span>
);

export const AccountSettingsPage = ({ sections, activeSectionId, onSectionSelect }: HelpCenterPageProps) => {
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-6">
                <div className="rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">
                        Team and Settings
                    </div>
                    <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">
                        Keep access and preferences aligned
                    </h2>
                    <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed">
                        Team and Settings keep your workspace secure, consistent, and easy to manage. Roles define who
                        can edit or manage projects, while personal preferences control how information appears to
                        others and how you stay informed.
                    </p>
                </div>

                <aside className="space-y-4">
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            In this guide
                        </div>
                        <div className="mt-3 space-y-2">
                            {sections.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => onSectionSelect(section.id)}
                                    className={`w-full text-left text-sm font-medium transition-colors ${activeSectionId === section.id
                                        ? 'text-[var(--color-primary)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                        }`}
                                >
                                    {section.title}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 text-sm text-[var(--color-text-muted)]">
                        Clear roles reduce approval bottlenecks. Update access before a project scales to avoid
                        confusion later.
                    </div>
                </aside>
            </div>

            <section data-section-id="team-roles" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Access" title="Team roles" icon="group" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Roles define what members can view and edit in the workspace and inside projects. Assign roles
                    based on responsibility, not just seniority, so that approvals and edits stay clear.
                </p>
                <div className="flex flex-wrap gap-2">
                    <RoleBadge label="Owner" />
                    <RoleBadge label="Admin" />
                    <RoleBadge label="Member" />
                    <RoleBadge label="Guest" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Workspace roles</div>
                        <p className="mt-2">
                            Workspace roles control settings, member management, and access to all projects.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Project roles</div>
                        <p className="mt-2">
                            Project roles focus on what someone can edit inside a single project. Use Viewer roles for
                            stakeholders who only need visibility.
                        </p>
                    </InfoCard>
                </div>
                <Callout>
                    If someone needs to review work but not edit it, a Viewer role is usually the safest default.
                </Callout>
            </section>

            <section data-section-id="workspace-settings" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Workspace" title="Workspace settings" icon="settings" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Workspace settings control how your organization operates inside ProjectFlow. Use this area to
                    manage integrations, branding, and policies so every project follows the same standards.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Integrations</div>
                        <p className="mt-2">
                            Connect external tools such as GitHub to keep development updates and issue tracking in
                            sync with project work.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Branding</div>
                        <p className="mt-2">
                            Keep naming, colors, and structure consistent so teams recognize the workspace instantly.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="profile-preferences" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-5">
                <SectionHeader eyebrow="Personal" title="Profile and preferences" icon="person" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Your profile is how others see you in the workspace. Keep it accurate so teammates know who to
                    contact, and adjust privacy settings so you are comfortable sharing details like skills or bio.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Visibility</div>
                        <p className="mt-2">
                            Choose what is public, team-only, or private. This is especially useful for skills and bio
                            fields.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Presence</div>
                        <p className="mt-2">
                            Your status signals availability to teammates. Keep it updated if you rely on it for
                            handoffs.
                        </p>
                    </InfoCard>
                </div>
            </section>

            <section data-section-id="notifications" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-5">
                <SectionHeader eyebrow="Signals" title="Notifications" icon="notifications" />
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    Notifications should highlight what matters without creating noise. Focus on updates that change
                    decisions: approvals, due dates, and ownership changes.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Stay informed</div>
                        <p className="mt-2">
                            Keep alerts for approvals, mentions, and critical changes so you never miss a decision.
                        </p>
                    </InfoCard>
                    <InfoCard>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Reduce noise</div>
                        <p className="mt-2">
                            Mute low-signal notifications and rely on weekly reviews for non-urgent updates.
                        </p>
                    </InfoCard>
                </div>
                <Callout>
                    If you receive too many notifications, reduce noise at the source by keeping statuses accurate and
                    consolidating updates into fewer comments.
                </Callout>
            </section>
        </div>
    );
};
