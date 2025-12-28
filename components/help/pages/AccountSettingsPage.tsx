import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex } from '../helpCenterTypes';

export const accountSettingsSections: HelpCenterSectionIndex[] = [
    { id: 'team-roles', title: 'Team roles', summary: 'Define access and responsibility.', content: 'Roles control what members can view and edit.', keywords: ['roles', 'permissions', 'access'] },
    { id: 'role-permissions', title: 'Role permissions matrix', summary: 'Detailed permission breakdown.', content: 'Complete permission table for each role.', keywords: ['permissions', 'matrix', 'access'] },
    { id: 'workspace-settings', title: 'Workspace settings', summary: 'Workspace-wide preferences.', content: 'Manage integrations, branding, and policies.', keywords: ['workspace', 'integrations', 'settings'] },
    { id: 'groups', title: 'Groups', summary: 'Organize team into groups.', content: 'Create groups for visibility and access.', keywords: ['groups', 'teams', 'organization'] },
    { id: 'profile-preferences', title: 'Profile and preferences', summary: 'Personalize your experience.', content: 'Update profile and visibility.', keywords: ['profile', 'preferences'] },
    { id: 'notifications', title: 'Notifications', summary: 'Stay informed.', content: 'Adjust notification preferences.', keywords: ['notifications', 'alerts'] },
    { id: 'integrations', title: 'Integrations', summary: 'Connect external tools.', content: 'Setup guides for integrations.', keywords: ['integrations', 'github', 'connect'] }
];

const RoleBadge = ({ label, color }: { label: string; color: string }) => (
    <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${color}`}>{label}</span>
);

const RoleCard = ({ role, description, permissions, color }: { role: string; description: string; permissions: string[]; color: string }) => (
    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
        <div className="flex items-center gap-3 mb-3"><RoleBadge label={role} color={color} /></div>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">{description}</p>
        <div className="space-y-1">{permissions.map((p, i) => <div key={i} className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><span className="material-symbols-outlined text-[14px] text-emerald-500">check</span>{p}</div>)}</div>
    </div>
);

const PermissionRow = ({ feature, owner, admin, member, viewer }: { feature: string; owner: boolean; admin: boolean; member: boolean; viewer: boolean }) => (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-[var(--color-surface-border)] last:border-0 items-center">
        <div className="text-sm text-[var(--color-text-main)]">{feature}</div>
        {[owner, admin, member, viewer].map((v, i) => <div key={i} className="text-center"><span className={`material-symbols-outlined text-[16px] ${v ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>{v ? 'check_circle' : 'cancel'}</span></div>)}
    </div>
);

const SettingCard = ({ icon, name, description }: { icon: string; name: string; description: string }) => (
    <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">{icon}</span>
        <div><div className="text-sm font-bold text-[var(--color-text-main)]">{name}</div><p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p></div>
    </div>
);

