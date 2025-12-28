import React from 'react';
import { ProjectRisk } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface RiskResultProps {
    risks: ProjectRisk[];
}

export const RiskResult: React.FC<RiskResultProps> = ({ risks }) => {
    const { t } = useLanguage();

    const impactLabels: Record<string, string> = {
        High: t('aiStudio.risk.level.high'),
        Medium: t('aiStudio.risk.level.medium'),
        Low: t('aiStudio.risk.level.low'),
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
                <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">{t('aiStudio.risk.title')}</span>
                <h2 className="text-3xl font-display font-bold text-ink dark:text-white">{t('aiStudio.risk.reportTitle')}</h2>
                <p className="text-muted">{t('aiStudio.risk.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {risks.map((item, idx) => (
                    <div key={idx} className="app-panel p-6 space-y-4 hover:border-rose-200 dark:hover:border-rose-900/30 transition-colors duration-300">
                        <div className="flex items-start justify-between gap-4">
                            <h4 className="font-bold text-lg text-ink dark:text-white leading-tight">{item.risk}</h4>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${item.impact === 'High' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                        item.impact === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    }`}>
                                    {t('aiStudio.risk.impactLabel').replace('{level}', impactLabels[item.impact] || item.impact)}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${item.probability === 'High' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                        item.probability === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    }`}>
                                    {t('aiStudio.risk.probabilityLabel').replace('{level}', impactLabels[item.probability] || item.probability)}
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-line dark:border-white/5">
                            <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">shield</span>
                                {t('aiStudio.risk.mitigation')}
                            </h5>
                            <p className="text-sm text-muted leading-relaxed">{item.mitigation}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
