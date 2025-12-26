import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';

interface SocialPostedViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface LiveData {
    postUrl: string;
    metrics: {
        views: string;
        likes: string;
        comments: string;
        shares: string;
    };
    status: 'Active' | 'Paused' | 'Ended';
}

export const SocialPostedView: React.FC<SocialPostedViewProps> = ({ idea, onUpdate }) => {

    const liveData: LiveData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    postUrl: parsed.postUrl || '',
                    metrics: parsed.metrics || { views: '', likes: '', comments: '', shares: '' },
                    status: parsed.liveStatus || 'Active',
                    ...parsed // Preserve other data
                };
            }
        } catch { }
        return {
            postUrl: '',
            metrics: { views: '', likes: '', comments: '', shares: '' },
            status: 'Active'
        };
    })();

    const updateLive = (updates: Partial<LiveData>) => {
        const newData = { ...liveData, ...updates };
        if (updates.status !== undefined) {
            // @ts-ignore
            newData.liveStatus = updates.status;
        }

        onUpdate({ concept: JSON.stringify(newData) });
    };

    const [isEditingMetrics, setIsEditingMetrics] = useState(false);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Column: Status & Link */}
            <div className="col-span-1 flex flex-col gap-6">
                <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <span className="material-symbols-outlined text-[120px] animate-pulse">check_circle</span>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="size-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                            <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">Post is Live</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Post URL</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={liveData.postUrl}
                                        onChange={(e) => updateLive({ postUrl: e.target.value })}
                                        placeholder="https://..."
                                        className="flex-1 text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                    <a
                                        href={liveData.postUrl || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`p-2.5 rounded-lg border border-[var(--color-surface-border)] flex items-center justify-center transition-colors ${liveData.postUrl ? 'bg-[var(--color-surface-hover)] hover:text-emerald-500' : 'opacity-50 cursor-not-allowed'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                                    </a>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col gap-2">
                                <Button
                                    variant="secondary"
                                    className="w-full justify-center"
                                    onClick={() => onUpdate({ stage: 'Ideation' })}
                                >
                                    <span className="material-symbols-outlined mr-2">refresh</span>
                                    Draft New Post
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Center/Right: Metrics */}
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-[var(--color-text-main)] text-lg">Post Performance</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">Track engagement stats</p>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingMetrics(!isEditingMetrics)}
                    >
                        {isEditingMetrics ? 'Done' : 'Edit Metrics'}
                    </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Views Card */}
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                            <span className="text-xs font-bold uppercase">Views</span>
                        </div>
                        {isEditingMetrics ? (
                            <input
                                type="text"
                                className="w-full bg-white dark:bg-slate-800 rounded px-2 py-1 text-2xl font-black text-blue-900 dark:text-blue-100"
                                value={liveData.metrics.views}
                                onChange={(e) => updateLive({ metrics: { ...liveData.metrics, views: e.target.value } })}
                                placeholder="0"
                            />
                        ) : (
                            <span className="text-3xl font-black text-blue-900 dark:text-blue-100 tracking-tight">{liveData.metrics.views || '-'}</span>
                        )}
                    </div>

                    {/* Likes Card */}
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
                        <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
                            <span className="material-symbols-outlined text-[20px]">favorite</span>
                            <span className="text-xs font-bold uppercase">Likes</span>
                        </div>
                        {isEditingMetrics ? (
                            <input
                                type="text"
                                className="w-full bg-white dark:bg-slate-800 rounded px-2 py-1 text-2xl font-black text-rose-900 dark:text-rose-100"
                                value={liveData.metrics.likes}
                                onChange={(e) => updateLive({ metrics: { ...liveData.metrics, likes: e.target.value } })}
                                placeholder="0"
                            />
                        ) : (
                            <span className="text-3xl font-black text-rose-900 dark:text-rose-100 tracking-tight">{liveData.metrics.likes || '-'}</span>
                        )}
                    </div>

                    {/* Comments Card */}
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                            <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                            <span className="text-xs font-bold uppercase">Comments</span>
                        </div>
                        {isEditingMetrics ? (
                            <input
                                type="text"
                                className="w-full bg-white dark:bg-slate-800 rounded px-2 py-1 text-2xl font-black text-amber-900 dark:text-amber-100"
                                value={liveData.metrics.comments}
                                onChange={(e) => updateLive({ metrics: { ...liveData.metrics, comments: e.target.value } })}
                                placeholder="0"
                            />
                        ) : (
                            <span className="text-3xl font-black text-amber-900 dark:text-amber-100 tracking-tight">{liveData.metrics.comments || '-'}</span>
                        )}
                    </div>

                    {/* Shares Card */}
                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                        <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400">
                            <span className="material-symbols-outlined text-[20px]">share</span>
                            <span className="text-xs font-bold uppercase">Shares</span>
                        </div>
                        {isEditingMetrics ? (
                            <input
                                type="text"
                                className="w-full bg-white dark:bg-slate-800 rounded px-2 py-1 text-2xl font-black text-purple-900 dark:text-purple-100"
                                value={liveData.metrics.shares}
                                onChange={(e) => updateLive({ metrics: { ...liveData.metrics, shares: e.target.value } })}
                                placeholder="0"
                            />
                        ) : (
                            <span className="text-3xl font-black text-purple-900 dark:text-purple-100 tracking-tight">{liveData.metrics.shares || '-'}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