const NotificationRow = ({ type, inApp, email, description }: { type: string; inApp: boolean; email: boolean; description: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-surface-border)] last:border-0">
        <div className="flex-1"><div className="text-sm font-medium text-[var(--color-text-main)]">{type}</div><div className="text-xs text-[var(--color-text-muted)]">{description}</div></div>
        <div className="flex items-center gap-4">{inApp && <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[10px] text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">In-App</span>}{email && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[10px] text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Email</span>}</div>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = { tip: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200', warning: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-200', info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/40 dark:bg-sky-900/20 dark:text-sky-200' };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

export const AccountSettingsPage = (_props: HelpCenterPageProps) => (
    <div className="px-6 py-6 space-y-10">
        <div className="rounded-[28px] border border-[var(--color-surface-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Team and Settings</div>
            <h2 className="text-3xl font-bold text-[var(--color-text-main)] mt-3">Keep Access and Preferences Aligned</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-3 leading-relaxed max-w-2xl">Manage roles, permissions, integrations, and personal preferences to keep your workspace secure and efficient.</p>
        </div>

        <section data-section-id="team-roles" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Access</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Team Roles</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Roles define what members can view and edit.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RoleCard role="Owner" color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" description="Full control of workspace." permissions={['Full settings access', 'Manage all members', 'Delete workspace', 'Transfer ownership']} />
                <RoleCard role="Admin" color="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" description="Settings and member management." permissions={['Edit settings', 'Manage members', 'Create projects', 'View all data']} />
                <RoleCard role="Member" color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" description="Create and edit content." permissions={['Create projects', 'Edit own content', 'Comment', 'View assigned']} />
                <RoleCard role="Viewer" color="bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300" description="Read-only access." permissions={['View projects', 'View comments', 'Cannot edit']} />
            </div>
            <Callout type="tip">If someone needs to review work but not edit it, Viewer is the safest default.</Callout>
        </section>

        <section data-section-id="role-permissions" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Matrix</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Role Permissions Matrix</h3></div>
            <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5 overflow-x-auto">
                <div className="grid grid-cols-5 gap-2 py-2 border-b border-[var(--color-surface-border)] mb-2">
                    <div className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Feature</div>
                    <div className="text-xs font-bold uppercase text-[var(--color-text-muted)] text-center">Owner</div>
                    <div className="text-xs font-bold uppercase text-[var(--color-text-muted)] text-center">Admin</div>
                    <div className="text-xs font-bold uppercase text-[var(--color-text-muted)] text-center">Member</div>
                    <div className="text-xs font-bold uppercase text-[var(--color-text-muted)] text-center">Viewer</div>
                </div>
                <PermissionRow feature="Manage workspace settings" owner={true} admin={true} member={false} viewer={false} />
                <PermissionRow feature="Manage billing" owner={true} admin={false} member={false} viewer={false} />
                <PermissionRow feature="Invite members" owner={true} admin={true} member={false} viewer={false} />
                <PermissionRow feature="Remove members" owner={true} admin={true} member={false} viewer={false} />
                <PermissionRow feature="Create projects" owner={true} admin={true} member={true} viewer={false} />
                <PermissionRow feature="Delete projects" owner={true} admin={true} member={false} viewer={false} />
                <PermissionRow feature="Create/edit tasks" owner={true} admin={true} member={true} viewer={false} />
                <PermissionRow feature="View all projects" owner={true} admin={true} member={true} viewer={true} />
                <PermissionRow feature="Comment" owner={true} admin={true} member={true} viewer={false} />
            </div>
        </section>

        <section data-section-id="workspace-settings" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Workspace</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Workspace Settings</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SettingCard icon="badge" name="Workspace Name" description="Display name and URL slug" />
                <SettingCard icon="palette" name="Branding" description="Logo, colors, and theme" />
                <SettingCard icon="language" name="Timezone" description="Default timezone for dates" />
                <SettingCard icon="calendar_today" name="Week Start" description="Sunday or Monday" />
                <SettingCard icon="verified_user" name="Security" description="2FA requirements, session policy" />
                <SettingCard icon="receipt_long" name="Billing" description="Plan, invoices, payment method" />
            </div>
        </section>

        <section data-section-id="groups" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Organization</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Groups</h3><p className="text-sm text-[var(--color-text-muted)] mt-2">Organize team members for visibility and access control.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Use Cases</div>
                    <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>Department-based visibility (Marketing, Engineering)</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>Project-specific access (Client A Team)</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>Cross-functional teams (Launch Squad)</div>
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">How Groups Work</div>
                    <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-sky-500">group_add</span>Create groups in Settings → Groups</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-sky-500">person_add</span>Add members to groups</div>
                        <div className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-sky-500">visibility</span>Set project visibility to specific groups</div>
                    </div>
                </div>
            </div>
        </section>

        <section data-section-id="profile-preferences" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Personal</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Profile and Preferences</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SettingCard icon="person" name="Display Name" description="How your name appears" />
                <SettingCard icon="photo_camera" name="Avatar" description="Profile photo" />
                <SettingCard icon="work" name="Title/Role" description="Your role in the organization" />
                <SettingCard icon="psychology" name="Skills" description="Areas of expertise" />
                <SettingCard icon="visibility" name="Privacy" description="What others can see" />
                <SettingCard icon="dark_mode" name="Theme" description="Light, dark, or system" />
            </div>
        </section>

        <section data-section-id="notifications" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Signals</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Notifications</h3></div>
            <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-5">
                <NotificationRow type="Mentions" inApp={true} email={true} description="When someone @mentions you" />
                <NotificationRow type="Assignments" inApp={true} email={true} description="When assigned to a task or issue" />
                <NotificationRow type="Comments" inApp={true} email={false} description="Replies to your comments" />
                <NotificationRow type="Approvals" inApp={true} email={true} description="Review requests and decisions" />
                <NotificationRow type="Status Changes" inApp={true} email={false} description="When items you own change status" />
                <NotificationRow type="Due Dates" inApp={true} email={true} description="Upcoming and overdue reminders" />
            </div>
            <Callout type="info">Reduce noise by keeping statuses accurate and consolidating updates into fewer comments.</Callout>
        </section>

        <section data-section-id="integrations" className="help-section rounded-3xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-6 space-y-6">
            <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--color-text-muted)]">Connect</div><h3 className="text-xl font-bold text-[var(--color-text-main)] mt-2">Integrations</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined text-[20px] text-white">code</span></div><span className="text-sm font-bold text-[var(--color-text-main)]">GitHub</span></div>
                    <p className="text-sm text-[var(--color-text-muted)] mb-3">Sync repositories, link PRs to tasks, and track development progress.</p>
                    <div className="text-xs text-[var(--color-text-muted)]"><strong>Setup:</strong> Settings → Integrations → GitHub → Authorize</div>
                </div>
                <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-5">
                    <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"><span className="material-symbols-outlined text-[20px] text-white">hub</span></div><span className="text-sm font-bold text-[var(--color-text-main)]">Coming Soon</span></div>
                    <p className="text-sm text-[var(--color-text-muted)]">More integrations including Slack, Figma, and calendar sync are on the roadmap.</p>
                </div>
            </div>
        </section>
    </div>
);
