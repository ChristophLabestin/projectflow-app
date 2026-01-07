import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingAnalysisViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface AnalysisData {
    impressions: string;
    clicks: string;
    conversions: string;
    costPerAcquisition: string;
    roi: string;
    keyTakeaways: string;
}

interface MetricCardProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    isEditing: boolean;
    icon: string;
    tone: 'primary' | 'neutral' | 'success' | 'warning';
}

export const MarketingAnalysisView: React.FC<MarketingAnalysisViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const analysis: AnalysisData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    impressions: parsed.impressions || '',
                    clicks: parsed.clicks || '',
                    conversions: parsed.conversions || '',
                    costPerAcquisition: parsed.costPerAcquisition || '',
                    roi: parsed.roi || '',
                    keyTakeaways: parsed.keyTakeaways || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            impressions: '',
            clicks: '',
            conversions: '',
            costPerAcquisition: '',
            roi: '',
            keyTakeaways: ''
        };
    })();

    const updateAnalysis = (updates: Partial<AnalysisData>) => {
        const newData = { ...analysis, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const [isEditing, setIsEditing] = useState(false);
    const metricLabels = {
        impressions: t('flowStages.marketingAnalysis.metrics.impressions'),
        clicks: t('flowStages.marketingAnalysis.metrics.clicks'),
        conversions: t('flowStages.marketingAnalysis.metrics.conversions'),
        cpa: t('flowStages.marketingAnalysis.metrics.cpa'),
    };

    return (
        <div className="flow-marketing-analysis">
            <Card className="flow-marketing-analysis__main">
                <div className="flow-marketing-analysis__header">
                    <div className="flow-marketing-analysis__heading">
                        <h2>{t('flowStages.marketingAnalysis.title')}</h2>
                        <p>{t('flowStages.marketingAnalysis.subtitle')}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
                        {isEditing ? t('flowStages.marketingAnalysis.actions.save') : t('flowStages.marketingAnalysis.actions.edit')}
                    </Button>
                </div>

                <div className="flow-marketing-analysis__metrics">
                    <MetricCard label={metricLabels.impressions} value={analysis.impressions} onChange={(value) => updateAnalysis({ impressions: value })} isEditing={isEditing} icon="visibility" tone="primary" />
                    <MetricCard label={metricLabels.clicks} value={analysis.clicks} onChange={(value) => updateAnalysis({ clicks: value })} isEditing={isEditing} icon="mouse" tone="neutral" />
                    <MetricCard label={metricLabels.conversions} value={analysis.conversions} onChange={(value) => updateAnalysis({ conversions: value })} isEditing={isEditing} icon="shopping_cart" tone="success" />
                    <MetricCard label={metricLabels.cpa} value={analysis.costPerAcquisition} onChange={(value) => updateAnalysis({ costPerAcquisition: value })} isEditing={isEditing} icon="attach_money" tone="warning" />
                </div>

                <div className="flow-marketing-analysis__takeaways">
                    <h3>{t('flowStages.marketingAnalysis.takeaways.title')}</h3>
                    <TextArea
                        value={analysis.keyTakeaways}
                        onChange={(e) => updateAnalysis({ keyTakeaways: e.target.value })}
                        placeholder={t('flowStages.marketingAnalysis.takeaways.placeholder')}
                        className="flow-marketing-analysis__takeaways-field"
                    />
                </div>
            </Card>

            <Card className="flow-marketing-analysis__sidebar">
                <h3>{t('flowStages.marketingAnalysis.verdict.title')}</h3>

                <div className="flow-marketing-analysis__roi">
                    <span className="flow-marketing-analysis__roi-label">{t('flowStages.marketingAnalysis.verdict.roiLabel')}</span>
                    {isEditing ? (
                        <input
                            type="text"
                            value={analysis.roi}
                            onChange={(e) => updateAnalysis({ roi: e.target.value })}
                            className="flow-marketing-analysis__roi-input"
                            placeholder="0%"
                        />
                    ) : (
                        <div className="flow-marketing-analysis__roi-value">{analysis.roi || '-'}%</div>
                    )}
                </div>

                <Button className="flow-marketing-analysis__archive" variant="secondary">
                    {t('flowStages.marketingAnalysis.actions.archive')}
                </Button>
            </Card>
        </div>
    );
};

const MetricCard = ({ label, value, onChange, isEditing, icon, tone }: MetricCardProps) => (
    <div className="flow-marketing-analysis__metric" data-tone={tone}>
        <div className="flow-marketing-analysis__metric-header">
            <span className="material-symbols-outlined">{icon}</span>
            <span>{label}</span>
        </div>
        {isEditing ? (
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flow-marketing-analysis__metric-input"
                placeholder="-"
            />
        ) : (
            <span className="flow-marketing-analysis__metric-value">{value || '-'}</span>
        )}
    </div>
);
