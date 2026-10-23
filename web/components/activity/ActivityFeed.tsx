import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import type { DocumentSnapshot } from 'firebase/firestore';

import { useLanguage } from '../../context/LanguageContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Select } from '../common/Select/Select';
import { Button } from '../common/Button/Button';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { useFlipList } from '../motion';
import { ACTIVITY_FILTER_DOMAINS, activityTypeDef } from '../../config/activityTypes';
import {
    fetchActivityPage,
    subscribeActivityFeed,
    type ActivityEvent,
    type ActivityFeedFilter,
} from '../../services/domain/activityStreamService';
import { subscribeWorkspaceMembers } from '../../services/domain/workspaceMembersService';
import { getUserProjects } from '../../services/domain/projectsService';
import {
    activitySentence,
    activityTargetPath,
    dayKey,
    groupEventsByDay,
    mergeEventPages,
} from '../../utils/activityStreamText';
import type { Project } from '../../types';
import './activity-feed.scss';

type Period = '7' | '30' | '90' | 'all';
const PERIODS: Period[] = ['7', '30', '90', 'all'];
const DAY_MS = 24 * 60 * 60 * 1000;

interface ActivityFeedProps {
    /** Project feed when set; workspace feed otherwise. */
    projectId?: string;
    /** Default period when the URL has none. */
    defaultPeriod?: Period;
}

interface MemberOption {
    uid: string;
    displayName: string;
    photoURL?: string;
}

