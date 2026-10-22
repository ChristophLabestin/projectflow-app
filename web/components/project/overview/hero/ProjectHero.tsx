import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../../../../types';
import type { ProjectHealth } from '../../../../services/healthService';
import { Badge } from '../../../common/Badge/Badge';
import type { OverviewDerived } from '../hooks/useProjectOverviewDerived';
import type { OverviewMember } from '../hooks/useProjectMembers';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
    Active: 'success',
    'In Testing': 'warning',
    Completed: 'success',
    Canceled: 'error',
    'On Hold': 'warning',
    Review: 'neutral',
    Planning: 'neutral',
    Backlog: 'neutral',
    Brainstorming: 'neutral'
};

export type ProjectHeroProps = {
    project: Project;
    health: ProjectHealth | null;
    derived: OverviewDerived;
    tenantQuery: string;
    companyContextProject?: Project | null;
    linkedCompanyCount?: number;
    canManageTasks: boolean;
    isOwner: boolean;
    canDelete?: boolean;
    onDelete?: () => void;
    isPinned: boolean;
    onNewTask: () => void;
    onTogglePin: () => void;
    onEdit: () => void;
    onInvite: () => void;
    onReport: () => void;
    onOpenHealth: () => void;
    onOpenNext: () => void;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
    onComplete: () => void;
    isWide: boolean;
    onToggleWide: () => void;
    coverExpanded: boolean;
    onToggleCoverExpand: () => void;
    reminders?: React.ReactNode;
    members: OverviewMember[];
    onOpenContext: () => void;
    t: (key: string, fallback?: string) => string;
};

