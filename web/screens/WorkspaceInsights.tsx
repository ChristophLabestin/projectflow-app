import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { Select } from '../components/common/Select/Select';
import { Button } from '../components/common/Button/Button';
import { EmptyState } from '../components/common/EmptyState/EmptyState';
import { Skeleton } from '../components/common/Skeleton/Skeleton';
import { AnimatedNumber } from '../components/motion';
import { MarkdownContent } from '../components/legal/MarkdownContent';
import {
    generateWeeklyInsightsReport,
    getLatestInsightsReport,
    refreshWorkspaceInsights,
    subscribeLatestInsights,
    type InsightsHealth,
    type InsightsReport,
    type InsightsSnapshot,
} from '../services/domain/insightsService';
import { subscribeWorkspaceMembers } from '../services/domain/workspaceMembersService';
import { aggregateInsights } from '../utils/insightsAggregate';
import { isWorkspaceAreaEnabled } from '../config/features';
import { createWikiPageFromMarkdown } from '../services/wiki/wikiService';
import './workspace-insights.scss';

type WeeksOption = '4' | '8' | '12';
const STALE_MS = 26 * 60 * 60 * 1000;

const HEALTH_ICON: Record<InsightsHealth, string> = { good: 'check_circle', watch: 'visibility', risk: 'warning' };

interface KpiProps {
    label: string;
    value: number | null;
    format?: (value: number) => string;
    hint?: string;
    tone?: 'default' | 'warning';
}

const Kpi: React.FC<KpiProps> = ({ label, value, format: fmt, hint, tone = 'default' }) => (
    <div className={`insights-kpi insights-kpi--${tone}`}>
        <span className="insights-kpi__label">{label}</span>
        <span className="insights-kpi__value">
            {value === null ? '–' : <AnimatedNumber value={value} format={fmt} />}
        </span>
        {hint && <span className="insights-kpi__hint">{hint}</span>}
    </div>
);

/** Shared calm chart chrome: muted grid, small axis text, token colours via CSS variables. */
const axisProps = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: 'var(--color-text-subtle)' } } as const;
const tooltipProps = {
    cursor: { fill: 'var(--color-surface-hover)', stroke: 'var(--color-surface-border)' },
    contentStyle: {
        background: 'var(--color-surface-card)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        color: 'var(--color-text-main)',
        fontSize: 12,
    },
    labelStyle: { color: 'var(--color-text-muted)', marginBottom: 4 },
} as const;

