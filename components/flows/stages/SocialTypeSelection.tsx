import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialTypeSelectionProps {
    onSelect: (type: 'post' | 'campaign') => void;
}

export const SocialTypeSelection: React.FC<SocialTypeSelectionProps> = ({ onSelect }) => {
    const { t } = useLanguage();

    return (
        <div className="flow-type-selection">
            <div className="flow-type-selection__header">
                <h2 className="flow-type-selection__title">{t('flowStages.socialType.title')}</h2>
                <p className="flow-type-selection__subtitle">
                    {t('flowStages.socialType.subtitle')}
                </p>
            </div>

            <div className="flow-type-selection__grid">
                {/* Single Post Card */}
                <button
                    onClick={() => onSelect('post')}
                    className="flow-type-card"
                    type="button"
                >
                    <div className="flow-type-card__icon">
                        <span className="material-symbols-outlined">post_add</span>
                    </div>
                    <div className="flow-type-card__body">
                        <h3 className="flow-type-card__title">{t('flowStages.socialType.post.title')}</h3>
                        <p className="flow-type-card__description">
                            {t('flowStages.socialType.post.description')}
                        </p>
                    </div>
                    <div className="flow-type-card__footer">
                        <ul className="flow-type-card__features">
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.socialType.post.feature1')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.socialType.post.feature2')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.socialType.post.feature3')}
                            </li>
                        </ul>
                        <span className="flow-type-card__action">
                            {t('flowStages.socialType.post.action')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </span>
                    </div>
                </button>

                {/* Campaign Card */}
                <button
                    onClick={() => onSelect('campaign')}
                    className="flow-type-card"
                    type="button"
                >
                    <div className="flow-type-card__icon">
                        <span className="material-symbols-outlined">campaign</span>
                    </div>
                    <div className="flow-type-card__body">
                        <h3 className="flow-type-card__title">{t('flowStages.socialType.campaign.title')}</h3>
                        <p className="flow-type-card__description">
                            {t('flowStages.socialType.campaign.description')}
                        </p>
                    </div>
                    <div className="flow-type-card__footer">
                        <ul className="flow-type-card__features">
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.socialType.campaign.feature1')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.socialType.campaign.feature2')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.socialType.campaign.feature3')}
                            </li>
                        </ul>
                        <span className="flow-type-card__action">
                            {t('flowStages.socialType.campaign.action')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </span>
                    </div>
                </button>
            </div>
        </div>
    );
};
