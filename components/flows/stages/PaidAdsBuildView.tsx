import React, { useMemo } from 'react';
import { Idea, AdPlatform } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Checkbox } from '../../common/Checkbox/Checkbox';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { Select } from '../../common/Select/Select';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { useLanguage } from '../../../context/LanguageContext';

interface PaidAdsBuildViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const PLATFORMS: Array<{ id: AdPlatform; labelKey: string }> = [
    { id: 'Meta', labelKey: 'flowStages.paidAdsBuild.platforms.meta' },
    { id: 'Google', labelKey: 'flowStages.paidAdsBuild.platforms.google' },
    { id: 'LinkedIn', labelKey: 'flowStages.paidAdsBuild.platforms.linkedin' },
    { id: 'TikTok', labelKey: 'flowStages.paidAdsBuild.platforms.tiktok' },
    { id: 'Other', labelKey: 'flowStages.paidAdsBuild.platforms.other' },
];

const CHECKLIST_ITEMS = [
    { id: 'pixel', labelKey: 'flowStages.paidAdsBuild.checklist.pixel' },
    { id: 'events', labelKey: 'flowStages.paidAdsBuild.checklist.events' },
    { id: 'lp', labelKey: 'flowStages.paidAdsBuild.checklist.lp' },
    { id: 'policy', labelKey: 'flowStages.paidAdsBuild.checklist.policy' },
    { id: 'naming', labelKey: 'flowStages.paidAdsBuild.checklist.naming' },
    { id: 'budget_caps', labelKey: 'flowStages.paidAdsBuild.checklist.budgetCaps' },
];

const TRACKING_STATUSES = [
    { value: 'Not Started', labelKey: 'flowStages.paidAdsBuild.tracking.notStarted' },
    { value: 'In Progress', labelKey: 'flowStages.paidAdsBuild.tracking.inProgress' },
    { value: 'Verified', labelKey: 'flowStages.paidAdsBuild.tracking.verified' },
];

export const PaidAdsBuildView: React.FC<PaidAdsBuildViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const { adData, updateAdData } = usePaidAdsData(idea, onUpdate);
    const setup = adData.setup || {};

    const trackingOptions = useMemo(
        () => TRACKING_STATUSES.map((status) => ({ value: status.value, label: t(status.labelKey) })),
        [t]
    );

    const selectedTrackingStatus = TRACKING_STATUSES.some((status) => status.value === setup.trackingStatus)
        ? (setup.trackingStatus as string)
        : TRACKING_STATUSES[0].value;

    const togglePlatform = (platform: AdPlatform) => {
        const current = setup.platforms || [];
        const next = current.includes(platform)
            ? current.filter(p => p !== platform)
            : [...current, platform];
        updateAdData({ setup: { platforms: next } });
    };

    const toggleChecklist = (itemId: string) => {
        const current = setup.checklist || [];
        const next = current.includes(itemId)
            ? current.filter(i => i !== itemId)
            : [...current, itemId];
        updateAdData({ setup: { checklist: next } });
    };

    return (
        <div className="flow-paid-ads-build">
            <div className="flow-paid-ads-build__container">
                <Card className="flow-paid-ads-build__hero">
                    <div className="flow-paid-ads-build__hero-content">
                        <span className="flow-paid-ads-build__badge">{t('flowStages.paidAdsBuild.hero.badge')}</span>
                        <h1 className="flow-paid-ads-build__title">{t('flowStages.paidAdsBuild.hero.title')}</h1>
                    </div>
                    <div className="flow-paid-ads-build__hero-icon">
                        <span className="material-symbols-outlined">fact_check</span>
                    </div>
                </Card>

                <div className="flow-paid-ads-build__grid">
                    <div className="flow-paid-ads-build__main">
                        <Card className="flow-paid-ads-build__panel">
                            <h3 className="flow-paid-ads-build__panel-title">
                                {t('flowStages.paidAdsBuild.sections.platformMix')}
                            </h3>
                            <div className="flow-paid-ads-build__platform-grid">
                                {PLATFORMS.map((platform) => {
                                    const isSelected = (setup.platforms || []).includes(platform.id);
                                    return (
                                        <button
                                            key={platform.id}
                                            type="button"
                                            onClick={() => togglePlatform(platform.id)}
                                            className={`flow-paid-ads-build__platform ${isSelected ? 'is-active' : ''}`}
                                            aria-pressed={isSelected}
                                        >
                                            <span className="flow-paid-ads-build__platform-label">{t(platform.labelKey)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-build__panel">
                            <h3 className="flow-paid-ads-build__panel-title">
                                {t('flowStages.paidAdsBuild.sections.campaignStructure')}
                            </h3>
                            <TextArea
                                value={setup.campaignStructure || ''}
                                onChange={(event) => updateAdData({ setup: { campaignStructure: event.target.value } })}
                                placeholder={t('flowStages.paidAdsBuild.placeholders.campaignStructure')}
                                className="flow-paid-ads-build__control flow-paid-ads-build__control--tall"
                            />
                        </Card>

                        <Card className="flow-paid-ads-build__panel">
                            <h3 className="flow-paid-ads-build__panel-title">
                                {t('flowStages.paidAdsBuild.sections.qaNotes')}
                            </h3>
                            <TextArea
                                value={setup.qaNotes || ''}
                                onChange={(event) => updateAdData({ setup: { qaNotes: event.target.value } })}
                                placeholder={t('flowStages.paidAdsBuild.placeholders.qaNotes')}
                                className="flow-paid-ads-build__control"
                            />
                        </Card>
                    </div>

                    <div className="flow-paid-ads-build__aside">
                        <Card className="flow-paid-ads-build__panel">
                            <div className="flow-paid-ads-build__panel-header">
                                <h3 className="flow-paid-ads-build__panel-title">
                                    {t('flowStages.paidAdsBuild.sections.tracking')}
                                </h3>
                            </div>
                            <div className="flow-paid-ads-build__field-stack">
                                <Select
                                    label={t('flowStages.paidAdsBuild.fields.trackingStatus')}
                                    value={selectedTrackingStatus}
                                    onChange={(value) => updateAdData({ setup: { trackingStatus: value as any } })}
                                    options={trackingOptions}
                                    className="flow-paid-ads-build__control"
                                />
                                <TextInput
                                    label={t('flowStages.paidAdsBuild.fields.utmScheme')}
                                    value={setup.utmScheme || ''}
                                    onChange={(event) => updateAdData({ setup: { utmScheme: event.target.value } })}
                                    placeholder={t('flowStages.paidAdsBuild.placeholders.utmScheme')}
                                    className="flow-paid-ads-build__control"
                                />
                            </div>
                        </Card>

                        <Card className="flow-paid-ads-build__panel">
                            <h3 className="flow-paid-ads-build__panel-title">
                                {t('flowStages.paidAdsBuild.sections.checklist')}
                            </h3>
                            <div className="flow-paid-ads-build__checklist">
                                {CHECKLIST_ITEMS.map((item) => (
                                    <Checkbox
                                        key={item.id}
                                        checked={(setup.checklist || []).includes(item.id)}
                                        onChange={() => toggleChecklist(item.id)}
                                        label={t(item.labelKey)}
                                        className="flow-paid-ads-build__check"
                                    />
                                ))}
                            </div>
                        </Card>

                        <Button
                            className="flow-paid-ads-build__advance"
                            onClick={() => onUpdate({ stage: 'Review' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.paidAdsBuild.actions.advance')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
