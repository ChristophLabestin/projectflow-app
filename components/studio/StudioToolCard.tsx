import React from 'react';
import { StudioTool } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface StudioToolCardProps {
    tool: StudioTool;
    title: string;
    description: string;
    icon: string;
    active: boolean;
    onClick: () => void;
    color: string;
}

export const StudioToolCard: React.FC<StudioToolCardProps> = ({
    tool, title, description, icon, active, onClick, color
}) => {
    const { t } = useLanguage();

    return (
        <button
            onClick={onClick}
            className={`
                relative flex flex-col text-left p-6 rounded-2xl transition-all duration-400 overflow-hidden border
                ${active
                    ? `bg-${color}-50/50 dark:bg-${color}-500/5 shadow-xl scale-[1.02] z-10 border-transparent`
                    : 'bg-white/60 dark:bg-zinc-800/40 hover:bg-white dark:hover:bg-zinc-800 shadow-sm border-transparent hover:border-line dark:hover:border-white/10'
                }
            `}
        >
            {/* Accent Bar */}
            {active && (
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-${color}-500 animate-in fade-in slide-in-from-left duration-500`}></div>
            )}

            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-6 
                transition-all duration-300
                ${active
                    ? `bg-${color}-500 text-white shadow-lg shadow-${color}-500/20 scale-110`
                    : `bg-${color}-100 text-${color}-600 dark:bg-${color}-900/30 dark:text-${color}-400`
                }
            `}>
                <span className="material-symbols-outlined text-[28px]">{icon}</span>
            </div>

            <h3 className={`text-lg font-display font-bold mb-2 transition-colors ${active ? 'text-ink dark:text-white' : 'text-ink/80 dark:text-white/80'}`}>
                {title}
            </h3>

            <p className={`text-sm leading-relaxed transition-colors ${active ? 'text-ink/70 dark:text-white/70' : 'text-muted/70'}`}>
                {description}
            </p>

            {active && (
                <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-indigo-500 dark:text-indigo-400 animate-fade-in">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>{t('aiStudio.tools.selected')}</span>
                </div>
            )}
        </button>
    );
};
