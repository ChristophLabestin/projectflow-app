import React from 'react';
import { StudioTool } from '../../types';

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
    return (
        <button
            onClick={onClick}
            className={`
                flex flex-col text-left p-6 rounded-2xl transition-all duration-300 border-2
                ${active
                    ? `bg-white shadow-lift border-ink dark:bg-zinc-900 dark:border-white`
                    : 'bg-white/50 border-transparent hover:border-ink/20 dark:bg-zinc-800/50 hover:dark:border-white/20'
                }
            `}
        >
            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-6 
                transition-transform duration-300 group-hover:scale-110
                ${active ? 'bg-ink text-white dark:bg-white dark:text-ink' : `bg-${color}-100 text-${color}-600 dark:bg-${color}-900/30 dark:text-${color}-400`}
            `}>
                <span className="material-symbols-outlined text-[28px]">{icon}</span>
            </div>

            <h3 className={`text-lg font-display font-bold mb-2 ${active ? 'text-ink dark:text-white' : 'text-ink/80 dark:text-white/80'}`}>
                {title}
            </h3>

            <p className={`text-sm leading-relaxed ${active ? 'text-muted' : 'text-muted/70'}`}>
                {description}
            </p>

            {active && (
                <div className="mt-6 flex items-center gap-2 text-xs font-bold text-ink dark:text-white animate-fade-in">
                    <span>Active Tool</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                </div>
            )}
        </button>
    );
};