const ActorAvatar: React.FC<{ event: ActivityEvent; photoURL?: string }> = ({ event, photoURL }) => {
    const { actor } = event;
    if (actor.kind === 'automation' || actor.kind === 'system') {
        return (
            <span className={`activity-feed__avatar activity-feed__avatar--${actor.kind}`} aria-hidden="true">
                <span className="material-symbols-outlined">{actor.kind === 'automation' ? 'bolt' : 'settings'}</span>
            </span>
        );
    }
    const src = actor.photoURL || photoURL;
    return (
        <span className="activity-feed__avatar" aria-hidden="true">
            {src ? <img src={src} alt="" /> : <span>{(actor.name || '?').slice(0, 1).toUpperCase()}</span>}
            {actor.kind === 'ai' && (
                <span className="activity-feed__avatar-badge material-symbols-outlined">auto_awesome</span>
            )}
        </span>
    );
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ projectId, defaultPeriod = '30' }) => {
    const { t, dateFormat, dateLocale } = useLanguage();
    const { activeWorkspaceId: tenantId, activeWorkspace } = useWorkspace();
    const isGuest = activeWorkspace?.role === 'Guest';
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const person = searchParams.get('person') || '';
    const project = projectId || searchParams.get('project') || '';
    const domain = searchParams.get('type') || '';
    const period = (PERIODS.includes(searchParams.get('period') as Period) ? searchParams.get('period') : defaultPeriod) as Period;

    const setParam = useCallback((key: string, value: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value) next.set(key, value);
            else next.delete(key);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const [members, setMembers] = useState<MemberOption[]>([]);
    const [projects, setProjects] = useState<Project[] | null>(projectId ? [] : null);

    useEffect(() => {
        if (!tenantId) return undefined;
        return subscribeWorkspaceMembers((list) => setMembers(list.map((m) => ({ uid: m.uid, displayName: m.displayName, photoURL: m.photoURL }))), tenantId);
    }, [tenantId]);

    useEffect(() => {
        if (projectId || !tenantId) return;
        let alive = true;
        getUserProjects(tenantId, { includeScreenshots: false })
            .then((list) => { if (alive) setProjects(list); })
            .catch(() => { if (alive) setProjects([]); });
        return () => { alive = false; };
    }, [projectId, tenantId]);

    // Guests must scope every query to their projects (firestore.rules).
    const filter = useMemo<ActivityFeedFilter | null>(() => {
        if (!tenantId) return null;
        if (isGuest && !project && projects === null) return null; // wait for the guest's projects
        // Period start is rounded to the hour so the live query stays stable across renders.
        const sinceMs = period === 'all' ? undefined : Math.floor((Date.now() - Number(period) * DAY_MS) / 3600000) * 3600000;
        return {
            projectId: project || undefined,
            scopeProjectIds: isGuest && !project ? (projects || []).map((p) => p.id) : undefined,
            actorId: person || undefined,
            domain: domain || undefined,
            sinceMs,
        };
    }, [tenantId, isGuest, project, projects, person, domain, period]);
    const filterKey = JSON.stringify(filter);

    const [live, setLive] = useState<ActivityEvent[]>([]);
    const [liveCursor, setLiveCursor] = useState<DocumentSnapshot | null>(null);
    const [liveHasMore, setLiveHasMore] = useState(false);
    const [older, setOlder] = useState<ActivityEvent[]>([]);
    const [olderCursor, setOlderCursor] = useState<DocumentSnapshot | null>(null);
    const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        setOlder([]);
        setOlderCursor(null);
        setOlderHasMore(null);
        setError(false);
        if (!filter || !tenantId) return undefined;
        setLoading(true);
        return subscribeActivityFeed(tenantId, filter, (page) => {
            setLive(page.events);
            setLiveCursor(page.cursor);
            setLiveHasMore(page.hasMore);
            setLoading(false);
        }, (err) => {
            console.error('Activity feed failed', err);
            setError(true);
            setLoading(false);
        });
        // filterKey captures every filter field.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantId, filterKey]);

    const hasMore = olderHasMore ?? liveHasMore;
    const loadMore = useCallback(async () => {
        const cursor = olderCursor || liveCursor;
        if (!filter || !tenantId || !cursor || loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const page = await fetchActivityPage(tenantId, filter, cursor);
            setOlder((prev) => [...prev, ...page.events]);
            setOlderCursor(page.cursor);
            setOlderHasMore(page.hasMore);
        } catch (err) {
            console.error('Activity page failed', err);
            setOlderHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [filter, tenantId, olderCursor, liveCursor, loadingMore, hasMore]);

    // Endless scroll: load the next page when the sentinel comes into view.
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !hasMore) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) void loadMore();
        }, { rootMargin: '400px 0px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);

    const events = useMemo(() => mergeEventPages(live, older), [live, older]);
    const groups = useMemo(() => groupEventsByDay(events), [events]);
    const listRef = useRef<HTMLDivElement | null>(null);
    useFlipList(listRef, { keyAttribute: 'data-event-id', enter: true });

    const photoById = useMemo(() => new Map(members.map((m) => [m.uid, m.photoURL])), [members]);
    const formatDate = useCallback((value: string) => {
        const date = new Date(`${value}T12:00:00`);
        return Number.isNaN(date.getTime()) ? value : format(date, dateFormat, { locale: dateLocale });
    }, [dateFormat, dateLocale]);

    const today = dayKey(Date.now());
    const yesterday = dayKey(Date.now() - DAY_MS);
    const dayLabel = (key: string) => {
        if (key === today) return t('activity.group.today');
        if (key === yesterday) return t('activity.group.yesterday');
        return format(new Date(`${key}T12:00:00`), 'EEEE, d. MMMM yyyy', { locale: dateLocale });
    };

    const personOptions = useMemo(() => [
        { value: '', label: t('activity.filter.allPeople') },
        ...members
            .slice()
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
            .map((m) => ({ value: m.uid, label: m.displayName || m.uid })),
    ], [members, t]);
    const projectOptions = useMemo(() => [
        { value: '', label: t('activity.filter.allProjects') },
        ...(projects || [])
            .slice()
            .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
            .map((p) => ({ value: p.id, label: p.title || p.id })),
    ], [projects, t]);
    const typeOptions = useMemo(() => [
        { value: '', label: t('activity.filter.allTypes') },
        ...ACTIVITY_FILTER_DOMAINS.map((d) => ({ value: d, label: t(`activity.domain.${d}`) })),
    ], [t]);
    const periodOptions = useMemo(() => PERIODS.map((p) => ({ value: p, label: t(`activity.filter.period.${p}`) })), [t]);

    const filtered = Boolean(person || domain || (!projectId && project) || period !== defaultPeriod);
    const resetFilters = () => setSearchParams(new URLSearchParams(), { replace: true });

    return (
        <section className="activity-feed">
            <div className="activity-feed__filters" role="group" aria-label={t('activity.title')}>
                <Select value={person} onChange={(v) => setParam('person', String(v))} options={personOptions} className="activity-feed__filter" />
                {!projectId && (
                    <Select value={project} onChange={(v) => setParam('project', String(v))} options={projectOptions} className="activity-feed__filter" />
                )}
                <Select value={domain} onChange={(v) => setParam('type', String(v))} options={typeOptions} className="activity-feed__filter" />
                <Select value={period} onChange={(v) => setParam('period', String(v) === defaultPeriod ? '' : String(v))} options={periodOptions} className="activity-feed__filter" />
                {filtered && (
                    <Button size="sm" variant="ghost" onClick={resetFilters}>{t('activity.filter.reset')}</Button>
                )}
            </div>

            {loading ? (
                <div className="activity-feed__skeleton" aria-busy="true">
                    {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="activity-feed__skeleton-row" />)}
                </div>
            ) : error ? (
                <EmptyState
                    compact
                    title={t('activity.error')}
                    icon={<span className="material-symbols-outlined">error</span>}
                />
            ) : events.length === 0 ? (
                <EmptyState
                    title={filtered ? t('activity.empty.filtered') : t('activity.empty.title')}
                    message={filtered ? undefined : t('activity.empty.message')}
                    icon={<span className="material-symbols-outlined">history</span>}
                    actions={filtered ? <Button size="sm" variant="secondary" onClick={resetFilters}>{t('activity.filter.reset')}</Button> : undefined}
                />
            ) : (
                <div className="activity-feed__list" ref={listRef}>
                    {groups.map((group) => (
                        <div key={group.key} className="activity-feed__day">
                            <h3 className="activity-feed__day-label">{dayLabel(group.key)}</h3>
                            <ol className="activity-feed__events">
                                {group.events.map((event) => {
                                    const def = activityTypeDef(event.type, event.domain);
                                    const target = activityTargetPath(event);
                                    const snippet = typeof event.meta?.snippet === 'string' ? event.meta.snippet : '';
                                    const parts = activitySentence(event, t, formatDate);
                                    const open = () => { if (target) navigate(target); };
                                    return (
                                        <li key={event.id} data-event-id={event.id}>
                                            <div
                                                className={`activity-feed__event ${target ? 'is-link' : ''}`.trim()}
                                                role={target ? 'link' : undefined}
                                                tabIndex={target ? 0 : undefined}
                                                onClick={open}
                                                onKeyDown={(e) => { if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
                                            >
                                                <ActorAvatar event={event} photoURL={event.actorId ? photoById.get(event.actorId) : undefined} />
                                                <div className="activity-feed__body">
                                                    <p className="activity-feed__sentence">
                                                        {parts.map((part, index) => part.kind === 'actor'
                                                            ? <strong key={index}>{part.value}</strong>
                                                            : part.kind === 'object'
                                                                ? <span key={index} className="activity-feed__object">{part.value}</span>
                                                                : <React.Fragment key={index}>{part.value}</React.Fragment>)}
                                                    </p>
                                                    {snippet && <p className="activity-feed__snippet">{snippet}</p>}
                                                    <p className="activity-feed__meta">
                                                        <span className="material-symbols-outlined activity-feed__type-icon" aria-hidden="true">{def.icon}</span>
                                                        <time dateTime={new Date(event.createdAtMs).toISOString()}>{format(event.createdAtMs, 'HH:mm')}</time>
                                                        {!projectId && event.projectId && event.projectTitle && (
                                                            <>
                                                                <span aria-hidden="true">·</span>
                                                                <Link
                                                                    to={`/project/${event.projectId}`}
                                                                    className="activity-feed__project"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {event.projectTitle}
                                                                </Link>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    ))}
                    <div ref={sentinelRef} className="activity-feed__sentinel">
                        {hasMore ? (
                            <Button size="sm" variant="ghost" onClick={() => void loadMore()} disabled={loadingMore}>
                                {t('activity.loadMore')}
                            </Button>
                        ) : (
                            <span className="activity-feed__end">{t('activity.end')}</span>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};
