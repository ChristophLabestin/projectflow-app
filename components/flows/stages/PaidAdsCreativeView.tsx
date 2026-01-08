import React, { useMemo, useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { Select } from '../../common/Select/Select';
import { generateAdCopy } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsCreativeViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const CTA_OPTIONS = [
    { value: 'Learn More', labelKey: 'flowStages.paidAdsCreative.cta.learnMore' },
    { value: 'Shop Now', labelKey: 'flowStages.paidAdsCreative.cta.shopNow' },
    { value: 'Sign Up', labelKey: 'flowStages.paidAdsCreative.cta.signUp' },
    { value: 'Get Started', labelKey: 'flowStages.paidAdsCreative.cta.getStarted' },
    { value: 'Download', labelKey: 'flowStages.paidAdsCreative.cta.download' },
    { value: 'Contact Us', labelKey: 'flowStages.paidAdsCreative.cta.contactUs' },
    { value: 'Book Now', labelKey: 'flowStages.paidAdsCreative.cta.bookNow' },
    { value: 'Apply Now', labelKey: 'flowStages.paidAdsCreative.cta.applyNow' },
];

export const PaidAdsCreativeView: React.FC<PaidAdsCreativeViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { adData, updateCreative } = usePaidAdsData(idea, onUpdate);
    const [isGenerating, setIsGenerating] = useState(false);
    const [variationInput, setVariationInput] = useState('');
    const creative = adData.creative || {};

    const ctaOptions = useMemo(
        () => CTA_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
        [t]
    );

    const selectedCtaValue = CTA_OPTIONS.some((option) => option.value === creative.cta)
        ? (creative.cta as string)
        : CTA_OPTIONS[0].value;

    const selectedCtaLabel = ctaOptions.find((option) => option.value === selectedCtaValue)?.label
        || t(CTA_OPTIONS[0].labelKey);

    const headlineOneLength = (creative.headline1 || '').length;
    const headlineTwoLength = (creative.headline2 || '').length;

    const handleGenerateCopy = async () => {
        setIsGenerating(true);
        try {
            const objective = adData.objective?.toString() || 'General';

            const copy = await generateAdCopy(idea.title, objective, 'Social Media', idea.description || adData.missionStatement || '');

            if (copy) {
                const newHeadline = copy.headlines && copy.headlines.length > 0 ? copy.headlines[0] : '';
                const newPrimaryText = copy.primaryText && copy.primaryText.length > 0 ? copy.primaryText[0] : '';

                const updates: any = {};
                if (newHeadline) updates.headline1 = newHeadline;
                if (newPrimaryText) updates.primaryText = newPrimaryText;

                const newVariations = [...(creative.variations || [])];
                if (copy.headlines && copy.headlines.length > 1) {
                    newVariations.push(...copy.headlines.slice(1));
                }
                updates.variations = [...new Set(newVariations)];

                updateCreative(updates);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const addVariation = () => {
        const trimmed = variationInput.trim();
        if (!trimmed) return;
        const current = creative.variations || [];
        if (!current.includes(trimmed)) {
            updateCreative({ variations: [...current, trimmed] });
        }
        setVariationInput('');
    };

    const removeVariation = (index: number) => {
        if (!creative.variations) return;
        updateCreative({ variations: creative.variations.filter((_, i) => i !== index) });
    };

    const previewDescription = creative.description || t('flowStages.paidAdsCreative.preview.descriptionFallback');
    const previewHeadline = creative.headline1 || t('flowStages.paidAdsCreative.preview.headlineFallback');

    return (
        <div className="flow-paid-ads-creative">
            <div className="flow-paid-ads-creative__container">
                <Card className="flow-paid-ads-creative__hero">
                    <div className="flow-paid-ads-creative__hero-content">
                        <span className="flow-paid-ads-creative__badge">
                            {t('flowStages.paidAdsCreative.hero.badge')}
                        </span>
                        <h1 className="flow-paid-ads-creative__title">
                            {t('flowStages.paidAdsCreative.hero.title')}
                        </h1>
                    </div>
                    <div className="flow-paid-ads-creative__hero-icon">
                        <span className="material-symbols-outlined">palette</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-creative__grid">
                    <div className="flow-paid-ads-creative__main">
                        <Card className="flow-paid-ads-creative__panel">
                            <div className="flow-paid-ads-creative__panel-header">
                                <h3 className="flow-paid-ads-creative__panel-title">
                                    {t('flowStages.paidAdsCreative.sections.adCopy')}
                                </h3>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleGenerateCopy}
                                    isLoading={isGenerating}
                                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                >
                                    {isGenerating
                                        ? t('flowStages.paidAdsCreative.actions.generatingCopy')
                                        : t('flowStages.paidAdsCreative.actions.generateCopy')}
                                </Button>
                            </div>

                            <div className="flow-paid-ads-creative__field-grid">
                                <TextInput
                                    label={t('flowStages.paidAdsCreative.fields.headline1')}
                                    value={creative.headline1 || ''}
                                    onChange={(event) => updateCreative({ headline1: event.target.value })}
                                    placeholder={t('flowStages.paidAdsCreative.placeholders.headline1')}
                                    maxLength={30}
                                    rightElement={
                                        <span className="flow-paid-ads-creative__count">
                                            {headlineOneLength}/30
                                        </span>
                                    }
                                    className="flow-paid-ads-creative__control"
                                />
                                <TextInput
                                    label={t('flowStages.paidAdsCreative.fields.headline2')}
                                    value={creative.headline2 || ''}
                                    onChange={(event) => updateCreative({ headline2: event.target.value })}
                                    placeholder={t('flowStages.paidAdsCreative.placeholders.headline2')}
                                    maxLength={30}
                                    rightElement={
                                        <span className="flow-paid-ads-creative__count">
                                            {headlineTwoLength}/30
                                        </span>
                                    }
                                    className="flow-paid-ads-creative__control"
                                />
                            </div>

                            <TextArea
                                label={t('flowStages.paidAdsCreative.fields.primaryText')}
                                value={creative.primaryText || ''}
                                onChange={(event) => updateCreative({ primaryText: event.target.value })}
                                placeholder={t('flowStages.paidAdsCreative.placeholders.primaryText')}
                                className="flow-paid-ads-creative__control flow-paid-ads-creative__control--tall"
                            />

                            <div className="flow-paid-ads-creative__field-grid">
                                <TextInput
                                    label={t('flowStages.paidAdsCreative.fields.description')}
                                    value={creative.description || ''}
                                    onChange={(event) => updateCreative({ description: event.target.value })}
                                    placeholder={t('flowStages.paidAdsCreative.placeholders.description')}
                                    className="flow-paid-ads-creative__control"
                                />
                                <Select
                                    label={t('flowStages.paidAdsCreative.fields.cta')}
                                    value={selectedCtaValue}
                                    onChange={(value) => updateCreative({ cta: String(value) })}
                                    options={ctaOptions}
                                    placeholder={t('flowStages.paidAdsCreative.placeholders.cta')}
                                    className="flow-paid-ads-creative__control"
                                />
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-creative__panel">
                            <div className="flow-paid-ads-creative__panel-header">
                                <h3 className="flow-paid-ads-creative__panel-title">
                                    {t('flowStages.paidAdsCreative.sections.visualDirection')}
                                </h3>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled
                                    icon={<span className="material-symbols-outlined">add_photo_alternate</span>}
                                    className="flow-paid-ads-creative__attach"
                                >
                                    {t('flowStages.paidAdsCreative.actions.attachReference')}
                                </Button>
                            </div>
                            <TextArea
                                label={t('flowStages.paidAdsCreative.fields.visualConcept')}
                                value={creative.visualConcept || ''}
                                onChange={(event) => updateCreative({ visualConcept: event.target.value })}
                                placeholder={t('flowStages.paidAdsCreative.placeholders.visualConcept')}
                                className="flow-paid-ads-creative__control"
                            />
                        </Card>
                    </div>

                    <div className="flow-paid-ads-creative__aside">
                        <Card className="flow-paid-ads-creative__preview">
                            <h3 className="flow-paid-ads-creative__panel-title">
                                {t('flowStages.paidAdsCreative.sections.livePreview')}
                            </h3>
                            <div className="flow-paid-ads-creative__mockup">
                                <div className="flow-paid-ads-creative__mockup-header">
                                    <div className="flow-paid-ads-creative__mockup-avatar" />
                                    <div className="flow-paid-ads-creative__mockup-meta">
                                        <span className="flow-paid-ads-creative__mockup-line" />
                                        <span className="flow-paid-ads-creative__mockup-line flow-paid-ads-creative__mockup-line--short" />
                                    </div>
                                </div>
                                <div className="flow-paid-ads-creative__mockup-media">
                                    {creative.visualConcept ? (
                                        <span className="flow-paid-ads-creative__mockup-visual">{creative.visualConcept}</span>
                                    ) : (
                                        <div className="flow-paid-ads-creative__mockup-placeholder">
                                            <span className="material-symbols-outlined" aria-hidden="true">image</span>
                                            <span>{t('flowStages.paidAdsCreative.preview.mediaPlaceholder')}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flow-paid-ads-creative__mockup-footer">
                                    <div className="flow-paid-ads-creative__mockup-copy">
                                        <span className="flow-paid-ads-creative__mockup-label">{previewDescription}</span>
                                        <span className="flow-paid-ads-creative__mockup-title">{previewHeadline}</span>
                                    </div>
                                    <span className="flow-paid-ads-creative__mockup-cta">{selectedCtaLabel}</span>
                                </div>
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-creative__variations">
                            <div className="flow-paid-ads-creative__panel-header">
                                <h3 className="flow-paid-ads-creative__panel-title">
                                    {t('flowStages.paidAdsCreative.sections.experiments')}
                                </h3>
                            </div>
                            <div className="flow-paid-ads-creative__variation-row">
                                <TextInput
                                    value={variationInput}
                                    onChange={(event) => setVariationInput(event.target.value)}
                                    onKeyDown={(event) => event.key === 'Enter' && addVariation()}
                                    placeholder={t('flowStages.paidAdsCreative.placeholders.variationInput')}
                                    aria-label={t('flowStages.paidAdsCreative.fields.variationInput')}
                                    className="flow-paid-ads-creative__control"
                                />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={addVariation}
                                    className="flow-paid-ads-creative__variation-add"
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('common.add')}
                                </Button>
                            </div>
                            <div className="flow-paid-ads-creative__variation-list">
                                {(creative.variations || []).length === 0 ? (
                                    <span className="flow-paid-ads-creative__variation-empty">
                                        {t('flowStages.paidAdsCreative.variations.empty')}
                                    </span>
                                ) : (
                                    (creative.variations || []).map((variation, index) => (
                                        <div key={index} className="flow-paid-ads-creative__variation-item">
                                            <div className="flow-paid-ads-creative__variation-info">
                                                <span className="flow-paid-ads-creative__variation-tag">
                                                    {t('flowStages.paidAdsCreative.variations.label').replace('{index}', String(index + 1))}
                                                </span>
                                                <span>{variation}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeVariation(index)}
                                                className="flow-paid-ads-creative__variation-remove"
                                                aria-label={t('common.delete')}
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Button
                            className="flow-paid-ads-creative__advance"
                            onClick={() => onUpdate({ stage: 'Targeting' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.paidAdsCreative.actions.advance')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
