import React from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Badge } from '../../../common/Badge/Badge';
import { timeAgo } from '../../../../utils/time';
import type { Activity, Milestone, Sprint } from '../../../../types';

type Common = {
    dateFormat: string;
    dateLocale: Locale;
    t: (key: string, fallback?: string) => string;
};

const milestoneVariant = (status: Milestone['status']): 'neutral' | 'success' | 'warning' | 'error' =>
    status === 'Achieved' ? 'success' : status === 'Missed' ? 'error' : 'warning';

export const MilestonesPanel: React.FC<Common & { milestones: Milestone[] }> = ({ milestones, dateFormat, dateLocale, t }) => {
    if (!milestones.length) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">flag</span>
                <p>{t('projectOverview.v2.milestones.empty', 'No milestones yet')}</p>
            </div>
        );
    }
    const sorted = [...milestones].sort((a, b) =>
        new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime());
    return (
        <div className="po-panel-list">
            {sorted.map((milestone) => (
                <div key={milestone.id} className="po-panel-list__row">
                    <span className="po-panel-list__icon material-symbols-outlined">flag</span>
                    <div className="po-panel-list__copy">
                        <strong>{milestone.title}</strong>
                        {milestone.description && <span>{milestone.description}</span>}
                    </div>
                    <div className="po-panel-list__meta">
                        {milestone.linkedTaskIds?.length ? (
                            <span className="po-panel-list__count">
                                {t('projectOverview.v2.milestones.linkedTasks', '{count} tasks').replace('{count}', String(milestone.linkedTaskIds.length))}
                            </span>
                        ) : null}
                        {milestone.dueDate && <span>{format(new Date(milestone.dueDate), dateFormat, { locale: dateLocale })}</span>}
                        <Badge variant={milestoneVariant(milestone.status)}>{t(`milestones.status.${milestone.status.toLowerCase()}`, milestone.status)}</Badge>
                    </div>
                </div>
            ))}
        </div>
    );
};

const sprintVariant = (status: Sprint['status']): 'neutral' | 'success' | 'warning' =>
    status === 'Active' ? 'success' : status === 'Completed' ? 'neutral' : 'warning';

export const SprintsPanel: React.FC<Common & { sprints: Sprint[] }> = ({ sprints, dateFormat, dateLocale, t }) => {
    if (!sprints.length) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">sprint</span>
                <p>{t('projectOverview.v2.sprints.empty', 'No sprints yet')}</p>
            </div>
        );
    }
    const sorted = [...sprints].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return (
        <div className="po-panel-list">
            {sorted.map((sprint) => (
                <div key={sprint.id} className="po-panel-list__row">
                    <span className="po-panel-list__icon material-symbols-outlined">sprint</span>
                    <div className="po-panel-list__copy">
                        <strong>{sprint.name}</strong>
                        {sprint.goal && <span>{sprint.goal}</span>}
                    </div>
                    <div className="po-panel-list__meta">
                        {sprint.memberIds?.length ? <span className="po-panel-list__count">{sprint.memberIds.length}</span> : null}
                        <span>
                            {format(new Date(sprint.startDate), dateFormat, { locale: dateLocale })} – {format(new Date(sprint.endDate), dateFormat, { locale: dateLocale })}
                        </span>
                        <Badge variant={sprintVariant(sprint.status)}>{t(`sprints.status.${sprint.status.toLowerCase()}`, sprint.status)}</Badge>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const ActivityPanel: React.FC<Common & { activity: Activity[] }> = ({ activity, t }) => {
    if (!activity.length) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">history</span>
                <p>{t('projectOverview.v2.activity.empty', 'No activity yet')}</p>
            </div>
        );
    }
    return (
        <div className="po-activity">
            {activity.slice(0, 40).map((entry) => (
                <div key={entry.id} className="po-activity__row">
                    <span className="po-activity__icon material-symbols-outlined">
                        {entry.type === 'task' ? 'task_alt'
                            : entry.type === 'comment' ? 'chat_bubble'
                            : entry.type === 'member' ? 'person_add'
                            : entry.type === 'report' ? 'auto_awesome'
                            : 'bolt'}
                    </span>
                    <div className="po-activity__copy">
                        <span className="po-activity__text"><strong>{entry.user}</strong> {entry.action} {entry.target}</span>
                        {entry.createdAt && <span className="po-activity__time">{timeAgo(entry.createdAt)}</span>}
                    </div>
                </div>
            ))}
        </div>
    );
};
