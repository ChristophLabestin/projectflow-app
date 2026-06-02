import React from 'react';
import './overview-workspace-content.scss';

export type ProjectOverviewWorkspaceTab = 'tasks' | 'sprints' | 'milestones' | 'steuerung' | 'aktivitaeten';

export type ProjectOverviewTasksView = 'list' | 'board' | 'kanban';
export type ProjectOverviewSprintsView = 'list' | 'board';
export type ProjectOverviewMilestonesView = 'list' | 'timeline';
export type ProjectOverviewActivityView = 'feed' | 'compact';

export type ProjectOverviewViewMode =
    | ProjectOverviewTasksView
    | ProjectOverviewSprintsView
    | ProjectOverviewMilestonesView
    | ProjectOverviewActivityView;

type TabConfig = {
    id: ProjectOverviewWorkspaceTab;
    icon: string;
    labelKey: string;
    count?: number;
};

type ViewOption = {
    value: string;
    icon: string;
    labelKey: string;
};

type ProjectOverviewWorkspaceProps = {
    activeTab: ProjectOverviewWorkspaceTab;
    onTabChange: (tab: ProjectOverviewWorkspaceTab) => void;
    t: (key: string, fallback?: string) => string;
    tabs: TabConfig[];
    viewOptions?: ViewOption[];
    activeView?: string;
    onViewChange?: (view: string) => void;
    viewAriaLabelKey?: string;
    toolbarActions?: React.ReactNode;
    children: React.ReactNode;
};

export const ProjectOverviewWorkspace: React.FC<ProjectOverviewWorkspaceProps> = ({
    activeTab,
    onTabChange,
    t,
    tabs,
    viewOptions,
    activeView,
    onViewChange,
    viewAriaLabelKey,
    toolbarActions,
    children
}) => (
    <section className="project-overview-workspace" aria-label={t('projectOverview.workspace.label')}>
        <div className="project-overview-workspace__tabs" role="tablist" aria-label={t('projectOverview.workspace.tabsLabel')}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`project-overview-tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls={`project-overview-panel-${tab.id}`}
                    className={`project-overview-workspace__tab ${activeTab === tab.id ? 'is-active' : ''}`.trim()}
                    onClick={() => onTabChange(tab.id)}
                >
                    <span className="material-symbols-outlined project-overview-workspace__tab-icon">{tab.icon}</span>
                    <span className="project-overview-workspace__tab-label">{t(tab.labelKey)}</span>
                    {typeof tab.count === 'number' && tab.count > 0 && (
                        <span className="project-overview-workspace__tab-count">{tab.count}</span>
                    )}
                </button>
            ))}
        </div>

        {(viewOptions?.length || toolbarActions) && (
            <div className="project-overview-workspace__toolbar">
                <div className="project-overview-workspace__toolbar-start">{toolbarActions}</div>
                {viewOptions && viewOptions.length > 0 && onViewChange && (
                    <div
                        className="project-overview-workspace__view-toggle"
                        role="group"
                        aria-label={viewAriaLabelKey ? t(viewAriaLabelKey) : t('projectOverview.workspace.viewLabel')}
                    >
                        {viewOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`project-overview-workspace__view-btn ${activeView === option.value ? 'is-active' : ''}`.trim()}
                                onClick={() => onViewChange(option.value)}
                                aria-pressed={activeView === option.value}
                                title={t(option.labelKey)}
                                aria-label={t(option.labelKey)}
                            >
                                <span className="material-symbols-outlined">{option.icon}</span>
                                <span className="project-overview-workspace__view-btn-label">{t(option.labelKey)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}

        <div
            className="project-overview-workspace__panel"
            role="tabpanel"
            id={`project-overview-panel-${activeTab}`}
            aria-labelledby={`project-overview-tab-${activeTab}`}
        >
            {children}
        </div>
    </section>
);
