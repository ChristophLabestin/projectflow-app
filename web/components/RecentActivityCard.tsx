import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeProjectActivity } from '../services/dataService';
import { Activity } from '../types';
import { timeAgo } from '../utils/time';
import { activityIcon } from '../utils/activityHelpers';
import { useLanguage } from '../context/LanguageContext';
import { Card } from './common/Card/Card';

export const RecentActivityCard = ({ projectId }: { projectId: string }) => {
    const { t } = useLanguage();
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = subscribeProjectActivity(projectId, (data) => {
            setActivity(data);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    return (
        <Card className="recent-activity-card">
            <div className="recent-activity-card__header">
                <h3 className="recent-activity-card__title">{t('recentActivity.title', 'Recent Activity')}</h3>
                <Link to={`/project/${projectId}/activity`} className="recent-activity-card__link">
                    {t('recentActivity.viewHistory', 'View History')}
                </Link>
            </div>

            <div className="recent-activity-card__list custom-scrollbar">
                {loading ? (
                    <div className="recent-activity-card__loading">
                        <span className="material-symbols-outlined recent-activity-card__loading-icon animate-spin">progress_activity</span>
                    </div>
                ) : activity.length === 0 ? (
                    <p className="recent-activity-card__empty">{t('recentActivity.empty', 'No recent activity.')}</p>
                ) : (
                    activity.slice(0, 10).map((item, idx) => {
                        const { icon, color, bg } = activityIcon(item.type, item.action);
                        return (
                            <div key={item.id} className="recent-activity-card__item">
                                {idx !== activity.length - 1 && <div className="recent-activity-card__line" />}
                                <div className="recent-activity-card__icon" style={{ backgroundColor: bg, color }}>
                                    <span className="material-symbols-outlined recent-activity-card__icon-symbol">{icon}</span>
                                </div>
                                <div className="recent-activity-card__body">
                                    <p className="recent-activity-card__text">
                                        <span className="recent-activity-card__user">{item.user}</span>
                                        <span className="recent-activity-card__action">{item.action}</span>
                                    </p>
                                    <p className="recent-activity-card__time">{timeAgo(item.createdAt)}</p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </Card>
    );
};
