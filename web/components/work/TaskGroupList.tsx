import React, { useCallback, useRef, useState } from 'react';
import { useFlipList } from '../motion';

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
    /** Group-level "select all in this group" checkbox for selectable lists. */
    selection?: WorkGroupSelection;
    /** `grid` renders each group's tasks as tiles (rows with `variant="card"`). */
    layout?: 'list' | 'grid';
}

export interface WorkGroupSelection {
    /** The list is selecting: checkboxes stay visible (also on touch devices). */
    active: boolean;
    isSelected: (task: Task) => boolean;
    onToggleGroup: (tasks: Task[], selected: boolean) => void;
    label: (groupLabel: string) => string;
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
    toggleLabel,
    selection,
    layout = 'list'
}: TaskGroupListProps) => {
    const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey, defaultCollapsed));
    // Rows glide when they reorder or change group, rise in when added, slide out when removed.
    const groupsRef = useRef<HTMLDivElement>(null);
    useFlipList(groupsRef, { keyAttribute: 'data-task-id' });

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
        <div ref={groupsRef} className={`work-groups work-groups--${layout} ${selection ? 'is-selectable' : ''} ${selection?.active ? 'is-selecting' : ''}`}>
            {groups.map((group) => {
                const isCollapsed = collapsed.has(group.key);
                const bodyId = `${storageKey}-${group.key}`.replace(/[^a-zA-Z0-9_-]/g, '-');
                const selectedCount = selection ? group.tasks.filter(selection.isSelected).length : 0;
                const groupState = selectedCount === 0 ? 'none' : selectedCount === group.tasks.length ? 'all' : 'some';
                return (
                    <section key={group.key} className={`work-group work-group--${group.tone}`}>
                        <div className="work-group__head">
                            {selection && group.tasks.length > 0 && (
                                <button
                                    type="button"
                                    role="checkbox"
                                    className="work-group__select"
                                    aria-checked={groupState === 'some' ? 'mixed' : groupState === 'all'}
                                    aria-label={selection.label(group.label)}
                                    title={selection.label(group.label)}
                                    onClick={() => selection.onToggleGroup(group.tasks, groupState !== 'all')}
                                >
                                    <span className="work-select-box" aria-hidden="true">
                                        <span className="material-symbols-outlined">{groupState === 'some' ? 'remove' : 'check'}</span>
                                    </span>
                                </button>
                            )}
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
                        </div>
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
