import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';

interface MarketingTypeSelectionProps {
    onSelect: (type: 'paidAd' | 'emailMarketing') => void;
}

export const MarketingTypeSelection: React.FC<MarketingTypeSelectionProps> = ({ onSelect }) => {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto p-6">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-main mb-4">{t('flowStages.marketingType.title')}</h2>
                <p className="text-muted text-lg max-w-2xl mx-auto">
                    {t('flowStages.marketingType.subtitle')}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                {/* Paid Ad Card */}
                <button
                    onClick={() => onSelect('paidAd')}
                    className="group relative flex flex-col p-8 rounded-2xl border-2 border-surface hover:border-violet-500 bg-surface-paper hover:bg-surface-hover transition-all duration-200 text-left"
                >
                    <div className="size-14 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                        <span className="material-symbols-outlined text-3xl text-violet-500">ads_click</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">{t('flowStages.marketingType.paidAd.title')}</h3>
                    <p className="text-muted mb-6 leading-relaxed">
                        {t('flowStages.marketingType.paidAd.description')}
                    </p>
                    <div className="mt-auto">
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.marketingType.paidAd.feature1')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.marketingType.paidAd.feature2')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.marketingType.paidAd.feature3')}
                            </li>
                        </ul>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-500 group-hover:gap-3 transition-all">
                            {t('flowStages.marketingType.paidAd.action')}
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </span>
                    </div>
                </button>

                {/* Email Marketing Card */}
                <button
                    onClick={() => onSelect('emailMarketing')}
                    className="group relative flex flex-col p-8 rounded-2xl border-2 border-surface hover:border-orange-500 bg-surface-paper hover:bg-surface-hover transition-all duration-200 text-left"
                >
                    <div className="size-14 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                        <span className="material-symbols-outlined text-3xl text-orange-500">mail</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">{t('flowStages.marketingType.emailMarketing.title')}</h3>
                    <p className="text-muted mb-6 leading-relaxed">
                        {t('flowStages.marketingType.emailMarketing.description')}
                    </p>
                    <div className="mt-auto">
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.marketingType.emailMarketing.feature1')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.marketingType.emailMarketing.feature2')}
                            </li>
                            <li className="flex items-center gap-2 text-sm text-subtle">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                {t('flowStages.marketingType.emailMarketing.feature3')}
                            </li>
                        </ul>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-orange-500 group-hover:gap-3 transition-all">
                            {t('flowStages.marketingType.emailMarketing.action')}
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </span>
                    </div>
                </button>
            </div>
        </div>
    );
};
