// /flows (no flow selected): what Flows are, status at a glance, quick start (sentence or template).
import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import { Skeleton } from '../../components/common/Skeleton/Skeleton';
import { FlowTemplateGallery } from '../../components/flows/FlowTemplateGallery';
import { FlowFromText } from '../../components/flows/FlowFromText';
import { flowHealth } from '../../components/flows/FlowsSidebar';
import { TRIGGER_ICONS, triggerSentence } from '../../components/flows/flowText';
import { newFlowPath, useFlowsOutlet } from './FlowsLayout';

export const FlowsHome = () => {
    const { t, dateLocale, language } = useLanguage();
    const navigate = useNavigate();
    const { flows, quota, usage, ctx, routeProjectId } = useFlowsOutlet();
    const canCreate = ctx.role === 'Owner' || ctx.role === 'Admin' || ctx.role === 'Member';

    const scoped = useMemo(() => (flows || []).filter((flow) =>
        !routeProjectId || flow.scope === 'workspace' || flow.projectId === routeProjectId), [flows, routeProjectId]);
    const active = scoped.filter((flow) => flowHealth(flow) === 'active').length;
    const problems = scoped.filter((flow) => ['paused', 'failed'].includes(flowHealth(flow)));
    const recent = scoped.filter((flow) => flow.stats.lastRunAtMs).sort((a, b) => (b.stats.lastRunAtMs || 0) - (a.stats.lastRunAtMs || 0)).slice(0, 5);

    if (flows === null) return <Skeleton className="flows-skeleton" />;

    return (
        <div className="flows-home">
            <header className="flows-home__hero">
                <h1>{routeProjectId ? t('flows.home.titleProject').replace('{project}', ctx.names.project(routeProjectId)) : t('nav.flows')}</h1>
                <p>{t('flows.home.intro')}</p>
                <ol className="flows-home__how" aria-label={t('flows.home.howTitle')}>
                    {(['when', 'if', 'then'] as const).map((step) => (
                        <li key={step}>
                            <span className="flows-home__how-kind">{t(`flows.step.${step}`)}</span>
                            <span>{t(`flows.home.how.${step}`)}</span>
                        </li>
                    ))}
                </ol>
            </header>

            {scoped.length > 0 && (
                <section className="flows-home__stats" aria-label={t('flows.home.statusTitle')}>
                    <div className="flows-stat">
                        <span className="flows-stat__label">{t('flows.home.active')}</span>
                        <span className="flows-stat__value">{active}{quota ? <small> / {quota.activeFlowsPerWorkspace}</small> : null}</span>
                    </div>
                    <div className="flows-stat">
                        <span className="flows-stat__label">{t('flows.home.runs')}</span>
                        <span className="flows-stat__value">{usage.runs.toLocaleString(language)}{quota ? <small> / {quota.runsPerMonth.toLocaleString(language)}</small> : null}</span>
                    </div>
                    <div className={`flows-stat ${problems.length ? 'is-warning' : ''}`.trim()}>
                        <span className="flows-stat__label">{t('flows.home.problems')}</span>
                        <span className="flows-stat__value">{problems.length}</span>
                    </div>
                </section>
            )}

            {problems.length > 0 && (
                <section className="flows-home__section">
                    <h2>{t('flows.home.needsAttention')}</h2>
                    <ul className="flows-home__list">
                        {problems.map((flow) => (
                            <li key={flow.id}>
                                <Link to={`/flows/${flow.id}?tab=log`} className="flows-home__row is-problem">
                                    <span className="material-symbols-outlined" aria-hidden="true">{flow.pausedReason ? 'pause_circle' : 'error'}</span>
                                    <span className="flows-home__row-main">
                                        <strong>{flow.name}</strong>
                                        <em>{flow.pausedReason ? t(`flows.paused.${flow.pausedReason}`) : flow.stats.lastError || t('flows.list.lastFailed')}</em>
                                    </span>
                                    <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {canCreate && (
                <section className="flows-home__section">
                    <h2>{t('flows.home.quickStart')}</h2>
                    <FlowFromText t={t} tenantId={ctx.tenantId || ''} projectId={routeProjectId} />
                </section>
            )}

            {recent.length > 0 && (
                <section className="flows-home__section">
                    <h2>{t('flows.home.recent')}</h2>
                    <ul className="flows-home__list">
                        {recent.map((flow) => (
                            <li key={flow.id}>
                                <Link to={`/flows/${flow.id}`} className="flows-home__row">
                                    <span className="material-symbols-outlined" aria-hidden="true">{TRIGGER_ICONS[flow.trigger.type] || 'bolt'}</span>
                                    <span className="flows-home__row-main">
                                        <strong>{flow.name}</strong>
                                        <em>{triggerSentence(flow.trigger, t, ctx.names)}</em>
                                    </span>
                                    <span className="flows-home__row-meta">
                                        {formatDistanceToNow(flow.stats.lastRunAtMs!, { addSuffix: true, locale: dateLocale })}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {canCreate && (
                <section className="flows-home__section">
                    <div className="flows-home__section-head">
                        <h2>{t('flows.home.templates')}</h2>
                        <Link to={newFlowPath(routeProjectId, { start: 'template' })} className="flows-home__more">{t('flows.home.allTemplates')}</Link>
                    </div>
                    <FlowTemplateGallery t={t} limit={6} onPick={(templateId) => navigate(templateId
                        ? `/flows/new/edit?template=${templateId}${routeProjectId ? `&projectId=${routeProjectId}` : ''}`
                        : newFlowPath(routeProjectId))} />
                </section>
            )}
        </div>
    );
};

export default FlowsHome;
