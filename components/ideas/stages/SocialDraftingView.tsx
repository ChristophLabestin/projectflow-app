import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { auth } from '../../../services/firebase';

import { useNavigate } from 'react-router-dom';
import { createSocialPostFromIdea } from '../../../services/marketingService';
import { useState } from 'react';

interface SocialDraftingViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ContentDraft {
    copy: string;
    assets: string[];
    hashtags: string;
    metaDescription: string;
    ctas: string;
}

export const SocialDraftingView: React.FC<SocialDraftingViewProps> = ({ idea, onUpdate }) => {
    let scope: 'post' | 'campaign' = 'post';

    const content: ContentDraft = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                if (parsed.scope) scope = parsed.scope;
                return {
                    copy: parsed.copy || '',
                    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
                    hashtags: parsed.hashtags || '',
                    metaDescription: parsed.metaDescription || '',
                    ctas: parsed.ctas || '',
                    ...parsed // Preserve strategy data
                };
            }
        } catch { }
        return {
            copy: '',
            assets: [],
            hashtags: '',
            metaDescription: '',
            ctas: ''
        };
    })();

    const updateContent = (updates: Partial<ContentDraft>) => {
        const newData = { ...content, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const navigate = useNavigate();
    const [isConverting, setIsConverting] = useState(false);

    const handleConvertToPost = async () => {
        if (!idea.projectId || !auth.currentUser) return;
        setIsConverting(true);
        try {
            if (scope === 'campaign') {
                navigate(`/project/${idea.projectId}/social/campaigns/create?ideaId=${idea.id}`);
            } else {
                const postId = await createSocialPostFromIdea(idea.projectId, idea);
                onUpdate({
                    convertedCampaignId: postId,
                    campaignType: 'social',
                    stage: 'Scheduled' // Auto-advance
                });
            }
        } catch (error) {
            console.error("Failed to check/convert", error);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left & Middle Column: Main Editor */}
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">
                            {scope === 'campaign' ? 'Campaign Plan' : 'Social Post Draft'}
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                            {scope === 'campaign' ? 'Outline your campaign strategy' : 'Write the copy and prepare assets'}
                        </p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden focus-within:ring-1 focus-within:ring-orange-500 transition-all">
                    <div className="flex items-center gap-2 p-2 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-paper)]">
                        {/* Toolbar buttons - keep same */}
                        <button className="p-1.5 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"><span className="material-symbols-outlined text-[18px]">format_bold</span></button>
                    </div>
                    <textarea
                        value={content.copy}
                        onChange={(e) => updateContent({ copy: e.target.value })}
                        className="flex-1 w-full bg-transparent border-none p-4 focus:ring-0 resize-none font-mono text-sm leading-relaxed"
                        placeholder={scope === 'campaign' ? "Describe the campaign strategy, key messages, and rollout plan..." : "Start writing your post here..."}
                    />
                    {scope === 'post' && (
                        <div className="p-2 border-t border-[var(--color-surface-border)] text-right">
                            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{content.copy.length} chars</span>
                        </div>
                    )}
                </div>

                {/* Conversion Status / Action */}
                <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)] flex justify-between items-center">
                    {idea.convertedCampaignId ? (
                        <div className="flex items-center gap-3 bg-green-50 text-green-700 px-4 py-2 rounded-lg border border-green-200 w-full justify-between">
                            <span className="flex items-center gap-2 font-medium">
                                <span className="material-symbols-outlined">check_circle</span>
                                {scope === 'campaign' ? 'Campaign Created' : 'Post Created'}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="bg-white hover:bg-green-50 border-green-200 text-green-700"
                                    onClick={() => navigate(`/project/${idea.projectId}/social/${scope === 'campaign' ? 'campaigns' : 'calendar'}`)}
                                >
                                    {scope === 'campaign' ? 'View Campaign' : 'View Calendar'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-end gap-3 w-full">
                            <Button
                                className="h-10 text-sm gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-md rounded-lg"
                                onClick={handleConvertToPost}
                                isLoading={isConverting}
                            >
                                <span>{scope === 'campaign' ? 'Create Campaign' : 'Convert to Post'}</span>
                                <span className="material-symbols-outlined text-[18px]">send</span>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Metadata & Assets */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <h3 className="font-bold text-[var(--color-text-main)] mb-4">Metadata & Assets</h3>

                <div className="space-y-4 overflow-y-auto pr-1">
                    {/* Visual Description / Script Field */}
                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
                            {scope === 'campaign' ? 'Episodes / Themes' : 'Visual / Script'}
                        </label>
                        <textarea
                            value={(content as any).script || ''}
                            onChange={(e) => updateContent({ script: e.target.value } as any)}
                            placeholder={scope === 'campaign' ? "- Episode 1: ...\n- Episode 2: ..." : "Describe the image, or write the video script..."}
                            rows={4}
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Hashtags</label>
                        <textarea
                            value={content.hashtags}
                            onChange={(e) => updateContent({ hashtags: e.target.value })}
                            placeholder="#marketing #growth #startup"
                            rows={2}
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Call to Action (CTA)</label>
                        <input
                            type="text"
                            value={content.ctas}
                            onChange={(e) => updateContent({ ctas: e.target.value })}
                            placeholder="e.g. Link in bio, Sign up now"
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-orange-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Assets</label>
                        <div className="border-2 border-dashed border-[var(--color-surface-border)] rounded-xl p-6 text-center hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group">
                            <span className="material-symbols-outlined text-3xl text-[var(--color-text-muted)] group-hover:text-orange-500 mb-2">cloud_upload</span>
                            <p className="text-xs text-[var(--color-text-muted)]">Drop images or items here</p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">Internal Notes</label>
                        <textarea
                            value={content.metaDescription}
                            onChange={(e) => updateContent({ metaDescription: e.target.value })}
                            placeholder="Brief context..."
                            rows={3}
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-orange-500 outline-none resize-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
