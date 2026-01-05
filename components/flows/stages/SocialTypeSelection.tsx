import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialTypeSelectionProps {
    onSelect: (type: 'post' | 'campaign') => void;
}

export const SocialTypeSelection: React.FC<SocialTypeSelectionProps> = ({ onSelect }) => {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto p-6">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-main mb-4">{t('flowStages.socialType.title')}</h2>
                <p className="text-muted text-lg max-w-2xl mx-auto">
                    {t('flowStages.socialType.subtitle')}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                {/* Single Post Card */}
                <button
                    onClick={() => onSelect('post')}
                    className="group relative flex flex-col p-8 rounded-2xl border-2 border-surface hover:border-primary bg-surface-paper hover:bg-surface-hover transition-all duration-200 text-left"
                >
                    <div className="size-14 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                        <span className="material-symbols-outlined text-3xl text-indigo-500">post_add</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">{t('flowStages.socialType.post.title')}</h3>
                    <p className="text-muted mb-6 leading-relaxed">
                        {t('flowStages.socialType.post.description')}
                    </p>
                    <div className="mt-auto">
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.socialType.post.feature1')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.socialType.post.feature2')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.socialType.post.feature3')}
                            </li>
                        </ul>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                            {t('flowStages.socialType.post.action')}
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </span>
                    </div>
                </button>

                {/* Campaign Card */}
                <button
                    onClick={() => onSelect('campaign')}
                    className="group relative flex flex-col p-8 rounded-2xl border-2 border-surface hover:border-primary bg-surface-paper hover:bg-surface-hover transition-all duration-200 text-left"
                >
                    <div className="size-14 rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-pink-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                        <span className="material-symbols-outlined text-3xl text-fuchsia-500">campaign</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">{t('flowStages.socialType.campaign.title')}</h3>
                    <p className="text-muted mb-6 leading-relaxed">
                        {t('flowStages.socialType.campaign.description')}
                    </p>
                    <div className="mt-auto">
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.socialType.campaign.feature1')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.socialType.campaign.feature2')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.socialType.campaign.feature3')}
                            </li>
                        </ul>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                            {t('flowStages.socialType.campaign.action')}
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </span>
                    </div>
                </button>
            </div>
        </div>
    );
};
