import React, { useMemo } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { DatePicker } from '../../common/DateTime/DatePicker';
import { TextInput } from '../../common/Input/TextInput';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingExecutionViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ExecutionData {
    startDate: string;
    endDate: string;
    actualBudget: string;
    trackingLinks: string[];
    status: 'Pending' | 'Active' | 'Paused' | 'Completed';
}

export const MarketingExecutionView: React.FC<MarketingExecutionViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const execution: ExecutionData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    startDate: parsed.startDate || '',
                    endDate: parsed.endDate || '',
                    actualBudget: parsed.actualBudget || '',
                    trackingLinks: Array.isArray(parsed.trackingLinks) ? parsed.trackingLinks : [],
                    status: parsed.marketingStatus || 'Pending',
                    ...parsed
                };
            }
        } catch { }
        return {
            startDate: '',
            endDate: '',
            actualBudget: '',
            trackingLinks: [],
            status: 'Pending'
        };
    })();

    const updateExecution = (updates: Partial<ExecutionData>) => {
        const newData = { ...execution, ...updates };
        if (updates.status !== undefined) {
            // @ts-ignore
            newData.marketingStatus = updates.status;
        }
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const addLink = () => updateExecution({ trackingLinks: [...execution.trackingLinks, ''] });

    const updateLink = (idx: number, val: string) => {
        const newLinks = [...execution.trackingLinks];
        newLinks[idx] = val;
        updateExecution({ trackingLinks: newLinks });
    };

    const navigate = useNavigate();
    const statusLabels: Record<ExecutionData['status'], string> = {
        Pending: t('flowStages.marketingExecution.status.pending'),
        Active: t('flowStages.marketingExecution.status.active'),
        Paused: t('flowStages.marketingExecution.status.paused'),
        Completed: t('flowStages.marketingExecution.status.completed'),
    };
    const statusOptions: ExecutionData['status'][] = ['Pending', 'Active', 'Paused', 'Completed'];

    const startDateValue = execution.startDate ? new Date(execution.startDate) : null;
    const endDateValue = execution.endDate ? new Date(execution.endDate) : null;

    const campaignTypeLabel = useMemo(() => (
        idea.campaignType === 'email'
            ? t('flowStages.marketingExecution.campaignType.email')
            : t('flowStages.marketingExecution.campaignType.ad')
    ), [idea.campaignType, t]);

    if (idea.convertedCampaignId) {
        return (
            <div className="flow-marketing-execution">
                <div className="flow-marketing-execution__container">
                    <Card className="flow-marketing-execution__converted">
                        <div className="flow-marketing-execution__converted-icon">
                            <span className="material-symbols-outlined">rocket_launch</span>
                        </div>
                        <h2>{t('flowStages.marketingExecution.live.title')}</h2>
                        <p>{t('flowStages.marketingExecution.live.description').replace('{type}', campaignTypeLabel)}</p>
                        <div className="flow-marketing-execution__converted-actions">
                            <Button variant="ghost" onClick={() => onUpdate({ convertedCampaignId: undefined })}>
                                {t('flowStages.marketingExecution.live.actions.disconnect')}
                            </Button>
                            <Button
                                onClick={() => navigate(`/projects/${idea.projectId}/marketing/${idea.campaignType === 'email' ? 'email' : 'ads'}/${idea.convertedCampaignId}`)}
                            >
                                {t('flowStages.marketingExecution.live.actions.viewDashboard')}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flow-marketing-execution">
            <div className="flow-marketing-execution__container">
                <div className="flow-marketing-execution__grid">
                    <Card className="flow-marketing-execution__panel">
                        <div className="flow-marketing-execution__header">
                            <div>
                                <h2 className="flow-marketing-execution__title">{t('flowStages.marketingExecution.title')}</h2>
                                <p className="flow-marketing-execution__subtitle">{t('flowStages.marketingExecution.subtitle')}</p>
                            </div>
                            <div className="flow-marketing-execution__status">
                                {statusOptions.map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => updateExecution({ status })}
                                        className={`flow-marketing-execution__status-pill ${execution.status === status ? 'is-active' : ''}`}
                                    >
                                        {statusLabels[status]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flow-marketing-execution__date-grid">
                            <DatePicker
                                label={t('flowStages.marketingExecution.startDate')}
                                value={startDateValue}
                                onChange={(date) => updateExecution({ startDate: date ? date.toISOString().split('T')[0] : '' })}
                                placeholder={t('flowStages.marketingExecution.startDatePlaceholder')}
                            />
                            <DatePicker
                                label={t('flowStages.marketingExecution.endDate')}
                                value={endDateValue}
                                onChange={(date) => updateExecution({ endDate: date ? date.toISOString().split('T')[0] : '' })}
                                placeholder={t('flowStages.marketingExecution.endDatePlaceholder')}
                            />
                        </div>

                        <div className="flow-marketing-execution__list-section">
                            <div className="flow-marketing-execution__list-header">
                                <span className="flow-marketing-execution__label">{t('flowStages.marketingExecution.tracking.label')}</span>
                                <Button size="sm" variant="ghost" onClick={addLink}>
                                    {t('flowStages.marketingExecution.tracking.add')}
                                </Button>
                            </div>
                            {execution.trackingLinks.length === 0 && (
                                <p className="flow-marketing-execution__empty">{t('flowStages.marketingExecution.tracking.empty')}</p>
                            )}
                            <div className="flow-marketing-execution__list">
                                {execution.trackingLinks.map((link, idx) => (
                                    <TextInput
                                        key={idx}
                                        value={link}
                                        onChange={(event) => updateLink(idx, event.target.value)}
                                        placeholder={t('flowStages.marketingExecution.tracking.placeholder')}
                                        className="flow-marketing-execution__control"
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flow-marketing-execution__footer">
                            <Button
                                disabled={execution.status !== 'Completed'}
                                onClick={() => onUpdate({ stage: 'Analysis' })}
                                icon={<span className="material-symbols-outlined">analytics</span>}
                                iconPosition="right"
                                className="flow-marketing-execution__advance"
                            >
                                {t('flowStages.marketingExecution.actions.analyze')}
                            </Button>
                        </div>
                    </Card>

                    <Card className="flow-marketing-execution__panel flow-marketing-execution__panel--aside">
                        <h3 className="flow-marketing-execution__panel-title">{t('flowStages.marketingExecution.budget.title')}</h3>
                        <div className="flow-marketing-execution__budget">
                            <span className="flow-marketing-execution__label">{t('flowStages.marketingExecution.budget.approved')}</span>
                            <div className="flow-marketing-execution__budget-value">$5,000.00</div>
                        </div>
                        <TextInput
                            label={t('flowStages.marketingExecution.budget.actual')}
                            value={execution.actualBudget}
                            onChange={(event) => updateExecution({ actualBudget: event.target.value })}
                            placeholder={t('flowStages.marketingExecution.budget.placeholder')}
                            leftElement={<span className="flow-marketing-execution__currency">$</span>}
                            className="flow-marketing-execution__control"
                        />
                    </Card>
                </div>
            </div>
        </div>
    );
};
