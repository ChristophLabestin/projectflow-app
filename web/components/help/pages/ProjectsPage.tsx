import React from 'react';
import type { HelpCenterPageProps, HelpCenterSectionIndex, HelpCenterSectionsBuilder } from '../helpCenterTypes';
import { splitHelpKeywords } from '../helpCenterContent';
import { useLanguage } from '../../../context/LanguageContext';

export const getProjectsSections: HelpCenterSectionsBuilder = t => [
    {
        id: 'project-fields',
        title: t('help.projects.sections.fields.title'),
        summary: t('help.projects.sections.fields.summary'),
        content: t('help.projects.sections.fields.content'),
        keywords: splitHelpKeywords(t('help.projects.sections.fields.keywords'))
    },
    {
        id: 'status-priority',
        title: t('help.projects.sections.status.title'),
        summary: t('help.projects.sections.status.summary'),
        content: t('help.projects.sections.status.content'),
        keywords: splitHelpKeywords(t('help.projects.sections.status.keywords'))
    },
    {
        id: 'health-signals',
        title: t('help.projects.sections.health.title'),
        summary: t('help.projects.sections.health.summary'),
        content: t('help.projects.sections.health.content'),
        keywords: splitHelpKeywords(t('help.projects.sections.health.keywords'))
    },
    {
        id: 'modules-catalog',
        title: t('help.projects.sections.modules.title'),
        summary: t('help.projects.sections.modules.summary'),
        content: t('help.projects.sections.modules.content'),
        keywords: splitHelpKeywords(t('help.projects.sections.modules.keywords'))
    },
    {
        id: 'visibility-access',
        title: t('help.projects.sections.visibility.title'),
        summary: t('help.projects.sections.visibility.summary'),
        content: t('help.projects.sections.visibility.content'),
        keywords: splitHelpKeywords(t('help.projects.sections.visibility.keywords'))
    },
    {
        id: 'project-overview',
        title: t('help.projects.sections.overview.title'),
        summary: t('help.projects.sections.overview.summary'),
        content: t('help.projects.sections.overview.content'),
        keywords: splitHelpKeywords(t('help.projects.sections.overview.keywords'))
    },
    {
        id: 'activity-tracking',
        title: t('help.projects.sections.activity.title'),
        summary: t('help.projects.sections.activity.summary'),
        content: t('help.projects.sections.activity.content'),
        keywords: splitHelpKeywords(t('help.projects.sections.activity.keywords'))
    }
] as HelpCenterSectionIndex[];

/* ─────────────────────────────────────────────────────────────
   LAYOUT COMPONENTS - Dashboard Style
───────────────────────────────────────────────────────────── */

const MetricCard = ({
    label,
    value,
    icon,
    color
}: {
    label: string;
    value: string;
    icon: string;
    color: 'blue' | 'green' | 'amber' | 'rose' | 'purple';
}) => {
    const colors = {
        blue: 'bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)] border-[rgba(var(--brand-blue-rgb),0.3)]',
        green: 'bg-[rgba(var(--brand-green-rgb),0.1)] text-[var(--brand-green-text)] border-[rgba(var(--brand-green-rgb),0.3)]',
        amber: 'bg-[rgba(var(--brand-amber-rgb),0.1)] text-[var(--brand-amber-text)] border-[rgba(var(--brand-amber-rgb),0.3)]',
        rose: 'bg-[rgba(var(--status-blocked-rgb),0.1)] text-[var(--color-status-blocked-text)] border-[rgba(var(--status-blocked-rgb),0.3)]',
        purple: 'bg-[rgba(var(--brand-violet-rgb),0.1)] text-[var(--brand-violet-text)] border-[rgba(var(--brand-violet-rgb),0.3)]'
    };
    return (
        <div className={`rounded-2xl border p-4 ${colors[color]}`}>
            <div className="flex items-center justify-between">
                <span className="material-symbols-outlined text-[24px]">{icon}</span>
                <span className="text-2xl font-bold">{value}</span>
            </div>
            <div className="text-xs font-medium mt-2 opacity-80">{label}</div>
        </div>
    );
};

