import React from 'react';
import { Check, Lock } from 'lucide-react';
import './moduleSelection.scss';

export interface ModuleItem {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    disabled?: boolean;
    disabledReason?: string;
}

interface ModuleSelectionProps {
    modules: ModuleItem[];
    selectedModules: string[];
    onToggle: (moduleId: string) => void;
    ariaLabel?: string;
    className?: string;
    selectionMode?: 'single' | 'multiple';
}

export const ModuleSelection: React.FC<ModuleSelectionProps> = ({
    modules,
    selectedModules,
    onToggle,
    ariaLabel,
    className = '',
    selectionMode = 'multiple'
}) => {
    return (
        <div
            className={`module-selection ${className}`}
            role={selectionMode === 'single' ? 'radiogroup' : 'group'}
            aria-label={ariaLabel}
        >
            {modules.map((module) => {
                const isSelected = selectedModules.includes(module.id);
                return (
                    <button
                        key={module.id}
                        type="button"
                        className={`module-selection__item ${isSelected ? 'module-selection__item--selected' : ''} ${module.disabled ? 'module-selection__item--disabled' : ''}`}
                        onClick={() => onToggle(module.id)}
                        disabled={module.disabled}
                        role={selectionMode === 'single' ? 'radio' : 'checkbox'}
                        aria-checked={isSelected}
                    >
                        <div className="module-selection__icon">
                            {module.icon}
                        </div>
                        <div className="module-selection__info">
                            <span className="module-selection__title">{module.title}</span>
                            <span className="module-selection__desc">
                                {module.disabled && module.disabledReason ? module.disabledReason : module.description}
                            </span>
                        </div>
                        <div className="module-selection__check">
                            {module.disabled ? <Lock strokeWidth={2.5} /> : isSelected && <Check strokeWidth={3} />}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
