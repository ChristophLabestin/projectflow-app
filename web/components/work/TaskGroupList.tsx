import React, { useCallback, useState } from 'react';

import type { Task } from '../../types';
import type { WorkGroup } from './workList';

interface TaskGroupListProps {
    groups: WorkGroup[];
    /** localStorage key used to remember collapsed groups for this list. */
    storageKey: string;
    renderRow: (task: Task) => React.ReactNode;
    empty?: React.ReactNode;
    /** Groups collapsed until the user opens them (e.g. "done"). */
    defaultCollapsed?: string[];
    toggleLabel: (label: string, collapsed: boolean) => string;
}

const readCollapsed = (key: string, fallback: string[]) => {
    try {
        const raw = localStorage.getItem(key);
        return new Set<string>(raw ? JSON.parse(raw) : fallback);
    } catch {
        return new Set<string>(fallback);
    }
};

/** Renders grouped work with collapsible, count-labelled group headers. */
export const TaskGroupList = ({
    groups,
    storageKey,
    renderRow,
    empty,
    defaultCollapsed = ['done'],
    toggleLabel
}: TaskGroupListProps) => {
    const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey, defaultCollapsed));

    const toggle = useCallback((key: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            try {
                localStorage.setItem(storageKey, JSON.stringify([...next]));
            } catch {
                // best-effort
            }
            return next;
        });
    }, [storageKey]);

    if (!groups.length) return <>{empty}</>;

    return (
        <div className="work-groups">
            {groups.map((group) => {
                const isCollapsed = collapsed.has(group.key);
                const bodyId = `${storageKey}-${group.key}`.replace(/[^a-zA-Z0-9_-]/g, '-');
                return (
                    <section key={group.key} className={`work-group work-group--${group.tone}`}>
                        <button
                            type="button"
                            className="work-group__header"
                            aria-expanded={!isCollapsed}
                            aria-controls={bodyId}
                            aria-label={toggleLabel(group.label, isCollapsed)}
                            onClick={() => toggle(group.key)}
                        >
                            <span className={`material-symbols-outlined work-group__chevron ${isCollapsed ? 'is-collapsed' : ''}`}>expand_more</span>
                            <span className="work-group__label">{group.label}</span>
                            <span className="work-group__count">{group.tasks.length}</span>
                        </button>
                        {!isCollapsed && (
                            <div id={bodyId} className="work-group__rows" role="list">
                                {group.tasks.map((task) => (
                                    <React.Fragment key={`${task.projectId}:${task.id}`}>{renderRow(task)}</React.Fragment>
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
};
