import React, { useState } from 'react';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Idea, SocialPlatform } from '../../../types';
import { generatePlatformConceptsAI } from '../../../services/geminiService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCreativeLabViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface CreativeConcept {
    hook: string;
    contentBody: string;
    visualCue: string;
    format: string;
}

interface CreativeLabData {
    tone: string;
    concepts: Record<string, CreativeConcept>;
    hooks?: string[];
    storyboard?: any[];
}

export const SocialCreativeLabView: React.FC<SocialCreativeLabViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);

    const strategy = (() => {
        try {
            return idea.concept ? JSON.parse(idea.concept) : {};
        } catch { return {}; }
    })();

    const labData: CreativeLabData = {
        tone: strategy.tone || 'Friendly & Professional',
        concepts: strategy.concepts || {},
        hooks: strategy.hooks,
        storyboard: strategy.storyboard
    };

    const updateLabData = (updates: Partial<CreativeLabData>) => {
        const newData = { ...strategy, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const handleGenerateConcepts = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const concepts = await generatePlatformConceptsAI(idea, strategy, labData.tone);
            updateLabData({ concepts });
        } catch (error) {
            console.error('Concept generation error:', error);
        } finally {
            setGenerating(false);
        }
    };

    const validChannels: SocialPlatform[] = strategy.channels || [];
    const hasConcepts = Object.keys(labData.concepts).length > 0;

    const TONES = [
        { id: 'Professional', label: t('flowStages.socialCreativeLab.tones.professional') },
        { id: 'Witty', label: t('flowStages.socialCreativeLab.tones.witty') },
        { id: 'Bold', label: t('flowStages.socialCreativeLab.tones.bold') },
        { id: 'Educational', label: t('flowStages.socialCreativeLab.tones.educational') },
        { id: 'Authentic', label: t('flowStages.socialCreativeLab.tones.authentic') },
        { id: 'High Energy', label: t('flowStages.socialCreativeLab.tones.highEnergy') },
        { id: 'Minimalist', label: t('flowStages.socialCreativeLab.tones.minimalist') },
    ];
    const toneLabel = TONES.find((tone) => tone.id === labData.tone)?.label || labData.tone;

    const missionText = (
        <p className="flow-social-creative__mission">
            "{t('flowStages.socialCreativeLab.mission.prefix')} <span className="flow-social-creative__mission-highlight">
                {t('flowStages.socialCreativeLab.mission.plays').replace('{count}', String(validChannels.length))}
            </span>
            {' '}{t('flowStages.socialCreativeLab.mission.into')} <span className="flow-social-creative__mission-highlight">
                {t('flowStages.socialCreativeLab.mission.concepts')}
            </span>
            {' '}{t('flowStages.socialCreativeLab.mission.amplify')} <span className="flow-social-creative__mission-highlight">
                {toneLabel}
            </span> {t('flowStages.socialCreativeLab.mission.voiceSuffix')}"
        </p>
    );

    return (
        <div className="flow-social-creative">
            <div className="flow-social-creative__container">
                <div className="flow-social-creative__hero">
                    <div className="flow-social-creative__hero-glow">
                        <span className="material-symbols-outlined">science</span>
                    </div>
                    <div className="flow-social-creative__hero-content">
                        <div className="flow-social-creative__hero-header">
                            <div className="flow-social-creative__badge">
                                {t('flowStages.socialCreativeLab.hero.badge')}
                            </div>
                            <h1 className="flow-social-creative__title">
                                {t('flowStages.socialCreativeLab.hero.title')}
                            </h1>
                        </div>
                        <div className="flow-social-creative__mission-card">
                            {missionText}
                        </div>
                    </div>
                </div>

                <div className="flow-social-creative__grid">
                    <div className="flow-social-creative__sidebar">
                        <Card className="flow-social-creative__panel">
                            <h3 className="flow-social-creative__panel-title">{t('flowStages.socialCreativeLab.ingredients.title')}</h3>
                            {validChannels.length === 0 ? (
                                <div className="flow-social-creative__empty">
                                    <p>{t('flowStages.socialCreativeLab.ingredients.empty')}</p>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onUpdate({ stage: 'Strategy' })}
                                    >
                                        {t('flowStages.socialCreativeLab.ingredients.return')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flow-social-creative__channels">
                                    {validChannels.map((channel) => (
                                        <div key={channel} className="flow-social-creative__channel">
                                            <div className="flow-social-creative__channel-icon">
                                                <PlatformIcon platform={channel} />
                                            </div>
                                            <div className="flow-social-creative__channel-body">
                                                <span>{channel}</span>
                                                <span className="flow-social-creative__channel-play">
                                                    {strategy.plays?.[channel]?.play || t('flowStages.socialCreativeLab.ingredients.defaultPlay')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {idea.keywords && idea.keywords.length > 0 && (
                                <div className="flow-social-creative__themes">
                                    <div className="flow-social-creative__themes-label">{t('flowStages.socialCreativeLab.ingredients.themes')}</div>
                                    <div className="flow-social-creative__themes-list">
                                        {idea.keywords.slice(0, 5).map((keyword) => (
                                            <span key={keyword} className="flow-social-creative__theme">{keyword}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>

                        <Card className="flow-social-creative__panel">
                            <h3 className="flow-social-creative__panel-title">{t('flowStages.socialCreativeLab.voice.title')}</h3>
                            <div className="flow-social-creative__tones">
                                {TONES.map((tone) => (
                                    <button
                                        key={tone.id}
                                        type="button"
                                        className={`flow-social-creative__tone ${labData.tone === tone.id ? 'is-active' : ''}`}
                                        onClick={() => updateLabData({ tone: tone.id })}
                                    >
                                        {tone.label}
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <Card className="flow-social-creative__panel flow-social-creative__generate">
                            <div className="flow-social-creative__generate-icon">
                                <span className={`material-symbols-outlined ${generating ? 'animate-spin' : ''}`}>
                                    {generating ? 'change_circle' : 'science'}
                                </span>
                            </div>
                            <h3>{t('flowStages.socialCreativeLab.actions.title')}</h3>
                            <p>{t('flowStages.socialCreativeLab.actions.subtitle')}</p>
                            <Button
                                onClick={handleGenerateConcepts}
                                isLoading={generating}
                                disabled={validChannels.length === 0}
                                className="flow-social-creative__generate-button"
                            >
                                {hasConcepts ? t('flowStages.socialCreativeLab.actions.regenerate') : t('flowStages.socialCreativeLab.actions.run')}
                            </Button>
                        </Card>
                    </div>

                    <div className="flow-social-creative__main">
                        <Card className="flow-social-creative__results">
                            <div className="flow-social-creative__results-header">
                                <div>
                                    <h3>{t('flowStages.socialCreativeLab.results.title')}</h3>
                                    <p>{t('flowStages.socialCreativeLab.results.subtitle')}</p>
                                </div>
                                {hasConcepts && (
                                    <span className="flow-social-creative__badge-success">
                                        {t('flowStages.socialCreativeLab.results.success')}
                                    </span>
                                )}
                            </div>

                            {!hasConcepts ? (
                                <div className="flow-social-creative__results-empty">
                                    <span className="material-symbols-outlined">experiment</span>
                                    <h4>{t('flowStages.socialCreativeLab.results.empty.title')}</h4>
                                    <p>{t('flowStages.socialCreativeLab.results.empty.subtitle')}</p>
                                </div>
                            ) : (
                                <div className="flow-social-creative__results-grid">
                                    {validChannels.map((platform) => {
                                        const concept = labData.concepts[platform];
                                        if (!concept) return null;

                                        return (
                                            <div key={platform} className="flow-social-creative__card">
                                                <div className="flow-social-creative__card-header">
                                                    <div className="flow-social-creative__card-channel">
                                                        <div className="flow-social-creative__channel-icon">
                                                            <PlatformIcon platform={platform} />
                                                        </div>
                                                        <span>{concept.format || t('flowStages.socialCreativeLab.results.formatFallback')}</span>
                                                    </div>
                                                    <span className="material-symbols-outlined">more_horiz</span>
                                                </div>

                                                <div className="flow-social-creative__card-body">
                                                    <div>
                                                        <div className="flow-social-creative__label">
                                                            <span className="material-symbols-outlined">phishing</span>
                                                            {t('flowStages.socialCreativeLab.results.hook')}
                                                        </div>
                                                        <p className="flow-social-creative__hook">"{concept.hook}"</p>
                                                    </div>

                                                    <div className="flow-social-creative__content">
                                                        <span className="flow-social-creative__label">{t('flowStages.socialCreativeLab.results.contentOutline')}</span>
                                                        <p>{concept.contentBody}</p>
                                                    </div>

                                                    <div>
                                                        <span className="flow-social-creative__label">{t('flowStages.socialCreativeLab.results.visualDirection')}</span>
                                                        <div className="flow-social-creative__visual">
                                                            <span className="material-symbols-outlined">videocam</span>
                                                            <p>{concept.visualCue}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        <div className="flow-social-creative__footer">
                            <Button
                                className="flow-social-creative__advance"
                                onClick={() => onUpdate({ stage: 'Studio' })}
                                disabled={!hasConcepts}
                                icon={<span className="material-symbols-outlined">movie_edit</span>}
                                iconPosition="right"
                            >
                                {t('flowStages.socialCreativeLab.actions.advance')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