export const ProjectHero: React.FC<ProjectHeroProps> = ({
    project,
    health,
    derived,
    tenantQuery,
    companyContextProject,
    linkedCompanyCount,
    canManageTasks,
    isOwner,
    canDelete,
    onDelete,
    isPinned,
    onNewTask,
    onTogglePin,
    onEdit,
    onInvite,
    onReport,
    onOpenHealth,
    onOpenNext,
    onPause,
    onResume,
    onCancel,
    onComplete,
    isWide,
    onToggleWide,
    coverExpanded,
    onToggleCoverExpand,
    reminders,
    members,
    onOpenContext,
    t
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const statusVariant = STATUS_VARIANT[project.status] || 'neutral';
    const statusLabel = t(`status.${project.status}`, project.status);
    const hasCover = Boolean(project.coverImage);
    const purpose = project.description?.trim();
    const initial = project.title?.trim().charAt(0).toUpperCase() || '?';

    const completion = Math.max(0, Math.min(100, Math.round(derived.completionPct)));
    const summary = [
        `${completion}% ${t('projectOverview.v2.hero.complete', 'Complete')}`,
        t('projectOverview.v2.hero.openCount', '{count} open').replace('{count}', String(derived.openTaskCount)),
        t('projectOverview.v2.hero.overdueCount', '{count} overdue').replace('{count}', String(derived.overdueCount)),
        t('projectOverview.v2.hero.dueSoonCount', '{count} due soon').replace('{count}', String(derived.dueSoonCount)),
        health ? `${t('projectOverview.command.health', 'Health')} ${health.score}` : ''
    ].filter(Boolean).join(' · ');

    const nextItem = derived.nextItem;
    const nextLabelKey = nextItem
        ? `projectOverview.v2.attention.${nextItem.kind}`
        : '';

    return (
        <header className={`po-hero ${hasCover ? 'po-hero--has-cover' : ''} ${hasCover && coverExpanded ? 'po-hero--cover-expanded' : ''}`.trim()}>
            {hasCover && (
                <div className="po-hero__cover" style={{ backgroundImage: `url(${project.coverImage})` }} aria-hidden="true">
                    <button
                        type="button"
                        className="po-hero__cover-toggle"
                        onClick={onToggleCoverExpand}
                        title={coverExpanded ? t('projectOverview.v2.hero.shrinkCover', 'Shrink cover') : t('projectOverview.v2.hero.enlargeCover', 'Enlarge cover')}
                        aria-label={coverExpanded ? t('projectOverview.v2.hero.shrinkCover', 'Shrink cover') : t('projectOverview.v2.hero.enlargeCover', 'Enlarge cover')}
                        aria-pressed={coverExpanded}
                    >
                        <span className="material-symbols-outlined">{coverExpanded ? 'unfold_less' : 'unfold_more'}</span>
                    </button>
                </div>
            )}

            <div className="po-hero__body">
                <div className="po-hero__identity">
                    <div
                        className={`po-hero__icon ${project.squareIcon ? 'po-hero__icon--image' : ''}`.trim()}
                        style={project.squareIcon ? { backgroundImage: `url(${project.squareIcon})` } : undefined}
                        aria-hidden="true"
                    >
                        {!project.squareIcon && <span>{initial}</span>}
                    </div>
                    <div className="po-hero__identity-copy">
                        <div className="po-hero__title-row">
                            <h1 className="po-hero__title">{project.title}</h1>
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                            {project.priority && (
                                <span className="po-hero__priority">{t(`tasks.priority.${project.priority.toLowerCase()}`, project.priority)}</span>
                            )}
                            {companyContextProject && (
                                <Link to={`/project/${companyContextProject.id}${tenantQuery}`} className="po-hero__chip">
                                    <span className="material-symbols-outlined">domain</span>
                                    {t('projectOverview.company.partOf', 'Part of {company}').replace('{company}', companyContextProject.title)}
                                </Link>
                            )}
                            {typeof linkedCompanyCount === 'number' && linkedCompanyCount > 0 && (
                                <span className="po-hero__chip po-hero__chip--static">
                                    <span className="material-symbols-outlined">account_tree</span>
                                    {t('projectOverview.company.linkedCount', '{count} linked').replace('{count}', String(linkedCompanyCount))}
                                </span>
                            )}
                        </div>
                        {purpose
                            ? <p className="po-hero__purpose">{purpose}</p>
                            : isOwner && (
                                <button type="button" className="po-hero__purpose po-hero__purpose--empty" onClick={onEdit}>
                                    {t('projectOverview.v2.hero.addPurpose', 'Add a project purpose')}
                                </button>
                            )}
                    </div>
                </div>

                <div className="po-hero__side">
                    <button
                        type="button"
                        className="po-hero__pulse"
                        onClick={onOpenHealth}
                        title={summary}
                        aria-label={`${t('projectOverview.command.health', 'Health')}: ${summary}`}
                    >
                        <span className="po-hero__pulse-progress">
                            <span className="po-hero__pulse-track" aria-hidden="true">
                                <span className="po-hero__pulse-fill" style={{ width: `${completion}%` }} />
                            </span>
                            <span className="po-hero__pulse-value">{completion}%</span>
                        </span>
                        {health && (
                            <>
                                <span className="po-hero__pulse-divider" aria-hidden="true" />
                                <span className={`po-hero__pulse-health po-hero__pulse-health--${health.status}`}>
                                    <span className="po-hero__pulse-dot" aria-hidden="true" />
                                    {t(`status.${health.status}`, health.status)}
                                </span>
                            </>
                        )}
                    </button>

                    <button type="button" className="po-hero__context" onClick={onOpenContext}>
                        {members.length > 0 && (
                            <span className="po-hero__avatars" aria-hidden="true">
                                {members.slice(0, 3).map((member) => (
                                    <span
                                        key={member.id}
                                        className="po-hero__avatar"
                                        style={member.photoURL ? { backgroundImage: `url(${member.photoURL})` } : undefined}
                                    >
                                        {!member.photoURL && (member.displayName.trim().charAt(0).toUpperCase() || '?')}
                                    </span>
                                ))}
                            </span>
                        )}
                        <span>{t('projectOverview.v2.context.open', 'Project info')}</span>
                    </button>

                    {reminders}

                    <div className="po-hero__menu" ref={menuRef}>
                        <button
                            type="button"
                            className="po-hero__icon-btn"
                            onClick={() => setMenuOpen((open) => !open)}
                            aria-haspopup="true"
                            aria-expanded={menuOpen}
                            aria-label={t('projectOverview.v2.hero.more', 'More actions')}
                        >
                            <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                        {menuOpen && (
                            <div className="po-hero__menu-list" role="menu">
                                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onTogglePin(); }}>
                                    <span className="material-symbols-outlined">push_pin</span>
                                    {isPinned ? t('projectOverview.v2.hero.unpin', 'Unpin') : t('projectOverview.v2.hero.pin', 'Pin')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onToggleWide(); }}>
                                    <span className="material-symbols-outlined">{isWide ? 'close_fullscreen' : 'open_in_full'}</span>
                                    {isWide ? t('projectOverview.v2.hero.collapseWidth', 'Fit width') : t('projectOverview.v2.hero.fullWidth', 'Full width')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onReport(); }}>
                                    <span className="material-symbols-outlined">auto_awesome</span>
                                    {t('projectOverview.v2.hero.report', 'Project report')}
                                </button>
                                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onInvite(); }}>
                                    <span className="material-symbols-outlined">person_add</span>
                                    {t('projectOverview.actions.invite', 'Invite')}
                                </button>
                                {isOwner && (
                                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onEdit(); }}>
                                        <span className="material-symbols-outlined">settings</span>
                                        {t('projectOverview.v2.hero.settings', 'Settings')}
                                    </button>
                                )}
                                {isOwner && project.status !== 'Canceled' && (
                                    <>
                                        <span className="po-hero__menu-divider" />
                                        {project.status === 'On Hold' ? (
                                            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onResume(); }}>
                                                <span className="material-symbols-outlined">play_circle</span>
                                                {t('projectOverview.v2.lifecycle.resume', 'Resume project')}
                                            </button>
                                        ) : (
                                            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onPause(); }}>
                                                <span className="material-symbols-outlined">pause_circle</span>
                                                {t('projectOverview.v2.lifecycle.pause', 'Pause project')}
                                            </button>
                                        )}
                                        {project.status !== 'Completed' && (
                                            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onComplete(); }}>
                                                <span className="material-symbols-outlined">check_circle</span>
                                                {t('projectOverview.v2.lifecycle.complete', 'Mark complete')}
                                            </button>
                                        )}
                                        <button type="button" role="menuitem" className="po-hero__menu-danger" onClick={() => { setMenuOpen(false); onCancel(); }}>
                                            <span className="material-symbols-outlined">cancel</span>
                                            {t('projectOverview.v2.lifecycle.cancel', 'Cancel project')}
                                        </button>
                                    </>
                                )}
                                {canDelete && onDelete && (
                                    <>
                                        <span className="po-hero__menu-divider" />
                                        <button type="button" role="menuitem" className="po-hero__menu-danger" onClick={() => { setMenuOpen(false); onDelete(); }}>
                                            <span className="material-symbols-outlined">delete</span>
                                            {t('projectOverview.delete.title', 'Delete project')}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="po-hero__signals">
                {nextItem && (
                    <button type="button" className={`po-hero__signal po-hero__signal--${nextItem.kind}`} onClick={onOpenNext}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                            {nextItem.kind === 'overdue' ? 'priority_high' : nextItem.kind === 'blocked' ? 'block' : nextItem.kind === 'atRisk' ? 'warning' : 'schedule'}
                        </span>
                        <span className="po-hero__signal-label">{t(nextLabelKey, nextItem.kind)}</span>
                        <span className="po-hero__signal-title">{nextItem.title}</span>
                        <span className="material-symbols-outlined po-hero__signal-cta" aria-hidden="true">arrow_forward</span>
                    </button>
                )}
                <span className="po-hero__stat">{t('projectOverview.v2.hero.openCount', '{count} open').replace('{count}', String(derived.openTaskCount))}</span>
                {derived.overdueCount > 0 && (
                    <span className="po-hero__stat po-hero__stat--danger">{t('projectOverview.v2.hero.overdueCount', '{count} overdue').replace('{count}', String(derived.overdueCount))}</span>
                )}
                {derived.dueSoonCount > 0 && (
                    <span className="po-hero__stat po-hero__stat--warning">{t('projectOverview.v2.hero.dueSoonCount', '{count} due soon').replace('{count}', String(derived.dueSoonCount))}</span>
                )}
            </div>
        </header>
    );
};
