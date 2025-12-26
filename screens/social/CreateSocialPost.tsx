import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker'; // Assuming this exists or using Input for now
import { AICaptionGenerator } from './components/AICaptionGenerator';
import { CaptionPresetPicker } from './components/CaptionPresetPicker';
import { MediaLibrary } from '../../components/MediaLibrary/MediaLibraryModal';
import { SocialPostPreview } from './components/SocialPostPreview';
import { createSocialPost, updateSocialPost, getSocialPostById, subscribeCampaigns, deleteSocialPost } from '../../services/dataService';
import { generateSocialHashtags, generateYouTubeScript } from '../../services/geminiService';
import { SocialPost, SocialPlatform, SocialPostFormat, SocialAsset, SocialCampaign } from '../../types';
import { auth } from '../../services/firebase';
import { format as formatDate } from 'date-fns';
import { useConfirm } from '../../context/UIContext';

const PLATFORM_FORMATS: Record<SocialPlatform, SocialPostFormat[]> = {
    'Instagram': ['Post', 'Story', 'Reel'],
    'Facebook': ['Text', 'Post', 'Reel', 'Story'],
    'LinkedIn': ['Text', 'Post', 'Carousel'],
    'TikTok': ['Video'],
    'X': ['Text', 'Post'],
    'YouTube': ['Video', 'Short']
};