const FieldRow = ({
    field,
    type,
    required,
    description
}: {
    field: string;
    type: string;
    required?: boolean;
    description: string;
}) => (
    <div className="flex items-start gap-4 py-3 border-b border-surface last:border-0">
        <div className="flex-shrink-0 w-[140px]">
            <span className="text-sm font-semibold text-main">{field}</span>
            {required && <span className="ml-1 text-[var(--color-status-blocked-text)] text-xs">*</span>}
        </div>
        <div className="flex-shrink-0 w-[80px]">
            <span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] font-medium text-muted">
                {type}
            </span>
        </div>
        <div className="flex-1 text-sm text-muted">{description}</div>
    </div>
);

const StatusBadge = ({
    status,
    color,
    description
}: {
    status: string;
    color: string;
    description: string;
}) => (
    <div className="rounded-xl border border-surface bg-card p-4">
        <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-sm font-bold text-main">{status}</span>
        </div>
        <p className="text-sm text-muted mt-2 leading-relaxed">{description}</p>
    </div>
);

const HealthGauge = ({
    level,
    textColor,
    barColor,
    label,
    triggers
}: {
    level: number;
    textColor: string;
    barColor: string;
    label: string;
    triggers: string[];
}) => {
    const { t } = useLanguage();
    return (
        <div className="rounded-2xl border border-surface bg-card p-5">
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-main">{label}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${textColor}`}>{level}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${level}%` }} />
            </div>
            <div className="mt-4 text-xs text-muted">
                <div className="font-semibold mb-2">{t('help.projects.health.triggeredBy')}</div>
                <ul className="space-y-1">
                    {triggers.map((trigger, i) => (
                        <li key={i} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-[var(--color-text-subtle)]" />
                            {trigger}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const ModuleCard = ({
    icon,
    name,
    description,
    features
}: {
    icon: string;
    name: string;
    description: string;
    features: string[];
}) => (
    <div className="rounded-2xl border border-surface bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
            </div>
            <div>
                <div className="text-sm font-bold text-main">{name}</div>
            </div>
        </div>
        <p className="text-sm text-muted leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2">
            {features.map((f, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-surface-hover text-[10px] font-medium text-muted">
                    {f}
                </span>
            ))}
        </div>
    </div>
);

const Callout = ({ type, children }: { type: 'tip' | 'warning' | 'info'; children: React.ReactNode }) => {
    const styles = {
        tip: 'border-[rgba(var(--brand-amber-rgb),0.3)] bg-[rgba(var(--brand-amber-rgb),0.1)] text-[var(--brand-amber-text)]',
        warning: 'border-[rgba(var(--status-blocked-rgb),0.3)] bg-[rgba(var(--status-blocked-rgb),0.1)] text-[var(--color-status-blocked-text)]',
        info: 'border-[rgba(var(--brand-blue-rgb),0.3)] bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)]'
    };
    const icons = { tip: 'lightbulb', warning: 'warning', info: 'info' };
    return (
        <div className={`rounded-2xl border p-4 text-[13px] ${styles[type]}`}>
            <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px]">{icons[type]}</span>
                <div>{children}</div>
            </div>
        </div>
    );
};

const OverviewCard = ({
    icon,
    title,
    items
}: {
    icon: string;
    title: string;
    items: { label: string; description: string }[];
}) => (
    <div className="rounded-2xl border border-surface bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
            <span className="text-sm font-bold text-main">{title}</span>
        </div>
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i}>
                    <div className="text-xs font-semibold text-main">{item.label}</div>
                    <div className="text-xs text-muted mt-1">{item.description}</div>
                </div>
            ))}
        </div>
    </div>
);

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────────────────────── */

