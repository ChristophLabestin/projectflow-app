import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { SWOTCard } from './SWOTCard';
import { generateProductStrategyAI, generateSWOTAnalysisAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface ProductStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const ProductStrategyView: React.FC<ProductStrategyViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);

    const analysis = idea.analysis || {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    };

    const handleSwotUpdate = (category: keyof typeof analysis, newList: string[]) => {
        onUpdate({
            analysis: {
                ...analysis,
                [category]: newList
            }
        });
    };

    const handleGenerateStrategy = async () => {
        setGenerating(true);
        try {
            const [strategyData, swotData] = await Promise.all([
                generateProductStrategyAI(idea),
                generateSWOTAnalysisAI(idea)
            ]);

            onUpdate({
                description: strategyData.vision,
                riskWinAnalysis: {
                    ...(idea.riskWinAnalysis || {
                        successProbability: 0,
                        risks: [],
                        wins: [],
                        recommendation: ''
                    }),
                    marketFitScore: strategyData.marketFit,
                    technicalFeasibilityScore: strategyData.feasibility
                },
                analysis: {
                    strengths: Array.from(new Set([...analysis.strengths, ...swotData.strengths])),
                    weaknesses: Array.from(new Set([...analysis.weaknesses, ...swotData.weaknesses])),
                    opportunities: Array.from(new Set([...analysis.opportunities, ...swotData.opportunities])),
                    threats: Array.from(new Set([...analysis.threats, ...swotData.threats])),
                }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const marketFitScore = idea.riskWinAnalysis?.marketFitScore || 0;
    const feasibilityScore = idea.riskWinAnalysis?.technicalFeasibilityScore || 0;

    return (
        <div className="flow-product-strategy">
            <div className="flow-product-strategy__header">
                <div className="flow-product-strategy__heading">
                    <h2>{t('flowStages.productStrategy.title')}</h2>
                    <p>{t('flowStages.productStrategy.subtitle')}</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateStrategy}
                    isLoading={generating}
                    className="flow-product-strategy__generate"
                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                >
                    {t('flowStages.productStrategy.actions.generate')}
                </Button>
            </div>

            <div className="flow-product-strategy__layout">
                <div className="flow-product-strategy__sidebar">
                    <Card className="flow-product-strategy__panel">
                        <div className="flow-product-strategy__panel-header">
                            <span className="material-symbols-outlined">visibility</span>
                            <span>{t('flowStages.productStrategy.vision.title')}</span>
                        </div>
                        <TextArea
                            value={idea.description}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            placeholder={t('flowStages.productStrategy.vision.placeholder')}
                            className="flow-product-strategy__vision"
                        />
                    </Card>

                    <Card className="flow-product-strategy__panel">
                        <div className="flow-product-strategy__panel-header">
                            <span className="material-symbols-outlined">ads_click</span>
                            <span>{t('flowStages.productStrategy.marketFit.title')}</span>
                        </div>
                        <div className="flow-product-strategy__sliders">
                            <div className="flow-product-strategy__slider">
                                <div className="flow-product-strategy__slider-header">
                                    <span>{t('flowStages.productStrategy.marketFit.demand')}</span>
                                    <span>{marketFitScore}/10</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={marketFitScore}
                                    onChange={(e) => onUpdate({
                                        riskWinAnalysis: {
                                            ...(idea.riskWinAnalysis || {
                                                successProbability: 0,
                                                technicalFeasibilityScore: 0,
                                                risks: [],
                                                wins: [],
                                                recommendation: ''
                                            }),
                                            marketFitScore: parseInt(e.target.value, 10)
                                        }
                                    })}
                                    className="flow-product-strategy__range"
                                    data-tone="primary"
                                />
                            </div>

                            <div className="flow-product-strategy__slider">
                                <div className="flow-product-strategy__slider-header">
                                    <span>{t('flowStages.productStrategy.marketFit.feasibility')}</span>
                                    <span>{feasibilityScore}/10</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={feasibilityScore}
                                    onChange={(e) => onUpdate({
                                        riskWinAnalysis: {
                                            ...(idea.riskWinAnalysis || {
                                                successProbability: 0,
                                                marketFitScore: 0,
                                                risks: [],
                                                wins: [],
                                                recommendation: ''
                                            }),
                                            technicalFeasibilityScore: parseInt(e.target.value, 10)
                                        }
                                    })}
                                    className="flow-product-strategy__range"
                                    data-tone="warning"
                                />
                            </div>
                        </div>
                    </Card>

                    <div className="flow-product-strategy__advance">
                        <Button
                            className="flow-product-strategy__advance-button"
                            onClick={() => onUpdate({ stage: 'Discovery' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.productStrategy.actions.advance')}
                        </Button>
                    </div>
                </div>

                <div className="flow-product-strategy__main">
                    <div className="flow-product-strategy__swot-grid">
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
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
