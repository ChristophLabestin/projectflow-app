import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { HelpCenterPageProps, HelpCenterSectionsBuilder } from '../helpCenterTypes';
import { splitHelpKeywords } from '../helpCenterContent';

const SECTION_IDS = ['team-roles', 'role-permissions', 'workspace-settings', 'groups', 'profile-preferences', 'notifications', 'integrations'] as const;

export const getAccountSettingsSections: HelpCenterSectionsBuilder = t =>
    SECTION_IDS.map(id => ({
        id,
        title: t(`help.accountSettings.sections.${id}.title`),
        summary: t(`help.accountSettings.sections.${id}.summary`),
        content: t(`help.accountSettings.sections.${id}.content`),
        keywords: splitHelpKeywords(t(`help.accountSettings.sections.${id}.keywords`))
    }));

const RoleBadge = ({ label, color }: { label: string; color: string }) => (
    <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${color}`}>{label}</span>
);

const RoleCard = ({ role, description, permissions, color }: { role: string; description: string; permissions: string[]; color: string }) => (
    <div className="rounded-2xl border border-surface bg-card p-5">
        <div className="flex items-center gap-3 mb-3"><RoleBadge label={role} color={color} /></div>
        <p className="text-sm text-muted mb-3">{description}</p>
        <div className="space-y-1">{permissions.map((p, i) => <div key={i} className="flex items-center gap-2 text-xs text-muted"><span className="material-symbols-outlined text-[14px] text-[var(--brand-green-text)]">check</span>{p}</div>)}</div>
    </div>
);

const PermissionRow = ({ feature, owner, admin, member, viewer }: { feature: string; owner: boolean; admin: boolean; member: boolean; viewer: boolean }) => (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-surface last:border-0 items-center">
        <div className="text-sm text-main">{feature}</div>
        {[owner, admin, member, viewer].map((v, i) => <div key={i} className="text-center"><span className={`material-symbols-outlined text-[16px] ${v ? 'text-[var(--brand-green-text)]' : 'text-subtle'}`}>{v ? 'check_circle' : 'cancel'}</span></div>)}
    </div>
);

const SettingCard = ({ icon, name, description }: { icon: string; name: string; description: string }) => (
    <div className="rounded-xl border border-surface bg-card p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
        <div><div className="text-sm font-bold text-main">{name}</div><p className="text-xs text-muted mt-1">{description}</p></div>
    </div>
);

const NotificationRow = ({ type, inApp, email, description, inAppLabel, emailLabel }: { type: string; inApp: boolean; email: boolean; description: string; inAppLabel: string; emailLabel: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-surface last:border-0">
        <div className="flex-1"><div className="text-sm font-medium text-main">{type}</div><div className="text-xs text-muted">{description}</div></div>
        <div className="flex items-center gap-4">{inApp && <span className="px-2 py-0.5 rounded-full bg-[rgba(var(--brand-blue-rgb),0.1)] text-[10px] text-[var(--brand-blue-text)]">{inAppLabel}</span>}{email && <span className="px-2 py-0.5 rounded-full bg-[rgba(var(--brand-violet-rgb),0.1)] text-[10px] text-[var(--brand-violet-text)]">{emailLabel}</span>}</div>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = {
        tip: 'border-[rgba(var(--brand-amber-rgb),0.3)] bg-[rgba(var(--brand-amber-rgb),0.1)] text-[var(--brand-amber-text)]',
        warning: 'border-[rgba(var(--status-blocked-rgb),0.3)] bg-[rgba(var(--status-blocked-rgb),0.1)] text-[var(--color-status-blocked-text)]',
        info: 'border-[rgba(var(--brand-blue-rgb),0.3)] bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)]'
    };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}><div className="flex items-start gap-2"><span className="material-symbols-outlined text-[18px]">{icons[type]}</span><div>{children}</div></div></div>;
};

const ROLES = [
    { id: 'owner', color: 'bg-[rgba(var(--brand-violet-rgb),0.1)] text-[var(--brand-violet-text)]', perms: ['settings', 'members', 'delete', 'transfer'] },
    { id: 'admin', color: 'bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)]', perms: ['settings', 'members', 'projects', 'data'] },
    { id: 'member', color: 'bg-[rgba(var(--brand-green-rgb),0.1)] text-[var(--brand-green-text)]', perms: ['projects', 'own', 'comment', 'assigned'] },
    { id: 'viewer', color: 'bg-surface-hover text-muted', perms: ['projects', 'comments', 'noEdit'] }
];

const PERMISSION_ROWS: Array<{ id: string; values: [boolean, boolean, boolean, boolean] }> = [
    { id: 'workspaceSettings', values: [true, true, false, false] },
    { id: 'billing', values: [true, false, false, false] },
    { id: 'invite', values: [true, true, false, false] },
    { id: 'remove', values: [true, true, false, false] },
    { id: 'createProjects', values: [true, true, true, false] },
    { id: 'deleteProjects', values: [true, true, false, false] },
    { id: 'tasks', values: [true, true, true, false] },
    { id: 'viewAll', values: [true, true, true, true] },
    { id: 'comment', values: [true, true, true, false] }
];

const WORKSPACE_SETTINGS = [
    { id: 'name', icon: 'badge' },
    { id: 'branding', icon: 'palette' },
    { id: 'timezone', icon: 'language' },
    { id: 'weekStart', icon: 'calendar_today' },
    { id: 'security', icon: 'verified_user' },
    { id: 'billing', icon: 'receipt_long' }
];

const GROUP_USE_CASES = ['department', 'project', 'crossFunctional'];
const GROUP_STEPS = [
    { id: 'create', icon: 'group_add' },
    { id: 'add', icon: 'person_add' },
    { id: 'visibility', icon: 'visibility' }
];

const PROFILE_SETTINGS = [
    { id: 'displayName', icon: 'person' },
    { id: 'avatar', icon: 'photo_camera' },
    { id: 'title', icon: 'work' },
    { id: 'skills', icon: 'psychology' },
    { id: 'privacy', icon: 'visibility' },
    { id: 'theme', icon: 'dark_mode' }
];

const NOTIFICATIONS = [
    { id: 'mentions', email: true },
    { id: 'assignments', email: true },
    { id: 'comments', email: false },
    { id: 'approvals', email: true },
    { id: 'status', email: false },
    { id: 'dueDates', email: true }
];

export const AccountSettingsPage = (_props: HelpCenterPageProps) => {
    const { t } = useLanguage();
    const p = 'help.accountSettings.';
    return (
        <div className="px-6 py-6 space-y-10">
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}hero.eyebrow`)}</div>
                <h2 className="text-3xl font-bold text-main mt-3">{t(`${p}hero.title`)}</h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">{t(`${p}hero.description`)}</p>
            </div>

            <section data-section-id="team-roles" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}roles.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}roles.title`)}</h3><p className="text-sm text-muted mt-2">{t(`${p}roles.description`)}</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {ROLES.map(r => (
                        <RoleCard key={r.id} role={t(`${p}roles.${r.id}.name`)} color={r.color} description={t(`${p}roles.${r.id}.description`)} permissions={r.perms.map(perm => t(`${p}roles.${r.id}.perms.${perm}`))} />
                    ))}
                </div>
                <Callout type="tip">{t(`${p}roles.tip`)}</Callout>
            </section>

            <section data-section-id="role-permissions" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}matrix.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}matrix.title`)}</h3></div>
                <div className="rounded-2xl border border-surface bg-surface p-5 overflow-x-auto">
                    <div className="grid grid-cols-5 gap-2 py-2 border-b border-surface mb-2">
                        <div className="text-xs font-bold uppercase text-muted">{t(`${p}matrix.feature`)}</div>
                        {ROLES.map(r => <div key={r.id} className="text-xs font-bold uppercase text-muted text-center">{t(`${p}roles.${r.id}.name`)}</div>)}
                    </div>
                    {PERMISSION_ROWS.map(row => (
                        <PermissionRow key={row.id} feature={t(`${p}matrix.rows.${row.id}`)} owner={row.values[0]} admin={row.values[1]} member={row.values[2]} viewer={row.values[3]} />
                    ))}
                </div>
            </section>

            <section data-section-id="workspace-settings" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}workspace.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}workspace.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {WORKSPACE_SETTINGS.map(s => <SettingCard key={s.id} icon={s.icon} name={t(`${p}workspace.${s.id}.name`)} description={t(`${p}workspace.${s.id}.description`)} />)}
                </div>
            </section>

            <section data-section-id="groups" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}groups.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}groups.title`)}</h3><p className="text-sm text-muted mt-2">{t(`${p}groups.description`)}</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}groups.useCasesTitle`)}</div>
                        <div className="space-y-3 text-sm text-muted">
                            {GROUP_USE_CASES.map(u => <div key={u} className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-primary">check</span>{t(`${p}groups.useCases.${u}`)}</div>)}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-surface bg-surface p-5">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{t(`${p}groups.howTitle`)}</div>
                        <div className="space-y-3 text-sm text-muted">
                            {GROUP_STEPS.map(s => <div key={s.id} className="flex items-start gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--brand-blue-text)]">{s.icon}</span>{t(`${p}groups.how.${s.id}`)}</div>)}
                        </div>
                    </div>
                </div>
            </section>

            <section data-section-id="profile-preferences" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}profile.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}profile.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {PROFILE_SETTINGS.map(s => <SettingCard key={s.id} icon={s.icon} name={t(`${p}profile.${s.id}.name`)} description={t(`${p}profile.${s.id}.description`)} />)}
                </div>
            </section>

            <section data-section-id="notifications" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}notifications.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}notifications.title`)}</h3></div>
                <div className="rounded-2xl border border-surface bg-surface p-5">
                    {NOTIFICATIONS.map(n => (
                        <NotificationRow key={n.id} type={t(`${p}notifications.${n.id}.name`)} inApp={true} email={n.email} description={t(`${p}notifications.${n.id}.description`)} inAppLabel={t(`${p}notifications.channelInApp`)} emailLabel={t(`${p}notifications.channelEmail`)} />
                    ))}
                </div>
                <Callout type="info">{t(`${p}notifications.tip`)}</Callout>
            </section>

            <section data-section-id="integrations" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t(`${p}integrations.eyebrow`)}</div><h3 className="text-xl font-bold text-main mt-2">{t(`${p}integrations.title`)}</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center"><span className="material-symbols-outlined text-[20px] text-main">code</span></div><span className="text-sm font-bold text-main">GitHub</span></div>
                        <p className="text-sm text-muted mb-3">{t(`${p}integrations.github.description`)}</p>
                        <div className="text-xs text-muted"><strong>{t(`${p}integrations.github.setupLabel`)}</strong> {t(`${p}integrations.github.setupSteps`)}</div>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-violet)] to-[var(--brand-blue)] flex items-center justify-center"><span className="material-symbols-outlined text-[20px] text-on-primary">hub</span></div><span className="text-sm font-bold text-main">{t(`${p}integrations.soon.title`)}</span></div>
                        <p className="text-sm text-muted">{t(`${p}integrations.soon.description`)}</p>
                    </div>
                </div>
            </section>
        </div>
    );
};
