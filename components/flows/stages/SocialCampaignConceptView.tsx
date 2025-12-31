import React from 'react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Textarea } from '../../ui/Textarea';
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
    // Parse concept data
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
        } catch { }
        // Fallback or if it's just a string, treat string as Core Flow
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
        // We preserve other fields that might be in the JSON (like strategy fields from next step if they exist, though unlikely if we are linear)
        // Actually, if we use the same JSON blob, we must be careful not to wipe 'strategy' fields if they share the same storage.
        // SocialStrategyView reads: subGoal, targetAudience, channels...
        // We are adding: bigIdea, hook, themes, mood...
        // So we should try to merge with existing JSON if possible.
        let existingJson = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                existingJson = JSON.parse(idea.concept);
            }
        } catch { }

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

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-24">
                <Card padding="lg" className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{t('flowStages.socialCampaignConcept.hero.badge')}</Badge>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-main)]">
                            {t('flowStages.socialCampaignConcept.hero.title')}
                        </h1>
                        <p className="text-sm text-[var(--color-text-muted)] max-w-2xl">
                            {t('flowStages.socialCampaignConcept.hero.subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleGenerateAI}
                            disabled={generating}
                            variant="secondary"
                            size="sm"
                            icon={
                                <span className={`material-symbols-outlined text-[16px] ${generating ? 'animate-spin' : ''}`}>
                                    {generating ? 'progress_activity' : 'auto_awesome'}
                                </span>
                            }
                        >
                            {generating ? t('flowStages.socialCampaignConcept.actions.dreaming') : t('flowStages.socialCampaignConcept.actions.aiSuggest')}
                        </Button>
                    </div>
                </Card>

                {(isChangeReq || idea.lastRejectionReason) && (
                    <Card className="border-l-4 border-l-amber-400">
                        <div className="flex items-start gap-3">
                            <div className="size-10 rounded-xl bg-amber-100/60 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-[var(--color-text-main)]">
                                    {t('flowStages.socialCampaignConcept.changes.title')}
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                    {idea.lastRejectionReason || t('flowStages.socialCampaignConcept.changes.default')}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                                    <span>{t('flowStages.socialCampaignConcept.changes.action')}</span>
                                    <span className="h-px w-8 bg-[var(--color-surface-border)]" />
                                    <span className="text-[var(--color-text-muted)]">{t('flowStages.socialCampaignConcept.changes.actionHint')}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-6">
                        <Card padding="md" className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="size-9 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-[var(--color-text-main)]">
                                        {t('flowStages.socialCampaignConcept.core.title')}
                                    </h3>
                                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                        {t('flowStages.socialCampaignConcept.core.subtitle')}
                                    </p>
                                </div>
                            </div>
                            <Textarea
                                className="min-h-[160px] text-base leading-relaxed focus:border-[var(--color-primary)]"
                                placeholder={t('flowStages.socialCampaignConcept.core.placeholder')}
                                value={conceptData.bigIdea}
                                onChange={(e) => updateConcept({ bigIdea: e.target.value })}
                            />
                        </Card>

                        <Card padding="md" className="space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="size-9 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[18px]">palette</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-[var(--color-text-main)]">
                                        {t('flowStages.socialCampaignConcept.visual.title')}
                                    </h3>
                                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                        {t('flowStages.socialCampaignConcept.visual.subtitle')}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Textarea
                                    label={t('flowStages.socialCampaignConcept.visual.descriptionLabel')}
                                    className="min-h-[140px] focus:border-[var(--color-primary)]"
                                    placeholder={t('flowStages.socialCampaignConcept.visual.descriptionPlaceholder')}
                                    value={conceptData.visualDirection}
                                    onChange={(e) => updateConcept({ visualDirection: e.target.value })}
                                />
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                                        {t('flowStages.socialCampaignConcept.visual.moodLabel')}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {MOODS.map((mood) => {
                                            const isActive = conceptData.mood === mood.id;
                                            return (
                                                <button
                                                    key={mood.id}
                                                    type="button"
                                                    onClick={() => updateConcept({ mood: mood.id })}
                                                    aria-pressed={isActive}
                                                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${isActive
                                                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-[var(--color-primary)]'
                                                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-surface-border)] hover:border-[var(--color-text-subtle)] hover:text-[var(--color-text-main)]'
                                                        }`}
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

                    <div className="lg:col-span-4 space-y-6">
                        <Card padding="md" className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">anchor</span>
                                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    {t('flowStages.socialCampaignConcept.hook.title')}
                                </h3>
                            </div>
                            <Textarea
                                className="min-h-[120px] focus:border-[var(--color-primary)]"
                                placeholder={t('flowStages.socialCampaignConcept.hook.placeholder')}
                                value={conceptData.hook}
                                onChange={(e) => updateConcept({ hook: e.target.value })}
                            />
                        </Card>

                        <Card padding="md" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">view_column</span>
                                    <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                        {t('flowStages.socialCampaignConcept.themes.title')}
                                    </h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={addTheme}
                                    title={t('flowStages.socialCampaignConcept.themes.placeholder')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {conceptData.themes.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-[var(--color-surface-border)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                                        {t('flowStages.socialCampaignConcept.themes.empty')}
                                    </div>
                                ) : (
                                    conceptData.themes.map((theme, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold text-[var(--color-text-subtle)] w-5 text-right">{i + 1}</span>
                                            <input
                                                type="text"
                                                value={theme}
                                                onChange={(e) => updateTheme(i, e.target.value)}
                                                placeholder={t('flowStages.socialCampaignConcept.themes.placeholder').replace('{index}', `${i + 1}`)}
                                                className="flex-1 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-subtle)] transition-colors focus:border-[var(--color-primary)]"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeTheme(i)}
                                                className="p-1 rounded-lg text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <div>
                            <Button
                                className="w-full"
                                size="lg"
                                onClick={() => onUpdate({ stage: 'Strategy' })}
                            >
                                {t('flowStages.socialCampaignConcept.actions.advance')}
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
