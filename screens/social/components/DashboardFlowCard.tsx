import React from 'react';
import { Idea } from '../../../types';
import { Link } from 'react-router-dom';

interface DashboardFlowCardProps {
    idea: Idea;
    projectId: string;
}

export const DashboardFlowCard: React.FC<DashboardFlowCardProps> = ({ idea, projectId }) => {
    // Parse social strategy from concept if it exists
    const strategy = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                return JSON.parse(idea.concept);
            }
        } catch { }
        return null;
    })();

    const channels = strategy?.channels || [];
    const goal = strategy?.campaignType || 'No Goal';

    return (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-surface-border)] p-4 hover:shadow-md transition-all group flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">
                        {idea.stage}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                        {goal}
                    </span>
                </div>
                <div className="flex -space-x-2">
                    {channels.slice(0, 3).map((channel: string) => (
                        <div key={channel} className="size-6 rounded-full bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] flex items-center justify-center overflow-hidden" title={channel}>
                            <span className="material-symbols-outlined text-[14px]">
                                {channel === 'Instagram' ? 'photo_camera' :
                                    channel === 'LinkedIn' ? 'business' :
                                        channel === 'TikTok' ? 'audiotrack' :
                                            channel === 'Facebook' ? 'groups' :
                                                channel === 'X' ? 'close' : 'share'}
                            </span>
                        </div>
                    ))}
                    {channels.length > 3 && (
                        <div className="size-6 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] flex items-center justify-center text-[10px] font-bold">
                            +{channels.length - 3}
                        </div>
                    )}
                </div>
            </div>

            <h4 className="text-sm font-bold text-[var(--color-text-main)] mb-1 line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">
                {idea.title}
            </h4>
            <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-4 flex-1">
                {idea.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-surface-border)] mt-auto">
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                    <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                    <span>{idea.comments || 0}</span>
                    <span className="material-symbols-outlined text-[14px] ml-1">thumbs_up_down</span>
                    <span>{idea.votes || 0}</span>
                </div>
                <Link
                    to={`/project/${projectId}/flows/${idea.id}`}
                    className="text-[10px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                >
                    View Flow
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                </Link>
            </div>
        </div>
    );
};