export const CreateSocialPost = () => {
    const { id: projectId, postId } = useParams<{ id: string; postId?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const defaultDate = searchParams.get('date');
    const preselectedCampaignId = searchParams.get('campaignId');

    // Form State
    const [platform, setPlatform] = useState<SocialPlatform>('Instagram');
    const [format, setFormat] = useState<SocialPostFormat>('Image');
    const [caption, setCaption] = useState('');
    const [hashtags, setHashtags] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [campaignId, setCampaignId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [assets, setAssets] = useState<SocialAsset[]>([]);

    const [isConcept, setIsConcept] = useState(false);

    // YouTube / Concept State
    const [videoTitle, setVideoTitle] = useState('');
    const [thumbnailIdea, setThumbnailIdea] = useState('');
    const [scriptOutline, setScriptOutline] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [isPickingThumbnail, setIsPickingThumbnail] = useState(false);
    const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
    const [storyProgress, setStoryProgress] = useState(0);
    const [isStoryPlaying, setIsStoryPlaying] = useState(true);
    const [isPreviewHovered, setIsPreviewHovered] = useState(false);
    const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});

    // Data State
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);

    // Modals
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const [showAIGenerator, setShowAIGenerator] = useState(false);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeCampaigns(projectId, (data) => setCampaigns(data));
        return () => unsub();
    }, [projectId]);

    // Initial Load (Edit Mode)
    useEffect(() => {
        if (defaultDate) {
            setScheduledDate(defaultDate);
            setScheduledTime('12:00');
        }

        if (preselectedCampaignId) {
            setCampaignId(preselectedCampaignId);
        }

        if (postId && projectId) {
            setLoading(true);
            getSocialPostById(projectId, postId).then(post => {
                if (post) {
                    setPlatform(post.platform);
                    setFormat(post.format);
                    setCaption(post.content.caption || '');
                    setHashtags(post.content.hashtags?.join(' ') || '');
                    setCampaignId(post.campaignId || '');
                    setIsConcept(post.isConcept || false);
                    if (post.scheduledFor) {
                        setScheduledDate(formatDate(new Date(post.scheduledFor), 'yyyy-MM-dd'));
                        setScheduledTime(formatDate(new Date(post.scheduledFor), 'HH:mm'));
                    }
                    if (post.assets) {
                        setAssets(post.assets);
                    }
                    if (post.videoConcept) {
                        setVideoTitle(post.videoConcept.title || '');
                        setThumbnailIdea(post.videoConcept.thumbnailIdea || '');
                        setScriptOutline(post.videoConcept.scriptOutline || '');
                        setThumbnailUrl(post.videoConcept.thumbnailUrl || '');
                    }
                }
            }).catch(console.error).finally(() => setLoading(false));
        }
    }, [postId, projectId, defaultDate, preselectedCampaignId]);

    const isYouTube = platform === 'YouTube';

    // Reset carousel and story progress when platform or format changes
    const STEPS = [
        { id: 1, label: 'Strategy' },
        { id: 2, label: 'Content' },
        { id: 3, label: 'Review & Schedule' }
    ];

    useEffect(() => {
        setActiveCarouselIndex(0);
        setStoryProgress(0);
    }, [platform, format, assets.length]);

    // Story Auto-switch Logic
    useEffect(() => {
        if ((format !== 'Story' && platform !== 'TikTok') || assets.length === 0 || !isStoryPlaying || isPreviewHovered) return;

        const currentAsset = assets[activeCarouselIndex] || assets[0];

        // If it's a video, SocialPostPreview will handle progress via onTimeUpdate and switching via onEnded
        if (currentAsset?.type === 'video') return;

        const duration = 7000; // Default for images
        const intervalTime = 50;
        const step = (intervalTime / duration) * 100;

        const timer = setInterval(() => {
            setStoryProgress(prev => {
                if (prev >= 100) {
                    setActiveCarouselIndex(idx => (idx + 1) % assets.length);
                    return 0;
                }
                return prev + step;
            });
        }, intervalTime);

        return () => clearInterval(timer);
    }, [format, platform, assets, activeCarouselIndex, isStoryPlaying, isPreviewHovered]);

    const handleSubmit = async (forceIsConcept: boolean = false) => {
        if (!projectId) return;
        setLoading(true);
        try {
            let scheduledFor = null;
            if (scheduledDate) {
                const dateTimeStr = scheduledTime ? `${scheduledDate}T${scheduledTime}` : `${scheduledDate}T12:00`;
                scheduledFor = new Date(dateTimeStr).toISOString();
            }

            const isVideoFormat = ['Video', 'Reel', 'Short', 'Story'].includes(format);
            const shouldSaveVideoConcept = isYouTube || isVideoFormat || videoTitle || scriptOutline;

            const data: any = {
                platform,
                format,
                campaignId: campaignId || null,
                content: {
                    caption: isYouTube ? videoTitle : caption,
                    hashtags: hashtags.split(' ').filter(h => h.startsWith('#')),
                },
                assets,
                scheduledFor,
                status: scheduledFor ? 'Scheduled' : 'Draft',
                projectId,
                isConcept: forceIsConcept,
                videoConcept: shouldSaveVideoConcept ? {
                    title: videoTitle || (isYouTube ? caption : (caption?.slice(0, 50) || 'Untitled Video')),
                    thumbnailIdea,
                    scriptOutline,
                    thumbnailUrl
                } : null
            };

            if (postId) {
                await updateSocialPost(projectId, postId, data);
            } else {
                await createSocialPost(projectId, data);
            }
            // Navigate back to where we came from? 
            // If campaignId was present, go to campaign detail? Or just calendar/posts list.
            // For now, consistent behavior:
            if (campaignId) {
                navigate(`/project/${projectId}/social/campaigns/${campaignId}`);
            } else {
                navigate(`/project/${projectId}/social/calendar`);
            }
        } catch (error) {
            console.error("Failed to save post", error);
        } finally {
            setLoading(false);
        }
    };

    const confirm = useConfirm();

    const handleDeletePost = async () => {
        if (!projectId || !postId) return;
        const confirmed = await confirm(
            'Delete Post?',
            'Are you sure you want to delete this post? This action cannot be undone.'
        );
        if (confirmed) {
            await deleteSocialPost(projectId, postId);
            navigate(-1);
        }
    };

    // Helper to get platform icon
    const getPlatformIcon = (p: SocialPlatform) => {
        switch (p) {
            case 'Instagram': return 'photo_camera'; // Material icon equivalent? Or use svg
            case 'Facebook': return 'facebook';
            case 'LinkedIn': return 'work';
            case 'X': return 'flutter_dash'; // Close enough
            case 'TikTok': return 'music_note';
            default: return 'public';
        }
    };

    // Stepper State
    const [currentStep, setCurrentStep] = useState(1);

    return (
        <div className="flex items-center justify-center p-6 h-full w-full bg-[var(--color-bg-base)]">
            <div className="w-full max-w-6xl h-[850px] bg-[var(--color-surface-card)] rounded-3xl shadow-2xl border border-[var(--color-surface-border)] flex overflow-hidden animate-fade-in relative">

                {/* Close Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* LEFT: Form Panel */}
                <div className="w-[50%] flex flex-col border-r border-[var(--color-surface-border)]">

                    {/* Header with Stepper */}
                    <header className="px-8 py-6 border-b border-[var(--color-surface-border)]">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h1 className="text-xl font-bold text-[var(--color-text-main)]">{postId ? 'Edit Post' : 'Create New Post'}</h1>
                                <p className="text-sm text-[var(--color-text-subtle)]">Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].label}</p>
                            </div>
                            {postId && (
                                <button
                                    onClick={handleDeletePost}
                                    className="p-2 text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Post"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            )}
                        </div>

                        {/* Stepper Indicator */}
                        <div className="flex items-center gap-2">
                            {STEPS.map((step) => (
                                <div key={step.id} className="flex items-center flex-1">
                                    <div
                                        className={`flex-1 h-2 rounded-full transition-colors ${step.id <= currentStep
                                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600'
                                            : 'bg-[var(--color-surface-hover)]'
                                            }`}
                                    />
                                </div>
                            ))}
                        </div>
                    </header>

                    {/* Step Content */}
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">

                        {/* STEP 1: STRATEGY */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-[var(--color-text-main)]">Campaign Context</label>
                                    <select
                                        value={campaignId}
                                        onChange={(e) => setCampaignId(e.target.value)}
                                        className="w-full h-12 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    >
                                        <option value="">No Campaign (Standalone Post)</option>
                                        {campaigns.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-[var(--color-text-muted)]">Link this post to a campaign to track aggregate performance.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2 space-y-4">
                                        <label className="text-sm font-bold text-[var(--color-text-main)]">Target Platform</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'].map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => {
                                                        const newPlatform = p as SocialPlatform;
                                                        setPlatform(newPlatform);
                                                        const validFormats = PLATFORM_FORMATS[newPlatform];
                                                        if (newPlatform !== 'YouTube' && !validFormats.includes(format)) {
                                                            setFormat(validFormats[0]);
                                                        }
                                                    }}
                                                    className={`h-24 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${platform === p
                                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                                                        : 'border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)] text-[var(--color-text-muted)]'
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-2xl">{getPlatformIcon(p as SocialPlatform)}</span>
                                                    <span className="text-xs font-semibold">{p}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="col-span-2 space-y-4">
                                        <label className="text-sm font-bold text-[var(--color-text-main)]">Post Format</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(PLATFORM_FORMATS[platform] || ['Image']).map(fmt => (
                                                <button
                                                    key={fmt}
                                                    onClick={() => setFormat(fmt as SocialPostFormat)}
                                                    className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${format === fmt
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-transparent border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-indigo-300'
                                                        }`}
                                                >
                                                    {fmt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: CONTENT */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-fade-in">
                                {isYouTube ? (
                                    <div className="space-y-6">
                                        <Input
                                            label="Video Title"
                                            value={videoTitle}
                                            onChange={e => setVideoTitle(e.target.value)}
                                            placeholder="e.g. How to use ProjectFlow in 5 mins"
                                            autoFocus
                                        />

                                        <div>
                                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-3 block">Thumbnail Design</label>
                                            <div className="flex gap-4">
                                                {thumbnailUrl ? (
                                                    <div className="relative aspect-video w-48 rounded-lg overflow-hidden bg-black/5 group border border-[var(--color-surface-border)] shrink-0">
                                                        <img src={thumbnailUrl} className="w-full h-full object-cover" />
                                                        <button
                                                            onClick={() => setThumbnailUrl('')}
                                                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setIsPickingThumbnail(true);
                                                            setShowAssetPicker(true);
                                                        }}
                                                        className="aspect-video w-48 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all shrink-0"
                                                    >
                                                        <span className="material-symbols-outlined text-2xl mb-1">add_photo_alternate</span>
                                                        <span className="text-xs font-bold">Upload</span>
                                                    </button>
                                                )}

                                                <div className="flex-1">
                                                    <Textarea
                                                        value={thumbnailIdea}
                                                        onChange={e => setThumbnailIdea(e.target.value)}
                                                        placeholder="Describe the thumbnail concept..."
                                                        className="h-full text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase block">Script & Description</label>
                                                <button
                                                    onClick={async () => {
                                                        if (!videoTitle) return;
                                                        setLoading(true);
                                                        try {
                                                            const script = await generateYouTubeScript(videoTitle, thumbnailIdea);
                                                            setScriptOutline(script);
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    }}
                                                    className="text-xs font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-1 disabled:opacity-50"
                                                    disabled={loading || !videoTitle}
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                                    Generate with AI
                                                </button>
                                            </div>
                                            <Textarea
                                                value={scriptOutline}
                                                onChange={e => setScriptOutline(e.target.value)}
                                                placeholder="Key points, chapters, or full description..."
                                                className="min-h-[200px]"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Media - Only show if not Text format */}
                                        {format !== 'Text' && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Visual Assets</label>
                                                    <span className="text-[10px] text-[var(--color-text-muted)]">{Math.max(0, 10 - assets.length)} slots remaining</span>
                                                </div>

                                                <div className="grid grid-cols-4 gap-3">
                                                    {assets.map((asset, idx) => (
                                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-black/5 group border border-[var(--color-surface-border)] shadow-sm">
                                                            {asset.type === 'video' ? (
                                                                <video src={asset.url} className="w-full h-full object-cover" muted playsInline />
                                                            ) : (
                                                                <img src={asset.url} className="w-full h-full object-cover" />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                                            <button
                                                                onClick={() => setAssets(prev => prev.filter((_, i) => i !== idx))}
                                                                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => setShowAssetPicker(true)}
                                                        className="aspect-square border-2 border-dashed border-[var(--color-surface-border)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all group"
                                                    >
                                                        <span className="material-symbols-outlined text-2xl mb-1 group-hover:scale-110 transition-transform">add_photo_alternate</span>
                                                        <span className="text-[10px] font-bold">Add Media</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Caption */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Caption</label>
                                                    {projectId && (
                                                        <CaptionPresetPicker
                                                            projectId={projectId}
                                                            platform={platform}
                                                            onApply={(presetCaption, presetHashtags) => {
                                                                setCaption(presetCaption);
                                                                if (presetHashtags && presetHashtags.length > 0) {
                                                                    setHashtags(presetHashtags.join(' '));
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                                {/* X/Twitter character limit */}
                                                {platform === 'X' && (
                                                    <span className={`text-xs font-mono ${caption.length > 280 ? 'text-red-500 font-bold' : 'text-[var(--color-text-muted)]'}`}>
                                                        {caption.length}/280
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <Textarea
                                                    value={caption}
                                                    onChange={e => {
                                                        // Enforce 280 char limit for X
                                                        if (platform === 'X' && e.target.value.length > 280) {
                                                            setCaption(e.target.value.substring(0, 280));
                                                        } else {
                                                            setCaption(e.target.value);
                                                        }
                                                    }}
                                                    placeholder={platform === 'X' ? "What is happening?!" : "Write an engaging caption..."}
                                                    className={`min-h-[160px] pb-10 resize-none font-medium ${platform === 'X' && caption.length > 260 ? 'border-amber-500 focus:ring-amber-500' : ''}`}
                                                />
                                                <button
                                                    onClick={() => setShowAIGenerator(true)}
                                                    className="absolute bottom-3 right-3 px-3 py-1.5 bg-[var(--color-surface-hover)] text-[var(--color-text-main)] rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[var(--color-surface-pressed)] transition-colors border border-[var(--color-surface-border)]"
                                                >
                                                    <span className="material-symbols-outlined text-[14px] text-indigo-500">auto_awesome</span>
                                                    AI Assist
                                                </button>
                                            </div>
                                        </div>

                                        {/* Hashtags */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Hashtags</label>
                                                <button
                                                    onClick={async () => {
                                                        if (!caption && !videoTitle) return;
                                                        setLoading(true);
                                                        try {
                                                            const tags = await generateSocialHashtags(caption || videoTitle || "marketing", platform);
                                                            setHashtags(tags);
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    }}
                                                    className="text-[10px] font-bold text-indigo-500 hover:underline disabled:opacity-50"
                                                    disabled={loading || (!caption && !videoTitle)}
                                                >
                                                    Generate Relevant Tags
                                                </button>
                                            </div>
                                            <Input
                                                value={hashtags}
                                                onChange={e => setHashtags(e.target.value)}
                                                placeholder="#marketing #social #growth"
                                                className="font-mono text-sm text-[var(--color-primary)]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 3: SCHEDULE */}
                        {currentStep === 3 && (
                            <div className="space-y-8 animate-fade-in flex flex-col justify-center h-full">
                                <div className="text-center space-y-2">
                                    <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 mb-2">
                                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-[var(--color-text-main)]">Ready to Publish?</h3>
                                    <p className="text-[var(--color-text-muted)] max-w-md mx-auto">
                                        Your {platform} {format} post is ready. Review the preview on the right and select a publishing time.
                                    </p>
                                </div>

                                <div className="bg-[var(--color-surface-hover)] p-6 rounded-2xl border border-[var(--color-surface-border)] max-w-md mx-auto w-full">
                                    <h4 className="text-sm font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined">calendar_clock</span>
                                        Scheduling
                                    </h4>
                                    <div className="space-y-4">
                                        <DatePicker
                                            label="Date"
                                            value={scheduledDate}
                                            onChange={setScheduledDate}
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                        <TimePicker
                                            label="Time"
                                            value={scheduledTime}
                                            onChange={setScheduledTime}
                                        />
                                        {!scheduledDate && (
                                            <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg">
                                                <span className="material-symbols-outlined text-sm">info</span>
                                                Leave blank to save as a Draft.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    <footer className="px-8 py-5 border-t border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-card)]">
                        {currentStep > 1 ? (
                            <Button variant="ghost" onClick={() => setCurrentStep(prev => prev - 1)}>
                                <span className="material-symbols-outlined mr-1">arrow_back</span>
                                Back
                            </Button>
                        ) : (
                            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                        )}

                        <div className="flex gap-3">
                            {currentStep < 3 ? (
                                <Button variant="primary" onClick={() => setCurrentStep(prev => prev + 1)}>
                                    Next Step
                                    <span className="material-symbols-outlined ml-1">arrow_forward</span>
                                </Button>
                            ) : (
                                <>
                                    {isConcept && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => handleSubmit(true)}
                                            isLoading={loading}
                                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                                        >
                                            Update Concept
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setScheduledDate('');
                                            setScheduledTime('');
                                            setTimeout(() => handleSubmit(false), 0);
                                        }}
                                        isLoading={loading}
                                    >
                                        {isConcept ? 'Convert to Draft' : 'Save as Draft'}
                                    </Button>
                                    <Button variant="primary" onClick={() => handleSubmit(false)} isLoading={loading} disabled={!!scheduledDate && !scheduledTime}>
                                        {scheduledDate ? 'Schedule Post' : 'Save & Close'}
                                    </Button>
                                </>
                            )}
                        </div>
                    </footer>
                </div>

                {/* RIGHT: Preview Panel */}
                <div className="w-[50%] bg-[var(--color-bg-base)] flex flex-col items-center justify-center p-8 relative">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                    <div className="mb-6 text-center z-10">
                        <h2 className="text-sm font-semibold text-[var(--color-text-subtle)] uppercase tracking-wider mb-1">Preview</h2>
                        <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined text-[16px]">{getPlatformIcon(platform)}</span>
                            {platform} • {format}
                        </div>
                    </div>

                    <div
                        className="relative z-10 w-full flex justify-center cursor-pointer"
                        onMouseEnter={() => setIsPreviewHovered(true)}
                        onMouseLeave={() => setIsPreviewHovered(false)}
                        onClick={() => setIsStoryPlaying(!isStoryPlaying)}
                    >
                        <SocialPostPreview
                            platform={platform}
                            format={format}
                            assets={assets}
                            caption={caption}
                            hashtags={hashtags}
                            isYouTube={isYouTube}
                            thumbnailUrl={thumbnailUrl}
                            videoTitle={videoTitle}
                            activeCarouselIndex={activeCarouselIndex}
                            setActiveCarouselIndex={setActiveCarouselIndex}
                            storyProgress={storyProgress}
                            setStoryProgress={setStoryProgress}
                            isStoryPlaying={isStoryPlaying}
                            isPreviewHovered={isPreviewHovered}
                            videoDurations={videoDurations}
                            setVideoDurations={setVideoDurations}
                        />
                    </div>

                    {/* Preview Instructions */}
                    <div className="mt-8 flex items-center gap-6 text-[var(--color-text-muted)] text-[11px] font-medium animate-fade-in">
                        <div className="flex items-center gap-2">
                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] font-mono text-[10px] shadow-sm">Hover</kbd>
                            <span>to Pause</span>
                        </div>
                        <div className="w-px h-3 bg-[var(--color-surface-border)]" />
                        <div className="flex items-center gap-2">
                            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] font-mono text-[10px] shadow-sm">Click</kbd>
                            <span>to Toggle Playback</span>
                        </div>
                        <div className="w-px h-3 bg-[var(--color-surface-border)]" />
                        <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isStoryPlaying && !isPreviewHovered ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="uppercase tracking-widest text-[9px] font-bold w-14 inline-block">
                                {isStoryPlaying ? (isPreviewHovered ? 'Paused' : 'Playing') : 'Stopped'}
                            </span>
                        </div>
                    </div>
                </div>

            </div>

            <AICaptionGenerator
                isOpen={showAIGenerator}
                onClose={() => setShowAIGenerator(false)}
                onGenerate={(text) => setCaption(prev => prev + (prev ? '\n\n' : '') + text)}
                platform={platform}
            />

            <MediaLibrary
                isOpen={showAssetPicker}
                onClose={() => {
                    setShowAssetPicker(false);
                    setIsPickingThumbnail(false);
                }}
                projectId={projectId || ''}
                onSelect={(asset) => {
                    if (isPickingThumbnail) {
                        setThumbnailUrl(asset.url);
                    } else {
                        // Adapt MediaAsset to SocialAsset structure
                        const socialAsset: SocialAsset = {
                            id: asset.id,
                            projectId: projectId || '',
                            url: asset.url,
                            storagePath: '', // Unknown from MediaAsset, but URL works for display
                            type: asset.type,
                            filename: asset.name,
                            mimeType: asset.type === 'image' ? 'image/jpeg' : 'video/mp4', // Guessing
                            size: 0,
                            createdAt: new Date().toISOString(),
                            createdBy: auth.currentUser?.uid || ''
                        };
                        setAssets(prev => [...prev, socialAsset]);
                    }
                    setShowAssetPicker(false);
                    setIsPickingThumbnail(false);
                }}
            />
        </div>
    );
};
