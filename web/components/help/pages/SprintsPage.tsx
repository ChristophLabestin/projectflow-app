import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { HelpCenterPageProps, HelpCenterSectionsBuilder } from '../helpCenterTypes';
import { splitHelpKeywords } from '../helpCenterContent';

const SECTION_IDS = ['sprint-overview', 'backlog-planning', 'active-sprint'] as const;

export const getSprintsSections: HelpCenterSectionsBuilder = t =>
    SECTION_IDS.map(id => ({
        id,
        title: t(`help.sprints.sections.${id}.title`),
        summary: t(`help.sprints.sections.${id}.summary`),
        content: t(`help.sprints.sections.${id}.content`),
        keywords: splitHelpKeywords(t(`help.sprints.sections.${id}.keywords`))
    }));

export const SprintsPage = (_props: HelpCenterPageProps) => {
    const { t } = useLanguage();
    const boardFeatures = ['dragCards', 'cardInfo', 'complete'];

    return (
        <div className="px-6 py-6 space-y-10">
            {/* Hero Section */}
            <div className="rounded-[28px] border border-surface bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] p-6">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
                    {t('help.sprints.hero.eyebrow')}
                </div>
                <h2 className="text-3xl font-bold text-main mt-3">
                    {t('help.sprints.hero.title')}
                </h2>
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">
                    {t('help.sprints.hero.description')}
                </p>
                <div className="flex items-center gap-4 mt-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">directions_run</span>
                        {t('help.sprints.hero.badgeWorkflow')}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(var(--brand-blue-rgb),0.1)] text-[var(--brand-blue-text)] text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">view_kanban</span>
                        {t('help.sprints.hero.badgeKanban')}
                    </div>
                </div>
            </div>

            {/* SECTION: Overview */}
            <section data-section-id="sprint-overview" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.sprints.lifecycle.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.sprints.lifecycle.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.sprints.lifecycle.description')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">sync</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-muted">edit_calendar</span>
                            <span className="text-sm font-bold text-main">{t('help.sprints.lifecycle.planning.title')}</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                            {t('help.sprints.lifecycle.planning.description')}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-[var(--brand-green-text)]">play_circle</span>
                            <span className="text-sm font-bold text-main">{t('help.sprints.lifecycle.active.title')}</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                            {t('help.sprints.lifecycle.active.description')}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-surface bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-[var(--brand-blue-text)]">check_circle</span>
                            <span className="text-sm font-bold text-main">{t('help.sprints.lifecycle.completed.title')}</span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed">
                            {t('help.sprints.lifecycle.completed.description')}
                        </p>
                    </div>
                </div>
            </section>

            {/* SECTION: Backlog Management */}
            <section data-section-id="backlog-planning" className="help-section rounded-3xl border border-surface bg-card p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.sprints.backlog.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.sprints.backlog.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.sprints.backlog.description')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">list_alt</span>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-primary">drag_indicator</span>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-main">{t('help.sprints.backlog.dragDrop.title')}</div>
                            <p className="text-xs text-muted mt-1">
                                {t('help.sprints.backlog.dragDrop.description')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="size-8 rounded-full bg-[rgba(var(--brand-amber-rgb),0.1)] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[16px] text-[var(--brand-amber-text)]">sort</span>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-main">{t('help.sprints.backlog.sorting.title')}</div>
                            <p className="text-xs text-muted mt-1">
                                {t('help.sprints.backlog.sorting.description')}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION: Active Sprint */}
            <section data-section-id="active-sprint" className="help-section rounded-3xl border border-surface bg-surface p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">{t('help.sprints.board.eyebrow')}</div>
                        <h3 className="text-xl font-bold text-main mt-2">{t('help.sprints.board.title')}</h3>
                        <p className="text-sm text-muted mt-2 max-w-xl leading-relaxed">
                            {t('help.sprints.board.description')}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-[20px] text-subtle">view_kanban</span>
                </div>

                <div className="rounded-2xl border border-surface bg-card p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                        {t('help.sprints.board.featuresTitle')}
                    </div>
                    <ul className="space-y-3">
                        {boardFeatures.map(feature => (
                            <li key={feature} className="flex items-center gap-3 text-sm text-main">
                                <span className="material-symbols-outlined text-[18px] text-subtle">check</span>
                                <span>{t(`help.sprints.board.features.${feature}`)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </div>
    );
};
