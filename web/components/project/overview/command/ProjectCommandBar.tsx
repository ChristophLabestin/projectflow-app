import React, { useEffect, useRef, useState } from 'react';
import type { ViewDescriptor, OverviewGroupBy, OverviewSortBy } from '../config/overviewConfig';
import type { ProjectOverviewViewState } from '../hooks/useProjectOverviewViewState';
import { ProjectOverviewTasksQuickAdd } from '../ProjectOverviewTasksQuickAdd';

export type CommandOption = { value: string; label: string };

export type ProjectCommandBarProps = {
    viewState: ProjectOverviewViewState;
    availableViews: ViewDescriptor[];
    statusOptions: CommandOption[];
    priorityOptions: CommandOption[];
    assigneeOptions: CommandOption[];
    initiativeOptions: CommandOption[];
    showQuickAdd: boolean;
    showViewControls: boolean;
    workFocus: boolean;
    onToggleWorkFocus: () => void;
    onQuickAdd: (title: string) => Promise<void>;
    t: (key: string, fallback?: string) => string;
};

const SORT_OPTIONS: { value: OverviewSortBy; labelKey: string }[] = [
    { value: 'manual', labelKey: 'projectOverview.v2.sort.manual' },
    { value: 'priority', labelKey: 'projectOverview.v2.sort.priority' },
    { value: 'dueDate', labelKey: 'projectOverview.v2.sort.dueDate' },
    { value: 'title', labelKey: 'projectOverview.v2.sort.title' },
    { value: 'createdAt', labelKey: 'projectOverview.v2.sort.createdAt' }
];

const GROUP_OPTIONS: { value: OverviewGroupBy; labelKey: string }[] = [
    { value: 'status', labelKey: 'projectOverview.v2.group.status' },
    { value: 'priority', labelKey: 'projectOverview.v2.group.priority' },
    { value: 'initiative', labelKey: 'projectOverview.v2.group.initiative' },
    { value: 'assignee', labelKey: 'projectOverview.v2.group.assignee' },
    { value: 'none', labelKey: 'projectOverview.v2.group.none' }
];

