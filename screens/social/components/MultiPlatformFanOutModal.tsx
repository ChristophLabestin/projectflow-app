import React, { useState, useEffect } from 'react';
import { SocialPost, SocialPlatform } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import fbLogo from '../../../assets/Facebook Brand Asset Pack/Logo/Primary Logo/Facebook_Logo_Primary.png';
import igLogo from '../../../assets/01 Static Glyph/01 Gradient Glyph/Instagram_Glyph_Gradient.png';
import liLogo from '../../../assets/in-logo/LI-In-Bug.png';
import ytLogo from '../../../assets/YouTube_Icon/Digital/01 Red/yt_icon_red_digital.png';
import ttLogo from '../../../assets/Dev Portal Logo Pack/TikTok Logo Pack/TikTok – Icons/TikTok_Icon_Black_Circle.png';
import xLogoBlack from '../../../assets/x-logo/logo-black.png';
import xLogoWhite from '../../../assets/x-logo/logo-white.png';
import { useLanguage } from '../../../context/LanguageContext';

interface MultiPlatformFanOutModalProps {
    post: SocialPost;
    onClose: () => void;
    onSubmit: (originalPost: SocialPost, newPosts: Partial<SocialPost>[]) => void;
    unavailablePlatforms?: SocialPlatform[];
}

// Brand Icons (SVGs)
const BrandIcons: Record<string, React.ReactNode> = {
    Instagram: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
    ),
    LinkedIn: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
    ),
    YouTube: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
        </svg>
    ),
    TikTok: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.65-1.58-1.09v8.32c0 .41.01.82-.07 1.23-.2 1.05-.7 2.03-1.45 2.81-.92.93-2.18 1.51-3.5 1.58-1 .04-2.01-.15-2.92-.61-1.75-.9-2.85-2.66-3.05-4.59-.2-1.92.51-3.87 1.94-5.23 1.4-1.32 3.4-1.96 5.38-1.68v4.06c-1.28-.15-2.59.39-3.23 1.52-.37.66-.46 1.44-.24 2.16.22.7.77 1.27 1.42 1.58 1.24.58 2.74.27 3.73-.78.58-.61.88-1.44.88-2.28.02-4.22.01-8.45.01-12.67.01-1.07.01-2.14 0-3.33z" />
        </svg>
    ),
    Facebook: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385h-3.047v-3.47h3.047v-2.641c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385c5.737-.9 10.125-5.864 10.125-11.854z" />
        </svg>
    ),
    X: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    )
};


const ALL_PLATFORMS: SocialPlatform[] = ['Instagram', 'LinkedIn', 'YouTube', 'TikTok', 'Facebook', 'X'];

