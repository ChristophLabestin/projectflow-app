import React from 'react';

import { InlineMenu, type InlineMenuOption } from './InlineMenu';

interface WorkMenuChipProps {
    /** Accessible name, e.g. "Group by: Due date". */
    label: string;
    icon: string;
    /** Muted text before the value, e.g. "Group by". */
    prefix?: string;
    /** Current value as shown in the chip. */
    valueLabel: string;
    /** Filter chips: muted while unset, highlighted while narrowing the list. Omit for settings like group-by. */
    active?: boolean;
    options: InlineMenuOption[];
    value: string;
    onSelect: (value: string) => void;
    width?: number;
}

/** Toolbar chip that opens an InlineMenu (group-by, filters). Use instead of a form Select in work toolbars. */
export const WorkMenuChip = ({ label, icon, prefix, valueLabel, active, options, value, onSelect, width = 220 }: WorkMenuChipProps) => (
    <InlineMenu
        label={label}
        triggerClassName={`work-chip work-chip--menu ${active !== undefined ? 'work-chip--filter' : ''} ${active ? 'is-active' : ''}`}
        trigger={(
            <>
                <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
                {prefix && <span className="work-chip__prefix">{prefix}</span>}
                <span className="work-chip__value">{valueLabel}</span>
                <span className="material-symbols-outlined work-chip__caret" aria-hidden="true">expand_more</span>
            </>
        )}
        options={options}
        value={value}
        onSelect={onSelect}
        width={width}
    />
);
