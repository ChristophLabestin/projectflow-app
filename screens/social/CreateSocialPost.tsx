import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker'; // Assuming this exists or using Input for now
import { AICaptionGenerator } from './components/AICaptionGenerator';
import { AssetPickerModal } from './components/AssetPickerModal';
import { createSocialPost, updateSocialPost, getSocialPostById } from '../../services/dataService'; // Need getSocialPostById
import { SocialPost, SocialPlatform, SocialPostFormat, SocialAsset } from '../../types';
import { auth } from '../../services/firebase';
import { format as formatDate } from 'date-fns';

const PLATFORM_FORMATS: Record<SocialPlatform, SocialPostFormat[]> = {
    'Instagram': ['Image', 'Video', 'Carousel', 'Story', 'Reel'],
    'Facebook': ['Image', 'Video', 'Reel', 'Story'],
    'LinkedIn': ['Image', 'Video', 'Carousel'], // Carousel = Document/PDF usually, but Image Carousel works too
    'TikTok': ['Video'], // TikTok is basically Reels/Video
    'X': ['Image', 'Video']
};

export const CreateSocialPost = () => {
    const { id: projectId, postId } = useParams<{ id: string; postId?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const defaultDate = searchParams.get('date');

    // Form State
    const [platform, setPlatform] = useState<SocialPlatform>('Instagram');
    const [format, setFormat] = useState<SocialPostFormat>('Image');
    const [caption, setCaption] = useState('');
    const [hashtags, setHashtags] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [assets, setAssets] = useState<SocialAsset[]>([]);

    // Modals
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const [showAIGenerator, setShowAIGenerator] = useState(false);

    // Initial Load (Edit Mode)
    useEffect(() => {
        if (defaultDate) {
            setScheduledDate(defaultDate);
            setScheduledTime('12:00');
        }

        if (postId && projectId) {
            setLoading(true);
            getSocialPostById(projectId, postId).then(post => {
                if (post) {
                    setPlatform(post.platform);
                    setFormat(post.format); // Might need valid check
                    setCaption(post.content.caption || '');
                    setHashtags(post.content.hashtags?.join(' ') || '');
                    if (post.scheduledFor) {
                        setScheduledDate(formatDate(new Date(post.scheduledFor), 'yyyy-MM-dd'));
                        setScheduledTime(formatDate(new Date(post.scheduledFor), 'HH:mm'));
                    }
                    if (post.assets) {
                        setAssets(post.assets);
                    }
                }
            }).catch(console.error).finally(() => setLoading(false));
        }
    }, [postId, projectId, defaultDate]);

    const handleSubmit = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            let scheduledFor = null;
            if (scheduledDate) {
                const dateTimeStr = scheduledTime ? `${scheduledDate}T${scheduledTime}` : `${scheduledDate}T12:00`;
                scheduledFor = new Date(dateTimeStr).toISOString();
            }

            const data: any = {
                platform,
                format,
                content: {
                    caption,
                    hashtags: hashtags.split(' ').filter(h => h.startsWith('#')),
                },
                assets,
                scheduledFor,
                status: scheduledFor ? 'Scheduled' : 'Draft',
                projectId
            };

            if (postId) {
                // await updateSocialPost(projectId, postId, data);
                // Need to implement fetch first to ensure we aren't overwriting blindly? 
                // Actually updateSocialPost is fine.
                await updateSocialPost(projectId, postId, data);
            } else {
                await createSocialPost(projectId, data);
            }
            navigate(`/project/${projectId}/social/calendar`);
        } catch (error) {
            console.error("Failed to save post", error);
        } finally {
            setLoading(false);
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

    // Preview Component (Right Side)
    const PostPreview = () => {
        // Shared Elements
        const mediaUrl = assets.length > 0 ? assets[0].url : null;
        const mockUser = { name: 'your_account', handle: '@your_account', avatar: 'U' };

        // 1. VERTICAL FULL CONTEXT (Stories, Reels, TikTok)
        if (format === 'Story' || format === 'Reel' || platform === 'TikTok') {
            return (
                <div className="w-[300px] h-[533px] bg-black text-white rounded-2xl overflow-hidden relative shadow-xl border border-gray-800 flex flex-col">
                    {/* Background Media */}
                    {mediaUrl ? (
                        <img src={mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-white/20">movie</span>
                        </div>
                    )}

                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

                    {/* Top Bar */}
                    <div className="relative z-10 p-4 pt-6 flex justify-between items-center">
                        {format === 'Story' && (
                            <div className="absolute top-2 left-2 right-2 flex gap-1 h-1">
                                <div className="flex-1 bg-white/50 rounded-full overflow-hidden">
                                    <div className="h-full w-1/3 bg-white" />
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] font-bold text-black border border-white/20">
                                {mockUser.avatar}
                            </div>
                            <span className="text-xs font-bold shadow-black drop-shadow-md">{mockUser.name}</span>
                        </div>
                        <span className="material-symbols-outlined text-white drop-shadow-md">more_horiz</span>
                    </div>

                    {/* Right Actions (TikTok/Reels style) */}
                    {(platform === 'TikTok' || format === 'Reel') && (
                        <div className="absolute right-2 bottom-20 z-10 flex flex-col items-center gap-4 text-white">
                            <div className="flex flex-col items-center gap-1">
                                <span className="material-symbols-outlined text-2xl drop-shadow-md">favorite</span>
                                <span className="text-[10px] font-medium drop-shadow-md">1.2k</span>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="material-symbols-outlined text-2xl drop-shadow-md">chat_bubble</span>
                                <span className="text-[10px] font-medium drop-shadow-md">342</span>
                            </div>
                            <span className="material-symbols-outlined text-2xl drop-shadow-md">share</span>
                        </div>
                    )}

                    {/* Bottom Caption */}
                    <div className="relative z-10 mt-auto p-4 pb-8 space-y-2">
                        <div className="text-sm font-medium line-clamp-2 drop-shadow-md">
                            <span className="font-bold mr-2">{mockUser.name}</span>
                            {caption || "Write a caption..."}
                        </div>
                        {hashtags && <div className="text-xs text-blue-200 font-medium drop-shadow-md">{hashtags}</div>}
                    </div>
                </div>
            );
        }

        // 2. TWITTER / X LAYOUT
        if (platform === 'X') {
            return (
                <div className="w-full max-w-sm mx-auto bg-white dark:bg-black rounded-xl border border-[var(--color-surface-border)] shadow-xl p-4">
                    <div className="flex gap-3">
                        <div className="size-10 rounded-full bg-gray-200 shrink-0 flex items-center justify-center font-bold text-gray-500">
                            {mockUser.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-[15px]">
                                <span className="font-bold text-[var(--color-text-main)]">{mockUser.name}</span>
                                <span className="text-[var(--color-text-muted)]">{mockUser.handle}</span>
                                <span className="text-[var(--color-text-muted)]">·</span>
                                <span className="text-[var(--color-text-muted)]">2m</span>
                            </div>

                            <div className="mt-1 text-[15px] whitespace-pre-wrap text-[var(--color-text-main)] mb-3">
                                {caption || <span className="text-gray-400 italic">What's happening?</span>}
                                {hashtags && <div className="text-[var(--color-primary)] mt-1">{hashtags}</div>}
                            </div>

                            {assets.length > 0 && (
                                <div className={`rounded-xl overflow-hidden border border-[var(--color-surface-border)] ${assets.length > 1 ? 'grid grid-cols-2 gap-px' : ''}`}>
                                    {assets.map((a, i) => (
                                        <div key={i} className={`bg-gray-100 ${assets.length === 1 ? 'aspect-video' : 'aspect-square'}`}>
                                            <img src={a.url} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-between mt-3 text-[var(--color-text-muted)] max-w-xs">
                                <span className="material-symbols-outlined text-[18px] hover:text-blue-500 cursor-pointer">chat_bubble</span>
                                <span className="material-symbols-outlined text-[18px] hover:text-green-500 cursor-pointer">repeat</span>
                                <span className="material-symbols-outlined text-[18px] hover:text-red-500 cursor-pointer">favorite</span>
                                <span className="material-symbols-outlined text-[18px] hover:text-blue-500 cursor-pointer">ios_share</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // 3. STANDARD FEED (Instagram, Facebook, LinkedIn)
        return (
            <div className="w-full max-w-sm mx-auto bg-white dark:bg-black rounded-xl border border-[var(--color-surface-border)] shadow-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-3 flex items-center gap-2 border-b border-[var(--color-surface-border)]">
                    <div className="size-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {mockUser.avatar}
                    </div>
                    <div className="flex-1">
                        <div className="text-xs font-bold text-[var(--color-text-main)]">{mockUser.name}</div>
                        {platform === 'LinkedIn' && <div className="text-[10px] text-[var(--color-text-muted)]">Project Manager • 2h • 🌐</div>}
                        {platform === 'Facebook' && <div className="text-[10px] text-[var(--color-text-muted)]">2 mins ago • 🌎</div>}
                        {platform === 'Instagram' && <div className="text-[10px] text-[var(--color-text-muted)]">Original Audio</div>}
                    </div>
                    <span className="material-symbols-outlined text-[var(--color-text-muted)] text-sm">more_horiz</span>
                </div>

                {/* LinkedIn Text is often ABOVE media */}
                {(platform === 'LinkedIn' || platform === 'Facebook') && caption && (
                    <div className="p-3 pb-1 text-sm whitespace-pre-wrap text-[var(--color-text-main)]">
                        {caption}
                        {hashtags && <span className="text-[var(--color-primary)] ml-1">{hashtags}</span>}
                    </div>
                )}

                {/* Media Area */}
                <div className={`${platform === 'LinkedIn' ? 'aspect-video' : 'aspect-square'} bg-[var(--color-surface-hover)] flex items-center justify-center relative overflow-hidden group`}>
                    {assets.length > 0 ? (
                        assets.length === 1 ? (
                            <img src={assets[0].url} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory">
                                {assets.map((a, i) => (
                                    <img key={i} src={a.url} className="w-full h-full object-cover snap-center shrink-0" />
                                ))}
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                                    1/{assets.length}
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="text-center p-6">
                            <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)] mb-2">image</span>
                            <p className="text-xs text-[var(--color-text-muted)]">No media selected</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-3 pb-1 flex justify-between border-t border-[var(--color-surface-border)]">
                    <div className="flex gap-4 text-[var(--color-text-main)]">
                        {platform === 'LinkedIn' ? (
                            <>
                                <div className="flex flex-col items-center gap-0.5 scale-90"><span className="material-symbols-outlined">thumb_up</span><span className="text-[10px]">Like</span></div>
                                <div className="flex flex-col items-center gap-0.5 scale-90"><span className="material-symbols-outlined">chat</span><span className="text-[10px]">Comment</span></div>
                                <div className="flex flex-col items-center gap-0.5 scale-90"><span className="material-symbols-outlined">share</span><span className="text-[10px]">Repost</span></div>
                                <div className="flex flex-col items-center gap-0.5 scale-90"><span className="material-symbols-outlined">send</span><span className="text-[10px]">Send</span></div>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-xl hover:text-red-500 cursor-pointer">favorite</span>
                                <span className="material-symbols-outlined text-xl cursor-pointer">chat_bubble</span>
                                <span className="material-symbols-outlined text-xl cursor-pointer">send</span>
                            </>
                        )}
                    </div>
                    {platform === 'Instagram' && <span className="material-symbols-outlined text-xl cursor-pointer">bookmark</span>}
                </div>

                {/* Instagram Bottom Caption */}
                {platform === 'Instagram' && (
                    <div className="p-3 pt-1 space-y-1">
                        <div className="text-xs font-bold text-[var(--color-text-main)]">1,234 likes</div>
                        <div className="text-xs text-[var(--color-text-main)]">
                            <span className="font-bold mr-1">{mockUser.name}</span>
                            {caption || <span className="text-[var(--color-text-muted)] italic">Write a caption...</span>}
                        </div>
                        {hashtags && <div className="text-xs text-blue-500">{hashtags}</div>}
                        <div className="text-[10px] text-[var(--color-text-muted)] uppercase mt-2">2 minutes ago</div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex items-center justify-center p-6 h-full w-full bg-[var(--color-bg-base)]">
            <div className="w-full max-w-6xl h-[800px] bg-[var(--color-surface-card)] rounded-3xl shadow-2xl border border-[var(--color-surface-border)] flex overflow-hidden animate-fade-in relative">

                {/* Close Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* LEFT: Form Panel */}
                <div className="w-[50%] flex flex-col border-r border-[var(--color-surface-border)]">
                    <header className="px-8 py-6 border-b border-[var(--color-surface-border)]">
                        <h1 className="text-xl font-bold text-[var(--color-text-main)]">{postId ? 'Edit Post' : 'Create New Post'}</h1>
                        <p className="text-sm text-[var(--color-text-subtle)]">Draft your content and schedule it.</p>
                    </header>

                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-6">
                        {/* Platform & Format */}
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Platform"
                                value={platform}
                                onChange={e => {
                                    const newPlatform = e.target.value as SocialPlatform;
                                    setPlatform(newPlatform);
                                    // Reset format if current valid format is not available for new platform
                                    const validFormats = PLATFORM_FORMATS[newPlatform];
                                    if (!validFormats.includes(format)) {
                                        setFormat(validFormats[0]);
                                    }
                                }}
                            >
                                <option value="Instagram">Instagram</option>
                                <option value="Facebook">Facebook</option>
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="TikTok">TikTok</option>
                                <option value="X">X (Twitter)</option>
                            </Select>
                            <Select label="Format" value={format} onChange={e => setFormat(e.target.value as any)}>
                                {PLATFORM_FORMATS[platform].map(fmt => (
                                    <option key={fmt} value={fmt}>{fmt}</option>
                                ))}
                            </Select>
                        </div>

                        {/* Media */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Media</label>
                                <button
                                    onClick={() => setShowAssetPicker(true)}
                                    className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                                    Library
                                </button>
                            </div>

                            {assets.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {assets.map((asset, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-black/5 group border border-[var(--color-surface-border)]">
                                            <img src={asset.url} className="w-full h-full object-cover" />
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
                                        className="aspect-square border-2 border-dashed border-[var(--color-surface-border)] rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => setShowAssetPicker(true)}
                                    className="h-32 border-2 border-dashed border-[var(--color-surface-border)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors"
                                >
                                    <span className="material-symbols-outlined text-3xl mb-1">add_photo_alternate</span>
                                    <span className="text-sm">Select Media</span>
                                </div>
                            )}
                        </div>

                        {/* Caption */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Caption</label>
                                <button
                                    onClick={() => setShowAIGenerator(true)}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                    AI Assist
                                </button>
                            </div>
                            <Textarea
                                value={caption}
                                onChange={e => setCaption(e.target.value)}
                                placeholder="Write your caption..."
                                className="min-h-[140px] resize-none"
                            />
                            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                                <span>{caption.length} chars</span>
                                <span>{hashtags.split(' ').filter(h => h.startsWith('#')).length} tags</span>
                            </div>
                        </div>

                        {/* Hashtags */}
                        <Input
                            label="Hashtags"
                            value={hashtags}
                            onChange={e => setHashtags(e.target.value)}
                            placeholder="#marketing #social"
                        />

                        {/* Schedule */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-surface-border)]">
                            <DatePicker
                                label="Schedule Date"
                                value={scheduledDate}
                                onChange={setScheduledDate}
                            />
                            <TimePicker // Assuming TimePicker uses string value
                                label="Time"
                                value={scheduledTime}
                                onChange={setScheduledTime}
                            />
                        </div>

                    </div>

                    <footer className="px-8 py-5 border-t border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-card)]">
                        <div className="text-xs text-[var(--color-text-muted)]">
                            {scheduledDate ? 'Will be scheduled' : 'Will save as draft'}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                            <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
                                {postId ? 'Save Changes' : 'Create Post'}
                            </Button>
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

                    <div className="relative z-10 w-full flex justify-center transform scale-100 hover:scale-[1.01] transition-transform duration-500">
                        <PostPreview />
                    </div>
                </div>

            </div>

            <AICaptionGenerator
                isOpen={showAIGenerator}
                onClose={() => setShowAIGenerator(false)}
                onGenerate={(text) => setCaption(prev => prev + (prev ? '\n\n' : '') + text)}
            />

            <AssetPickerModal
                isOpen={showAssetPicker}
                onClose={() => setShowAssetPicker(false)}
                onSelect={(asset) => setAssets(prev => [...prev, asset])}
            />
        </div>
    );
};
