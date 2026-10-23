import React from 'react';

import { FLOW_TEMPLATES } from '../../config/flowTemplates';

interface FlowTemplateGalleryProps {
    t: (key: string) => string;
    onPick: (templateId: string | null) => void;
}

/** Template cards plus "Start from scratch". */
export const FlowTemplateGallery: React.FC<FlowTemplateGalleryProps> = ({ t, onPick }) => (
    <div className="flow-gallery">
        <button type="button" className="flow-gallery__card flow-gallery__card--blank" onClick={() => onPick(null)}>
            <span className="flow-gallery__icon material-symbols-outlined">add</span>
            <span className="flow-gallery__title">{t('flows.templates.blank.title')}</span>
            <span className="flow-gallery__text">{t('flows.templates.blank.description')}</span>
        </button>
        {FLOW_TEMPLATES.map((template) => (
            <button key={template.id} type="button" className="flow-gallery__card" onClick={() => onPick(template.id)}>
                <span className="flow-gallery__icon material-symbols-outlined">{template.icon}</span>
                <span className="flow-gallery__title">{t(`flows.templates.${template.id}.title`)}</span>
                <span className="flow-gallery__text">{t(`flows.templates.${template.id}.description`)}</span>
            </button>
        ))}
    </div>
);
