import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { DatePicker } from '../../ui/DatePicker';
import { createEmailCampaignFromIdea, createAdCampaignFromIdea } from '../../../services/marketingService';
import { auth } from '../../../services/firebase';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingPlanningViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface MarketingPlan {
    // Email Specifics
    emailSenderName: string;
    emailSubjectLines: string[]; // For A/B testing
    emailPreheader: string;

    // Ads Specifics
    adPlatform: string; // Google, Meta, LinkedIn, etc.
    dailyBudget: string;
    adHeadlines: string[];
    adCreativeType: string; // Image, Video, Carousel

    // General
    audienceCriteria: string; // Detailed targeting (kept as text for flexibility)
    assetsRequired: { name: string; done: boolean }[];
    timelineStart: string;
    timelineEnd: string;
}

export const MarketingPlanningView: React.FC<MarketingPlanningViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const defaultAssets = [
        { name: t('flowStages.marketingPlanning.assets.adCreatives'), done: false },
        { name: t('flowStages.marketingPlanning.assets.emailCopy'), done: false },
        { name: t('flowStages.marketingPlanning.assets.landingPage'), done: false },
        { name: t('flowStages.marketingPlanning.assets.utmCodes'), done: false },
    ];
    const plan: MarketingPlan = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    emailSenderName: parsed.emailSenderName || '',
                    emailSubjectLines: Array.isArray(parsed.emailSubjectLines) ? parsed.emailSubjectLines : [],
                    emailPreheader: parsed.emailPreheader || '',
                    adPlatform: parsed.adPlatform || 'Google Ads',
                    dailyBudget: parsed.dailyBudget || '',
                    adHeadlines: Array.isArray(parsed.adHeadlines) ? parsed.adHeadlines : [],
                    adCreativeType: parsed.adCreativeType || 'Image',
                    audienceCriteria: parsed.audienceCriteria || '',
                    assetsRequired: Array.isArray(parsed.assetsRequired) ? parsed.assetsRequired : defaultAssets,
                    timelineStart: parsed.timelineStart || '',
                    timelineEnd: parsed.timelineEnd || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            emailSenderName: '',
            emailSubjectLines: [],
            emailPreheader: '',
            adPlatform: 'Google Ads',
            dailyBudget: '',
            adHeadlines: [],
            adCreativeType: 'Image',
            audienceCriteria: '',
            assetsRequired: defaultAssets,
            timelineStart: '',
            timelineEnd: ''
        };
    })();

    const updatePlan = (updates: Partial<MarketingPlan>) => {
        const newData = { ...plan, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    // Helper for array management
    const addToArray = (field: 'emailSubjectLines' | 'adHeadlines') => {
        updatePlan({ [field]: [...plan[field], ''] });
    };

    const updateArrayItem = (field: 'emailSubjectLines' | 'adHeadlines', idx: number, val: string) => {
        const newArr = [...plan[field]];
        newArr[idx] = val;
        updatePlan({ [field]: newArr });
    };

    const removeArrayItem = (field: 'emailSubjectLines' | 'adHeadlines', idx: number) => {
        const newArr = [...plan[field]];
        newArr.splice(idx, 1);
        updatePlan({ [field]: newArr });
    };

    const toggleAsset = (idx: number) => {
        const newAssets = [...plan.assetsRequired];
        newAssets[idx].done = !newAssets[idx].done;
        updatePlan({ assetsRequired: newAssets });
    };




    const navigate = useNavigate();
    const [isConverting, setIsConverting] = useState(false);

    const handleConvertToCampaign = async () => {
        const user = auth.currentUser;
        if (!user || !idea.projectId) return;
        setIsConverting(true);
        try {
            let campaignId = '';
            let type: 'email' | 'ad' = activeTab === 'Email' ? 'email' : 'ad';

            if (activeTab === 'Email') {
                campaignId = await createEmailCampaignFromIdea(
                    idea.projectId,
                    { id: idea.id, concept: idea.concept, title: idea.title },
                    { uid: user.uid, displayName: user.displayName || 'User' }
                );
            } else {
                campaignId = await createAdCampaignFromIdea(idea.projectId, { id: idea.id, concept: idea.concept, title: idea.title });
            }

            // Update idea with conversion info
            onUpdate({
                convertedCampaignId: campaignId,
                campaignType: type,
                stage: 'Execution' // Auto-advance to Execution
            });

            // Optional: Show success notification
        } catch (error) {
            console.error("Failed to convert campaign", error);
        } finally {
            setIsConverting(false);
        }
    };


    const [activeTab, setActiveTab] = useState<'Email' | 'Ads'>('Email');
    const tabLabels: Record<'Email' | 'Ads', string> = {
        Email: t('flowStages.marketingPlanning.tabs.email'),
        Ads: t('flowStages.marketingPlanning.tabs.ads'),
    };
    const adPlatformOptions = [
        { value: 'Google Ads', label: t('flowStages.marketingPlanning.ads.platform.google') },
        { value: 'Meta (FB/Insta)', label: t('flowStages.marketingPlanning.ads.platform.meta') },
        { value: 'LinkedIn Ads', label: t('flowStages.marketingPlanning.ads.platform.linkedin') },
        { value: 'Twitter / X', label: t('flowStages.marketingPlanning.ads.platform.x') },
        { value: 'TikTok Ads', label: t('flowStages.marketingPlanning.ads.platform.tiktok') },
    ];
    const adFormatOptions = [
        { value: 'Image', label: t('flowStages.marketingPlanning.ads.format.image') },
        { value: 'Video', label: t('flowStages.marketingPlanning.ads.format.video') },
        { value: 'Carousel', label: t('flowStages.marketingPlanning.ads.format.carousel') },
        { value: 'Text Only', label: t('flowStages.marketingPlanning.ads.format.textOnly') },
    ];


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left: Planning Configuration */}
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">{t('flowStages.marketingPlanning.title')}</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('flowStages.marketingPlanning.subtitle')}</p>
                    </div>
                    {/* Channel Switcher */}
                    <div className="flex bg-[var(--color-surface-bg)] rounded-lg p-1 border border-[var(--color-surface-border)]">
                        <button
                            onClick={() => setActiveTab('Email')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'Email'
                                ? 'bg-white shadow text-purple-600'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">mail</span>
                            {tabLabels.Email}
                        </button>
                        <button
                            onClick={() => setActiveTab('Ads')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'Ads'
                                ? 'bg-white shadow text-purple-600'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">ads_click</span>
                            {tabLabels.Ads}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    {activeTab === 'Email' ? (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.email.sender.label')}</label>
                                    <input
                                        type="text"
                                        value={plan.emailSenderName}
                                        onChange={(e) => updatePlan({ emailSenderName: e.target.value })}
                                        className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-purple-500"
                                        placeholder={t('flowStages.marketingPlanning.email.sender.placeholder')}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.email.preheader.label')}</label>
                                    <input
                                        type="text"
                                        value={plan.emailPreheader}
                                        onChange={(e) => updatePlan({ emailPreheader: e.target.value })}
                                        className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-purple-500"
                                        placeholder={t('flowStages.marketingPlanning.email.preheader.placeholder')}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('flowStages.marketingPlanning.email.subjects.label')}</label>
                                    <button onClick={() => addToArray('emailSubjectLines')} className="text-xs text-purple-600 font-medium hover:text-purple-700">
                                        {t('flowStages.marketingPlanning.email.subjects.add')}
                                    </button>
                                </div>
                                {plan.emailSubjectLines.length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic">{t('flowStages.marketingPlanning.email.subjects.empty')}</p>}
                                {plan.emailSubjectLines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <div className="flex items-center justify-center size-9 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-xs font-bold text-[var(--color-text-muted)]">
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <input
                                            type="text"
                                            value={line}
                                            onChange={(e) => updateArrayItem('emailSubjectLines', idx, e.target.value)}
                                            className="flex-1 text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                                            placeholder={t('flowStages.marketingPlanning.email.subjects.placeholder')}
                                        />
                                        <button onClick={() => removeArrayItem('emailSubjectLines', idx)} className="text-[var(--color-text-muted)] hover:text-rose-500 px-2">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.ads.platform.label')}</label>
                                    <select
                                        value={plan.adPlatform}
                                        onChange={(e) => updatePlan({ adPlatform: e.target.value })}
                                        className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-purple-500"
                                    >
                                        {adPlatformOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.ads.format.label')}</label>
                                    <select
                                        value={plan.adCreativeType}
                                        onChange={(e) => updatePlan({ adCreativeType: e.target.value })}
                                        className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-purple-500"
                                    >
                                        {adFormatOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.ads.budget.label')}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                                        <input
                                            type="text"
                                            value={plan.dailyBudget}
                                            onChange={(e) => updatePlan({ dailyBudget: e.target.value })}
                                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg pl-6 pr-3 py-2.5 outline-none focus:ring-1 focus:ring-purple-500"
                                            placeholder={t('flowStages.marketingPlanning.ads.budget.placeholder')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('flowStages.marketingPlanning.ads.headlines.label')}</label>
                                    <button onClick={() => addToArray('adHeadlines')} className="text-xs text-purple-600 font-medium hover:text-purple-700">
                                        {t('flowStages.marketingPlanning.ads.headlines.add')}
                                    </button>
                                </div>
                                {plan.adHeadlines.length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic">{t('flowStages.marketingPlanning.ads.headlines.empty')}</p>}
                                {plan.adHeadlines.map((line, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <div className="flex items-center justify-center size-9 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-xs font-bold text-[var(--color-text-muted)]">
                                            #{idx + 1}
                                        </div>
                                        <input
                                            type="text"
                                            value={line}
                                            onChange={(e) => updateArrayItem('adHeadlines', idx, e.target.value)}
                                            className="flex-1 text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                                            placeholder={t('flowStages.marketingPlanning.ads.headlines.placeholder')}
                                        />
                                        <button onClick={() => removeArrayItem('adHeadlines', idx)} className="text-[var(--color-text-muted)] hover:text-rose-500 px-2">
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.ads.audience.label')}</label>
                                <textarea
                                    value={plan.audienceCriteria}
                                    onChange={(e) => updatePlan({ audienceCriteria: e.target.value })}
                                    className="w-full h-24 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-purple-500 outline-none text-sm resize-none"
                                    placeholder={t('flowStages.marketingPlanning.ads.audience.placeholder')}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-auto pt-6 border-t border-[var(--color-surface-border)] flex justify-end">
                    <Button
                        className="h-10 text-sm gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-lg"
                        onClick={handleConvertToCampaign}
                        disabled={isConverting || !!idea.convertedCampaignId}
                    >
                        {isConverting ? t('flowStages.marketingPlanning.actions.creating') : idea.convertedCampaignId ? t('flowStages.marketingPlanning.actions.created') : t('flowStages.marketingPlanning.actions.createAndNext')}
                        <span>{t('flowStages.marketingPlanning.actions.confirmNext')}</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Button>
                </div>
            </div>

            {/* Link to Converted Campaign if exists */}
            {idea.convertedCampaignId && (
                <div className="col-span-1 lg:col-span-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                            <span className="material-symbols-outlined">verified</span>
                        </div>
                        <div>
                            <h4 className="font-bold text-green-800 dark:text-green-200">{t('flowStages.marketingPlanning.converted.title')}</h4>
                            <p className="text-sm text-green-600 dark:text-green-300">{t('flowStages.marketingPlanning.converted.subtitle')}</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white border-none"
                        onClick={() => navigate(`/projects/${idea.projectId}/marketing/${idea.campaignType === 'email' ? 'email' : 'ads'}/${idea.convertedCampaignId}`)}
                    >
                        {t('flowStages.marketingPlanning.converted.action')}
                    </Button>
                </div>
            )}

            {/* Right: Assets Checklist & Timeline */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <h3 className="font-bold text-[var(--color-text-main)] mb-4">{t('flowStages.marketingPlanning.readiness.title')}</h3>

                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.timeline.title')}</label>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] text-[var(--color-text-muted)] uppercase block mb-1">{t('flowStages.marketingPlanning.timeline.start')}</span>
                                <DatePicker
                                    value={plan.timelineStart}
                                    onChange={(date) => updatePlan({ timelineStart: date })}
                                    className="w-full"
                                    placeholder={t('flowStages.marketingPlanning.timeline.startPlaceholder')}
                                />
                            </div>
                            <div>
                                <span className="text-[10px] text-[var(--color-text-muted)] uppercase block mb-1">{t('flowStages.marketingPlanning.timeline.end')}</span>
                                <DatePicker
                                    value={plan.timelineEnd}
                                    onChange={(date) => updatePlan({ timelineEnd: date })}
                                    className="w-full"
                                    placeholder={t('flowStages.marketingPlanning.timeline.endPlaceholder')}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">{t('flowStages.marketingPlanning.assets.title')}</label>
                        <div className="space-y-2">
                            {plan.assetsRequired.map((asset, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => toggleAsset(idx)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${asset.done
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-purple-300'
                                        }`}
                                >
                                    <div className={`size-5 rounded flex items-center justify-center border ${asset.done
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-[var(--color-text-muted)] bg-white dark:bg-slate-800'
                                        }`}>
                                        {asset.done && <span className="material-symbols-outlined text-[14px]">check</span>}
                                    </div>
                                    <span className={`text-sm ${asset.done ? 'text-emerald-700 dark:text-emerald-300 line-through opacity-70' : 'text-[var(--color-text-main)]'}`}>
                                        {asset.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
