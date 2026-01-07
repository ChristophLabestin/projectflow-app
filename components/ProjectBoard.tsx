import React, { useMemo } from 'react';
import { Task, TaskStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';
import './project-board.scss';

interface ProjectBoardProps {
    tasks: Task[];
    renderTask: (task: Task) => React.ReactNode;
    stickyOffset?: string;
}

type BoardTone = 'muted' | 'primary' | 'warning' | 'success';

type BoardColumn = {
    id: string;
    title: string;
    statuses: TaskStatus[];
    tone: BoardTone;
};

export const ProjectBoard: React.FC<ProjectBoardProps> = ({ tasks, renderTask, stickyOffset = '0px' }) => {
    const { t } = useLanguage();

    const columns = useMemo<BoardColumn[]>(() => ([
        {
            id: 'backlog',
            title: t('tasks.status.backlog'),
            statuses: ['Backlog'],
            tone: 'muted'
        },
        {
            id: 'todo',
            title: t('tasks.status.todo'),
            statuses: ['Todo', 'Open', 'On Hold'],
            tone: 'primary'
        },
        {
            id: 'inprogress',
            title: t('tasks.status.inProgress'),
            statuses: ['In Progress'],
            tone: 'primary'
        },
        {
            id: 'review',
            title: t('tasks.status.review'),
            statuses: ['Review'],
            tone: 'warning'
        },
        {
            id: 'done',
            title: t('tasks.status.done'),
            statuses: ['Done'],
            tone: 'success'
        }
    ]), [t]);

    const columnsWithTasks = useMemo(() => {
        return columns.map(col => {
            const colTasks = tasks.filter(task => {
                if (col.id === 'todo') {
                    // Catch-all for undefined status or explicit Todo/Open/OnHold
                    return !task.status || col.statuses.includes(task.status);
                }
                return task.status && col.statuses.includes(task.status);
            });
            return {
                ...col,
                tasks: colTasks
            };
        });
    }, [tasks, columns]);

    return (
        <div className="project-board">
            {columnsWithTasks.map(col => (
                <div key={col.id} className={`project-board__column project-board__column--${col.id} project-board__column--${col.tone}`}>
                    {/* Column Header */}
                    <div
                        className="project-board__column-header"
                        style={{ top: stickyOffset }}
                    >
                        <div className="project-board__column-title">
                            <span className="project-board__dot" />
                            <h3 className="project-board__title">{col.title}</h3>
                        </div>
                        <span className="project-board__count">{col.tasks.length}</span>
                    </div>

                    {/* Tasks List */}
                    <div className="project-board__column-body">
                        {col.tasks.map(task => (
                            <div key={task.id} className="project-board__card">
                                {renderTask(task)}
                            </div>
                        ))}
                        {col.tasks.length === 0 && (
                            <div className="project-board__empty">
                                <span className="project-board__empty-text">{t('tasks.board.empty')}</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

