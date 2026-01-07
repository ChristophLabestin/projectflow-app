import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingTypeSelectionProps {
    onSelect: (type: 'paidAd' | 'emailMarketing') => void;
}

export const MarketingTypeSelection: React.FC<MarketingTypeSelectionProps> = ({ onSelect }) => {
    const { t } = useLanguage();

    return (
        <div className="flow-type-selection">
            <div className="flow-type-selection__header">
                <h2 className="flow-type-selection__title">{t('flowStages.marketingType.title')}</h2>
                <p className="flow-type-selection__subtitle">
                    {t('flowStages.marketingType.subtitle')}
                </p>
            </div>

            <div className="flow-type-selection__grid">
                {/* Paid Ad Card */}
                <button
                    onClick={() => onSelect('paidAd')}
                    className="flow-type-card"
                    type="button"
                >
                    <div className="flow-type-card__icon">
                        <span className="material-symbols-outlined">ads_click</span>
                    </div>
                    <div className="flow-type-card__body">
                        <h3 className="flow-type-card__title">{t('flowStages.marketingType.paidAd.title')}</h3>
                        <p className="flow-type-card__description">
                            {t('flowStages.marketingType.paidAd.description')}
                        </p>
                    </div>
                    <div className="flow-type-card__footer">
                        <ul className="flow-type-card__features">
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.marketingType.paidAd.feature1')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.marketingType.paidAd.feature2')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.marketingType.paidAd.feature3')}
                            </li>
                        </ul>
                        <span className="flow-type-card__action">
                            {t('flowStages.marketingType.paidAd.action')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </span>
                    </div>
                </button>

                {/* Email Marketing Card */}
                <button
                    onClick={() => onSelect('emailMarketing')}
                    className="flow-type-card"
                    type="button"
                >
                    <div className="flow-type-card__icon">
                        <span className="material-symbols-outlined">mail</span>
                    </div>
                    <div className="flow-type-card__body">
                        <h3 className="flow-type-card__title">{t('flowStages.marketingType.emailMarketing.title')}</h3>
                        <p className="flow-type-card__description">
                            {t('flowStages.marketingType.emailMarketing.description')}
                        </p>
                    </div>
                    <div className="flow-type-card__footer">
                        <ul className="flow-type-card__features">
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.marketingType.emailMarketing.feature1')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.marketingType.emailMarketing.feature2')}
                            </li>
                            <li className="flow-type-card__feature">
                                <span className="material-symbols-outlined flow-type-card__feature-icon">check_circle</span>
                                {t('flowStages.marketingType.emailMarketing.feature3')}
                            </li>
                        </ul>
                        <span className="flow-type-card__action">
                            {t('flowStages.marketingType.emailMarketing.action')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </span>
                    </div>
                </button>
            </div>
        </div>
    );
};
