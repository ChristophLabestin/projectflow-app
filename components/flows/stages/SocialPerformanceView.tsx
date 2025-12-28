
import React, { useState, useEffect } from 'react';
import { Idea, SocialPlatform, SocialPost, SocialCampaign } from '../../../types';
import { Button } from '../../ui/Button';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { subscribeCampaigns, createSocialPost } from '../../../services/dataService';
import { useNavigate } from 'react-router-dom';

interface SocialPerformanceViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ContentDraft {
    copy: string;
    assets: string[];
    status: 'draft' | 'ready';
    lastRefined?: string;
}

interface StudioData {
    concepts: Record<string, { hook: string; contentBody: string; visualCue: string; format: string }>;
    drafts: Record<string, ContentDraft>; // Keyed by platform
    activeDraftPlatform: string | null;
    selectedCampaignId?: string; // Target campaign
}

export const SocialPerformanceView: React.FC<SocialPerformanceViewProps> = ({ idea, onUpdate }) => {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [isDistributing, setIsDistributing] = useState(false);
    const [distributionResult, setDistributionResult] = useState<'success' | 'error' | null>(null);

    // Subscribe to campaigns
    useEffect(() => {
        if (idea.projectId) {
            const unsubscribe = subscribeCampaigns(idea.projectId, (data) => {
                setCampaigns(data.filter(c => c.status === 'Active' || c.status === 'Planning'));
            });
            return () => unsubscribe();
        }
    }, [idea.projectId]);


    // Parse Data from Strategy & Studio
    const studioData: StudioData = (() => {
        try {
            const parsed = idea.concept ? JSON.parse(idea.concept) : {};
            return {
                concepts: parsed.concepts || {},
                drafts: parsed.drafts || {},
                activeDraftPlatform: parsed.activeDraftPlatform || null,
                selectedCampaignId: parsed.selectedCampaignId || '',
            };
        } catch {
            return { concepts: {}, drafts: {}, activeDraftPlatform: null, selectedCampaignId: '' };
        }
    })();

    // Only show platforms that have drafts
    const platforms = Object.keys(studioData.drafts) as SocialPlatform[];

    const updateStudioData = (updates: Partial<StudioData>) => {
        const currentParsed = idea.concept ? JSON.parse(idea.concept) : {};
        const newData = { ...currentParsed, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const handleDistribute = async () => {
        if (isDistributing || !idea.projectId) return;
        setIsDistributing(true);
        setDistributionResult(null);

        try {
            // Create a social post for each draft
            const promises = platforms.map(async (p) => {
                const draft = studioData.drafts[p];
                if (!draft) return; // Ignore if no draft exists (shouldn't happen given 'platforms' definition)

                const postData = {
                    campaignId: studioData.selectedCampaignId || undefined,
                    platform: p,
                    content: {
                        caption: draft.copy,
                        hashtags: [], // Could extract hashtags here
                        originIdeaId: idea.id
                    },
                    assets: draft.assets.map(url => ({
                        id: Math.random().toString(36).substr(2, 9),
                        projectId: idea.projectId!,
                        url: url,
                        storagePath: '',
                        type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
                        filename: 'Asset',
                        mimeType: 'application/octet-stream',
                        size: 0,
                        createdAt: new Date(),
                        createdBy: ''
                    })),
                    format: (studioData.concepts[p]?.format as any) || 'Post',
                    status: 'Draft' as const, // Start as Draft in Social Module
                    isConcept: true, // Mark as concept
                    originIdeaId: idea.id
                };

                await createSocialPost(idea.projectId!, postData as any);
            });

            await Promise.all(promises);
            setDistributionResult('success');

            // Optionally update stage to 'Completed' or keep here? 
            // Often "Distribution" IS the end of this pipeline, so staying here to show success is fine.

        } catch (e) {
            console.error(e);
            setDistributionResult('error');
        } finally {
            setIsDistributing(false);
        }
    };


    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                {/* Hero / Header */}
                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-white dark:from-indigo-900/30 dark:via-blue-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-indigo-200 dark:border-indigo-800/50 relative overflow-hidden shadow-xl shadow-indigo-100 dark:shadow-none flex flex-col md:flex-row justify-between gap-6">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-indigo-600 rotate-12 -translate-y-10 translate-x-10">podium</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-indigo-200 dark:shadow-none">
                                    Distribution
                                </div>
                                <div className="h-[1px] w-8 bg-indigo-200 dark:bg-indigo-800 rounded-full" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                Launchpad Studio
                            </h1>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-2xl leading-relaxed">
                            Finalize your assets and send them to the Social Module. Assign to an active campaign or release as standalone concepts.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: Concept Manifesto (8/12) */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[12px] tracking-widest mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-500">inventory_2</span>
                                Ready for Transmission
                            </h3>

                            {platforms.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-2">drafts</span>
                                    <p className="text-sm font-medium">No drafts found. Go back to Studio to create content.</p>
                                    <Button
                                        onClick={() => onUpdate({ stage: 'Studio' })}
                                        className="mt-4 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-4 py-2"
                                    >
                                        Back to Studio
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {platforms.map(p => {
                                        const draft = studioData.drafts[p];
                                        const concept = studioData.concepts[p];
                                        const isReady = draft.status === 'ready';

                                        return (
                                            <div key={p} className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                                                {/* Asset Preview */}
                                                <div className="shrink-0 w-full md:w-32 aspect-video md:aspect-square rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                                                    {draft.assets[0] ? (
                                                        draft.assets[0].match(/\.(mp4|mov|webm)$/i) ? (
                                                            <video src={`${draft.assets[0]}#t=0.001`} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <img src={draft.assets[0]} alt="Asset" className="w-full h-full object-cover" />
                                                        )
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                            <span className="material-symbols-outlined">image_not_supported</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-2 left-2">
                                                        <div className="size-6 bg-white/90 dark:bg-black/50 backdrop-blur rounded-lg flex items-center justify-center shadow-sm">
                                                            <div className="size-3.5"><PlatformIcon platform={p} /></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{p} • {concept?.format}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${isReady ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                {isReady ? 'Ready' : 'Draft'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                                                            {draft.copy || <span className="italic opacity-50">No caption...</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Distribution Settings (4/12) */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm sticky top-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                    <span className="material-symbols-outlined text-xl">rocket_launch</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">Transmission</h3>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Setup & Send</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70">
                                        Target Campaign
                                    </label>
                                    <select
                                        value={studioData.selectedCampaignId || ''}
                                        onChange={(e) => updateStudioData({ selectedCampaignId: e.target.value })}
                                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-[11px] font-black text-slate-700 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    >
                                        <option value="">No Campaign (Standalone Concepts)</option>
                                        {campaigns.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 font-medium mt-2 leading-snug">
                                        Assigning a campaign will group these posts under it in the Social Module.
                                    </p>
                                </div>

                                <div className="h-px bg-slate-100 dark:bg-slate-800" />

                                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                                    <span>Total Items</span>
                                    <span>{platforms.length}</span>
                                </div>

                                <Button
                                    onClick={handleDistribute}
                                    disabled={isDistributing || distributionResult === 'success' || platforms.length === 0}
                                    className={`w-full h-12 rounded-xl text-white font-black text-xs uppercase tracking-[.2em] shadow-lg transition-all flex items-center justify-center gap-2 group ${distributionResult === 'success' ? 'bg-green-500 shadow-green-200' :
                                            'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'
                                        }`}
                                >
                                    {isDistributing ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                                            Transmitting...
                                        </>
                                    ) : distributionResult === 'success' ? (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                            Sent to Module
                                        </>
                                    ) : (
                                        <>
                                            Transmit to Social
                                            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">send</span>
                                        </>
                                    )}
                                </Button>

                                {distributionResult === 'success' && (
                                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 text-center animate-fade-in">
                                        <p className="text-xs font-bold text-green-700 dark:text-green-300 mb-2">Success!</p>
                                        <Button
                                            variant="secondary"
                                            className="text-xs w-full"
                                            onClick={() => navigate(`/project/${idea.projectId}/social/campaigns`)}
                                        >
                                            View in Social Module
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
