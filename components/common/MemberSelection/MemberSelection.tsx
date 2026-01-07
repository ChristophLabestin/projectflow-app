import React from 'react';
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
}

const MemberSelection: React.FC<MemberSelectionProps> = ({ members, selectedIds, onToggle }) => {
    return (
        <div className="member-selection">
            {members.map((member) => {
                const isSelected = selectedIds.includes(member.uid);

                return (
                    <button
                        key={member.uid}
                        type="button"
                        className={`member-selection__item ${isSelected ? 'member-selection__item--selected' : ''}`}
                        onClick={() => onToggle(member.uid)}
                    >
                        <div className="member-selection__avatar">
                            {member.photoURL ? (
                                <img src={member.photoURL} alt={member.displayName} />
                            ) : (
                                <span className="material-symbols-outlined">person</span>
                            )}
                        </div>

                        <div className="member-selection__info">
                            <h3 className="member-selection__title">{member.displayName}</h3>
                            <p className="member-selection__desc">{member.email}</p>
                        </div>

                        <div className="member-selection__check">
                            {isSelected && (
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default MemberSelection;
