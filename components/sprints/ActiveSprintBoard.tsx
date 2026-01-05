import React from 'react';
import { Task, Sprint } from '../../types';
import { ProjectBoard } from '../../components/ProjectBoard';
import { Button } from '../../components/ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { differenceInDays, format } from 'date-fns';
import { UpcomingSprintsList } from './UpcomingSprintsList';

interface ActiveSprintBoardProps {
    sprint: Sprint;
    tasks: Task[];
    upcomingSprints?: Sprint[];
    allTasks?: Task[];
    onCompleteSprint: () => void;
    onStartSprint?: (sprintId: string) => void;
    onSprintClick?: (sprint: Sprint) => void;
    renderTask: (task: Task) => React.ReactNode;
}

export const ActiveSprintBoard: React.FC<ActiveSprintBoardProps> = ({
    sprint,
    tasks,
    upcomingSprints = [],
    allTasks = [],
    onCompleteSprint,
    onStartSprint,
    onSprintClick,
    renderTask
}) => {
    const { t, dateFormat } = useLanguage();
    const daysLeft = differenceInDays(new Date(sprint.endDate), new Date());
    const isOverdue = daysLeft < 0;

    return (
        <div className="flex flex-col gap-6 h-full overflow-y-auto">
            {/* Sprint Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-[24px] border border-indigo-100 dark:border-indigo-500/20 shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                            Active Sprint
                        </span>
                        <h2 className="text-2xl font-black text-main uppercase tracking-tight">{sprint.name}</h2>
                    </div>
                    {sprint.goal && (
                        <p className="text-muted font-medium">Goal: <span className="text-main">{sprint.goal}</span></p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs font-bold uppercase tracking-widest text-subtle">
                        <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                            {format(new Date(sprint.startDate), dateFormat)} - {format(new Date(sprint.endDate), dateFormat)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md ${isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {isOverdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                        </span>
                    </div>
                </div>

                <Button
                    variant="primary"
                    onClick={onCompleteSprint}
                    className="shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined mr-2">flag</span>
                    Complete Sprint
                </Button>
            </div>

            {/* Board Area */}
            <div className="flex-1 min-h-[400px]">
                <ProjectBoard
                    tasks={tasks}
                    renderTask={renderTask}
                    stickyOffset="0px"
                />
            </div>

            {/* Upcoming Sprints */}
            <UpcomingSprintsList
                sprints={upcomingSprints}
                allTasks={allTasks}
                onStartSprint={onStartSprint}
                onSprintClick={onSprintClick}
            />
        </div>
    );
};
