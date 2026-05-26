import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';

import '../src/styles/components/_project-codex.scss';
import { Button } from '../components/common/Button/Button';
import { useLanguage } from '../context/LanguageContext';
import { subscribeProjectCodexFollowUps, subscribeProjectCodexSessions } from '../services/domain/codexService';
import type { CodexFollowUp, CodexSession, CodexSessionStatus } from '../types';
import { toMillis } from '../utils/time';

type SessionFilter = 'all' | CodexSessionStatus;

const STATUS_FILTERS: SessionFilter[] = ['all', 'running', 'partial', 'blocked', 'completed'];

const statusIcon: Record<CodexSessionStatus, string> = {
    running: 'terminal',
    partial: 'rule',
    blocked: 'block',
    completed: 'check_circle',
};

const formatTimestamp = (value: any, pattern: string, locale: Locale | undefined, emptyLabel: string) => {
    const millis = toMillis(value);
    if (!millis) return emptyLabel;
    return format(new Date(millis), pattern, { locale });
};

export const ProjectCodex = () => {
    const { id } = useParams<{ id: string }>();
    const { t, dateFormat, dateLocale } = useLanguage();
    const [sessions, setSessions] = useState<CodexSession[]>([]);
    const [followUps, setFollowUps] = useState<CodexFollowUp[]>([]);
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [followUpsLoaded, setFollowUpsLoaded] = useState(false);
    const [filter, setFilter] = useState<SessionFilter>('all');

    useEffect(() => {
        if (!id) return;

        const unsubscribeSessions = subscribeProjectCodexSessions(id, (items) => {
            setSessions(items);
            setSessionsLoaded(true);
        });
        const unsubscribeFollowUps = subscribeProjectCodexFollowUps(id, (items) => {
            setFollowUps(items);
            setFollowUpsLoaded(true);
        });

        return () => {
            unsubscribeSessions();
            unsubscribeFollowUps();
        };
    }, [id]);

    const filteredSessions = useMemo(() => (
        filter === 'all'
            ? sessions
            : sessions.filter((session) => session.status === filter)
    ), [filter, sessions]);

    const activeSessions = sessions.filter((session) => session.status === 'running').length;
    const openFollowUps = followUps.filter((followUp) => (followUp.status || 'open') === 'open');
    const latestSession = sessions[0];
    const latestValidation = latestSession?.lastValidationStatus || latestSession?.validationStatus || t('projectCodex.emptyValue');
    const loading = !sessionsLoaded || !followUpsLoaded;

    if (loading) {
        return (
            <div className="project-codex__loading">
                <span className="material-symbols-outlined project-codex__loading-icon">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="project-codex custom-scrollbar">
            <div className="project-codex__content">
                <header className="project-codex__header">
                    <div className="project-codex__title-block">
                        <Link
                            to={`/project/${id}`}
                            className="project-codex__back"
                            aria-label={t('projectCodex.back')}
                        >
                            <span className="material-symbols-outlined project-codex__back-icon">arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="project-codex__title">{t('projectCodex.title')}</h1>
                            <p className="project-codex__subtitle">{t('projectCodex.subtitle')}</p>
                        </div>
                    </div>
                    <Link to={`/project/${id}/activity`} className="project-codex__activity-link">
                        <span className="material-symbols-outlined">history</span>
                        {t('projectCodex.actions.activity')}
                    </Link>
                </header>

                <section className="project-codex__summary" aria-label={t('projectCodex.summary.label')}>
                    <div className="project-codex__metric">
                        <span className="project-codex__metric-label">{t('projectCodex.summary.active')}</span>
                        <strong className="project-codex__metric-value">{activeSessions}</strong>
                    </div>
                    <div className="project-codex__metric">
                        <span className="project-codex__metric-label">{t('projectCodex.summary.followUps')}</span>
                        <strong className="project-codex__metric-value">{openFollowUps.length}</strong>
                    </div>
                    <div className="project-codex__metric">
                        <span className="project-codex__metric-label">{t('projectCodex.summary.validation')}</span>
                        <strong className="project-codex__metric-value project-codex__metric-value--text">{latestValidation}</strong>
                    </div>
                    <div className="project-codex__metric">
                        <span className="project-codex__metric-label">{t('projectCodex.summary.updated')}</span>
                        <strong className="project-codex__metric-value project-codex__metric-value--text">
                            {formatTimestamp(latestSession?.updatedAt, dateFormat, dateLocale, t('projectCodex.emptyValue'))}
                        </strong>
                    </div>
                </section>

                <div className="project-codex__layout">
                    <section className="project-codex__sessions" aria-labelledby="project-codex-sessions-title">
                        <div className="project-codex__section-header">
                            <div>
                                <span className="project-codex__eyebrow">{t('projectCodex.sessions.eyebrow')}</span>
                                <h2 id="project-codex-sessions-title">{t('projectCodex.sessions.title')}</h2>
                            </div>
                            <div className="project-codex__filters">
                                {STATUS_FILTERS.map((status) => (
                                    <Button
                                        key={status}
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className={`project-codex__filter ${filter === status ? 'is-active' : ''}`.trim()}
                                        onClick={() => setFilter(status)}
                                        aria-pressed={filter === status}
                                    >
                                        {t(`projectCodex.filters.${status}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {filteredSessions.length === 0 ? (
                            <div className="project-codex__empty">
                                <span className="material-symbols-outlined">terminal</span>
                                <h3>{t('projectCodex.sessions.empty.title')}</h3>
                                <p>{t('projectCodex.sessions.empty.description')}</p>
                            </div>
                        ) : (
                            <div className="project-codex__session-list">
                                {filteredSessions.map((session) => (
                                    <article key={session.id} className={`project-codex__session is-${session.status}`}>
                                        <div className="project-codex__session-icon">
                                            <span className="material-symbols-outlined">{statusIcon[session.status] || 'terminal'}</span>
                                        </div>
                                        <div className="project-codex__session-body">
                                            <div className="project-codex__session-topline">
                                                <h3>{session.title}</h3>
                                                <span className={`project-codex__status is-${session.status}`}>
                                                    {t(`projectCodex.status.${session.status}`)}
                                                </span>
                                            </div>
                                            {session.summary && (
                                                <p className="project-codex__session-summary">{session.summary}</p>
                                            )}
                                            <div className="project-codex__session-meta">
                                                <span>
                                                    <span className="material-symbols-outlined">account_tree</span>
                                                    {session.branch || t('projectCodex.emptyValue')}
                                                </span>
                                                <span>
                                                    <span className="material-symbols-outlined">verified</span>
                                                    {session.lastValidationStatus || session.validationStatus || t('projectCodex.emptyValue')}
                                                </span>
                                                <span>
                                                    <span className="material-symbols-outlined">schedule</span>
                                                    {formatTimestamp(session.updatedAt, 'p', dateLocale, t('projectCodex.emptyValue'))}
                                                </span>
                                            </div>
                                            {session.lastCheckpointSummary && (
                                                <p className="project-codex__checkpoint">{session.lastCheckpointSummary}</p>
                                            )}
                                            {Boolean(session.filesTouched?.length) && (
                                                <div className="project-codex__files" aria-label={t('projectCodex.files.label')}>
                                                    {session.filesTouched?.slice(0, 4).map((filePath) => (
                                                        <span key={filePath} className="project-codex__file">{filePath}</span>
                                                    ))}
                                                    {(session.filesTouched?.length || 0) > 4 && (
                                                        <span className="project-codex__file project-codex__file--more">
                                                            {t('projectCodex.files.more').replace('{count}', String((session.filesTouched?.length || 0) - 4))}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <aside className="project-codex__inbox" aria-labelledby="project-codex-inbox-title">
                        <div className="project-codex__section-header">
                            <div>
                                <span className="project-codex__eyebrow">{t('projectCodex.inbox.eyebrow')}</span>
                                <h2 id="project-codex-inbox-title">{t('projectCodex.inbox.title')}</h2>
                            </div>
                        </div>

                        {openFollowUps.length === 0 ? (
                            <div className="project-codex__empty project-codex__empty--compact">
                                <span className="material-symbols-outlined">playlist_add_check</span>
                                <h3>{t('projectCodex.inbox.empty.title')}</h3>
                                <p>{t('projectCodex.inbox.empty.description')}</p>
                            </div>
                        ) : (
                            <div className="project-codex__followup-list">
                                {openFollowUps.map((followUp) => (
                                    <article key={followUp.id} className="project-codex__followup">
                                        <div className="project-codex__followup-header">
                                            <h3>{followUp.title}</h3>
                                            {followUp.priority && (
                                                <span className="project-codex__priority">{followUp.priority}</span>
                                            )}
                                        </div>
                                        {followUp.description && (
                                            <p>{followUp.description}</p>
                                        )}
                                        <div className="project-codex__followup-actions">
                                            {followUp.taskId && (
                                                <Link to={`/project/${id}/tasks/${followUp.taskId}`}>
                                                    <span className="material-symbols-outlined">open_in_new</span>
                                                    {t('projectCodex.inbox.openTask')}
                                                </Link>
                                            )}
                                            <span>
                                                {formatTimestamp(followUp.updatedAt || followUp.createdAt, dateFormat, dateLocale, t('projectCodex.emptyValue'))}
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
};
