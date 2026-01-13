import React from 'react';
import {
    CheckSquare,
    Bug,
    Lightbulb,
    Flag,
    History,
    Users,
    Megaphone,
    Target,
    Receipt,
    Zap,
    Check
} from 'lucide-react';
import './moduleSelection.scss';

export interface ModuleItem {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
}

const MODULES: ModuleItem[] = [
    { id: 'tasks', title: 'Tasks', description: 'Track work items', icon: <CheckSquare size={24} /> },
    { id: 'sprints', title: 'Sprints', description: 'Agile iterations', icon: <Zap size={24} /> },
    { id: 'issues', title: 'Issues', description: 'Bug tracking', icon: <Bug size={24} /> },
    { id: 'flows', title: 'Flows', description: 'Brainstorming', icon: <Lightbulb size={24} /> },
    { id: 'milestones', title: 'Milestones', description: 'Key deadlines', icon: <Flag size={24} /> },
    { id: 'activity', title: 'Activity', description: 'Change log', icon: <History size={24} /> },
    { id: 'groups', title: 'Groups', description: 'Manage Team Groups', icon: <Users size={24} /> },
    { id: 'social', title: 'Social', description: 'Campaign Manager', icon: <Megaphone size={24} /> },
    { id: 'marketing', title: 'Marketing', description: 'Ads & Email', icon: <Target size={24} /> },
    { id: 'accounting', title: 'Accounting', description: 'Financial planning & expenses', icon: <Receipt size={24} /> },
];

interface ModuleSelectionProps {
    selectedModules: string[];
    onToggle: (moduleId: string) => void;
}

export const ModuleSelection: React.FC<ModuleSelectionProps> = ({ selectedModules, onToggle }) => {
    return (
        <div className="module-selection">
            {MODULES.map((module) => {
                const isSelected = selectedModules.includes(module.id);
                return (
                    <div
                        key={module.id}
                        className={`module-selection__item ${isSelected ? 'module-selection__item--selected' : ''}`}
                        onClick={() => onToggle(module.id)}
                    >
                        <div className="module-selection__icon">
                            {module.icon}
                        </div>
                        <div className="module-selection__info">
                            <span className="module-selection__title">{module.title}</span>
                            <span className="module-selection__desc">{module.description}</span>
                        </div>
                        <div className="module-selection__check">
                            <Check strokeWidth={3} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
