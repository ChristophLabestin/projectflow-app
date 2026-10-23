// Flows list (/flows, /project/:id/flows): flows with status and toggle, usage, template gallery.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { Button } from '../../components/common/Button/Button';
import { Select } from '../../components/common/Select/Select';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { Skeleton } from '../../components/common/Skeleton/Skeleton';
import { SettingsSwitch } from '../../components/settings/SettingsSwitch';
import { FlowTemplateGallery } from '../../components/flows/FlowTemplateGallery';
import { TRIGGER_ICONS, actionSentence, triggerSentence } from '../../components/flows/flowText';
import {
    flowErrorMessage,
    setFlowEnabled,
    subscribeFlowQuota,
    subscribeFlowUsage,
    subscribeFlows,
    type Flow,
    type FlowQuota,
} from '../../services/domain/automationsService';
import { useFlowContext } from './useFlowContext';
import { planErrorMessage } from '../../services/billingService';
import './flows.scss';

export const FlowsScreen = () => {
    const { t, dateLocale, language } = useLanguage();
    const navigate = useNavigate();
    const { showError } = useToast();
    const { id: routeProjectId } = useParams<{ id: string }>();
    const ctx = useFlowContext();
    const { tenantId, names, projects, canManage } = ctx;
    const [flows, setFlows] = useState<Flow[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [filter, setFilter] = useState('');
    const [usage, setUsage] = useState({ runs: 0, aiSteps: 0, skipped: 0 });
    const [pending, setPending] = useState<string | null>(null);
    const [quota, setQuota] = useState<FlowQuota | null>(null);

    useEffect(() => {
        if (!tenantId || ctx.isGuest) return undefined;
        return subscribeFlowQuota(tenantId, setQuota);
    }, [tenantId, ctx.isGuest]);

    useEffect(() => {
        if (!tenantId || ctx.isGuest) return undefined;
        return subscribeFlows(tenantId, setFlows, () => setFailed(true));
    }, [tenantId, ctx.isGuest]);

    useEffect(() => {
        if (!tenantId || ctx.isGuest) return undefined;
        return subscribeFlowUsage(tenantId, setUsage);
    }, [tenantId, ctx.isGuest]);

    const scopeFilter = routeProjectId || filter;
    const visible = useMemo(() => (flows || []).filter((flow) => {
        if (!scopeFilter) return true;
        if (scopeFilter === 'workspace') return flow.scope === 'workspace';
        return flow.projectId === scopeFilter || (Boolean(routeProjectId) && flow.scope === 'workspace');
    }), [flows, scopeFilter, routeProjectId]);

    if (ctx.isGuest) {
        return <EmptyState title={t('flows.noAccess')} icon={<span className="material-symbols-outlined">lock</span>} />;
    }

    const back = routeProjectId ? `?back=${encodeURIComponent(`/project/${routeProjectId}/flows`)}` : '';
    const newFlowUrl = (templateId: string | null) => {
        const params = new URLSearchParams();
        if (templateId) params.set('template', templateId);
        else params.set('blank', '1');
        if (routeProjectId) {
            params.set('projectId', routeProjectId);
            params.set('back', `/project/${routeProjectId}/flows`);
        }
        return `/flows/new?${params.toString()}`;
    };
    const canCreate = routeProjectId ? canManage('project') : ctx.role === 'Owner' || ctx.role === 'Admin' || ctx.role === 'Member';

    const toggle = async (flow: Flow, enabled: boolean) => {
        setPending(flow.id);
        try {
            await setFlowEnabled(tenantId!, flow.id, enabled);
        } catch (err) {
            showError(planErrorMessage(err, t) || flowErrorMessage(err) || t('flows.error.save'));
        } finally {
            setPending(null);
        }
    };

    const filterOptions = [
        { value: '', label: t('flows.filter.all') },
        { value: 'workspace', label: t('flows.scope.workspace') },
        ...projects.map((project) => ({ value: project.id, label: project.title })),
    ];

    return (
        <div className="flows-page">
            <div className="flows-page__content">
                <header className="flows-page__header">
                    <div>
                        <h1>{t('nav.flows')}</h1>
                        <p>{t(routeProjectId ? 'flows.subtitleProject' : 'flows.subtitle')}</p>
                    </div>
                    {canCreate && (
                        <Button onClick={() => navigate(routeProjectId ? `/flows/new?projectId=${routeProjectId}&back=${encodeURIComponent(`/project/${routeProjectId}/flows`)}` : '/flows/new')}
                            icon={<span className="material-symbols-outlined">add</span>}>
                            {t('flows.new')}
                        </Button>
                    )}
                </header>

                <div className="flows-page__bar">
                    {!routeProjectId && (
                        <Select value={filter} onChange={(v) => setFilter(String(v))} options={filterOptions} className="flows-page__filter" />
                    )}
                    {quota && (
                        <span className={`flows-usage ${usage.runs >= quota.runsPerMonth * 0.8 ? 'is-warning' : ''}`.trim()}>
                            <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
                            {t('flows.usage').replace('{runs}', usage.runs.toLocaleString(language)).replace('{limit}', quota.runsPerMonth.toLocaleString(language))}
                            {quota.aiStepsPerMonth > 0 && ` · ${t('flows.usageAi').replace('{steps}', usage.aiSteps.toLocaleString(language)).replace('{limit}', quota.aiStepsPerMonth.toLocaleString(language))}`}
                            {quota.tier === 'free' && ` · ${t('flows.quota.free').replace('{active}', String(quota.activeFlowsPerWorkspace))}`}
                        </span>
                    )}
                </div>

                {failed ? (
                    <EmptyState title={t('flows.error.load')} icon={<span className="material-symbols-outlined">error</span>} />
                ) : !flows ? (
                    <Skeleton className="flows-skeleton" />
                ) : visible.length === 0 ? (
                    <section className="flows-empty">
                        <div className="flows-empty__intro">
                            <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
                            <div>
                                <h2>{t('flows.empty.title')}</h2>
                                <p>{t('flows.empty.message')}</p>
                            </div>
                        </div>
                        {canCreate && <FlowTemplateGallery t={t} onPick={(templateId) => navigate(newFlowUrl(templateId))} />}
                    </section>
                ) : (
                    <>
                        <ul className="flows-list">
                            {visible.map((flow) => {
                                const editable = canManage(flow.scope);
                                const lastRun = flow.stats.lastRunAtMs
                                    ? formatDistanceToNow(flow.stats.lastRunAtMs, { addSuffix: true, locale: dateLocale })
                                    : t('flows.list.neverRun');
                                return (
                                    <li key={flow.id} className={`flows-list__item ${flow.enabled ? '' : 'is-off'}`.trim()}>
                                        <span className="flows-list__icon material-symbols-outlined" aria-hidden="true">{TRIGGER_ICONS[flow.trigger.type] || 'bolt'}</span>
                                        <Link to={`/flows/${flow.id}${back}`} className="flows-list__main">
                                            <span className="flows-list__name">{flow.name}</span>
                                            <span className="flows-list__sentence">
                                                {triggerSentence(flow.trigger, t, names)}
                                                {flow.actions[0] ? ` → ${actionSentence(flow.actions[0], t, names)}` : ''}
                                                {flow.actions.length > 1 ? ` ${t('flows.list.more').replace('{count}', String(flow.actions.length - 1))}` : ''}
                                            </span>
                                        </Link>
                                        <span className="flows-list__scope">
                                            {flow.scope === 'project' && flow.projectId ? names.project(flow.projectId) : t('flows.scope.workspace')}
                                        </span>
                                        <span className={`flows-list__status is-${flow.pausedReason ? 'paused' : flow.stats.lastStatus || 'none'}`}>
                                            {flow.pausedReason
                                                ? <><span className="material-symbols-outlined" aria-hidden="true">pause_circle</span>{t('flows.list.paused')}</>
                                                : flow.stats.lastStatus === 'failed'
                                                    ? <><span className="material-symbols-outlined" aria-hidden="true">error</span>{t('flows.list.lastFailed')}</>
                                                    : lastRun}
                                        </span>
                                        <SettingsSwitch checked={flow.enabled} label={t('flows.enabled')} disabled={!editable || pending === flow.id}
                                            onChange={(enabled) => void toggle(flow, enabled)} />
                                    </li>
                                );
                            })}
                        </ul>
                        {canCreate && (
                            <section className="flows-templates">
                                <h2>{t('flows.templates.title')}</h2>
                                <FlowTemplateGallery t={t} onPick={(templateId) => navigate(newFlowUrl(templateId))} />
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default FlowsScreen;