export const ProjectsPage = (_props: HelpCenterPageProps) => {
    const { t } = useLanguage();
    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero Section */}
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
                    {t('help.projects.hero.eyebrow')}
                </div>
                <h2 className="text-3xl font-bold text-main mt-3">
                    {t('help.projects.hero.title')}
                </h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">
                    {t('help.projects.hero.body')}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <MetricCard label={t('help.projects.hero.metrics.activeTasks')} value="24" icon="checklist" color="blue" />
                    <MetricCard label={t('help.projects.hero.metrics.openIssues')} value="3" icon="report_problem" color="amber" />
                    <MetricCard label={t('help.projects.hero.metrics.milestones')} value="5" icon="flag" color="green" />
                    <MetricCard label={t('help.projects.hero.metrics.teamSize')} value="8" icon="group" color="purple" />
                </div>
            </div>

            <section data-section-id="project-fields" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.projects.fields.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.projects.fields.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.projects.fields.intro')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">list_alt</span>
                </div>


                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                        {t('help.projects.fields.coreTitle')}
                    </div>
                    <div className="space-y-0">
                        <FieldRow field={t('help.projects.fields.core.title.name')} type={t('help.projects.fields.types.text')} required description={t('help.projects.fields.core.title.desc')} />
                        <FieldRow field={t('help.projects.fields.core.description.name')} type={t('help.projects.fields.types.richText')} description={t('help.projects.fields.core.description.desc')} />
                        <FieldRow field={t('help.projects.fields.core.status.name')} type={t('help.projects.fields.types.select')} required description={t('help.projects.fields.core.status.desc')} />
                        <FieldRow field={t('help.projects.fields.core.priority.name')} type={t('help.projects.fields.types.select')} description={t('help.projects.fields.core.priority.desc')} />
                        <FieldRow field={t('help.projects.fields.core.owner.name')} type={t('help.projects.fields.types.user')} description={t('help.projects.fields.core.owner.desc')} />
                        <FieldRow field={t('help.projects.fields.core.startDate.name')} type={t('help.projects.fields.types.date')} description={t('help.projects.fields.core.startDate.desc')} />
                        <FieldRow field={t('help.projects.fields.core.dueDate.name')} type={t('help.projects.fields.types.date')} description={t('help.projects.fields.core.dueDate.desc')} />
                        <FieldRow field={t('help.projects.fields.core.tags.name')} type={t('help.projects.fields.types.multiSelect')} description={t('help.projects.fields.core.tags.desc')} />
                    </div>
                </div>

                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                        {t('help.projects.fields.settingsTitle')}
                    </div>
                    <div className="space-y-0">
                        <FieldRow field={t('help.projects.fields.settings.cover.name')} type={t('help.projects.fields.types.image')} description={t('help.projects.fields.settings.cover.desc')} />
                        <FieldRow field={t('help.projects.fields.settings.color.name')} type={t('help.projects.fields.types.color')} description={t('help.projects.fields.settings.color.desc')} />
                        <FieldRow field={t('help.projects.fields.settings.visibility.name')} type={t('help.projects.fields.types.select')} description={t('help.projects.fields.settings.visibility.desc')} />
                        <FieldRow field={t('help.projects.fields.settings.modules.name')} type={t('help.projects.fields.types.multiSelect')} description={t('help.projects.fields.settings.modules.desc')} />
                        <FieldRow field={t('help.projects.fields.settings.team.name')} type={t('help.projects.fields.types.users')} description={t('help.projects.fields.settings.team.desc')} />
                        <FieldRow field={t('help.projects.fields.settings.github.name')} type={t('help.projects.fields.types.url')} description={t('help.projects.fields.settings.github.desc')} />
                    </div>
                </div>
            </section>

            <section data-section-id="status-priority" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.projects.status.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.projects.status.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.projects.status.intro')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">tune</span>
                </div>


                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">{t('help.projects.status.statusesTitle')}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatusBadge
                            status={t('help.projects.status.statuses.planning.name')}
                            color="bg-[var(--color-text-subtle)]"
                            description={t('help.projects.status.statuses.planning.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.statuses.active.name')}
                            color="bg-[var(--brand-green)]"
                            description={t('help.projects.status.statuses.active.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.statuses.onHold.name')}
                            color="bg-[var(--brand-amber)]"
                            description={t('help.projects.status.statuses.onHold.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.statuses.completed.name')}
                            color="bg-[var(--brand-blue)]"
                            description={t('help.projects.status.statuses.completed.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.statuses.archived.name')}
                            color="bg-[var(--color-surface-border)]"
                            description={t('help.projects.status.statuses.archived.desc')}
                        />
                    </div>
                </div>

                <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">{t('help.projects.status.prioritiesTitle')}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatusBadge
                            status={t('help.projects.status.priorities.none.name')}
                            color="bg-[var(--color-surface-border)]"
                            description={t('help.projects.status.priorities.none.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.priorities.low.name')}
                            color="bg-[var(--color-text-subtle)]"
                            description={t('help.projects.status.priorities.low.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.priorities.medium.name')}
                            color="bg-[var(--brand-blue)]"
                            description={t('help.projects.status.priorities.medium.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.priorities.high.name')}
                            color="bg-[var(--brand-amber)]"
                            description={t('help.projects.status.priorities.high.desc')}
                        />
                        <StatusBadge
                            status={t('help.projects.status.priorities.critical.name')}
                            color="bg-[rgb(var(--status-blocked-rgb))]"
                            description={t('help.projects.status.priorities.critical.desc')}
                        />
                    </div>
                </div>

                <Callout type="tip">
                    {t('help.projects.status.tip')}
                </Callout>
            </section>

            <section data-section-id="health-signals" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.projects.health.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.projects.health.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.projects.health.intro')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">health_and_safety</span>
                </div>


                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                        {t('help.projects.health.formulaTitle')}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="px-3 py-1.5 rounded-lg bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)] font-medium">{t('help.projects.health.formula.taskProgress')}</span>
                        <span className="text-subtle">+</span>
                        <span className="px-3 py-1.5 rounded-lg bg-[rgba(var(--status-blocked-rgb),0.1)] text-[var(--color-status-blocked-text)] font-medium">{t('help.projects.health.formula.issueCount')}</span>
                        <span className="text-subtle">+</span>
                        <span className="px-3 py-1.5 rounded-lg bg-[rgba(var(--brand-green-rgb),0.1)] text-[var(--brand-green-text)] font-medium">{t('help.projects.health.formula.milestoneHealth')}</span>
                        <span className="text-subtle">+</span>
                        <span className="px-3 py-1.5 rounded-lg bg-[rgba(var(--brand-amber-rgb),0.1)] text-[var(--brand-amber-text)] font-medium">{t('help.projects.health.formula.activityRecency')}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <HealthGauge
                        level={85}
                        textColor="text-[var(--brand-green-text)]"
                        barColor="bg-[var(--brand-green)]"
                        label={t('help.projects.health.levels.healthy.label')}
                        triggers={[
                            t('help.projects.health.levels.healthy.t1'),
                            t('help.projects.health.levels.healthy.t2'),
                            t('help.projects.health.levels.healthy.t3'),
                            t('help.projects.health.levels.healthy.t4')
                        ]}
                    />
                    <HealthGauge
                        level={55}
                        textColor="text-[var(--brand-amber-text)]"
                        barColor="bg-[var(--brand-amber)]"
                        label={t('help.projects.health.levels.warning.label')}
                        triggers={[
                            t('help.projects.health.levels.warning.t1'),
                            t('help.projects.health.levels.warning.t2'),
                            t('help.projects.health.levels.warning.t3'),
                            t('help.projects.health.levels.warning.t4')
                        ]}
                    />
                    <HealthGauge
                        level={25}
                        textColor="text-[var(--color-status-blocked-text)]"
                        barColor="bg-[rgb(var(--status-blocked-rgb))]"
                        label={t('help.projects.health.levels.critical.label')}
                        triggers={[
                            t('help.projects.health.levels.critical.t1'),
                            t('help.projects.health.levels.critical.t2'),
                            t('help.projects.health.levels.critical.t3'),
                            t('help.projects.health.levels.critical.t4')
                        ]}
                    />
                </div>

                <Callout type="warning">
                    {t('help.projects.health.warning')}
                </Callout>
            </section>

            <section data-section-id="modules-catalog" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.projects.modules.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.projects.modules.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.projects.modules.intro')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">category</span>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ModuleCard
                        icon="checklist"
                        name={t('help.projects.modules.tasks.name')}
                        description={t('help.projects.modules.tasks.desc')}
                        features={[t('help.projects.modules.tasks.f1'), t('help.projects.modules.tasks.f2'), t('help.projects.modules.tasks.f3'), t('help.projects.modules.tasks.f4'), t('help.projects.modules.tasks.f5')]}
                    />
                    <ModuleCard
                        icon="report_problem"
                        name={t('help.projects.modules.issues.name')}
                        description={t('help.projects.modules.issues.desc')}
                        features={[t('help.projects.modules.issues.f1'), t('help.projects.modules.issues.f2'), t('help.projects.modules.issues.f3')]}
                    />
                    <ModuleCard
                        icon="flow_chart"
                        name={t('help.projects.modules.flows.name')}
                        description={t('help.projects.modules.flows.desc')}
                        features={[t('help.projects.modules.flows.f1'), t('help.projects.modules.flows.f2'), t('help.projects.modules.flows.f3'), t('help.projects.modules.flows.f4')]}
                    />
                    <ModuleCard
                        icon="flag"
                        name={t('help.projects.modules.milestones.name')}
                        description={t('help.projects.modules.milestones.desc')}
                        features={[t('help.projects.modules.milestones.f1'), t('help.projects.modules.milestones.f2'), t('help.projects.modules.milestones.f3')]}
                    />
                    <ModuleCard
                        icon="mail"
                        name={t('help.projects.modules.marketing.name')}
                        description={t('help.projects.modules.marketing.desc')}
                        features={[t('help.projects.modules.marketing.f1'), t('help.projects.modules.marketing.f2'), t('help.projects.modules.marketing.f3')]}
                    />
                    <ModuleCard
                        icon="photo_library"
                        name={t('help.projects.modules.media.name')}
                        description={t('help.projects.modules.media.desc')}
                        features={[t('help.projects.modules.media.f1'), t('help.projects.modules.media.f2'), t('help.projects.modules.media.f3'), t('help.projects.modules.media.f4')]}
                    />
                </div>
            </section>

            <section data-section-id="visibility-access" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.projects.visibility.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.projects.visibility.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.projects.visibility.intro')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">visibility</span>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-primary">public</span>
                            <span className="text-sm font-bold text-main">{t('help.projects.visibility.levels.workspace.name')}</span>
                        </div>
                        <p className="text-sm text-muted leading-relaxed">
                            {t('help.projects.visibility.levels.workspace.desc')}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-[var(--brand-amber-text)]">groups</span>
                            <span className="text-sm font-bold text-main">{t('help.projects.visibility.levels.groups.name')}</span>
                        </div>
                        <p className="text-sm text-muted leading-relaxed">
                            {t('help.projects.visibility.levels.groups.desc')}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-[var(--color-status-blocked-text)]">lock</span>
                            <span className="text-sm font-bold text-main">{t('help.projects.visibility.levels.team.name')}</span>
                        </div>
                        <p className="text-sm text-muted leading-relaxed">
                            {t('help.projects.visibility.levels.team.desc')}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                        {t('help.projects.visibility.rolesTitle')}
                    </div>
                    <div className="space-y-0">
                        <FieldRow field={t('help.projects.visibility.roles.owner.name')} type={t('help.projects.fields.types.full')} description={t('help.projects.visibility.roles.owner.desc')} />
                        <FieldRow field={t('help.projects.visibility.roles.admin.name')} type={t('help.projects.fields.types.full')} description={t('help.projects.visibility.roles.admin.desc')} />
                        <FieldRow field={t('help.projects.visibility.roles.member.name')} type={t('help.projects.fields.types.edit')} description={t('help.projects.visibility.roles.member.desc')} />
                        <FieldRow field={t('help.projects.visibility.roles.viewer.name')} type={t('help.projects.fields.types.read')} description={t('help.projects.visibility.roles.viewer.desc')} />
                    </div>
                </div>
            </section>

            <section data-section-id="project-overview" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.projects.overview.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.projects.overview.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.projects.overview.intro')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">dashboard</span>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <OverviewCard
                        icon="health_and_safety"
                        title={t('help.projects.overview.health.title')}
                        items={[
                            { label: t('help.projects.overview.health.score.label'), description: t('help.projects.overview.health.score.desc') },
                            { label: t('help.projects.overview.health.trend.label'), description: t('help.projects.overview.health.trend.desc') },
                            { label: t('help.projects.overview.health.topIssue.label'), description: t('help.projects.overview.health.topIssue.desc') }
                        ]}
                    />
                    <OverviewCard
                        icon="work"
                        title={t('help.projects.overview.workload.title')}
                        items={[
                            { label: t('help.projects.overview.workload.open.label'), description: t('help.projects.overview.workload.open.desc') },
                            { label: t('help.projects.overview.workload.urgent.label'), description: t('help.projects.overview.workload.urgent.desc') },
                            { label: t('help.projects.overview.workload.overdue.label'), description: t('help.projects.overview.workload.overdue.desc') }
                        ]}
                    />
                    <OverviewCard
                        icon="flag"
                        title={t('help.projects.overview.milestones.title')}
                        items={[
                            { label: t('help.projects.overview.milestones.upcoming.label'), description: t('help.projects.overview.milestones.upcoming.desc') },
                            { label: t('help.projects.overview.milestones.atRisk.label'), description: t('help.projects.overview.milestones.atRisk.desc') },
                            { label: t('help.projects.overview.milestones.completed.label'), description: t('help.projects.overview.milestones.completed.desc') }
                        ]}
                    />
                    <OverviewCard
                        icon="history"
                        title={t('help.projects.overview.activity.title')}
                        items={[
                            { label: t('help.projects.overview.activity.recent.label'), description: t('help.projects.overview.activity.recent.desc') },
                            { label: t('help.projects.overview.activity.contributors.label'), description: t('help.projects.overview.activity.contributors.desc') },
                            { label: t('help.projects.overview.activity.velocity.label'), description: t('help.projects.overview.activity.velocity.desc') }
                        ]}
                    />
                    <OverviewCard
                        icon="report_problem"
                        title={t('help.projects.overview.issues.title')}
                        items={[
                            { label: t('help.projects.overview.issues.openCount.label'), description: t('help.projects.overview.issues.openCount.desc') },
                            { label: t('help.projects.overview.issues.blockers.label'), description: t('help.projects.overview.issues.blockers.desc') },
                            { label: t('help.projects.overview.issues.resolutionRate.label'), description: t('help.projects.overview.issues.resolutionRate.desc') }
                        ]}
                    />
                    <OverviewCard
                        icon="flow_chart"
                        title={t('help.projects.overview.flows.title')}
                        items={[
                            { label: t('help.projects.overview.flows.inProgress.label'), description: t('help.projects.overview.flows.inProgress.desc') },
                            { label: t('help.projects.overview.flows.pendingReview.label'), description: t('help.projects.overview.flows.pendingReview.desc') },
                            { label: t('help.projects.overview.flows.ready.label'), description: t('help.projects.overview.flows.ready.desc') }
                        ]}
                    />
                </div>
            </section>

            <section data-section-id="activity-tracking" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.projects.activity.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.projects.activity.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.projects.activity.intro')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">history</span>
                </div>


                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
                        {t('help.projects.activity.trackedTitle')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted">
                            <span className="material-symbols-outlined text-[16px] text-primary">add_circle</span>
                            {t('help.projects.activity.items.created')}
                        </div>
                        <div className="flex items-center gap-2 text-muted">
                            <span className="material-symbols-outlined text-[16px] text-[var(--brand-blue-text)]">edit</span>
                            {t('help.projects.activity.items.updated')}
                        </div>
                        <div className="flex items-center gap-2 text-muted">
                            <span className="material-symbols-outlined text-[16px] text-[var(--brand-green-text)]">check_circle</span>
                            {t('help.projects.activity.items.status')}
                        </div>
                        <div className="flex items-center gap-2 text-muted">
                            <span className="material-symbols-outlined text-[16px] text-[var(--brand-amber-text)]">comment</span>
                            {t('help.projects.activity.items.comments')}
                        </div>
                        <div className="flex items-center gap-2 text-muted">
                            <span className="material-symbols-outlined text-[16px] text-[var(--brand-violet-text)]">person_add</span>
                            {t('help.projects.activity.items.assignments')}
                        </div>
                        <div className="flex items-center gap-2 text-muted">
                            <span className="material-symbols-outlined text-[16px] text-[var(--color-status-blocked-text)]">delete</span>
                            {t('help.projects.activity.items.deleted')}
                        </div>
                    </div>
                </div>

                <Callout type="info">
                    {t('help.projects.activity.info')}
                </Callout>
            </section>
        </div>
    );
};