export const MultiPlatformFanOutModal: React.FC<MultiPlatformFanOutModalProps> = ({ post, onClose, onSubmit, unavailablePlatforms = [] }) => {
    // Initialize selected platforms
    const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);

    // Initialize customizations for ALL platforms initially to avoid undefined errors if user selects them
    const [customizations, setCustomizations] = useState<Record<string, { caption: string; hashtags: string; visualDescription: string }>>({});

    // Track active platform being edited
    const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    // Platform Brand Colors (for accent)
    const getPlatformColor = (p: SocialPlatform) => {
        switch (p) {
            case 'Instagram': return 'from-yellow-400 via-red-500 to-purple-500';
            case 'LinkedIn': return 'bg-[#0077b5]';
            case 'YouTube': return 'bg-[#FF0000]';
            case 'TikTok': return 'bg-black dark:bg-white';
            case 'Facebook': return 'bg-[#1877F2]';
            case 'X': return 'bg-black dark:bg-white';
            default: return 'bg-gray-500';
        }
    };

    const getPlatformIcon = (platform: SocialPlatform) => {
        const commonClasses = "w-full h-full object-contain";
        switch (platform) {
            case 'Instagram':
                return <img src={igLogo} alt="Instagram" className={commonClasses} />;
            case 'LinkedIn':
                return <img src={liLogo} alt="LinkedIn" className={commonClasses} />;
            case 'YouTube':
                return <img src={ytLogo} alt="YouTube" className={commonClasses} />;
            case 'TikTok':
                return <img src={ttLogo} alt="TikTok" className={commonClasses} />;
            case 'Facebook':
                return <img src={fbLogo} alt="Facebook" className={commonClasses} />;
            case 'X':
                // X Brand Guidelines: White logo on Black background for the App Icon look.
                return (
                    <div className="w-full h-full bg-black flex items-center justify-center rounded-md overflow-hidden">
                        <img src={xLogoWhite} alt="X" className="w-[60%] h-[60%] object-contain" />
                    </div>
                );
            default:
                return null;
        }
    };

    useEffect(() => {
        if (post.platforms && post.platforms.length > 0) {
            const ps = post.platforms as SocialPlatform[];

            setSelectedPlatforms(ps); // Select all by default
            if (ps.length > 0) setActivePlatform(ps[0]);

            // Initialize customizations
            const initialCustoms: Record<string, { caption: string; hashtags: string; visualDescription: string }> = {};
            ps.forEach(p => {
                initialCustoms[p] = {
                    caption: post.content.caption || '',
                    hashtags: post.content.hashtags?.join(' ') || '',
                    visualDescription: post.videoConcept?.thumbnailIdea || ''
                };
            });
            setCustomizations(initialCustoms);
        }
    }, [post]);



    const handleCustomize = (field: 'caption' | 'hashtags' | 'visualDescription', value: string) => {
        if (!activePlatform) return;
        setCustomizations(prev => ({
            ...prev,
            [activePlatform]: {
                ...prev[activePlatform],
                [field]: value
            }
        }));
    };

    const handleApplyToAll = (field: 'caption' | 'hashtags') => {
        if (!activePlatform) return;
        const sourceValue = customizations[activePlatform][field];

        setCustomizations(prev => {
            const next = { ...prev };
            selectedPlatforms.forEach(p => {
                if (next[p]) {
                    next[p] = { ...next[p], [field]: sourceValue };
                }
            });
            return next;
        });
    };

    const handleAddPlatform = (platform: SocialPlatform) => {
        if (selectedPlatforms.includes(platform)) return;


        setSelectedPlatforms(prev => [...prev, platform]);
        setActivePlatform(platform);

        // Init customization with copied data or empty
        setCustomizations(prev => ({
            ...prev,
            [platform]: {
                caption: post.content.caption || '',
                hashtags: post.content.hashtags?.join(' ') || '',
                visualDescription: post.videoConcept?.thumbnailIdea || ''
            }
        }));
    };

    const handleSubmit = async () => {
        if (selectedPlatforms.length === 0) return;
        setLoading(true);
        try {
            const newPosts: Partial<SocialPost>[] = selectedPlatforms.map(p => {
                const custom = customizations[p];
                return {
                    platform: p,
                    content: {
                        caption: custom.caption,
                        hashtags: custom.hashtags.split(' ').filter(h => h.startsWith('#')),
                        mentions: [],
                        links: post.content.links || []
                    },
                    status: 'Draft',
                    isConcept: false,
                    assets: post.assets,
                    campaignId: post.campaignId,
                    format: post.format,
                    videoConcept: {
                        ...post.videoConcept,
                        thumbnailIdea: custom.visualDescription
                    }
                };
            });

            await onSubmit(post, newPosts);
            onClose();
        } catch (error) {
            console.error("Failed to fan out posts", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4 sm:p-6">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-[var(--color-surface-border)] overflow-hidden relative">

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--color-surface-border)] flex justify-between items-center z-10 text-[var(--color-text-main)] relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <span className="material-symbols-outlined">hub</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">{t('social.fanOut.title')}</h2>
                            <p className="text-xs text-[var(--color-text-muted)] font-medium">
                                {t('social.fanOut.subtitle').replace('{count}', String(selectedPlatforms.length))}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-muted)]"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden z-10 relative">

                    {/* Sidebar: Platform Navigator */}
                    <div className="w-64 border-r border-[var(--color-surface-border)] flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">

                        <div className="space-y-1">
                            <h3 className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider mb-3 px-2">{t('social.fanOut.targetPlatforms')}</h3>
                            {selectedPlatforms.map(p => {
                                const isActive = activePlatform === p;
                                const isSelected = selectedPlatforms.includes(p);
                                const colorClass = getPlatformColor(p);
                                const isGradient = colorClass.includes('gradient');

                                return (
                                    <div
                                        key={p}
                                        onClick={() => setActivePlatform(p)}
                                        className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 border ${isActive
                                            ? 'bg-[var(--color-surface-hover)]/50 border-[var(--color-surface-border)] shadow-sm scale-[1.02]'
                                            : 'border-transparent hover:bg-[var(--color-surface-hover)] hover:scale-[1.01]'
                                            }`}
                                    >
                                        {/* Selection Checkbox */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                isSelected
                                                    ? setSelectedPlatforms(prev => prev.filter(sp => sp !== p))
                                                    : setSelectedPlatforms(prev => [...prev, p]);
                                            }}
                                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected
                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                : 'border-gray-400 text-transparent hover:border-indigo-500'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                        </div>

                                        {/* Icon */}
                                        {/* Icon */}
                                        <div className="w-8 h-8 flex-shrink-0">
                                            {getPlatformIcon(p)}
                                        </div>

                                        {/* Label */}
                                        <span className={`text-sm font-medium ${isActive ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]'}`}>
                                            {p}
                                        </span>

                                        {/* Active Indicator */}
                                        {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-l-full bg-indigo-500" />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-[var(--color-surface-border)] my-2" />

                        {/* Add Platform Section */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider px-2">{t('social.fanOut.addPlatform')}</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {ALL_PLATFORMS
                                    .filter(p => !selectedPlatforms.includes(p) && !unavailablePlatforms.includes(p))
                                    .map(p => (
                                        <button
                                            key={p}
                                            onClick={() => handleAddPlatform(p)}
                                            className="px-2 py-2 text-xs font-medium rounded-lg border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">add</span> {p}
                                        </button>
                                    ))}
                            </div>

                            {/* Drafted Platforms */}
                            {unavailablePlatforms.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-[var(--color-surface-order)]">
                                    <h3 className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider px-2 mb-2">{t('social.fanOut.alreadyDrafted')}</h3>
                                    <div className="flex flex-wrap gap-1.5 px-1">
                                        {unavailablePlatforms.map(p => (
                                            <span key={p} className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-bold uppercase rounded-md flex items-center gap-1 border border-green-200 dark:border-green-900/30">
                                                <span className="material-symbols-outlined text-[12px]">check</span> {p}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Editor: The "Stage" */}
                    <div className="flex-1 flex flex-col relative">
                        {activePlatform && customizations[activePlatform] ? (
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                <div className="max-w-3xl mx-auto pb-20">

                                    {/* Platform Header */}
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-14 h-14 flex-shrink-0">
                                            {getPlatformIcon(activePlatform)}
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-bold text-[var(--color-text-main)] tracking-tight">{activePlatform}</h1>
                                            <p className="text-sm font-medium text-[var(--color-text-muted)]">{t('social.fanOut.customize')}</p>
                                        </div>
                                    </div>

                                    {/* Caption Editor (Full Width) */}
                                    <div className="mb-8 space-y-3 group">
                                        <div className="flex justify-between items-end">
                                            <label className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">{t('social.fanOut.primaryCaption')}</label>
                                            <button
                                                onClick={() => handleApplyToAll('caption')}
                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                                                {t('social.fanOut.applyToAll')}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Textarea
                                                value={customizations[activePlatform].caption}
                                                onChange={(e) => handleCustomize('caption', e.target.value)}
                                                rows={5}
                                                placeholder={t('social.fanOut.captionPlaceholder').replace('{platform}', activePlatform)}
                                                className="w-full p-5 rounded-2xl border-gray-200 dark:border-gray-700 bg-[var(--color-surface-card)] text-base leading-relaxed focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all resize-none"
                                            />
                                            <div className="absolute bottom-4 right-4 text-[10px] font-bold text-gray-400 bg-white/50 dark:bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
                                                {customizations[activePlatform].caption.length}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2-Column Grid for Metadata */}
                                    <div className="grid grid-cols-2 gap-6">

                                        {/* Hashtags */}
                                        <div className="space-y-3 group h-full flex flex-col">
                                        <div className="flex justify-between items-end">
                                            <label className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">{t('social.fanOut.hashtags')}</label>
                                            <button
                                                onClick={() => handleApplyToAll('hashtags')}
                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                                                {t('social.fanOut.applyToAll')}
                                            </button>
                                        </div>
                                        <div className="relative flex-1">
                                            <span className="absolute top-4 left-4 text-indigo-500/50 text-lg font-bold">#</span>
                                            <Textarea
                                                value={customizations[activePlatform].hashtags}
                                                onChange={(e) => handleCustomize('hashtags', e.target.value)}
                                                rows={4}
                                                placeholder={t('social.fanOut.hashtagsPlaceholder')}
                                                className="w-full h-full pl-8 p-4 rounded-2xl border-gray-200 dark:border-gray-700 bg-[var(--color-surface-card)] text-indigo-600 dark:text-indigo-400 font-medium resize-none shadow-sm focus:ring-4 focus:ring-indigo-500/10"
                                            />
                                        </div>
                                    </div>

                                        {/* Visual Description */}
                                        <div className="space-y-3 h-full flex flex-col">
                                            <label className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide flex items-center gap-2">
                                                {t('social.fanOut.visualPrompt')}
                                                <span className="material-symbols-outlined text-[14px] text-purple-500">auto_awesome</span>
                                            </label>
                                            <div className="relative flex-1 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-1.5 rounded-2xl shadow-inner">
                                                <Textarea
                                                    value={customizations[activePlatform].visualDescription}
                                                    onChange={(e) => handleCustomize('visualDescription', e.target.value)}
                                                    rows={4}
                                                    placeholder={t('social.fanOut.visualPlaceholder')}
                                                    className="w-full h-full p-3 rounded-xl border-dashed border-2 border-indigo-200 dark:border-indigo-800/50 bg-white/50 dark:bg-black/20 focus:bg-white dark:focus:bg-black/40 text-sm transition-all placeholder:text-gray-400 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center flex-col text-[var(--color-text-muted)] p-8 text-center">
                                <div className="w-20 h-20 rounded-3xl bg-[var(--color-surface-hover)] flex items-center justify-center mb-6 shadow-sm">
                                    <span className="material-symbols-outlined text-4xl opacity-40">ads_click</span>
                                </div>
                                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">{t('social.fanOut.selectPlatform')}</h3>
                                <p className="max-w-xs mx-auto text-sm">{t('social.fanOut.selectPlatformHint')}</p>
                            </div>
                        )}

                        {/* Bottom Action Bar */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-xl border-t border-[var(--color-surface-border)] flex items-center justify-between z-20 shadow-[-10px_-10px_30px_rgba(0,0,0,0.05)]">
                            <div className="text-sm font-medium text-[var(--color-text-muted)] px-4">
                                {t('social.fanOut.creating').replace('{count}', String(selectedPlatforms.length))}
                            </div>
                            <div className="flex gap-4">
                                <Button variant="ghost" onClick={onClose} className="hover:bg-gray-100 dark:hover:bg-white/5 text-[var(--color-text-main)]">{t('social.fanOut.cancel')}</Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading || selectedPlatforms.length === 0}
                                    className="bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black shadow-xl px-8 py-3 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                            {t('social.fanOut.creatingLabel')}
                                        </div>
                                    ) : t('social.fanOut.createDrafts')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
