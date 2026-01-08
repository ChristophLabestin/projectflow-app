import React from 'react';
import { Card } from '../../common/Card/Card';
import { Idea } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignProductionViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const SocialCampaignProductionView: React.FC<SocialCampaignProductionViewProps> = ({
    idea: _idea,
    onUpdate: _onUpdate
}) => {
    const { t } = useLanguage();
    return (
        <div className="flow-social-campaign-production">
            <div className="flow-social-campaign-production__container">
                <Card className="flow-social-campaign-production__hero">
                    <div>
                        <h1 className="flow-social-campaign-production__title">
                            {t('flowStages.socialCampaignProduction.title')}
                        </h1>
                        <p className="flow-social-campaign-production__subtitle">
                            {t('flowStages.socialCampaignProduction.subtitle')}
                        </p>
                    </div>
                    <div className="flow-social-campaign-production__hero-icon">
                        <span className="material-symbols-outlined">precision_manufacturing</span>
                    </div>
                </Card>

                <Card className="flow-social-campaign-production__panel">
                    <div className="flow-social-campaign-production__placeholder">
                        <span className="material-symbols-outlined">dashboard</span>
                        <p>{t('flowStages.socialCampaignProduction.placeholder.title')}</p>
                        <p className="flow-social-campaign-production__placeholder-subtitle">
                            {t('flowStages.socialCampaignProduction.placeholder.subtitle')}
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};
