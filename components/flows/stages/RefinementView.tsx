import React, { useState, useMemo } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { generateSWOTAnalysisAI } from '../../../services/geminiService';
import { SWOTCard } from './SWOTCard';
import { useLanguage } from '../../../context/LanguageContext';

interface RefinementViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const RefinementView: React.FC<RefinementViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<{
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
    } | null>(null);

    // Default empty analysis if not present
    const analysis = idea.analysis || {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    };

    // Generic handler for SWOT updates
    const handleSwotUpdate = (category: keyof typeof analysis, newList: string[]) => {
        onUpdate({
            analysis: {
                ...analysis,
                [category]: newList
            }
        });
    };

    const handleGenerateSWOT = async () => {
        setGenerating(true);
        try {
            // "result" contains ONLY the new additive points from AI
            const result = await generateSWOTAnalysisAI(idea);

            // Merge with existing analysis (deduplicating just in case)
            const mergedAnalysis = {
                strengths: Array.from(new Set([...analysis.strengths, ...result.strengths])),
                weaknesses: Array.from(new Set([...analysis.weaknesses, ...result.weaknesses])),
                opportunities: Array.from(new Set([...analysis.opportunities, ...result.opportunities])),
                threats: Array.from(new Set([...analysis.threats, ...result.threats])),
            };

            onUpdate({ analysis: mergedAnalysis });
            setAiSuggestions(result); // Track ONLY the new items for highlighting
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const levelLabels = useMemo(() => ({
        Low: t('flowStages.refinement.level.low'),
        Medium: t('flowStages.refinement.level.medium'),
        High: t('flowStages.refinement.level.high'),
    }), [t]);

    // Helper to render Impact/Effort pills
    const renderPillSelector = (
        label: string,
        value: string | undefined,
        field: 'impact' | 'effort'
    ) => (
        <div className="flow-refinement__metric">
            <span className="flow-refinement__metric-label">{label}</span>
            <div className="flow-refinement__pill-group">
                {['Low', 'Medium', 'High'].map((option) => {
                    const isSelected = value === option;
                    return (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onUpdate({ [field]: option })}
                            className={`flow-refinement__pill ${isSelected ? 'is-active' : ''}`}
                            data-level={option.toLowerCase()}
                            aria-pressed={isSelected}
                        >
                            {levelLabels[option as keyof typeof levelLabels] || option}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="flow-refinement">
            <div className="flow-refinement__header">
                <div className="flow-refinement__heading">
                    <h2 className="flow-refinement__title">{t('flowStages.refinement.title')}</h2>
                    <p className="flow-refinement__subtitle">{t('flowStages.refinement.subtitle')}</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateSWOT}
                    isLoading={generating}
                    className="flow-refinement__generate"
                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                >
                    {t('flowStages.refinement.actions.generate')}
                </Button>
            </div>

            <div className="flow-refinement__content">
                <div className="flow-refinement__sidebar">
                    <Card className="flow-refinement__panel flow-refinement__summary">
                        <div className="flow-refinement__panel-header">
                            <span className="material-symbols-outlined">subject</span>
                            <span>{t('flowStages.refinement.summary.title')}</span>
                        </div>
                        <TextArea
                            className="flow-refinement__summary-field"
                            value={idea.description}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            placeholder={t('flowStages.refinement.summary.placeholder')}
                        />
                    </Card>

                    <Card className="flow-refinement__panel flow-refinement__metrics">
                        {renderPillSelector(
                            t('flowStages.refinement.impact.title'),
                            idea.impact,
                            'impact'
                        )}

                        {renderPillSelector(
                            t('flowStages.refinement.effort.title'),
                            idea.effort,
                            'effort'
                        )}
                    </Card>

                    <div className="flow-refinement__advance">
                        <Button
                            className="flow-refinement__advance-button"
                            onClick={() => onUpdate({ stage: 'Concept' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.refinement.actions.advance')}
                        </Button>
                    </div>
                </div>

                <div className="flow-refinement__main">
                    <div className="flow-refinement__swot-grid">
                        <SWOTCard
                            title={t('flowStages.refinement.swot.strengths')}
                            icon="check_circle"
                            items={analysis.strengths}
                            colorClass="emerald"
                            onAdd={(text) => handleSwotUpdate('strengths', [...analysis.strengths, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.strengths];
                                newItems[index] = text;
                                handleSwotUpdate('strengths', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.strengths];
                                newItems.splice(index, 1);
                                handleSwotUpdate('strengths', newItems);
                            }}
                            highlightedItems={aiSuggestions?.strengths}
                        />
                        <SWOTCard
                            title={t('flowStages.refinement.swot.weaknesses')}
                            icon="warning"
                            items={analysis.weaknesses}
                            colorClass="rose"
                            onAdd={(text) => handleSwotUpdate('weaknesses', [...analysis.weaknesses, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.weaknesses];
                                newItems[index] = text;
                                handleSwotUpdate('weaknesses', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.weaknesses];
                                newItems.splice(index, 1);
                                handleSwotUpdate('weaknesses', newItems);
                            }}
                            highlightedItems={aiSuggestions?.weaknesses}
                        />
                        <SWOTCard
                            title={t('flowStages.refinement.swot.opportunities')}
                            icon="trending_up"
                            items={analysis.opportunities}
                            colorClass="indigo"
                            onAdd={(text) => handleSwotUpdate('opportunities', [...analysis.opportunities, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.opportunities];
                                newItems[index] = text;
                                handleSwotUpdate('opportunities', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.opportunities];
                                newItems.splice(index, 1);
                                handleSwotUpdate('opportunities', newItems);
                            }}
                            highlightedItems={aiSuggestions?.opportunities}
                        />
                        <SWOTCard
                            title={t('flowStages.refinement.swot.threats')}
                            icon="security"
                            items={analysis.threats}
                            colorClass="amber"
                            onAdd={(text) => handleSwotUpdate('threats', [...analysis.threats, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.threats];
                                newItems[index] = text;
                                handleSwotUpdate('threats', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.threats];
                                newItems.splice(index, 1);
                                handleSwotUpdate('threats', newItems);
                            }}
                            highlightedItems={aiSuggestions?.threats}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
