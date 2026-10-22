import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../components/common/Button/Button';
import { useLanguage } from '../context/LanguageContext';
import './error-page.scss';

/** Shown for unknown routes instead of silently redirecting to the dashboard. */
export const NotFound = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    return (
        <div className="error-page">
            <div className="error-page__card">
                <div className="error-page__icon">
                    <span className="material-symbols-outlined">travel_explore</span>
                </div>
                <h1 className="error-page__status">404</h1>
                <p className="error-page__message">{t('notFound.title')}</p>
                <p className="error-page__note">{t('notFound.description')}</p>
                <div className="error-page__actions">
                    <Button
                        variant="primary"
                        onClick={() => navigate('/')}
                        className="error-page__button"
                        icon={<span className="material-symbols-outlined">home</span>}
                    >
                        {t('notFound.backToDashboard')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
