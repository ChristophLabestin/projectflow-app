import React, { useMemo, useState } from 'react';
import { ModuleSelection, ModuleItem } from '../ModuleSelection/ModuleSelection';
import { TextInput } from '../Input/TextInput';
import './memberSelection.scss';

interface Member {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    role?: string;
}

interface MemberSelectionProps {
    members: Member[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    ariaLabel?: string;
    searchPlaceholder?: string;
    noResultsText?: string;
    searchThreshold?: number;
}

const MemberSelection: React.FC<MemberSelectionProps> = ({
    members,
    selectedIds,
    onToggle,
    ariaLabel,
    searchPlaceholder,
    noResultsText,
    searchThreshold = 8
}) => {
    const [query, setQuery] = useState('');
    const shouldShowSearch = members.length >= searchThreshold;
    const normalizedQuery = query.trim().toLowerCase();
    const filteredMembers = useMemo(() => {
        if (!normalizedQuery) return members;
        return members.filter(member => (
            (member.displayName || '').toLowerCase().includes(normalizedQuery)
            || member.email.toLowerCase().includes(normalizedQuery)
        ));
    }, [members, normalizedQuery]);

    const memberItems: ModuleItem[] = filteredMembers.map(member => ({
        id: member.uid,
        title: member.displayName || member.email,
        description: member.email,
        icon: member.photoURL ? (
            <img src={member.photoURL} alt="" className="member-selection__avatar-image" />
        ) : (
            <span className="material-symbols-outlined">person</span>
        )
    }));

    return (
        <div className="member-selection__layout">
            {shouldShowSearch && (
                <TextInput
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    leftElement={<span className="material-symbols-outlined">search</span>}
                    className="member-selection__search"
                />
            )}
            {memberItems.length > 0 ? (
                <ModuleSelection
                    modules={memberItems}
                    selectedModules={selectedIds}
                    onToggle={onToggle}
                    ariaLabel={ariaLabel}
                    className="member-selection"
                    selectionMode="multiple"
                />
            ) : (
                <div className="member-selection__empty">
                    <span className="material-symbols-outlined">person_search</span>
                    <p>{noResultsText}</p>
                </div>
            )}
        </div>
    );
};

export default MemberSelection;
