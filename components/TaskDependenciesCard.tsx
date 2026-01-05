import React from 'react';
import { TaskDependencySelector } from './TaskDependencySelector';

interface TaskDependenciesCardProps {
    projectId: string;
    currentTaskId: string;
    dependencies: string[];
    onUpdate: (ids: string[]) => void;
}

export const TaskDependenciesCard: React.FC<TaskDependenciesCardProps> = ({
    projectId,
    currentTaskId,
    dependencies,
    onUpdate
}) => {
    return (
        <div className="app-card p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-subtle uppercase tracking-wider">Dependencies</span>
                <span className="material-symbols-outlined text-[18px] text-muted">link</span>
            </div>

            {dependencies.length > 0 && (
                <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                        {/* We rely on the selector to show selected items, but here we can just show a count or let the selector handle it. 
                            The previous selector implementation shows selected items. 
                            Let's keep it simple and just render the selector which handles list + add.
                         */}
                    </div>
                </div>
            )}

            <div className="flex justify-start w-full">
                <TaskDependencySelector
                    projectId={projectId}
                    currentTaskId={currentTaskId}
                    selectedDependencyIds={dependencies}
                    onChange={onUpdate}
                />
            </div>
        </div>
    );
};