const MultiToggle: React.FC<{
    title: string;
    options: CommandOption[];
    selected: string[];
    onToggle: (value: string) => void;
}> = ({ title, options, selected, onToggle }) => {
    if (!options.length) return null;
    return (
        <div className="po-filter__group">
            <span className="po-filter__group-title">{title}</span>
            <div className="po-filter__chips">
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`po-filter__chip ${selected.includes(option.value) ? 'is-active' : ''}`.trim()}
                        onClick={() => onToggle(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export const ProjectCommandBar: React.FC<ProjectCommandBarProps> = ({
    viewState,
    availableViews,
    statusOptions,
    priorityOptions,
    assigneeOptions,
    initiativeOptions,
    showQuickAdd,
    showViewControls,
    workFocus,
    onToggleWorkFocus,
    onQuickAdd,
    t
}) => {
    const { view, setView, sortBy, setSortBy, groupBy, setGroupBy, filters, setFilters, resetFilters, activeFilterCount } = viewState;
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const showGroupControl = view !== 'board';

    useEffect(() => {
        if (!filterOpen) return;
        const handler = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [filterOpen]);

    const toggleIn = (list: string[], value: string): string[] =>
        list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

    return (
        <div className="po-command">
            <div className="po-command__main">
                <div className="po-command__search">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        type="search"
                        value={filters.search}
                        onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                        placeholder={t('projectOverview.v2.command.search', 'Search work…')}
                        aria-label={t('projectOverview.v2.command.search', 'Search work…')}
                    />
                </div>

                <div className="po-command__filter" ref={filterRef}>
                    <button
                        type="button"
                        className={`po-command__btn ${activeFilterCount > 0 ? 'is-active' : ''}`.trim()}
                        onClick={() => setFilterOpen((open) => !open)}
                        aria-haspopup="true"
                        aria-expanded={filterOpen}
                    >
                        <span className="material-symbols-outlined">tune</span>
                        <span>{t('projectOverview.v2.command.filter', 'Filter')}</span>
                        {activeFilterCount > 0 && <span className="po-command__badge">{activeFilterCount}</span>}
                    </button>
                    {filterOpen && (
                        <div className="po-filter">
                            <MultiToggle
                                title={t('projectOverview.workspace.columns.status', 'Status')}
                                options={statusOptions}
                                selected={filters.statuses}
                                onToggle={(value) => setFilters((prev) => ({ ...prev, statuses: toggleIn(prev.statuses, value) }))}
                            />
                            <MultiToggle
                                title={t('projectOverview.workspace.columns.priority', 'Priority')}
                                options={priorityOptions}
                                selected={filters.priorities}
                                onToggle={(value) => setFilters((prev) => ({ ...prev, priorities: toggleIn(prev.priorities, value) }))}
                            />
                            <MultiToggle
                                title={t('projectOverview.v2.command.assignee', 'Assignee')}
                                options={assigneeOptions}
                                selected={filters.assigneeIds}
                                onToggle={(value) => setFilters((prev) => ({ ...prev, assigneeIds: toggleIn(prev.assigneeIds, value) }))}
                            />
                            {initiativeOptions.length > 0 && (
                                <div className="po-filter__group">
                                    <span className="po-filter__group-title">{t('projectOverview.v2.group.initiative', 'Initiative')}</span>
                                    <div className="po-filter__chips">
                                        {initiativeOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={`po-filter__chip ${filters.initiativeId === option.value ? 'is-active' : ''}`.trim()}
                                                onClick={() => setFilters((prev) => ({
                                                    ...prev,
                                                    initiativeId: prev.initiativeId === option.value ? null : option.value
                                                }))}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <label className="po-filter__switch">
                                <input
                                    type="checkbox"
                                    checked={filters.showCompleted}
                                    onChange={(event) => setFilters((prev) => ({ ...prev, showCompleted: event.target.checked }))}
                                />
                                {t('projectOverview.v2.command.showCompleted', 'Show completed')}
                            </label>
                            <div className="po-filter__foot">
                                <button type="button" className="po-filter__reset" onClick={resetFilters}>
                                    {t('projectOverview.v2.command.clear', 'Clear all')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <label className="po-command__select">
                    <span className="po-command__select-label">{t('projectOverview.v2.command.sort', 'Sort')}</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value as OverviewSortBy)}>
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{t(option.labelKey, option.value)}</option>
                        ))}
                    </select>
                </label>

                {showGroupControl && (
                    <label className="po-command__select">
                        <span className="po-command__select-label">{t('projectOverview.v2.command.group', 'Group')}</span>
                        <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as OverviewGroupBy)}>
                            {GROUP_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{t(option.labelKey, option.value)}</option>
                            ))}
                        </select>
                    </label>
                )}

                {showViewControls && availableViews.length > 1 && (
                    <div className="po-command__views" role="group" aria-label={t('projectOverview.workspace.viewLabel', 'View')}>
                        {availableViews.map((descriptor) => (
                            <button
                                key={descriptor.id}
                                type="button"
                                className={`po-command__view-btn ${view === descriptor.id ? 'is-active' : ''}`.trim()}
                                onClick={() => setView(descriptor.id)}
                                title={t(descriptor.labelKey, descriptor.id)}
                                aria-label={t(descriptor.labelKey, descriptor.id)}
                                aria-pressed={view === descriptor.id}
                            >
                                <span className="material-symbols-outlined">{descriptor.icon}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {showQuickAdd && (
                <div className="po-command__quick-add">
                    <ProjectOverviewTasksQuickAdd onSubmit={onQuickAdd} />
                    <button
                        type="button"
                        className={`po-command__focus-btn ${workFocus ? 'is-active' : ''}`.trim()}
                        onClick={onToggleWorkFocus}
                        title={workFocus ? t('projectOverview.v2.command.focusExit', 'Exit focus') : t('projectOverview.v2.command.focus', 'Focus board')}
                        aria-label={workFocus ? t('projectOverview.v2.command.focusExit', 'Exit focus') : t('projectOverview.v2.command.focus', 'Focus board')}
                        aria-pressed={workFocus}
                    >
                        <span className="material-symbols-outlined">{workFocus ? 'fullscreen_exit' : 'height'}</span>
                    </button>
                </div>
            )}
        </div>
    );
};
