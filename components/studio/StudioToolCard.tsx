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
}

export const StudioToolCard: React.FC<StudioToolCardProps> = ({
    tool, title, description, icon, active, onClick
}) => {
    const { t } = useLanguage();
    const toolKey = tool.toLowerCase();

    return (
        <button
            onClick={onClick}
            type="button"
            aria-pressed={active}
            className={`studio-tool-card ${active ? 'is-active' : ''}`.trim()}
            data-tool={toolKey}
        >
            {active && (
                <span className="studio-tool-card__accent" aria-hidden="true" />
            )}

            <div className="studio-tool-card__icon">
                <span className="material-symbols-outlined">{icon}</span>
            </div>

            <h3 className="studio-tool-card__title">{title}</h3>

            <p className="studio-tool-card__description">{description}</p>

            {active && (
                <div className="studio-tool-card__selected">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>{t('aiStudio.tools.selected')}</span>
                </div>
            )}
        </button>
    );
};
