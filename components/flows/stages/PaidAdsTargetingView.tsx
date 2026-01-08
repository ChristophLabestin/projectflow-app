import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextInput } from '../../common/Input/TextInput';
import { generateTargetingSuggestions } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsTargetingViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const PLACEMENTS = [
    { id: 'feeds', labelKey: 'flowStages.paidAdsTargeting.placements.feeds', icon: 'feed' },
    { id: 'stories', labelKey: 'flowStages.paidAdsTargeting.placements.stories', icon: 'web_stories' },
    { id: 'search', labelKey: 'flowStages.paidAdsTargeting.placements.search', icon: 'search' },
    { id: 'messages', labelKey: 'flowStages.paidAdsTargeting.placements.messages', icon: 'chat' },
    { id: 'apps', labelKey: 'flowStages.paidAdsTargeting.placements.apps', icon: 'apps' },
];

const GENDER_OPTIONS = [
    { value: 'All', labelKey: 'flowStages.paidAdsTargeting.gender.all' },
    { value: 'Male', labelKey: 'flowStages.paidAdsTargeting.gender.male' },
    { value: 'Female', labelKey: 'flowStages.paidAdsTargeting.gender.female' },
];

export const PaidAdsTargetingView: React.FC<PaidAdsTargetingViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { adData, updateTargeting } = usePaidAdsData(idea, onUpdate);
    const [isGenerating, setIsGenerating] = useState(false);
    const targeting = adData.targeting || {};

    const [locationInput, setLocationInput] = useState('');
    const [interestInput, setInterestInput] = useState('');
    const [behaviorInput, setBehaviorInput] = useState('');
    const [customAudienceInput, setCustomAudienceInput] = useState('');
    const [lookalikeInput, setLookalikeInput] = useState('');
    const [languageInput, setLanguageInput] = useState('');

    const handleGenerateSuggestions = async () => {
        setIsGenerating(true);
        try {
            const suggestions = await generateTargetingSuggestions(
                idea.title,
                idea.description || adData.missionStatement || '',
                adData.objective?.toString() || ''
            );

            if (suggestions) {
                updateTargeting({
                    interests: [...new Set([...(targeting.interests || []), ...(suggestions.interests || [])])],
                    behaviors: [...new Set([...(targeting.behaviors || []), ...(suggestions.behaviors || [])])],
                });
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const addToList = (
        list: string[] | undefined,
        item: string,
        field: 'locations' | 'interests' | 'behaviors' | 'customAudiences' | 'lookalikes' | 'languages',
        setInput: (value: string) => void
    ) => {
        if (item.trim()) {
            const current = list || [];
            if (!current.includes(item.trim())) {
                updateTargeting({ [field]: [...current, item.trim()] });
            }
            setInput('');
        }
    };

    const removeFromList = (
        list: string[] | undefined,
        index: number,
        field: 'locations' | 'interests' | 'behaviors' | 'customAudiences' | 'lookalikes' | 'languages'
    ) => {
        if (!list) return;
        updateTargeting({ [field]: list.filter((_, i) => i !== index) });
    };

    const togglePlacement = (id: string) => {
        const current = targeting.placements || [];
        if (current.includes(id)) {
            updateTargeting({ placements: current.filter(p => p !== id) });
        } else {
            updateTargeting({ placements: [...current, id] });
        }
    };

    return (
        <div className="flow-paid-ads-targeting">
            <div className="flow-paid-ads-targeting__container">
                <Card className="flow-paid-ads-targeting__hero">
                    <div>
                        <div className="flow-paid-ads-targeting__badge">{t('flows.stage.targeting')}</div>
                        <h1 className="flow-paid-ads-targeting__title">{t('flowStages.paidAdsTargeting.hero.title')}</h1>
                    </div>
                    <div className="flow-paid-ads-targeting__hero-icon">
                        <span className="material-symbols-outlined">radar</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-targeting__grid">
                    <div className="flow-paid-ads-targeting__column">
                        <Card className="flow-paid-ads-targeting__panel">
                            <div className="flow-paid-ads-targeting__panel-header">
                                <h3>{t('flowStages.paidAdsTargeting.sections.demographics')}</h3>
                            </div>

                            <div className="flow-paid-ads-targeting__panel-body">
                                <div className="flow-paid-ads-targeting__field">
                                    <div className="flow-paid-ads-targeting__input-row">
                                        <TextInput
                                            label={t('flowStages.paidAdsTargeting.fields.locations')}
                                            value={locationInput}
                                            onChange={(event) => setLocationInput(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Enter' && addToList(targeting.locations, locationInput, 'locations', setLocationInput)}
                                            placeholder={t('flowStages.paidAdsTargeting.placeholders.locations')}
                                            leftElement={<span className="material-symbols-outlined">location_on</span>}
                                            className="flow-paid-ads-targeting__control"
                                        />
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flow-paid-ads-targeting__add-button"
                                            onClick={() => addToList(targeting.locations, locationInput, 'locations', setLocationInput)}
                                        >
                                            {t('common.add')}
                                        </Button>
                                    </div>
                                    <div className="flow-paid-ads-targeting__tag-list">
                                        {targeting.locations?.map((loc, index) => (
                                            <span key={index} className="flow-paid-ads-targeting__tag">
                                                {loc}
                                                <button
                                                    type="button"
                                                    className="flow-paid-ads-targeting__tag-remove"
                                                    onClick={() => removeFromList(targeting.locations, index, 'locations')}
                                                    aria-label={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flow-paid-ads-targeting__field flow-paid-ads-targeting__age-row">
                                    <TextInput
                                        type="number"
                                        label={t('flowStages.paidAdsTargeting.fields.minAge')}
                                        value={targeting.ageMin || 18}
                                        onChange={(event) => updateTargeting({ ageMin: Number(event.target.value) })}
                                        className="flow-paid-ads-targeting__control"
                                    />
                                    <TextInput
                                        type="number"
                                        label={t('flowStages.paidAdsTargeting.fields.maxAge')}
                                        value={targeting.ageMax || 65}
                                        onChange={(event) => updateTargeting({ ageMax: Number(event.target.value) })}
                                        className="flow-paid-ads-targeting__control"
                                    />
                                </div>

                                <div className="flow-paid-ads-targeting__field">
                                    <label className="flow-paid-ads-targeting__label">
                                        {t('flowStages.paidAdsTargeting.fields.gender')}
                                    </label>
                                    <div className="flow-paid-ads-targeting__segmented">
                                        {GENDER_OPTIONS.map((option) => {
                                            const isSelected = (targeting.genders || ['All']).includes(option.value as any);
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className={`flow-paid-ads-targeting__segment ${isSelected ? 'is-active' : ''}`}
                                                    onClick={() => updateTargeting({ genders: [option.value as any] })}
                                                    aria-pressed={isSelected}
                                                >
                                                    {t(option.labelKey)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flow-paid-ads-targeting__field">
                                    <div className="flow-paid-ads-targeting__input-row">
                                        <TextInput
                                            label={t('flowStages.paidAdsTargeting.fields.customAudiences')}
                                            value={customAudienceInput}
                                            onChange={(event) => setCustomAudienceInput(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Enter' && addToList(targeting.customAudiences, customAudienceInput, 'customAudiences', setCustomAudienceInput)}
                                            placeholder={t('flowStages.paidAdsTargeting.placeholders.customAudiences')}
                                            className="flow-paid-ads-targeting__control"
                                        />
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flow-paid-ads-targeting__add-button"
                                            onClick={() => addToList(targeting.customAudiences, customAudienceInput, 'customAudiences', setCustomAudienceInput)}
                                        >
                                            {t('common.add')}
                                        </Button>
                                    </div>
                                    <div className="flow-paid-ads-targeting__tag-list">
                                        {targeting.customAudiences?.map((audience, index) => (
                                            <span key={index} className="flow-paid-ads-targeting__tag">
                                                {audience}
                                                <button
                                                    type="button"
                                                    className="flow-paid-ads-targeting__tag-remove"
                                                    onClick={() => removeFromList(targeting.customAudiences, index, 'customAudiences')}
                                                    aria-label={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flow-paid-ads-targeting__field">
                                    <TextInput
                                        label={t('flowStages.paidAdsTargeting.fields.excludedAudiences')}
                                        value={targeting.excludedAudiences || ''}
                                        onChange={(event) => updateTargeting({ excludedAudiences: event.target.value })}
                                        placeholder={t('flowStages.paidAdsTargeting.placeholders.excludedAudiences')}
                                        className="flow-paid-ads-targeting__control"
                                    />
                                </div>
                            </div>

                            <div className="flow-paid-ads-targeting__panel-footer">
                                <Button
                                    className="flow-paid-ads-targeting__advance"
                                    onClick={() => onUpdate({ stage: 'Budget' })}
                                    icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                    iconPosition="right"
                                >
                                    {t('flowStages.paidAdsTargeting.actions.advance')}
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <div className="flow-paid-ads-targeting__column">
                        <Card className="flow-paid-ads-targeting__panel">
                            <div className="flow-paid-ads-targeting__panel-header">
                                <h3>{t('flowStages.paidAdsTargeting.sections.interests')}</h3>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-paid-ads-targeting__suggest"
                                    onClick={handleGenerateSuggestions}
                                    isLoading={isGenerating}
                                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                >
                                    {isGenerating
                                        ? t('flowStages.paidAdsTargeting.actions.analyzing')
                                        : t('flowStages.paidAdsTargeting.actions.suggest')}
                                </Button>
                            </div>

                            <div className="flow-paid-ads-targeting__panel-body">
                                <div className="flow-paid-ads-targeting__field">
                                    <div className="flow-paid-ads-targeting__input-row">
                                        <TextInput
                                            label={t('flowStages.paidAdsTargeting.fields.interests')}
                                            value={interestInput}
                                            onChange={(event) => setInterestInput(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Enter' && addToList(targeting.interests, interestInput, 'interests', setInterestInput)}
                                            placeholder={t('flowStages.paidAdsTargeting.placeholders.interests')}
                                            className="flow-paid-ads-targeting__control"
                                        />
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flow-paid-ads-targeting__add-button"
                                            onClick={() => addToList(targeting.interests, interestInput, 'interests', setInterestInput)}
                                        >
                                            {t('common.add')}
                                        </Button>
                                    </div>
                                    <div className="flow-paid-ads-targeting__tag-list">
                                        {targeting.interests?.map((interest, index) => (
                                            <span key={index} className="flow-paid-ads-targeting__tag">
                                                {interest}
                                                <button
                                                    type="button"
                                                    className="flow-paid-ads-targeting__tag-remove"
                                                    onClick={() => removeFromList(targeting.interests, index, 'interests')}
                                                    aria-label={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flow-paid-ads-targeting__field">
                                    <div className="flow-paid-ads-targeting__input-row">
                                        <TextInput
                                            label={t('flowStages.paidAdsTargeting.fields.behaviors')}
                                            value={behaviorInput}
                                            onChange={(event) => setBehaviorInput(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Enter' && addToList(targeting.behaviors, behaviorInput, 'behaviors', setBehaviorInput)}
                                            placeholder={t('flowStages.paidAdsTargeting.placeholders.behaviors')}
                                            className="flow-paid-ads-targeting__control"
                                        />
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flow-paid-ads-targeting__add-button"
                                            onClick={() => addToList(targeting.behaviors, behaviorInput, 'behaviors', setBehaviorInput)}
                                        >
                                            {t('common.add')}
                                        </Button>
                                    </div>
                                    <div className="flow-paid-ads-targeting__tag-list">
                                        {targeting.behaviors?.map((behavior, index) => (
                                            <span key={index} className="flow-paid-ads-targeting__tag">
                                                {behavior}
                                                <button
                                                    type="button"
                                                    className="flow-paid-ads-targeting__tag-remove"
                                                    onClick={() => removeFromList(targeting.behaviors, index, 'behaviors')}
                                                    aria-label={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-targeting__panel">
                            <div className="flow-paid-ads-targeting__panel-header">
                                <h3>{t('flowStages.paidAdsTargeting.sections.lookalikes')}</h3>
                            </div>

                            <div className="flow-paid-ads-targeting__panel-body">
                                <div className="flow-paid-ads-targeting__field">
                                    <div className="flow-paid-ads-targeting__input-row">
                                        <TextInput
                                            label={t('flowStages.paidAdsTargeting.fields.lookalikes')}
                                            value={lookalikeInput}
                                            onChange={(event) => setLookalikeInput(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Enter' && addToList(targeting.lookalikes, lookalikeInput, 'lookalikes', setLookalikeInput)}
                                            placeholder={t('flowStages.paidAdsTargeting.placeholders.lookalikes')}
                                            className="flow-paid-ads-targeting__control"
                                        />
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flow-paid-ads-targeting__add-button"
                                            onClick={() => addToList(targeting.lookalikes, lookalikeInput, 'lookalikes', setLookalikeInput)}
                                        >
                                            {t('common.add')}
                                        </Button>
                                    </div>
                                    <div className="flow-paid-ads-targeting__tag-list">
                                        {targeting.lookalikes?.map((lookalike, index) => (
                                            <span key={index} className="flow-paid-ads-targeting__tag">
                                                {lookalike}
                                                <button
                                                    type="button"
                                                    className="flow-paid-ads-targeting__tag-remove"
                                                    onClick={() => removeFromList(targeting.lookalikes, index, 'lookalikes')}
                                                    aria-label={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flow-paid-ads-targeting__field">
                                    <div className="flow-paid-ads-targeting__input-row">
                                        <TextInput
                                            label={t('flowStages.paidAdsTargeting.fields.languages')}
                                            value={languageInput}
                                            onChange={(event) => setLanguageInput(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Enter' && addToList(targeting.languages, languageInput, 'languages', setLanguageInput)}
                                            placeholder={t('flowStages.paidAdsTargeting.placeholders.languages')}
                                            className="flow-paid-ads-targeting__control"
                                        />
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="flow-paid-ads-targeting__add-button"
                                            onClick={() => addToList(targeting.languages, languageInput, 'languages', setLanguageInput)}
                                        >
                                            {t('common.add')}
                                        </Button>
                                    </div>
                                    <div className="flow-paid-ads-targeting__tag-list">
                                        {targeting.languages?.map((lang, index) => (
                                            <span key={index} className="flow-paid-ads-targeting__tag">
                                                {lang}
                                                <button
                                                    type="button"
                                                    className="flow-paid-ads-targeting__tag-remove"
                                                    onClick={() => removeFromList(targeting.languages, index, 'languages')}
                                                    aria-label={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-targeting__panel">
                            <div className="flow-paid-ads-targeting__panel-header">
                                <h3>{t('flowStages.paidAdsTargeting.sections.placements')}</h3>
                            </div>
                            <div className="flow-paid-ads-targeting__panel-body">
                                <div className="flow-paid-ads-targeting__placement-grid">
                                    {PLACEMENTS.map((placement) => {
                                        const selected = (targeting.placements || []).includes(placement.id);
                                        return (
                                            <button
                                                key={placement.id}
                                                type="button"
                                                onClick={() => togglePlacement(placement.id)}
                                                className={`flow-paid-ads-targeting__placement ${selected ? 'is-active' : ''}`}
                                                aria-pressed={selected}
                                            >
                                                <div className="flow-paid-ads-targeting__placement-icon">
                                                    <span className="material-symbols-outlined">{placement.icon}</span>
                                                </div>
                                                <span className="flow-paid-ads-targeting__placement-label">
                                                    {t(placement.labelKey)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};
