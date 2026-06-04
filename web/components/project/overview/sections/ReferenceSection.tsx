import React from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../../../../types';
import type { OverviewMember } from '../hooks/useProjectMembers';

export type ReferenceSectionProps = {
    project: Project;
    members: OverviewMember[];
    tenantQuery: string;
    isOwner: boolean;
    onEditBrief: () => void;
    onEditResources: () => void;
    onInvite: () => void;
    t: (key: string, fallback?: string) => string;
};

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export const ReferenceSection: React.FC<ReferenceSectionProps> = ({
    project,
    members,
    tenantQuery,
    isOwner,
    onEditBrief,
    onEditResources,
    onInvite,
    t
}) => {
    const brief = project.brief;
    const hasBrief = Boolean(brief?.objective?.trim() || brief?.scope?.trim() || brief?.successCriteria?.length);
    const resources = [
        ...(project.links || []).map((link) => ({ title: link.title, url: link.url })),
        ...(project.externalResources || []).map((res) => ({ title: res.title, url: res.url }))
    ];

    return (
        <section className="po-reference">
            {/* Brief / contract */}
            <div className="po-ref-card">
                <header className="po-ref-card__head">
                    <h3><span className="material-symbols-outlined">description</span>{t('projectOverview.v2.reference.brief', 'Project brief')}</h3>
                    {isOwner && (
                        <button type="button" className="po-ref-card__edit" onClick={onEditBrief} aria-label={t('projectOverview.v2.hero.settings', 'Edit')}>
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    )}
                </header>
                {hasBrief ? (
                    <div className="po-ref-card__body">
                        {brief?.objective?.trim() && (
                            <div className="po-ref-brief__item">
                                <small>{t('projectOverview.v2.reference.objective', 'Objective')}</small>
                                <p>{brief.objective}</p>
                            </div>
                        )}
                        {brief?.scope?.trim() && (
                            <div className="po-ref-brief__item">
                                <small>{t('projectOverview.v2.reference.scope', 'Scope')}</small>
                                <p>{brief.scope}</p>
                            </div>
                        )}
                        {brief?.successCriteria && brief.successCriteria.length > 0 && (
                            <div className="po-ref-brief__item">
                                <small>{t('projectOverview.v2.reference.success', 'Success criteria')}</small>
                                <ul>
                                    {brief.successCriteria.map((criterion, idx) => <li key={idx}>{criterion}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <button type="button" className="po-ref-card__empty" onClick={onEditBrief} disabled={!isOwner}>
                        <span className="material-symbols-outlined">add</span>
                        {t('projectOverview.v2.reference.briefEmpty', 'Define the objective, scope, and success criteria')}
                    </button>
                )}
            </div>

            {/* Resources */}
            <div className="po-ref-card">
                <header className="po-ref-card__head">
                    <h3><span className="material-symbols-outlined">link</span>{t('projectOverview.v2.reference.resources', 'Resources')}</h3>
                    {isOwner && (
                        <button type="button" className="po-ref-card__edit" onClick={onEditResources} aria-label={t('projectOverview.v2.hero.settings', 'Edit')}>
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    )}
                </header>
                {resources.length > 0 ? (
                    <div className="po-ref-card__body po-ref-links">
                        {resources.slice(0, 8).map((res, idx) => (
                            <a key={idx} href={res.url} target="_blank" rel="noreferrer" className="po-ref-link">
                                <span className="material-symbols-outlined">open_in_new</span>
                                <span className="po-ref-link__title">{res.title || res.url}</span>
                            </a>
                        ))}
                    </div>
                ) : (
                    <button type="button" className="po-ref-card__empty" onClick={onEditResources} disabled={!isOwner}>
                        <span className="material-symbols-outlined">add</span>
                        {t('projectOverview.v2.reference.resourcesEmpty', 'No links yet')}
                    </button>
                )}
            </div>

            {/* Team */}
            <div className="po-ref-card">
                <header className="po-ref-card__head">
                    <h3><span className="material-symbols-outlined">group</span>{t('projectOverview.v2.reference.team', 'Team')}</h3>
                    <button type="button" className="po-ref-card__edit" onClick={onInvite} aria-label={t('projectOverview.actions.invite', 'Invite')}>
                        <span className="material-symbols-outlined">person_add</span>
                    </button>
                </header>
                <div className="po-ref-card__body po-ref-team">
                    {members.length > 0 ? members.slice(0, 10).map((member) => (
                        <div key={member.id} className="po-ref-team__member" title={member.displayName}>
                            <span
                                className="po-ref-team__avatar"
                                style={member.photoURL ? { backgroundImage: `url(${member.photoURL})` } : undefined}
                            >
                                {!member.photoURL && initials(member.displayName)}
                            </span>
                            <span className="po-ref-team__name">{member.displayName}</span>
                        </div>
                    )) : (
                        <span className="po-ref-card__muted">{t('projectOverview.v2.reference.teamEmpty', 'No members yet')}</span>
                    )}
                </div>
            </div>

            {/* Codex */}
            <div className="po-ref-card">
                <header className="po-ref-card__head">
                    <h3><span className="material-symbols-outlined">terminal</span>{t('projectOverview.v2.reference.codex', 'Codex sessions')}</h3>
                </header>
                <div className="po-ref-card__body">
                    <Link to={`/project/${project.id}/codex${tenantQuery}`} className="po-ref-card__link">
                        {t('projectOverview.v2.reference.codexOpen', 'Open Codex')}
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                </div>
            </div>
        </section>
    );
};
