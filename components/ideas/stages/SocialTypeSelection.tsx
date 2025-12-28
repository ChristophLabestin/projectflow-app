import React from 'react';
import { Idea } from '../../../types';

interface SocialTypeSelectionProps {
    onSelect: (type: 'post' | 'campaign') => void;
}

export const SocialTypeSelection: React.FC<SocialTypeSelectionProps> = ({ onSelect }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto p-6">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-[var(--color-text-main)] mb-4">What are you creating?</h2>
                <p className="text-[var(--color-text-muted)] text-lg max-w-2xl mx-auto">
                    Choose how you want to structure this social media idea. This ensures you have the right tools for the job.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                {/* Single Post Card */}
                <button
                    onClick={() => onSelect('post')}
                    className="group relative flex flex-col p-8 rounded-2xl border-2 border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-paper)] hover:bg-[var(--color-surface-hover)] transition-all duration-200 text-left"
                >
                    <div className="size-14 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                        <span className="material-symbols-outlined text-3xl text-indigo-500">post_add</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">Single Post</h3>
                    <p className="text-[var(--color-text-muted)] mb-6 leading-relaxed">
                        Perfect for a one-off update, announcement, or quick thought. Focuses on content creation, formatting, and immediate scheduling.
                    </p>
                    <div className="mt-auto">
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                Quick creation flow
                            </li>
                            <li className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                Platform-specific previews
                            </li>
                            <li className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                Direct scheduling
                            </li>
                        </ul>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] group-hover:gap-3 transition-all">
                            Select Single Post
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </span>
                    </div>
                </button>

                {/* Campaign Card */}
                <button
                    onClick={() => onSelect('campaign')}
                    className="group relative flex flex-col p-8 rounded-2xl border-2 border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-paper)] hover:bg-[var(--color-surface-hover)] transition-all duration-200 text-left"
                >
                    <div className="size-14 rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-pink-600/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200">
                        <span className="material-symbols-outlined text-3xl text-fuchsia-500">campaign</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">Social Campaign</h3>
                    <p className="text-[var(--color-text-muted)] mb-6 leading-relaxed">
                        Ideal for a series of connected posts, a product launch, or a themed week. Focuses on strategy, scheduling, and cohesive messaging over time.
                    </p>
                    <div className="mt-auto">
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                Multi-post management
                            </li>
                            <li className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                Calendar planning view
                            </li>
                            <li className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
                                <span className="material-symbols-outlined text-[18px] text-green-500">check_circle</span>
                                Unified strategy & goals
                            </li>
                        </ul>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] group-hover:gap-3 transition-all">
                            Select Campaign
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </span>
                    </div>
                </button>
            </div>
        </div>
    );
};
