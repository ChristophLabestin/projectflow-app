import React from 'react';
import { Idea } from '../../../types';

interface SocialCampaignProductionViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const SocialCampaignProductionView: React.FC<SocialCampaignProductionViewProps> = ({ idea, onUpdate }) => {
    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Campaign Production</h2>
                        <p className="text-[var(--color-text-muted)]">Manage the creation of assets and copy for all campaign posts.</p>
                    </div>
                </div>

                <div className="bg-[var(--color-surface-paper)] rounded-xl border border-[var(--color-surface-border)] p-12 text-center text-[var(--color-text-muted)]">
                    <span className="material-symbols-outlined text-4xl mb-4 text-[var(--color-text-subtle)]">dashboard</span>
                    <p>Production Dashboard will act here.</p>
                    <p className="text-sm mt-2">Kanban or Grid view of all active drafts.</p>
                </div>
            </div>
        </div>
    );
};
