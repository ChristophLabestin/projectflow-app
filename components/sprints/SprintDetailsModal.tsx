import React, { useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { Sprint, Task, Member } from '../../types';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Badge } from '../common/Badge/Badge';
import { Card } from '../common/Card/Card';
import { useLanguage } from '../../context/LanguageContext';

interface SprintDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sprint: Sprint | null;
    tasks: Task[];
    currentUserId: string;
    projectMembers?: Member[];
    onEdit: (sprint: Sprint) => void;
    onDelete: (sprintId: string) => void;
    onStart?: (sprintId: string) => void;
    onComplete?: (sprintId: string) => void;
    onAddMember?: (userId: string) => void;
    onRemoveMember?: (userId: string) => void;
    onJoinRequest?: () => void;
    onApproveRequest?: (userId: string) => void;
    onRejectRequest?: (userId: string) => void;
    canManageTeam?: boolean;
}

export const SprintDetailsModal: React.FC<SprintDetailsModalProps> = ({
    isOpen,
    onClose,
    sprint,
    tasks,
    currentUserId,
    projectMembers = [],
    onEdit,
    onDelete,
    onStart,
    onComplete,
    onAddMember,
    onRemoveMember,
    onJoinRequest,
    onApproveRequest,
    onRejectRequest,
    canManageTeam = false
}) => {
    const { t, dateFormat, dateLocale } = useLanguage();
    const [activeTab, setActiveTab] = useState<'overview' | 'team'>('overview');
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

    const stats = useMemo(() => {
        if (!tasks) return { total: 0, completed: 0, progress: 0 };
        const total = tasks.length;
        const completed = tasks.filter(t => t.isCompleted).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, progress };
    }, [tasks]);

    if (!sprint) return null;

    const daysLeft = differenceInDays(new Date(sprint.endDate), new Date());
    const daysUntilStart = differenceInDays(new Date(sprint.startDate), new Date());
    const isOverdue = daysLeft < 0 && sprint.status === 'Active';
    const duration = differenceInDays(new Date(sprint.endDate), new Date(sprint.startDate));

    const isCreator = sprint.createdBy === currentUserId || canManageTeam;
    const isMember = sprint.memberIds?.includes(currentUserId);
    const hasPendingRequest = sprint.joinRequests?.includes(currentUserId);

    const activeMembers = projectMembers.filter(m => sprint.memberIds?.includes(m.uid));
    const pendingMembers = projectMembers.filter(m => sprint.joinRequests?.includes(m.uid));
    const availableMembers = projectMembers.filter(m => !sprint.memberIds?.includes(m.uid) && !sprint.joinRequests?.includes(m.uid));

    const statusLabels = {
        Active: t('projectSprints.status.active'),
        Planning: t('projectSprints.status.planning'),
        Completed: t('projectSprints.status.completed')
    };

    const statusVariant = sprint.status === 'Active' ? 'success' : sprint.status === 'Completed' ? 'neutral' : 'neutral';

    const timelineLabel = sprint.status === 'Active'
        ? (isOverdue
            ? t('projectSprints.details.timeline.overdue').replace('{count}', String(Math.abs(daysLeft)))
            : t('projectSprints.details.timeline.remaining').replace('{count}', String(daysLeft)))
        : sprint.status === 'Completed'
            ? t('projectSprints.details.timeline.completed')
            : t('projectSprints.details.timeline.startsIn').replace('{count}', String(Math.max(daysUntilStart, 0)));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('projectSprints.details.title')}
            size="xl"
            footer={(
                <div className="sprint-detail__footer">
                    <Button
                        variant="ghost"
                        className="sprint-detail__delete"
                        onClick={() => onDelete(sprint.id)}
                    >
                        {t('projectSprints.details.actions.delete')}
                    </Button>
                    <div className="sprint-detail__footer-actions">
                        <Button variant="secondary" onClick={() => onEdit(sprint)}>
                            {t('projectSprints.details.actions.edit')}
                        </Button>
                        {sprint.status === 'Planning' && onStart && (
                            <Button variant="primary" onClick={() => { onStart(sprint.id); onClose(); }}>
                                {t('projectSprints.details.actions.start')}
                            </Button>
                        )}
                        {sprint.status === 'Active' && onComplete && (
                            <Button variant="primary" onClick={() => { onComplete(sprint.id); onClose(); }}>
                                {t('projectSprints.details.actions.complete')}
                            </Button>
                        )}
                    </div>
                </div>
            )}
        >
            <div className="sprint-detail">
                <div className="sprint-detail__hero">
                    <div className="sprint-detail__badges">
                        <Badge variant={statusVariant}>{statusLabels[sprint.status]}</Badge>
                        {sprint.autoStart && sprint.status === 'Planning' && (
                            <Badge variant="warning">{t('projectSprints.labels.autoStart')}</Badge>
                        )}
                    </div>
                    <h2 className="sprint-detail__title">{sprint.name}</h2>
                    <div className="sprint-detail__meta">
                        <span>
                            <span className="material-symbols-outlined">calendar_today</span>
                            {format(new Date(sprint.startDate), dateFormat, { locale: dateLocale })}
                            <span className="sprint-detail__date-separator">-</span>
                            {format(new Date(sprint.endDate), dateFormat, { locale: dateLocale })}
                        </span>
                        <span>
                            <span className="material-symbols-outlined">schedule</span>
                            {t('projectSprints.details.duration').replace('{count}', String(duration))}
                        </span>
                    </div>
                </div>

                <div className="sprint-detail__tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className={`sprint-detail__tab ${activeTab === 'overview' ? 'is-active' : ''}`}
                    >
                        {t('projectSprints.details.tabs.overview')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('team')}
                        className={`sprint-detail__tab ${activeTab === 'team' ? 'is-active' : ''}`}
                    >
                        {t('projectSprints.details.tabs.team')}
                        {(pendingMembers.length > 0 && isCreator) && (
                            <span className="sprint-detail__tab-indicator" />
                        )}
                    </button>
                </div>

                <div className="sprint-detail__panel">
                    {activeTab === 'overview' && (
                        <div className="sprint-detail__overview">
                            <Card className="sprint-detail__progress">
                                <div className="sprint-detail__progress-header">
                                    <div>
                                        <span className="sprint-detail__label">{t('projectSprints.details.progress.title')}</span>
                                        <div className="sprint-detail__progress-value">
                                            <span>{stats.progress}%</span>
                                            <span className="sprint-detail__progress-subtitle">{t('projectSprints.details.progress.completed')}</span>
                                        </div>
                                    </div>
                                    <div className="sprint-detail__progress-meta">
                                        {t('projectSprints.details.progress.tasks')
                                            .replace('{completed}', String(stats.completed))
                                            .replace('{total}', String(stats.total))}
                                    </div>
                                </div>
                                <div className="sprint-detail__progress-track">
                                    <div
                                        className="sprint-detail__progress-fill"
                                        style={{ width: `${stats.progress}%` }}
                                    />
                                </div>
                            </Card>

                            <div className="sprint-detail__stats">
                                <Card className="sprint-detail__stat-card">
                                    <span className="sprint-detail__label">{t('projectSprints.details.timeline.title')}</span>
                                    <span className={`sprint-detail__stat-value ${isOverdue ? 'is-overdue' : ''}`}>
                                        {timelineLabel}
                                    </span>
                                </Card>
                                <Card className="sprint-detail__stat-card">
                                    <span className="sprint-detail__label">{t('projectSprints.details.goal.title')}</span>
                                    <span className="sprint-detail__stat-value">
                                        {sprint.goal || t('projectSprints.details.goal.empty')}
                                    </span>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="sprint-detail__team">
                            <div className="sprint-detail__team-header">
                                <h3>{t('projectSprints.details.team.title')}</h3>
                                <div className="sprint-detail__team-actions">
                                    {!isMember && !hasPendingRequest && onJoinRequest && (
                                        <Button variant="primary" onClick={onJoinRequest}>
                                            {t('projectSprints.details.team.join')}
                                        </Button>
                                    )}
                                    {hasPendingRequest && (
                                        <Button variant="ghost" disabled>
                                            {t('projectSprints.details.team.pending')}
                                        </Button>
                                    )}
                                    {isCreator && onAddMember && (
                                        <div className="sprint-detail__menu-wrapper">
                                            <Button variant="secondary" onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}>
                                                <span className="material-symbols-outlined">person_add</span>
                                                {t('projectSprints.details.team.add')}
                                            </Button>
                                            {isAddMemberOpen && (
                                                <div className="sprint-detail__menu">
                                                    {availableMembers.length === 0 ? (
                                                        <p>{t('projectSprints.details.team.noAvailable')}</p>
                                                    ) : (
                                                        availableMembers.map(member => (
                                                            <button
                                                                key={member.uid}
                                                                onClick={() => {
                                                                    onAddMember(member.uid);
                                                                    setIsAddMemberOpen(false);
                                                                }}
                                                                className="sprint-detail__menu-item"
                                                            >
                                                                {member.photoURL ? (
                                                                    <img src={member.photoURL} alt={member.displayName} />
                                                                ) : (
                                                                    <div className="sprint-detail__menu-avatar">
                                                                        {(member.displayName || member.email || '?').charAt(0)}
                                                                    </div>
                                                                )}
                                                                <span>{member.displayName || member.email}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isCreator && pendingMembers.length > 0 && (
                                <div className="sprint-detail__requests">
                                    <h4>{t('projectSprints.details.team.pendingTitle')}</h4>
                                    <div className="sprint-detail__request-list">
                                        {pendingMembers.map(member => (
                                            <div key={member.uid} className="sprint-detail__request">
                                                <div className="sprint-detail__member-info">
                                                    {member.photoURL ? (
                                                        <img src={member.photoURL} alt={member.displayName} />
                                                    ) : (
                                                        <div className="sprint-detail__member-avatar">
                                                            {(member.displayName || member.email || '?').charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p>{member.displayName}</p>
                                                        <span>{member.email}</span>
                                                    </div>
                                                </div>
                                                <div className="sprint-detail__request-actions">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="sprint-detail__icon-button sprint-detail__icon-button--danger"
                                                        onClick={() => onRejectRequest?.(member.uid)}
                                                        aria-label={t('projectSprints.details.team.reject')}
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="sprint-detail__icon-button sprint-detail__icon-button--success"
                                                        onClick={() => onApproveRequest?.(member.uid)}
                                                        aria-label={t('projectSprints.details.team.approve')}
                                                    >
                                                        <span className="material-symbols-outlined">check</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="sprint-detail__members">
                                <h4>{t('projectSprints.details.team.activeTitle').replace('{count}', String(activeMembers.length))}</h4>
                                {activeMembers.length === 0 ? (
                                    <div className="sprint-detail__members-empty">
                                        {t('projectSprints.details.team.none')}
                                    </div>
                                ) : (
                                    <div className="sprint-detail__member-grid">
                                        {activeMembers.map(member => (
                                            <div key={member.uid} className="sprint-detail__member">
                                                <div className="sprint-detail__member-info">
                                                    {member.photoURL ? (
                                                        <img src={member.photoURL} alt={member.displayName} />
                                                    ) : (
                                                        <div className="sprint-detail__member-avatar">
                                                            {(member.displayName || member.email || '?').charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="sprint-detail__member-name">
                                                            <span>{member.displayName}</span>
                                                            {sprint.createdBy === member.uid && (
                                                                <Badge variant="neutral" className="sprint-detail__owner">
                                                                    {t('projectSprints.details.team.owner')}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className="sprint-detail__member-email">{member.email}</span>
                                                    </div>
                                                </div>
                                                {isCreator && member.uid !== sprint.createdBy && onRemoveMember && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="sprint-detail__icon-button sprint-detail__icon-button--danger"
                                                        onClick={() => onRemoveMember(member.uid)}
                                                        aria-label={t('projectSprints.details.team.remove')}
                                                    >
                                                        <span className="material-symbols-outlined">remove_circle_outline</span>
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