export const WorkspaceInsights = () => {
    const { t, language, dateLocale } = useLanguage();
    const { activeWorkspaceId: tenantId, activeWorkspace } = useWorkspace();
    const isGuest = activeWorkspace?.role === 'Guest';

    const [snapshot, setSnapshot] = useState<InsightsSnapshot | null | undefined>(undefined);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [weeks, setWeeks] = useState<WeeksOption>('8');
    const [projectId, setProjectId] = useState('');
    const [names, setNames] = useState<Map<string, string>>(new Map());

    const [report, setReport] = useState<InsightsReport | null>(null);
    const [reportBusy, setReportBusy] = useState(false);
    const [reportError, setReportError] = useState(false);
    const [copied, setCopied] = useState(false);
    const [wikiDocId, setWikiDocId] = useState<string | null>(null);
    const [wikiBusy, setWikiBusy] = useState(false);
    const wikiEnabled = isWorkspaceAreaEnabled('wiki');

    useEffect(() => {
        if (!tenantId || isGuest) return undefined;
        setSnapshot(undefined);
        return subscribeLatestInsights(tenantId, setSnapshot, (err) => {
            console.error('Insights failed', err);
            setError(true);
        });
    }, [tenantId, isGuest]);

    useEffect(() => {
        if (!tenantId || isGuest) return undefined;
        return subscribeWorkspaceMembers((list) => setNames(new Map(list.map((m) => [m.uid, m.displayName || m.email || m.uid]))), tenantId);
    }, [tenantId, isGuest]);

    useEffect(() => {
        if (!tenantId || isGuest) return;
        let alive = true;
        getLatestInsightsReport(tenantId, language === 'de' ? 'de' : 'en')
            .then((r) => { if (alive) setReport(r); })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [tenantId, isGuest, language]);

    const refresh = useCallback(async () => {
        if (!tenantId) return;
        setRefreshing(true);
        try {
            await refreshWorkspaceInsights(tenantId);
        } catch (err) {
            console.error('Insights refresh failed', err);
            setError(true);
        } finally {
            setRefreshing(false);
        }
    }, [tenantId]);

    // First visit (no snapshot yet) or a stale one: compute on demand once.
    const autoRefreshed = useRef(false);
    useEffect(() => {
        if (snapshot === undefined || autoRefreshed.current) return;
        if (snapshot === null || Date.now() - snapshot.computedAtMs > STALE_MS) {
            autoRefreshed.current = true;
            void refresh();
        }
    }, [snapshot, refresh]);

    const data = useMemo(
        () => (snapshot ? aggregateInsights(snapshot, projectId ? [projectId] : null, Number(weeks)) : null),
        [snapshot, projectId, weeks]
    );

    const weekLabel = useCallback((week: string) => format(new Date(`${week}T12:00:00`), 'd. MMM', { locale: dateLocale }), [dateLocale]);
    const chartPoints = useMemo(() => (data?.points || []).map((p) => ({ ...p, label: weekLabel(p.week) })), [data, weekLabel]);
    const people = useMemo(() => (data?.people || []).slice(0, 8).map((p) => ({ ...p, name: names.get(p.uid) || t('activity.actor.someone') })), [data, names, t]);

    const generateReport = async () => {
        if (!tenantId) return;
        setReportBusy(true);
        setReportError(false);
        try {
            setReport(await generateWeeklyInsightsReport(tenantId, language === 'de' ? 'de' : 'en'));
            setWikiDocId(null);
        } catch (err) {
            console.error('Weekly report failed', err);
            setReportError(true);
        } finally {
            setReportBusy(false);
        }
    };

    const copyReport = async () => {
        if (!report) return;
        try {
            await navigator.clipboard.writeText(report.markdown);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const saveToWiki = async () => {
        if (!tenantId || !report) return;
        setWikiBusy(true);
        setReportError(false);
        try {
            const docId = await createWikiPageFromMarkdown(tenantId, {
                space: { type: 'workspace', projectId: null },
                title: t('insights.report.wikiTitle').replace('{week}', report.week),
                markdown: report.markdown,
                icon: 'insights',
            });
            setWikiDocId(docId);
        } catch (err) {
            console.error('Saving the weekly report to the wiki failed', err);
            setReportError(true);
        } finally {
            setWikiBusy(false);
        }
    };

    if (isGuest) return <Navigate to="/activity" replace />;

    const projectOptions = [
        { value: '', label: t('activity.filter.allProjects') },
        ...(snapshot?.projects || [])
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((p) => ({ value: p.id, label: p.title || p.id })),
    ];
    const weekOptions = (['4', '8', '12'] as WeeksOption[]).map((w) => ({ value: w, label: t(`insights.period.${w}`) }));
    const pct = (value: number) => `${Math.round(value * 100)} %`;
    const days = (value: number) => `${value.toLocaleString(language, { maximumFractionDigits: 1 })} ${t('insights.days')}`;
    const delta = data ? data.completed - data.completedPrev : 0;

    return (
        <div className="insights-page custom-scrollbar">
            <div className="insights-page__content">
                <header className="insights-page__header">
                    <div>
                        <h1>{t('nav.insights')}</h1>
                        <p>
                            {t('insights.subtitle')}
                            {snapshot?.computedAtMs ? ` · ${t('insights.updated').replace('{time}', format(snapshot.computedAtMs, 'Pp', { locale: dateLocale }))}` : ''}
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void refresh()}
                        disabled={refreshing}
                        icon={<span className="material-symbols-outlined">refresh</span>}
                    >
                        {refreshing ? t('insights.refreshing') : t('insights.refresh')}
                    </Button>
                </header>

                <div className="insights-page__filters">
                    <Select value={weeks} onChange={(v) => setWeeks(String(v) as WeeksOption)} options={weekOptions} className="insights-page__filter" />
                    <Select value={projectId} onChange={(v) => setProjectId(String(v))} options={projectOptions} className="insights-page__filter" />
                </div>

                {error && !snapshot ? (
                    <EmptyState title={t('insights.error')} icon={<span className="material-symbols-outlined">error</span>} />
                ) : !data ? (
                    <div className="insights-grid" aria-busy="true">
                        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="insights-skeleton" />)}
                    </div>
                ) : (
                    <>
                        <section className="insights-kpis" aria-label={t('insights.kpis')}>
                            <Kpi
                                label={t('insights.kpi.completed')}
                                value={data.completed}
                                hint={data.completedPrev || data.completed
                                    ? t('insights.kpi.vsPrevious').replace('{delta}', `${delta >= 0 ? '+' : ''}${delta}`)
                                    : undefined}
                            />
                            <Kpi label={t('insights.kpi.cycleTime')} value={data.avgCycleDays} format={days} />
                            <Kpi label={t('insights.kpi.overdue')} value={data.overdue} tone={data.overdue > 0 ? 'warning' : 'default'}
                                hint={t('insights.kpi.ofOpen').replace('{open}', String(data.open))} />
                            <Kpi label={t('insights.kpi.onTime')} value={data.onTimeRate} format={pct} hint={t('insights.kpi.onTimeHint')} />
                        </section>

                        <div className="insights-grid">
                            <section className="insights-card">
                                <h2>{t('insights.chart.throughput')}</h2>
                                <p className="insights-card__hint">{t('insights.chart.throughputHint')}</p>
                                <div className="insights-card__chart">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={chartPoints} margin={{ top: 8, right: 4, bottom: 0, left: -20 }} barCategoryGap="30%">
                                            <CartesianGrid vertical={false} stroke="var(--color-surface-border)" strokeDasharray="2 4" />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis allowDecimals={false} {...axisProps} />
                                            <Tooltip {...tooltipProps} />
                                            <Bar dataKey="completed" name={t('insights.series.completed')} fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            <section className="insights-card">
                                <h2>{t('insights.chart.cycleTime')}</h2>
                                <p className="insights-card__hint">{t('insights.chart.cycleTimeHint')}</p>
                                <div className="insights-card__chart">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                                            <CartesianGrid vertical={false} stroke="var(--color-surface-border)" strokeDasharray="2 4" />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis allowDecimals={false} {...axisProps} />
                                            <Tooltip {...tooltipProps} formatter={(value) => (typeof value === 'number' ? days(value) : value)} />
                                            <Line type="monotone" dataKey="cycleDays" name={t('insights.series.cycleDays')} stroke="var(--brand-violet)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: 'var(--brand-violet)' }} connectNulls />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            <section className="insights-card">
                                <h2>{t('insights.chart.burnup')}</h2>
                                <div className="insights-legend">
                                    <span><i className="insights-legend__swatch insights-legend__swatch--scope" />{t('insights.series.scope')}</span>
                                    <span><i className="insights-legend__swatch insights-legend__swatch--done" />{t('insights.series.done')}</span>
                                </div>
                                <div className="insights-card__chart">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                                            <CartesianGrid vertical={false} stroke="var(--color-surface-border)" strokeDasharray="2 4" />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis allowDecimals={false} {...axisProps} />
                                            <Tooltip {...tooltipProps} />
                                            <Line type="stepAfter" dataKey="scope" name={t('insights.series.scope')} stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                            <Line type="monotone" dataKey="done" name={t('insights.series.done')} stroke="var(--brand-green)" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            <section className="insights-card">
                                <h2>{t('insights.chart.workload')}</h2>
                                <p className="insights-card__hint">{t('insights.chart.workloadHint')}</p>
                                {people.length === 0 ? (
                                    <p className="insights-card__empty">{t('insights.chart.workloadEmpty')}</p>
                                ) : (
                                    <ul className="insights-load">
                                        {people.map((p) => {
                                            const max = people[0].open || 1;
                                            return (
                                                <li key={p.uid} className="insights-load__row">
                                                    <span className="insights-load__name">{p.name}</span>
                                                    <span className="insights-load__track" aria-hidden="true">
                                                        <span className="insights-load__bar" style={{ width: `${(p.open / max) * 100}%` }} />
                                                    </span>
                                                    <span className="insights-load__value">
                                                        {p.open}
                                                        {p.overdue > 0 && (
                                                            <span className="insights-load__overdue">
                                                                {t('insights.load.overdue').replace('{n}', String(p.overdue))}
                                                            </span>
                                                        )}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>
                        </div>

                        <section className="insights-card insights-card--wide">
                            <h2>{t('insights.health.title')}</h2>
                            {data.projects.length === 0 ? (
                                <p className="insights-card__empty">{t('insights.health.empty')}</p>
                            ) : (
                                <ul className="insights-health">
                                    {data.projects.slice(0, 12).map((p) => {
                                        const samples = p.onTime + p.late;
                                        return (
                                            <li key={p.id}>
                                                <Link to={`/project/${p.id}`} className="insights-health__row">
                                                    <span className={`insights-health__badge insights-health__badge--${p.health}`}>
                                                        <span className="material-symbols-outlined" aria-hidden="true">{HEALTH_ICON[p.health]}</span>
                                                        {t(`insights.health.${p.health}`)}
                                                    </span>
                                                    <span className="insights-health__title">{p.title || p.id}</span>
                                                    <span className="insights-health__stats">
                                                        <span>{t('insights.health.open').replace('{n}', String(p.open))}</span>
                                                        {p.overdue > 0 && <span>{t('insights.health.overdue').replace('{n}', String(p.overdue))}</span>}
                                                        {p.blocked > 0 && <span>{t('insights.health.blocked').replace('{n}', String(p.blocked))}</span>}
                                                        {samples > 0 && <span>{t('insights.health.onTime').replace('{n}', pct(p.onTime / samples))}</span>}
                                                        <span>{t('insights.health.activity').replace('{n}', String(p.activity7d))}</span>
                                                    </span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </>
                )}

                <section className="insights-card insights-card--wide insights-report">
                    <div className="insights-report__head">
                        <div>
                            <h2>{t('insights.report.title')}</h2>
                            <p className="insights-card__hint">
                                {report ? t('insights.report.week').replace('{week}', report.week) : t('insights.report.hint')}
                            </p>
                        </div>
                        <div className="insights-report__actions">
                            {report && (
                                <Button size="sm" variant="ghost" onClick={() => void copyReport()} icon={<span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>}>
                                    {copied ? t('insights.report.copied') : t('insights.report.copy')}
                                </Button>
                            )}
                            {report && wikiEnabled && (wikiDocId ? (
                                <Link to={`/wiki/${wikiDocId}`} className="insights-report__wiki-link">
                                    <span className="material-symbols-outlined" aria-hidden="true">menu_book</span>
                                    {t('insights.report.openWiki')}
                                </Link>
                            ) : (
                                <Button size="sm" variant="ghost" onClick={() => void saveToWiki()} disabled={wikiBusy}
                                    icon={<span className="material-symbols-outlined">menu_book</span>}>
                                    {wikiBusy ? t('insights.report.savingWiki') : t('insights.report.saveWiki')}
                                </Button>
                            ))}
                            <Button size="sm" variant="secondary" onClick={() => void generateReport()} disabled={reportBusy}
                                icon={<span className="material-symbols-outlined">auto_awesome</span>}>
                                {reportBusy ? t('insights.report.generating') : report ? t('insights.report.regenerate') : t('insights.report.generate')}
                            </Button>
                        </div>
                    </div>
                    {reportError && <p className="insights-report__error">{t('insights.report.error')}</p>}
                    {report && <MarkdownContent markdown={report.markdown} className="insights-report__body" />}
                </section>
            </div>
        </div>
    );
};
