import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Milestone } from '../../types';
import { subscribeProjectMilestones } from '../../services/domain/projectMetaService';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';

export const MilestoneCard = ({ projectId }: { projectId: string }) => {
    const navigate = useNavigate();
    const { dateFormat, dateLocale } = useLanguage();
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = subscribeProjectMilestones(projectId, (data) => {
            setMilestones(data);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    // Derived states
    const total = milestones.length;
    const achieved = milestones.filter(m => m.status === 'Achieved').length;
    const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;

    // Find next pending milestone
    const nextMilestone = milestones
        .filter(m => m.status === 'Pending')
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))[0];

    const isOverdue = nextMilestone?.dueDate
        ? new Date(nextMilestone.dueDate) < new Date()
        : false;

    if (loading) {
        return (
            <div className="milestone-card milestone-card--loading">
                <div className="milestone-card__skeleton-title" />
                <div className="milestone-card__skeleton-body" />
            </div>
        );
    }

    if (milestones.length === 0) {
        return (
            <div className="milestone-card">
                <div className="milestone-card__header">
                    <h3 className="milestone-card__title">Milestones</h3>
                    <span className="material-symbols-outlined milestone-card__header-icon">flag</span>
                </div>
                <div className="milestone-card__empty">
                    <p className="milestone-card__empty-text">No milestones set yet.</p>
                    <button
                        onClick={() => navigate(`/project/${projectId}/milestones`)}
                        className="milestone-card__empty-action"
                    >
                        + Add Milestone
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => navigate(`/project/${projectId}/milestones`)}
            className="milestone-card milestone-card--clickable"
        >
            <div className="milestone-card__header">
                <h3 className="milestone-card__title">Milestones</h3>
                <div className="milestone-card__arrow">
                    <span className="material-symbols-outlined">arrow_forward</span>
                </div>
            </div>

            <div className="milestone-card__body">
                {/* Progress Bar */}
                <div className="milestone-card__progress">
                    <div className="milestone-card__progress-head">
                        <span className="milestone-card__progress-label">Progress</span>
                        <span className="milestone-card__progress-count">{achieved}/{total}</span>
                    </div>
                    <div className="milestone-card__progress-track">
                        <div
                            className="milestone-card__progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Next Milestone Highlight */}
                {nextMilestone ? (
                    <div className={`milestone-card__next ${isOverdue ? 'milestone-card__next--overdue' : ''}`}>
                        <div className="milestone-card__next-head">
                            <span className={`material-symbols-outlined milestone-card__next-icon ${isOverdue ? 'milestone-card__next-icon--overdue' : ''}`}>
                                {isOverdue ? 'warning' : 'flag'}
                            </span>
                            <span className="milestone-card__next-eyebrow">Next Up</span>
                        </div>
                        <p className="milestone-card__next-title">{nextMilestone.title}</p>
                        {nextMilestone.dueDate && (
                            <p className={`milestone-card__next-due ${isOverdue ? 'milestone-card__next-due--overdue' : ''}`}>
                                Due {format(new Date(nextMilestone.dueDate), dateFormat, { locale: dateLocale })}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="milestone-card__done">
                        <p className="milestone-card__done-title">All caught up!</p>
                        <p className="milestone-card__done-sub">All milestones achieved.</p>
                    </div>
                )}
            </div>

            {/* Decorative Background Icon */}
            <span className="material-symbols-outlined milestone-card__decoration">
                flag
            </span>
        </div>
    );
};
