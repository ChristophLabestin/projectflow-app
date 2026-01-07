import React from 'react';
import { ProjectRisk } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Badge } from '../common/Badge/Badge';
import { Card, CardBody } from '../common/Card/Card';

interface RiskResultProps {
    risks: ProjectRisk[];
}

export const RiskResult: React.FC<RiskResultProps> = ({ risks }) => {
    const { t } = useLanguage();

    const impactLabels: Record<string, string> = {
        High: t('aiStudio.risk.level.high'),
        Medium: t('aiStudio.risk.level.medium'),
        Low: t('aiStudio.risk.level.low'),
    };
    const getBadgeVariant = (level: string) => {
        if (level === 'High') return 'error';
        if (level === 'Medium') return 'warning';
        return 'success';
    };

    return (
        <div className="ai-studio-risk animate-fade-in">
            <div className="ai-studio-risk__header">
                <span className="ai-studio-risk__label">{t('aiStudio.risk.title')}</span>
                <h2 className="ai-studio-risk__title">{t('aiStudio.risk.reportTitle')}</h2>
                <p className="ai-studio-risk__subtitle">{t('aiStudio.risk.subtitle')}</p>
            </div>

            <div className="ai-studio-risk__grid">
                {risks.map((item, idx) => (
                    <Card key={idx} className="ai-studio-risk__card">
                        <CardBody className="ai-studio-risk__card-body">
                            <div className="ai-studio-risk__top">
                                <h4 className="ai-studio-risk__risk-title">{item.risk}</h4>
                                <div className="ai-studio-risk__badges">
                                    <Badge variant={getBadgeVariant(item.impact)} className="ai-studio-risk__badge">
                                        {t('aiStudio.risk.impactLabel').replace('{level}', impactLabels[item.impact] || item.impact)}
                                    </Badge>
                                    <Badge variant={getBadgeVariant(item.probability)} className="ai-studio-risk__badge">
                                        {t('aiStudio.risk.probabilityLabel').replace('{level}', impactLabels[item.probability] || item.probability)}
                                    </Badge>
                                </div>
                            </div>

                            <div className="ai-studio-risk__mitigation">
                                <h5>
                                    <span className="material-symbols-outlined">shield</span>
                                    {t('aiStudio.risk.mitigation')}
                                </h5>
                                <p>{item.mitigation}</p>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
};
