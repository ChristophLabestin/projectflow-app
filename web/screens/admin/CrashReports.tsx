import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { listCrashIssues, type CrashIssue, type CrashPlatform, type CrashStatus } from '../../services/crashReportsService';
import { formatRelative } from './crashFormat';

type Filter<T> = T | 'all';

/** Admin platform → Crashes: issues grouped by fingerprint, newest first (/admin/crashes). */
export const CrashReports: React.FC = () => {
    const { t, language } = useLanguage();
    const { showError } = useToast();
    const [platform, setPlatform] = useState<Filter<CrashPlatform>>('all');
    const [status, setStatus] = useState<Filter<CrashStatus>>('open');
    const [environment, setEnvironment] = useState<Filter<'production' | 'development'>>('production');
    const [issues, setIssues] = useState<CrashIssue[] | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setIssues(await listCrashIssues({
                platform: platform === 'all' ? undefined : platform,
                status: status === 'all' ? undefined : status,
            }));
        } catch (error) {
            console.error(error);
            showError(t('crashAdmin.error.load'));
            setIssues([]);
        } finally {
            setLoading(false);
        }
    }, [platform, status, showError, t]);

    useEffect(() => { void load(); }, [load]);

    const visible = useMemo(
        () => (issues ?? []).filter((issue) => environment === 'all' || issue.environments.includes(environment)),
        [issues, environment],
    );
    const totals = useMemo(() => {
        const day = Date.now() - 86_400_000;
        return {
            issues: visible.length,
            events: visible.reduce((sum, issue) => sum + issue.count, 0),
            lastDay: visible.filter((issue) => issue.lastSeen >= day).length,
        };
    }, [visible]);

    const chips = <T extends string>(value: Filter<T>, set: (next: Filter<T>) => void, options: Filter<T>[], labelKey: string) => (
        <div className="admin-page__chips" role="group" aria-label={t(`${labelKey}.label`)}>
            {options.map((option) => (
                <Button key={option} size="sm" variant={value === option ? 'primary' : 'ghost'} onClick={() => set(option)} aria-pressed={value === option}>
                    {t(`${labelKey}.${option}`)}
                </Button>
            ))}
        </div>
    );

    return (
        <div className="admin-page">
            <header className="admin-page__head">
                <div>
                    <h1 className="admin-page__title">{t('crashAdmin.title')}</h1>
                    <p className="admin-page__subtitle">{t('crashAdmin.subtitle')}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
                    <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                    {t('crashAdmin.refresh')}
                </Button>
            </header>

            <div className="admin-page__stats">
                <div className="admin-page__stat"><strong>{totals.issues}</strong><span>{t('crashAdmin.stats.issues')}</span></div>
                <div className="admin-page__stat"><strong>{totals.events}</strong><span>{t('crashAdmin.stats.events')}</span></div>
                <div className="admin-page__stat"><strong>{totals.lastDay}</strong><span>{t('crashAdmin.stats.lastDay')}</span></div>
            </div>

            <div className="admin-page__filters">
                {chips<CrashPlatform>(platform, setPlatform, ['all', 'web', 'ios'], 'crashAdmin.platform')}
                {chips<CrashStatus>(status, setStatus, ['open', 'resolved', 'ignored', 'all'], 'crashAdmin.status')}
                {chips<'production' | 'development'>(environment, setEnvironment, ['production', 'development', 'all'], 'crashAdmin.environment')}
            </div>

            <section className="admin-page__card admin-page__card--flush">
                {issues === null ? null : visible.length === 0 ? (
                    <p className="admin-page__empty">{t('crashAdmin.empty')}</p>
                ) : (
                    <ul className="crash-list">
                        {visible.map((issue) => (
                            <li key={issue.id}>
                                <Link to={`/admin/crashes/${issue.id}`} className="crash-list__row">
                                    <span className={`crash-badge crash-badge--${issue.platform}`}>{t(`crashAdmin.platform.${issue.platform}`)}</span>
                                    <span className="crash-list__main">
                                        <span className="crash-list__type">{issue.type}</span>
                                        <span className="crash-list__message">{issue.message || issue.culprit || '—'}</span>
                                        {issue.culprit && <span className="crash-list__culprit">{issue.culprit}</span>}
                                    </span>
                                    <span className="crash-list__meta">
                                        <span className="crash-list__count">{issue.count}×</span>
                                        <span>{formatRelative(issue.lastSeen, language)}</span>
                                        <span className="crash-list__release">{issue.lastRelease}</span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};
