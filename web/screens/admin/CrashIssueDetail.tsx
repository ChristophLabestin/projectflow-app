import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import {
    getCrashIssue,
    listCrashEvents,
    setCrashIssueStatus,
    type CrashEvent,
    type CrashIssue,
    type CrashStatus,
} from '../../services/crashReportsService';
import { formatDateTime, formatFrame, formatRelative } from './crashFormat';

/** Admin platform → one crash issue: triage status, recent events, stack and device (/admin/crashes/:issueId). */
export const CrashIssueDetail: React.FC = () => {
    const { issueId = '' } = useParams();
    const { t, language } = useLanguage();
    const { showError, showSuccess } = useToast();
    const [issue, setIssue] = useState<CrashIssue | null | undefined>(undefined);
    const [events, setEvents] = useState<CrashEvent[]>([]);
    const [selected, setSelected] = useState(0);
    const [busy, setBusy] = useState<CrashStatus | null>(null);
    const [showAll, setShowAll] = useState(false);

    const load = useCallback(async () => {
        try {
            const [nextIssue, nextEvents] = await Promise.all([getCrashIssue(issueId), listCrashEvents(issueId)]);
            setIssue(nextIssue);
            setEvents(nextEvents);
            setSelected(0);
        } catch (error) {
            console.error(error);
            showError(t('crashAdmin.error.load'));
            setIssue(null);
        }
    }, [issueId, showError, t]);

    useEffect(() => { void load(); }, [load]);

    const changeStatus = async (status: CrashStatus) => {
        if (!issue) return;
        setBusy(status);
        try {
            await setCrashIssueStatus(issue, status);
            setIssue({ ...issue, status, resolvedRelease: status === 'resolved' ? issue.lastRelease : undefined });
            showSuccess(t(`crashAdmin.statusChanged.${status}`));
        } catch (error) {
            console.error(error);
            showError(t('crashAdmin.error.status'));
        } finally {
            setBusy(null);
        }
    };

    if (issue === undefined) return null;
    if (issue === null) {
        return (
            <div className="admin-page">
                <Link to="/admin/crashes" className="admin-page__back">← {t('crashAdmin.back')}</Link>
                <p className="admin-page__empty">{t('crashAdmin.notFound')}</p>
            </div>
        );
    }

    const event = events[selected];
    const frames = event ? (event.symbolicatedFrames ?? event.frames) : [];
    const shownFrames = showAll ? frames : frames.filter((frame) => frame.inApp !== false).slice(0, 30);

    return (
        <div className="admin-page">
            <Link to="/admin/crashes" className="admin-page__back">← {t('crashAdmin.back')}</Link>
            <header className="admin-page__head">
                <div>
                    <p className="admin-page__eyebrow">
                        <span className={`crash-badge crash-badge--${issue.platform}`}>{t(`crashAdmin.platform.${issue.platform}`)}</span>
                        <span>{t(`crashAdmin.status.${issue.status}`)}</span>
                        <span>· {issue.mechanism}</span>
                    </p>
                    <h1 className="admin-page__title crash-detail__title">{issue.type}</h1>
                    <p className="admin-page__subtitle crash-detail__message">{issue.message || '—'}</p>
                    {issue.culprit && <p className="crash-list__culprit">{issue.culprit}</p>}
                </div>
                <div className="admin-page__actions">
                    {issue.status !== 'resolved' && (
                        <Button size="sm" onClick={() => void changeStatus('resolved')} loading={busy === 'resolved'}>{t('crashAdmin.action.resolve')}</Button>
                    )}
                    {issue.status !== 'ignored' && (
                        <Button size="sm" variant="ghost" onClick={() => void changeStatus('ignored')} loading={busy === 'ignored'}>{t('crashAdmin.action.ignore')}</Button>
                    )}
                    {issue.status !== 'open' && (
                        <Button size="sm" variant="secondary" onClick={() => void changeStatus('open')} loading={busy === 'open'}>{t('crashAdmin.action.reopen')}</Button>
                    )}
                </div>
            </header>

            <div className="admin-page__stats">
                <div className="admin-page__stat"><strong>{issue.count}</strong><span>{t('crashAdmin.stats.events')}</span></div>
                <div className="admin-page__stat"><strong>{formatRelative(issue.firstSeen, language)}</strong><span>{t('crashAdmin.firstSeen')}</span></div>
                <div className="admin-page__stat"><strong>{formatRelative(issue.lastSeen, language)}</strong><span>{t('crashAdmin.lastSeen')}</span></div>
                <div className="admin-page__stat"><strong>{issue.releases.length}</strong><span>{t('crashAdmin.releases')}</span></div>
            </div>

            <div className="crash-detail">
                <section className="admin-page__card admin-page__card--flush crash-detail__events">
                    <h2 className="admin-page__section-title">{t('crashAdmin.events')}</h2>
                    {events.length === 0 ? <p className="admin-page__empty">{t('crashAdmin.noEvents')}</p> : (
                        <ul>
                            {events.map((item, index) => (
                                <li key={item.id}>
                                    <button type="button" className={`crash-detail__event ${index === selected ? 'is-active' : ''}`.trim()} onClick={() => setSelected(index)}>
                                        <span>{formatDateTime(item.timestamp, language)}</span>
                                        <span className="crash-list__release">{item.release}{item.build ? ` (${item.build})` : ''} · {item.environment}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {event && (
                    <section className="admin-page__card crash-detail__event-body">
                        <div className="admin-page__row">
                            <h2 className="admin-page__section-title">{t('crashAdmin.stack')}</h2>
                            <div className="admin-page__chips">
                                <span className="crash-detail__hint">{event.symbolicatedFrames ? t('crashAdmin.symbolicated') : t('crashAdmin.raw')}</span>
                                <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
                                    {showAll ? t('crashAdmin.inAppOnly') : t('crashAdmin.allFrames')}
                                </Button>
                            </div>
                        </div>
                        <ol className="crash-stack">
                            {shownFrames.map((frame, index) => {
                                const { symbol, location } = formatFrame(frame);
                                return (
                                    <li key={index} className={frame.inApp === false ? 'is-system' : ''}>
                                        <code className="crash-stack__symbol">{symbol}</code>
                                        <code className="crash-stack__location">{location}</code>
                                    </li>
                                );
                            })}
                        </ol>
                        {!event.symbolicatedFrames && (
                            <p className="admin-page__muted">{t('crashAdmin.symbolicateHint')}</p>
                        )}

                        <h2 className="admin-page__section-title">{t('crashAdmin.context')}</h2>
                        <dl className="crash-context">
                            <dt>{t('crashAdmin.ctx.release')}</dt><dd>{event.release}{event.build ? ` (${event.build})` : ''}</dd>
                            <dt>{t('crashAdmin.ctx.environment')}</dt><dd>{event.environment}</dd>
                            <dt>{t('crashAdmin.ctx.os')}</dt><dd>{`${event.device.os} ${event.device.osVersion}`.trim()}</dd>
                            {event.device.model && <><dt>{t('crashAdmin.ctx.device')}</dt><dd>{event.device.model}</dd></>}
                            {event.device.browser && <><dt>{t('crashAdmin.ctx.browser')}</dt><dd>{event.device.browser}</dd></>}
                            {event.device.locale && <><dt>{t('crashAdmin.ctx.locale')}</dt><dd>{event.device.locale}</dd></>}
                            {event.route && <><dt>{t('crashAdmin.ctx.route')}</dt><dd><code>{event.route}</code></dd></>}
                            <dt>{t('crashAdmin.ctx.mechanism')}</dt><dd>{event.mechanism}{event.handled ? ` · ${t('crashAdmin.ctx.handled')}` : ''}</dd>
                            <dt>{t('crashAdmin.ctx.install')}</dt><dd><code>{event.installId.slice(0, 8)}</code></dd>
                        </dl>
                    </section>
                )}
            </div>
        </div>
    );
};
