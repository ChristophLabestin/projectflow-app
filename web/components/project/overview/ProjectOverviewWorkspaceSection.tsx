import React from 'react';

type ProjectOverviewWorkspaceSectionProps = {
    title: string;
    icon?: string;
    count?: number | string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    id?: string;
};

export const ProjectOverviewWorkspaceSection: React.FC<ProjectOverviewWorkspaceSectionProps> = ({
    title,
    icon,
    count,
    actions,
    children,
    className,
    id
}) => (
    <section id={id} className={`overview-workspace__section ${className || ''}`.trim()}>
        <header className="overview-workspace__section-head">
            <div className="overview-workspace__section-title-wrap">
                {icon && <span className="material-symbols-outlined overview-workspace__section-icon">{icon}</span>}
                <h3 className="overview-workspace__section-title">{title}</h3>
                {count !== undefined && count !== null && (
                    <span className="overview-workspace__section-count">{count}</span>
                )}
            </div>
            {actions && <div className="overview-workspace__section-actions">{actions}</div>}
        </header>
        <div className="overview-workspace__section-body">{children}</div>
    </section>
);
