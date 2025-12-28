
import React, { useState, useEffect } from 'react';
import { Idea, SocialPlatform, SocialPost } from '../../../types';
import { Button } from '../../ui/Button';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { refineSocialContentAI } from '../../../services/geminiService';
import { MediaLibrary } from '../../MediaLibrary/MediaLibraryModal';
import { CaptionPresetPicker } from '../../../screens/social/components/CaptionPresetPicker';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialStudioViewProps {
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
}

export const SocialStudioView: React.FC<SocialStudioViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [isRefining, setIsRefining] = useState(false);
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);

    // Parse Data from Strategy & Lab
    const studioData: StudioData = (() => {
        try {
            const parsed = idea.concept ? JSON.parse(idea.concept) : {};
            return {
                concepts: parsed.concepts || {},
                drafts: parsed.drafts || {},
                activeDraftPlatform: parsed.activeDraftPlatform || null,
            };
        } catch {
            return { concepts: {}, drafts: {}, activeDraftPlatform: null };
        }
    })();

    // Ensure active platform is set
    useEffect(() => {
        const platforms = Object.keys(studioData.concepts);
        if (platforms.length > 0 && !studioData.activeDraftPlatform) {
            onUpdate({ concept: JSON.stringify({ ...studioData, activeDraftPlatform: platforms[0] }) });
        }
    }, []);


    const updateStudioData = (updates: Partial<StudioData>) => {
        const currentParsed = idea.concept ? JSON.parse(idea.concept) : {};
        const newData = { ...currentParsed, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const platforms = Object.keys(studioData.concepts) as SocialPlatform[];
    const activePlatform = studioData.activeDraftPlatform || (platforms.length > 0 ? platforms[0] : null);

    const activeConcept = activePlatform ? studioData.concepts[activePlatform] : null;
    const activeDraft = activePlatform ? (studioData.drafts[activePlatform] || {
        copy: activeConcept ? `${activeConcept.hook}\n\n${activeConcept.contentBody}` : '',
        assets: [],
        status: 'draft'
    }) : null;


    const handleUpdateDraft = (copy: string) => {
        if (!activePlatform) return;
        const newDrafts = {
            ...studioData.drafts,
            [activePlatform]: { ...activeDraft!, copy }
        };
        updateStudioData({ drafts: newDrafts });
    };

    const handleUpdateAssets = (newAssets: string[]) => {
        if (!activePlatform) return;
        const newDrafts = {
            ...studioData.drafts,
            [activePlatform]: { ...activeDraft!, assets: newAssets }
        };
        updateStudioData({ drafts: newDrafts });
    }

    const handleMarkReady = () => {
        if (!activePlatform) return;
        const newDrafts = {
            ...studioData.drafts,
            [activePlatform]: { ...activeDraft!, status: activeDraft?.status === 'ready' ? 'draft' : 'ready' }
        } as Record<string, ContentDraft>;
        updateStudioData({ drafts: newDrafts });
    }

    const handleAIRefine = async (customInstruction?: string) => {
        if (!activeDraft || !activePlatform || isRefining) return;
        setIsRefining(true);
        try {
            const tone = (idea.concept && JSON.parse(idea.concept).tone) || 'Professional';
            const refined = await refineSocialContentAI(activeDraft.copy, activePlatform, tone, customInstruction);
            handleUpdateDraft(refined);
        } catch (e) {
            console.error(e);
        } finally {
            setIsRefining(false);
        }
    };


    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                {/* Hero / Header */}
                <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-white dark:from-violet-900/30 dark:via-purple-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-violet-200 dark:border-violet-800/50 relative overflow-hidden shadow-xl shadow-violet-100 dark:shadow-none flex flex-col md:flex-row justify-between gap-6">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-violet-600 rotate-12 -translate-y-10 translate-x-10">movie_edit</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="px-3 py-1 bg-violet-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-violet-200 dark:shadow-none">
                                    {t('flowStages.socialStudio.hero.badge')}
                                </div>
                                <div className="h-[1px] w-8 bg-violet-200 dark:bg-violet-800 rounded-full" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                {t('flowStages.socialStudio.hero.title')}
                            </h1>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-2xl leading-relaxed">
                            {t('flowStages.socialStudio.hero.subtitle')}
                        </p>
                    </div>
                    <div className="relative z-10 flex flex-col justify-end">
                        <Button
                            onClick={() => onUpdate({ stage: 'Distribution' })} // Maps to SocialPerformanceView
                            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 shadow-lg shadow-slate-200 dark:shadow-none h-12 px-6 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-3"
                        >
                            {t('flowStages.socialStudio.actions.advance')}
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: Asset Editor (8/12) */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Platform Tabs */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                            {platforms.map(p => {
                                const isActive = activePlatform === p;
                                const isReady = studioData.drafts[p]?.status === 'ready';
                                return (
                                    <button
                                        key={p}
                                        onClick={() => updateStudioData({ activeDraftPlatform: p })}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${isActive
                                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg'
                                                : 'bg-white dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-violet-300'
                                            }`}
                                    >
                                        <div className="size-5"><PlatformIcon platform={p} /></div>
                                        <span className="text-[11px] font-black uppercase tracking-wider">{p}</span>
                                        {isReady && <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Editor Card */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm flex flex-col gap-6 min-h-[500px]">
                            {activePlatform && activeDraft ? (
                                <>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[12px] tracking-widest flex items-center gap-2">
                                                <span className="material-symbols-outlined text-violet-500">edit_note</span>
                                                {activePlatform} {t('flowStages.socialStudio.editor.draftLabel')}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1">
                                                {t('flowStages.socialStudio.editor.formatLabel')} {studioData.concepts[activePlatform]?.format}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <CaptionPresetPicker
                                                projectId={idea.projectId!}
                                                platform={activePlatform}
                                                onApply={(caption, hashtags) => {
                                                    const current = activeDraft.copy || '';
                                                    const separator = current && caption ? '\n\n' : '';
                                                    const tagSep = (current || caption) && hashtags ? '\n\n' : '';
                                                    const tags = hashtags ? hashtags.join(' ') : '';
                                                    handleUpdateDraft(`${current}${separator}${caption}${tagSep}${tags}`);
                                                }}
                                            />
                                            <button
                                                onClick={() => handleAIRefine()}
                                                disabled={isRefining}
                                                className="px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-violet-100 transition-all border border-violet-100 dark:border-violet-800"
                                            >
                                                <span className={`material-symbols-outlined text-[14px] ${isRefining ? 'animate-spin' : ''}`}>
                                                    {isRefining ? 'progress_activity' : 'auto_awesome'}
                                                </span>
                                                {t('flowStages.socialStudio.editor.autoRefine')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                                        {/* Text Column */}
                                        <div className="flex flex-col gap-4">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-2 opacity-80">{t('flowStages.socialStudio.editor.hookLabel')}</div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-snug">
                                                    "{studioData.concepts[activePlatform]?.hook}"
                                                </p>
                                            </div>

                                            <textarea
                                                className="flex-1 w-full bg-slate-50 dark:bg-slate-800/20 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-4 text-sm font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none leading-relaxed transition-all"
                                                value={activeDraft.copy}
                                                onChange={(e) => handleUpdateDraft(e.target.value)}
                                                placeholder={t('flowStages.socialStudio.editor.copyPlaceholder')}
                                            />
                                        </div>

                                        {/* Asset Column */}
                                        <div className="flex flex-col gap-4 items-center">
                                            <div className="w-full p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                                                <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1 opacity-80">{t('flowStages.socialStudio.editor.visualCueLabel')}</div>
                                                <p className="text-xs font-bold text-slate-500 italic">"{studioData.concepts[activePlatform]?.visualCue}"</p>
                                            </div>

                                            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-800/20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-4 flex flex-col items-center justify-center relative overflow-hidden group">
                                                {activeDraft.assets.length > 0 ? (
                                                    <div className="grid grid-cols-2 gap-2 w-full h-full overflow-y-auto pr-1">
                                                        {activeDraft.assets.map((url, i) => (
                                                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-black group/asset">
                                                                {url.match(/\.(mp4|mov|webm)$/i) ? (
                                                                    <video src={`${url}#t=0.001`} className="w-full h-full object-cover" muted />
                                                                ) : (
                                                                    <img src={url} alt={t('flowStages.socialStudio.editor.assetAlt')} className="w-full h-full object-cover" />
                                                                )}
                                                                <button
                                                                    onClick={() => handleUpdateAssets(activeDraft.assets.filter((_, idx) => idx !== i))}
                                                                    className="absolute top-1 right-1 size-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/asset:opacity-100 transition-all"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => setShowMediaLibrary(true)}
                                                            className="aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all"
                                                        >
                                                            <span className="material-symbols-outlined">add</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-center">
                                                        <div className="size-12 bg-white dark:bg-slate-900 rounded-full shadow-lg flex items-center justify-center mx-auto mb-4 text-violet-200">
                                                            <span className="material-symbols-outlined text-2xl">image</span>
                                                        </div>
                                                        <button
                                                            onClick={() => setShowMediaLibrary(true)}
                                                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-violet-200 dark:shadow-none"
                                                        >
                                                            {t('flowStages.socialStudio.editor.upload')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-4">movie_edit</span>
                                    <p className="text-xs font-black uppercase tracking-widest">{t('flowStages.socialStudio.editor.empty')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Production Queue (4/12) */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm sticky top-6">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[12px] tracking-widest mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-violet-500">queue_music</span>
                                {t('flowStages.socialStudio.queue.title')}
                            </h3>
                            <div className="space-y-3">
                                {platforms.map(p => {
                                    const ready = studioData.drafts[p]?.status === 'ready';
                                    const format = studioData.concepts[p]?.format;
                                    const hasContent = studioData.drafts[p]?.copy || studioData.drafts[p]?.assets.length > 0;

                                    return (
                                        <div key={p} className={`flex items-start justify-between p-3 rounded-xl border transition-all ${activePlatform === p
                                                ? 'bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800'
                                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                                                    <div className="size-5"><PlatformIcon platform={p} /></div>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block">{p}</span>
                                                    <span className="text-[10px] font-medium text-slate-400 block">{format}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${ready ? 'bg-green-100 text-green-600' :
                                                        hasContent ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'
                                                    }`}>
                                                    {ready ? t('flowStages.socialStudio.queue.status.ready') : hasContent ? t('flowStages.socialStudio.queue.status.inProgress') : t('flowStages.socialStudio.queue.status.empty')}
                                                </span>

                                                {activePlatform === p && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleMarkReady();
                                                        }}
                                                        className="text-[10px] font-bold text-violet-600 hover:text-violet-700 underline"
                                                    >
                                                        {ready ? t('flowStages.socialStudio.queue.actions.markDraft') : t('flowStages.socialStudio.queue.actions.markReady')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] text-slate-400 font-medium text-center">
                                    {t('flowStages.socialStudio.queue.hint')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showMediaLibrary && (
                <MediaLibrary
                    isOpen={showMediaLibrary}
                    onClose={() => setShowMediaLibrary(false)}
                    projectId={idea.projectId!}
                    onSelect={(asset) => {
                        const currentAssets = activeDraft?.assets || [];
                        handleUpdateAssets([...currentAssets, asset.url]);
                        setShowMediaLibrary(false);
                    }}
                />
            )}
        </div>
    );
};
