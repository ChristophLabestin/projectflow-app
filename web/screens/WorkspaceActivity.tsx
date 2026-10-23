import React from 'react';

import { ActivityFeed } from '../components/activity/ActivityFeed';
import { useLanguage } from '../context/LanguageContext';

/** `/activity`: workspace-wide activity stream (guests see their projects only). */
export const WorkspaceActivity = () => {
    const { t } = useLanguage();
    return (
        <div className="activity-page custom-scrollbar">
            <div className="activity-page__content">
                <header className="activity-page__header">
                    <div>
                        <h1>{t('activity.title')}</h1>
                        <p>{t('activity.subtitle')}</p>
                    </div>
                </header>
                <ActivityFeed />
            </div>
        </div>
    );
};
