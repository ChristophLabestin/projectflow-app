import React from 'react';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { Idea } from '../../../types';
import { generateSocialCampaignConceptAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignConceptViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    isChangeReq?: boolean;
}

interface CampaignConcept {
    bigIdea: string;
    hook: string;
    themes: string[];
    mood: string;
    visualDirection: string;
}

export const SocialCampaignConceptView: React.FC<SocialCampaignConceptViewProps> = ({ idea, onUpdate, isChangeReq }) => {
    const { t } = useLanguage();
    const conceptData: CampaignConcept = React.useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    bigIdea: parsed.bigIdea || '',
                    hook: parsed.hook || '',
                    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
                    mood: parsed.mood || '',
                    visualDirection: parsed.visualDirection || '',
                    ...parsed
                };
            }
        } catch {
            return {
                bigIdea: (!idea.concept || idea.concept.startsWith('{')) ? '' : idea.concept,
                hook: '',
                themes: [],
                mood: '',
                visualDirection: ''
            };
        }

        return {
            bigIdea: (!idea.concept || idea.concept.startsWith('{')) ? '' : idea.concept,
            hook: '',
            themes: [],
            mood: '',
            visualDirection: ''
        };
    }, [idea.concept]);

    const [generating, setGenerating] = React.useState(false);

    const handleGenerateAI = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const result = await generateSocialCampaignConceptAI(idea);
            updateConcept(result);
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const updateConcept = (updates: Partial<CampaignConcept>) => {
        const newData = { ...conceptData, ...updates };
        let existingJson = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                existingJson = JSON.parse(idea.concept);
            }
        } catch {
            existingJson = {};
        }

        onUpdate({ concept: JSON.stringify({ ...existingJson, ...newData }) });
    };

    const addTheme = () => {
        updateConcept({ themes: [...conceptData.themes, ''] });
    };

    const updateTheme = (index: number, val: string) => {
        const newThemes = [...conceptData.themes];
        newThemes[index] = val;
        updateConcept({ themes: newThemes });
    };

    const removeTheme = (index: number) => {
        const newThemes = conceptData.themes.filter((_, i) => i !== index);
        updateConcept({ themes: newThemes });
    };

    const MOODS = [
        { id: 'Energetic', label: t('flowStages.socialCampaignConcept.moods.energetic') },
        { id: 'Professional', label: t('flowStages.socialCampaignConcept.moods.professional') },
        { id: 'Minimalist', label: t('flowStages.socialCampaignConcept.moods.minimalist') },
        { id: 'Playful', label: t('flowStages.socialCampaignConcept.moods.playful') },
        { id: 'Luxurious', label: t('flowStages.socialCampaignConcept.moods.luxurious') },
        { id: 'Gritty', label: t('flowStages.socialCampaignConcept.moods.gritty') },
        { id: 'Authentic', label: t('flowStages.socialCampaignConcept.moods.authentic') },
    ];

    const showChanges = isChangeReq || idea.lastRejectionReason;

    return (
        <div className="flow-social-campaign-concept">
            <div className="flow-social-campaign-concept__container">
                <div className="flow-social-campaign-concept__hero">
                    <div className="flow-social-campaign-concept__hero-glow">
                        <span className="material-symbols-outlined">lightbulb</span>
                    </div>
                    <div className="flow-social-campaign-concept__hero-content">
                        <div className="flow-social-campaign-concept__hero-header">
                            <div className="flow-social-campaign-concept__badge">
                                {t('flowStages.socialCampaignConcept.hero.badge')}
                            </div>
                            <h1 className="flow-social-campaign-concept__title">
                                {t('flowStages.socialCampaignConcept.hero.title')}
                            </h1>
                        </div>
                        <p className="flow-social-campaign-concept__subtitle">
                            {t('flowStages.socialCampaignConcept.hero.subtitle')}
                        </p>
                    </div>
                    <div className="flow-social-campaign-concept__hero-actions">
                        <Button
                            onClick={handleGenerateAI}
                            disabled={generating}
                            variant="secondary"
                            size="sm"
                            icon={
                                <span className={`material-symbols-outlined ${generating ? 'animate-spin' : ''}`}>
                                    {generating ? 'progress_activity' : 'auto_awesome'}
                                </span>
                            }
                        >
                            {generating
                                ? t('flowStages.socialCampaignConcept.actions.dreaming')
                                : t('flowStages.socialCampaignConcept.actions.aiSuggest')}
                        </Button>
                    </div>
                </div>

                {showChanges && (
                    <Card className="flow-social-campaign-concept__change-card">
                        <div className="flow-social-campaign-concept__change-header">
                            <div className="flow-social-campaign-concept__change-icon">
                                <span className="material-symbols-outlined">edit_note</span>
                            </div>
                            <div className="flow-social-campaign-concept__change-body">
                                <h3>{t('flowStages.socialCampaignConcept.changes.title')}</h3>
                                <p>
                                    {idea.lastRejectionReason || t('flowStages.socialCampaignConcept.changes.default')}
                                </p>
                                <div className="flow-social-campaign-concept__change-action">
                                    <span>{t('flowStages.socialCampaignConcept.changes.action')}</span>
                                    <span className="flow-social-campaign-concept__change-divider" />
                                    <span>{t('flowStages.socialCampaignConcept.changes.actionHint')}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="flow-social-campaign-concept__grid">
                    <div className="flow-social-campaign-concept__main">
                        <Card className="flow-social-campaign-concept__panel">
                            <div className="flow-social-campaign-concept__panel-header">
                                <span className="material-symbols-outlined">auto_awesome</span>
                                <div>
                                    <h3>{t('flowStages.socialCampaignConcept.core.title')}</h3>
                                    <p>{t('flowStages.socialCampaignConcept.core.subtitle')}</p>
                                </div>
                            </div>
                            <TextArea
                                className="flow-social-campaign-concept__textarea"
                                placeholder={t('flowStages.socialCampaignConcept.core.placeholder')}
                                value={conceptData.bigIdea}
                                onChange={(e) => updateConcept({ bigIdea: e.target.value })}
                            />
                        </Card>

                        <Card className="flow-social-campaign-concept__panel">
                            <div className="flow-social-campaign-concept__panel-header">
                                <span className="material-symbols-outlined">palette</span>
                                <div>
                                    <h3>{t('flowStages.socialCampaignConcept.visual.title')}</h3>
                                    <p>{t('flowStages.socialCampaignConcept.visual.subtitle')}</p>
                                </div>
                            </div>

                            <div className="flow-social-campaign-concept__visual-grid">
                                <TextArea
                                    label={t('flowStages.socialCampaignConcept.visual.descriptionLabel')}
                                    className="flow-social-campaign-concept__textarea"
                                    placeholder={t('flowStages.socialCampaignConcept.visual.descriptionPlaceholder')}
                                    value={conceptData.visualDirection}
                                    onChange={(e) => updateConcept({ visualDirection: e.target.value })}
                                />
                                <div>
                                    <div className="flow-social-campaign-concept__label">
                                        {t('flowStages.socialCampaignConcept.visual.moodLabel')}
                                    </div>
                                    <div className="flow-social-campaign-concept__moods">
                                        {MOODS.map((mood) => {
                                            const isActive = conceptData.mood === mood.id;
                                            return (
                                                <button
                                                    key={mood.id}
                                                    type="button"
                                                    onClick={() => updateConcept({ mood: mood.id })}
                                                    aria-pressed={isActive}
                                                    className={`flow-social-campaign-concept__mood ${isActive ? 'is-active' : ''}`}
                                                >
                                                    {mood.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="flow-social-campaign-concept__sidebar">
                        <Card className="flow-social-campaign-concept__panel">
                            <div className="flow-social-campaign-concept__panel-header">
                                <span className="material-symbols-outlined">anchor</span>
                                <h3>{t('flowStages.socialCampaignConcept.hook.title')}</h3>
                            </div>
                            <TextArea
                                className="flow-social-campaign-concept__textarea"
                                placeholder={t('flowStages.socialCampaignConcept.hook.placeholder')}
                                value={conceptData.hook}
                                onChange={(e) => updateConcept({ hook: e.target.value })}
                            />
                        </Card>

                        <Card className="flow-social-campaign-concept__panel">
                            <div className="flow-social-campaign-concept__panel-header flow-social-campaign-concept__panel-header--split">
                                <div className="flow-social-campaign-concept__panel-title">
                                    <span className="material-symbols-outlined">view_column</span>
                                    <h3>{t('flowStages.socialCampaignConcept.themes.title')}</h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="flow-social-campaign-concept__theme-add"
                                    onClick={addTheme}
                                    title={t('flowStages.socialCampaignConcept.themes.placeholder')}
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </Button>
                            </div>

                            <div className="flow-social-campaign-concept__themes">
                                {conceptData.themes.length === 0 ? (
                                    <div className="flow-social-campaign-concept__themes-empty">
                                        {t('flowStages.socialCampaignConcept.themes.empty')}
                                    </div>
                                ) : (
                                    conceptData.themes.map((theme, index) => (
                                        <div key={index} className="flow-social-campaign-concept__theme-row">
                                            <span className="flow-social-campaign-concept__theme-index">{index + 1}</span>
                                            <TextInput
                                                value={theme}
                                                onChange={(e) => updateTheme(index, e.target.value)}
                                                placeholder={t('flowStages.socialCampaignConcept.themes.placeholder').replace('{index}', `${index + 1}`)}
                                                className="flow-social-campaign-concept__theme-input"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeTheme(index)}
                                                className="flow-social-campaign-concept__theme-remove"
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <div className="flow-social-campaign-concept__advance">
                            <Button
                                className="flow-social-campaign-concept__advance-button"
                                size="lg"
                                onClick={() => onUpdate({ stage: 'Strategy' })}
                                icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                iconPosition="right"
                            >
                                {t('flowStages.socialCampaignConcept.actions.advance')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
