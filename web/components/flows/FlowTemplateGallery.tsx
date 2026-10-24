import React from 'react';

import { FLOW_TEMPLATES, type FlowTemplateCategory } from '../../config/flowTemplates';

interface FlowTemplateGalleryProps {
    t: (key: string) => string;
    /** null = "Leer beginnen". */
    onPick: (templateId: string | null) => void;
    category?: FlowTemplateCategory | 'all';
    limit?: number;
    showBlank?: boolean;
}

/** Template cards (icon, title, one sentence), optionally filtered by category. */
export const FlowTemplateGallery: React.FC<FlowTemplateGalleryProps> = ({ t, onPick, category = 'all', limit, showBlank = false }) => {
    const templates = FLOW_TEMPLATES.filter((template) => category === 'all' || template.category === category).slice(0, limit);
    return (
        <div className="flow-gallery">
            {showBlank && (
                <button type="button" className="flow-gallery__card flow-gallery__card--blank" onClick={() => onPick(null)}>
                    <span className="flow-gallery__icon material-symbols-outlined">add</span>
                    <span className="flow-gallery__title">{t('flows.templates.blank.title')}</span>
                    <span className="flow-gallery__text">{t('flows.templates.blank.description')}</span>
                </button>
            )}
            {templates.map((template) => (
                <button key={template.id} type="button" className="flow-gallery__card" onClick={() => onPick(template.id)}>
                    <span className="flow-gallery__icon material-symbols-outlined">{template.icon}</span>
                    <span className="flow-gallery__title">{t(`flows.templates.${template.id}.title`)}</span>
                    <span className="flow-gallery__text">{t(`flows.templates.${template.id}.description`)}</span>
                    <span className="flow-gallery__tag">{t(`flows.templates.category.${template.category}`)}</span>
                </button>
            ))}
        </div>
    );
};
