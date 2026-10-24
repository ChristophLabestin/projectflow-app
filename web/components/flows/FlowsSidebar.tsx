// Flows sidebar: every flow grouped by scope, search + status filter, "Neuer Flow", monthly usage.
import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '../common/Button/Button';
import type { Flow, FlowQuota } from '../../services/domain/automationsService';
import { TRIGGER_ICONS, triggerSentence, type FlowNameLookup } from './flowText';

type Filter = 'all' | 'active' | 'off' | 'problems';

export const flowHealth = (flow: Flow): 'active' | 'off' | 'paused' | 'failed' =>
    flow.pausedReason ? 'paused' : !flow.enabled ? 'off' : flow.stats.lastStatus === 'failed' ? 'failed' : 'active';

interface FlowsSidebarProps {
    t: (key: string) => string;
    flows: Flow[] | null;
    names: FlowNameLookup;
    quota: FlowQuota | null;
    usage: { runs: number; aiSteps: number };
    routeProjectId: string | null;
    canCreate: boolean;
    /** Rendered inside the app sidebar's context layer: its header already shows title + "Neuer Flow". */
    embedded?: boolean;
}

export const FlowsSidebar: React.FC<FlowsSidebarProps> = ({ t, flows, names, quota, usage, routeProjectId, canCreate, embedded }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('all');

    const scoped = useMemo(() => (flows || []).filter((flow) =>
        !routeProjectId || flow.scope === 'workspace' || flow.projectId === routeProjectId), [flows, routeProjectId]);

    const counts = useMemo(() => ({
        all: scoped.length,
        active: scoped.filter((flow) => flowHealth(flow) === 'active').length,
        off: scoped.filter((flow) => flowHealth(flow) === 'off').length,
        problems: scoped.filter((flow) => ['paused', 'failed'].includes(flowHealth(flow))).length,
    }), [scoped]);

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const visible = scoped.filter((flow) => {
            const health = flowHealth(flow);
            if (filter === 'active' && health !== 'active') return false;
            if (filter === 'off' && health !== 'off') return false;
            if (filter === 'problems' && health !== 'paused' && health !== 'failed') return false;
            return !needle || flow.name.toLowerCase().includes(needle);
        });
        const byKey = new Map<string, { label: string; flows: Flow[] }>();
        visible.forEach((flow) => {
            const key = flow.scope === 'project' && flow.projectId ? flow.projectId : '';
            const label = key ? names.project(key) : t('flows.scope.workspace');
            if (!byKey.has(key)) byKey.set(key, { label, flows: [] });
            byKey.get(key)!.flows.push(flow);
        });
        return Array.from(byKey.entries())
            .sort(([a, ga], [b, gb]) => (a === '' ? -1 : b === '' ? 1 : ga.label.localeCompare(gb.label)))
            .map(([key, group]) => ({ key, ...group }));
    }, [scoped, query, filter, names, t]);

    const runsPct = quota && quota.runsPerMonth > 0 ? Math.min(100, Math.round((usage.runs / quota.runsPerMonth) * 100)) : 0;
    const newPath = routeProjectId ? `/flows/new?projectId=${routeProjectId}` : '/flows/new';

    return (
        <nav className={`flows-nav${embedded ? ' flows-nav--embedded' : ''}`} aria-label={t('nav.flows')}>
            {!embedded && (
                <div className="flows-nav__head">
                    <Link to={routeProjectId ? `/project/${routeProjectId}/flows` : '/flows'} className="flows-nav__title">
                        <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
                        <span>{t('nav.flows')}</span>
                    </Link>
                </div>
            )}
            {canCreate && !embedded && (
                <Button className="flows-nav__new" onClick={() => navigate(newPath)} icon={<span className="material-symbols-outlined">add</span>}>
                    {t('flows.new')}
                </Button>
            )}
            <div className="flows-nav__links">
                <NavLink end to={routeProjectId ? `/project/${routeProjectId}/flows` : '/flows'} className={({ isActive }) => `flows-nav__item ${isActive ? 'is-active' : ''}`.trim()}>
                    <span className="flows-nav__icon material-symbols-outlined" aria-hidden="true">dashboard</span>
                    <span className="flows-nav__name">{t('flows.nav.overview')}</span>
                </NavLink>
                {canCreate && (
                    <NavLink to={`/flows/new?start=template${routeProjectId ? `&projectId=${routeProjectId}` : ''}`}
                        className={() => `flows-nav__item ${location.pathname === '/flows/new' && location.search.includes('start=template') ? 'is-active' : ''}`.trim()}>
                        <span className="flows-nav__icon material-symbols-outlined" aria-hidden="true">dashboard_customize</span>
                        <span className="flows-nav__name">{t('flows.nav.templates')}</span>
                    </NavLink>
                )}
            </div>
            <label className="flows-nav__search">
                <span className="material-symbols-outlined" aria-hidden="true">search</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('flows.nav.search')} aria-label={t('flows.nav.search')} />
            </label>
            <div className="flows-nav__filters" role="tablist" aria-label={t('flows.nav.filter')}>
                {(['all', 'active', 'off', 'problems'] as Filter[]).map((key) => (
                    <button key={key} type="button" role="tab" aria-selected={filter === key}
                        className={`flows-nav__filter ${filter === key ? 'is-active' : ''} ${key === 'problems' && counts.problems ? 'has-problems' : ''}`.trim()}
                        onClick={() => setFilter(key)}>
                        {t(`flows.nav.filters.${key}`)}
                        <span className="flows-nav__count">{counts[key]}</span>
                    </button>
                ))}
            </div>
            <div className="flows-nav__scroll">
                {flows === null && <div className="flows-nav__empty">{t('flows.nav.loading')}</div>}
                {flows !== null && groups.length === 0 && (
                    <div className="flows-nav__empty">{scoped.length ? t('flows.nav.noMatch') : t('flows.nav.empty')}</div>
                )}
                {groups.map((group) => (
                    <div key={group.key || 'workspace'} className="flows-nav__section">
                        <p className="flows-nav__label">
                            <span className="material-symbols-outlined" aria-hidden="true">{group.key ? 'folder' : 'workspaces'}</span>
                            {group.label}
                        </p>
                        {group.flows.map((flow) => {
                            const health = flowHealth(flow);
                            return (
                                <NavLink key={flow.id} to={`/flows/${flow.id}`} className={({ isActive }) => `flows-nav__item ${isActive ? 'is-active' : ''}`.trim()}
                                    title={triggerSentence(flow.trigger, t, names)}>
                                    <span className="flows-nav__icon material-symbols-outlined" aria-hidden="true">{TRIGGER_ICONS[flow.trigger.type] || 'bolt'}</span>
                                    <span className="flows-nav__name">{flow.name || t('flows.namePlaceholder')}</span>
                                    <span className={`flows-nav__dot is-${health}`} aria-label={t(`flows.health.${health}`)} title={t(`flows.health.${health}`)} />
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
            </div>
            {quota && (
                <div className="flows-nav__usage">
                    <div className="flows-nav__usage-row">
                        <span>{t('flows.nav.runs')}</span>
                        <span>{usage.runs.toLocaleString()} / {quota.runsPerMonth.toLocaleString()}</span>
                    </div>
                    <div className={`flows-nav__meter ${runsPct >= 80 ? 'is-warning' : ''}`.trim()}><span style={{ width: `${runsPct}%` }} /></div>
                    {quota.tier === 'free' && <p className="flows-nav__plan">{t('flows.quota.free').replace('{active}', String(quota.activeFlowsPerWorkspace))}</p>}
                </div>
            )}
        </nav>
    );
};
