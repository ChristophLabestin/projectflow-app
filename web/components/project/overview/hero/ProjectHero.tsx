import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../../../../types';
import type { ProjectHealth } from '../../../../services/healthService';
import { Badge } from '../../../common/Badge/Badge';
import { HealthIndicator } from '../../HealthIndicator';
import type { OverviewDerived } from '../hooks/useProjectOverviewDerived';

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
    t: (key: string, fallback?: string) => string;
};

const ProgressRing: React.FC<{ pct: number; label: string }> = ({ pct, label }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    return (
        <div className="po-hero__metric po-hero__metric--ring" title={label}>
            <svg className="po-hero__ring" viewBox="0 0 44 44" aria-hidden="true">
                <circle className="po-hero__ring-track" cx="22" cy="22" r={radius} fill="none" strokeWidth="4" />
                <circle
                    className="po-hero__ring-value"
                    cx="22"
                    cy="22"
                    r={radius}
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 22 22)"
                />
                <text className="po-hero__ring-text" x="22" y="22" dominantBaseline="central" textAnchor="middle">
                    {pct}%
                </text>
            </svg>
            <span className="po-hero__metric-label">{label}</span>
        </div>
    );
};

const Stat: React.FC<{ value: number | string; label: string; tone?: 'default' | 'danger' | 'warning' }> = ({
    value,
    label,
    tone = 'default'
}) => (
    <div className={`po-hero__metric po-hero__metric--${tone}`}>
        <span className="po-hero__metric-value">{value}</span>
        <span className="po-hero__metric-label">{label}</span>
    </div>
);

export const ProjectHero: React.FC<ProjectHeroProps> = ({
    project,
    health,
    derived,
    tenantQuery,
    companyContextProject,
    linkedCompanyCount,
    canManageTasks,
    isOwner,
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

    const nextItem = derived.nextItem;
    const nextLabelKey = nextItem
        ? `projectOverview.v2.attention.${nextItem.kind}`
        : '';

    return (
        <header className={`po-hero ${hasCover ? 'po-hero--has-cover' : ''}`.trim()}>
            {hasCover && (
                <div className="po-hero__cover" style={{ backgroundImage: `url(${project.coverImage})` }} aria-hidden="true" />
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
                        <div className="po-hero__breadcrumb">
                            <Link to={`/projects${tenantQuery}`} className="po-hero__breadcrumb-link">
                                {t('nav.projects', 'Projects')}
                            </Link>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </div>
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

                <div className="po-hero__metrics" role="group" aria-label={t('projectOverview.v2.hero.metricsLabel', 'Project metrics')}>
                    <ProgressRing pct={derived.completionPct} label={t('projectOverview.v2.hero.complete', 'Complete')} />
                    <Stat value={derived.openTaskCount} label={t('projectOverview.v2.hero.openTasks', 'Open tasks')} />
                    <Stat
                        value={derived.overdueCount}
                        label={t('projectOverview.v2.hero.overdue', 'Overdue')}
                        tone={derived.overdueCount > 0 ? 'danger' : 'default'}
                    />
                    <Stat
                        value={derived.dueSoonCount}
                        label={t('projectOverview.v2.hero.dueSoon', 'Due soon')}
                        tone={derived.dueSoonCount > 0 ? 'warning' : 'default'}
                    />
                    {health && (
                        <button type="button" className="po-hero__health" onClick={onOpenHealth} aria-label={t('projectOverview.command.health', 'Health')}>
                            <HealthIndicator health={health} size="sm" showLabel={false} />
                            <span className="po-hero__metric-label">{t('projectOverview.command.health', 'Health')}</span>
                        </button>
                    )}
                </div>

                <div className="po-hero__actions">
                    <button
                        type="button"
                        className={`po-hero__icon-btn ${isWide ? 'is-active' : ''}`.trim()}
                        onClick={onToggleWide}
                        title={isWide ? t('projectOverview.v2.hero.collapseWidth', 'Fit width') : t('projectOverview.v2.hero.fullWidth', 'Full width')}
                        aria-label={isWide ? t('projectOverview.v2.hero.collapseWidth', 'Fit width') : t('projectOverview.v2.hero.fullWidth', 'Full width')}
                        aria-pressed={isWide}
                    >
                        <span className="material-symbols-outlined">{isWide ? 'close_fullscreen' : 'open_in_full'}</span>
                    </button>
                    <button
                        type="button"
                        className={`po-hero__icon-btn ${isPinned ? 'is-active' : ''}`.trim()}
                        onClick={onTogglePin}
                        title={isPinned ? t('projectOverview.v2.hero.unpin', 'Unpin') : t('projectOverview.v2.hero.pin', 'Pin')}
                        aria-label={isPinned ? t('projectOverview.v2.hero.unpin', 'Unpin') : t('projectOverview.v2.hero.pin', 'Pin')}
                    >
                        <span className="material-symbols-outlined">push_pin</span>
                    </button>
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
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {nextItem && (
                <button type="button" className={`po-hero__next po-hero__next--${nextItem.kind}`} onClick={onOpenNext}>
                    <span className="po-hero__next-icon material-symbols-outlined">
                        {nextItem.kind === 'overdue' ? 'priority_high' : nextItem.kind === 'blocked' ? 'block' : nextItem.kind === 'atRisk' ? 'warning' : 'schedule'}
                    </span>
                    <span className="po-hero__next-copy">
                        <span className="po-hero__next-label">{t(nextLabelKey, nextItem.kind)}</span>
                        <span className="po-hero__next-title">{nextItem.title}</span>
                    </span>
                    <span className="po-hero__next-cta material-symbols-outlined">arrow_forward</span>
                </button>
            )}
        </header>
    );
};
