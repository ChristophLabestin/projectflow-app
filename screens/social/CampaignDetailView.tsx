import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeCampaigns, subscribeSocialPosts, deleteSocialPost, createSocialPost, getProjectById, updateSocialPost } from '../../services/dataService';
import { SocialCampaign, SocialPost, Project } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useConfirm, useToast } from '../../context/UIContext';
import { differenceInDays } from 'date-fns';
import { generateCampaignContentPlan, SocialPostDraft } from '../../services/geminiService';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

// Draggable Wrapper
const DraggablePostCard = ({ post, children }: { post: SocialPost; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: post.id,
        data: { post }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
            {children}
        </div>
    );
};

// Droppable Column Wrapper
const DroppableColumn = ({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'bg-[var(--color-surface-hover)]/30 rounded-xl transition-colors' : ''}`}>
            {children}
        </div>
    );
};

export const CampaignDetailView = () => {
    const { id: projectId, campaignId } = useParams<{ id: string; campaignId: string }>();
    const navigate = useNavigate();

    const [campaign, setCampaign] = useState<SocialCampaign | null>(null);
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'content'>('overview');
    const [generating, setGenerating] = useState(false);
    const [generatedPlan, setGeneratedPlan] = useState<SocialPostDraft[]>([]);
    const [showPlanModal, setShowPlanModal] = useState(false);

    // DnD State
    const [activeDragItem, setActiveDragItem] = useState<SocialPost | null>(null);

    // Config Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [configFocus, setConfigFocus] = useState('');
    const [configPlatforms, setConfigPlatforms] = useState<string[]>([]);

    const confirm = useConfirm();
    const { showSuccess, showError } = useToast();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        if (campaign?.platforms) {
            setConfigPlatforms(campaign.platforms);
        }
    }, [campaign]);

    useEffect(() => {
        if (!projectId || !campaignId) return;

        const unsubCampaigns = subscribeCampaigns(projectId, (allCampaigns) => {
            const found = allCampaigns.find(c => c.id === campaignId);
            setCampaign(found || null);
        });

        const unsubPosts = subscribeSocialPosts(projectId, (allPosts) => {
            const linked = allPosts.filter(p => p.campaignId === campaignId);
            setPosts(linked);
            setLoading(false);
        });

        return () => {
            unsubCampaigns();
            unsubPosts();
        };
    }, [projectId, campaignId]);

    const handleOpenConfig = () => {
        if (!campaign) return;
        setShowConfigModal(true);
    };

    const handleGeneratePlan = async () => {
        if (!campaign || !projectId) return;
        setGenerating(true);
        setShowConfigModal(false); // Close config
        try {
            const project = await getProjectById(projectId);
            if (!project) throw new Error("Project not found");

            const existingContent = posts.map(p => p.videoConcept?.title || p.content.caption || '').filter(Boolean);

            const plan = await generateCampaignContentPlan(
                campaign,
                { title: project.title, description: project.description },
                existingContent,
                {
                    focus: configFocus,
                    platforms: configPlatforms
                }
            );

            setGeneratedPlan(plan);
            setShowPlanModal(true);
        } catch (error) {
            console.error("Failed to generate plan", error);
            showError("Failed to generate content plan");
        } finally {
            setGenerating(false);
        }
    };

    const handleSavePlan = async () => {
        if (!projectId || !campaignId) return;
        try {
            const validPlatforms = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];
            const validFormats = ['Image', 'Video', 'Carousel', 'Story', 'Reel', 'Short'];

            const promises = generatedPlan.map(draft => {
                const scheduledDate = new Date();
                scheduledDate.setDate(scheduledDate.getDate() + draft.scheduledDayOffset + 1); // Start tomorrow

                // 1. Sanitize Platform
                const platformCandidate = validPlatforms.find(p => p.toLowerCase() === draft.platform.toLowerCase());
                const platform = (platformCandidate || 'Instagram') as any;

                // 2. Sanitize Format
                const formatCandidate = validFormats.find(f => f.toLowerCase() === draft.type.toLowerCase());
                const format = (formatCandidate || 'Image') as any;

                // 3. Construct Payload (avoid undefined)
                const isVideo = ['Video', 'Reel', 'Short'].includes(format);

                const postPayload: any = {
                    projectId,
                    campaignId,
                    platform,
                    format,
                    status: 'Draft',
                    content: {
                        caption: draft.content || '',
                        hashtags: draft.hashtags || [],
                        originIdeaId: campaign.originIdeaId
                    },
                    assets: [],
                    scheduledFor: scheduledDate.toISOString(),
                    createdBy: 'AI',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                if (isVideo) {
                    postPayload.videoConcept = {
                        title: (draft.content || 'Video Concept').slice(0, 50) + '...',
                        scriptOutline: `Visual: ${draft.imagePrompt || 'No prompt'}\nCaption: ${draft.content}`,
                        thumbnailIdea: draft.imagePrompt || ''
                    };
                }

                return createSocialPost(projectId, postPayload);
            });

            await Promise.all(promises);
            showSuccess(`Saved ${generatedPlan.length} posts to drafts`);
            setShowPlanModal(false);
            setGeneratedPlan([]);
            setActiveTab('content');
        } catch (error) {
            console.error("Failed to save plan", error);
            showError("Failed to save posts");
        }
    };

    const handleCreatePost = () => {
        navigate(`/project/${projectId}/social/create?campaignId=${campaignId}`);
    };

    const handleEditPost = (post: SocialPost) => {
        navigate(`/project/${projectId}/social/edit/${post.id}?campaignId=${campaignId}`);
    };

    const handleDeletePost = async (post: SocialPost, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!projectId) return;
        const confirmed = await confirm(
            'Delete Post?',
            `Are you sure you want to delete "${post.videoConcept?.title || post.content?.caption?.slice(0, 30) || 'this post'}" ? `
        );
        if (confirmed) {
            try {
                await deleteSocialPost(projectId, post.id);
                showSuccess("Post deleted");
            } catch {
                showError("Failed to delete post");
            }
        }
    };

    // DnD Handler
    const handleDragStart = (event: any) => {
        setActiveDragItem(event.active.data.current?.post || null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

        const postId = active.id as string;
        const newStatus = over.id as string;
        const post = posts.find(p => p.id === postId);

        if (!post || post.status === newStatus) return;
        if (newStatus === 'Concepts') return;

        // Optimistic Update
        const originalPosts = [...posts];
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return { ...p, status: newStatus as any, isConcept: false };
            }
            return p;
        }));

        try {
            await updateSocialPost(projectId!, postId, {
                status: newStatus as any,
                isConcept: false
                // Note: If dragging to Scheduled, ideally we'd prompt for date, but for now we'll default or keep existing
            });
            showSuccess(`Moved to ${newStatus}`);
        } catch (error) {
            console.error("Failed to move post", error);
            showError("Failed to update post status");
            setPosts(originalPosts);
        }
    };

    const renderPostCard = (post: SocialPost, className: string = '') => {
        const isVideo = ['Video', 'Reel', 'Short', 'Story'].includes(post.format);
        const hasMedia = !!(post.videoConcept?.thumbnailUrl || post.assets?.[0]?.url);
        const mediaUrl = post.videoConcept?.thumbnailUrl || post.assets?.[0]?.url;

        // Platform Color Logic
        const getPlatformColor = (p: string) => {
            switch (p) {
                case 'Instagram': return 'border-l-pink-500';
                case 'LinkedIn': return 'border-l-blue-600';
                case 'YouTube': return 'border-l-red-600';
                case 'TikTok': return 'border-l-black dark:border-l-white';
                default: return 'border-l-gray-400';
            }
        };

        const getPlatformBadgeStyle = (p: string) => {
            switch (p) {
                case 'Instagram': return 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400';
                case 'LinkedIn': return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
                case 'YouTube': return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
                case 'TikTok': return 'bg-gray-100 text-black dark:bg-gray-800 dark:text-white';
                default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
            }
        };

        return (
            <div
                key={post.id}
                onClick={() => handleEditPost(post)}
                className={`group flex bg-[var(--color-surface-card)] rounded-xl border-y border-r border-[var(--color-surface-border)] ${getPlatformColor(post.platform)} border-l-[4px] hover:shadow-md hover:-translate-x-0.5 transition-all duration-200 cursor-pointer overflow-hidden h-28 ${className}`}
            >
                {/* Left: Media Thumbnail (Fixed) */}
                <div className="w-28 h-full relative bg-[var(--color-surface-bg)] shrink-0 border-r border-[var(--color-surface-border)]">
                    {hasMedia ? (
                        <>
                            <img
                                src={mediaUrl}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                alt="Post visual"
                                loading="lazy"
                            />
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--color-surface-hover)] to-[var(--color-surface-card)] text-center">
                            <span className="material-symbols-outlined text-2xl text-[var(--color-text-muted)] opacity-30">
                                {isVideo ? 'movie' : 'image'}
                            </span>
                        </div>
                    )}

                    {/* Left Center Play Button */}
                    {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-lg drop-shadow-md ml-0.5">play_arrow</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Info */}
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    {/* Top Row: Title + Platform */}
                    <div className="flex justify-between items-start gap-2">
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] truncate leading-tight flex-1 mt-0.5">
                            {post.videoConcept?.title || post.content.caption || 'Untitled Post'}
                        </h3>
                        <span className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getPlatformBadgeStyle(post.platform)}`} title={post.platform}>
                            {post.platform === 'Instagram' && <i className="fab fa-instagram text-[10px]" />} {/* Assuming fontawesome or similar, or just distinct styling */}
                            {/* Since we don't have FA, we'll use the dots or just text */}
                            {post.platform}
                        </span>
                    </div>

                    {/* Middle: Snippet (Hidden on very small height, shown here) */}
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate opacity-80">
                        {post.videoConcept?.scriptOutline || post.content.caption || 'No description'}
                    </p>

                    {/* Bottom Row: Status + Actions */}
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                            {post.status === 'Published' && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-bold">LIVE</span>}
                            {post.status === 'Scheduled' && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-bold">{post.scheduledFor ? new Date(post.scheduledFor).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : 'SCH'}</span>}
                            {post.isConcept && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] font-bold">CONCEPT</span>}
                            {(!post.isConcept && post.status === 'Draft') && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-bold">DRAFT</span>}
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => handleDeletePost(post, e)}
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <span className="material-symbols-outlined animate-spin text-3xl text-[var(--color-primary)]">progress_activity</span>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-muted)]">
                <span className="material-symbols-outlined text-4xl mb-2">campaign</span>
                <p>Campaign not found.</p>
                <Button variant="ghost" className="mt-4" onClick={() => navigate('../campaigns')}>Back to Campaigns</Button>
            </div>
        );
    }

    // Derived Metrics
    const concepts = posts.filter(p => p.isConcept);
    const published = posts.filter(p => p.status === 'Published');
    const scheduled = posts.filter(p => p.status === 'Scheduled');
    const drafts = posts.filter(p => !p.isConcept && p.status !== 'Published' && p.status !== 'Scheduled');

    const totalDays = campaign.startDate && campaign.endDate ? differenceInDays(new Date(campaign.endDate), new Date(campaign.startDate)) : 0;
    const daysElapsed = campaign.startDate ? differenceInDays(new Date(), new Date(campaign.startDate)) : 0;
    const progress = totalDays > 0 ? Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100)) : 0;

    const brandColor = campaign.color || '#E1306C';

    return (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col -m-6 relative overflow-hidden bg-[var(--color-bg-base)]">

                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* Hero Banner Area */}
                    <div className="relative pb-8">
                        {/* Background Gradient */}
                        <div className="absolute inset-0 h-80 overflow-hidden pointer-events-none">
                            <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-surface-card)] to-[var(--color-bg-base)]" />
                            <div className="absolute top-0 left-0 right-0 h-64 opacity-10 blur-3xl" style={{ backgroundColor: brandColor }} />
                        </div>

                        <div className="relative z-10 px-8 pt-8">
                            {/* Nav Back */}
                            <button
                                onClick={() => navigate('../campaigns')}
                                className="text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] flex items-center gap-1 mb-6 transition-colors bg-white/50 dark:bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full w-fit"
                            >
                                <span className="material-symbols-outlined text-base">arrow_back</span>
                                Back to Campaigns
                            </button>

                            {/* Title & Actions */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md bg-white/60 dark:bg-black/30 border border-white/20 shadow-sm" style={{ color: brandColor }}>
                                            {campaign.status}
                                        </div>
                                        {campaign.tags?.map(tag => (
                                            <span key={tag} className="text-xs text-[var(--color-text-muted)] font-medium">#{tag}</span>
                                        ))}
                                    </div>
                                    <h1 className="text-4xl md:text-5xl font-black text-[var(--color-text-main)] tracking-tight mb-2 drop-shadow-sm">
                                        {campaign.name}
                                    </h1>
                                    <div className="flex items-center gap-4 text-sm font-medium text-[var(--color-text-muted)]">
                                        <div className="flex items-center gap-1.5 bg-white/40 dark:bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                                            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                                            <span>
                                                {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD'}
                                                {' — '}
                                                {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                                            </span>
                                        </div>
                                        <div className="h-4 w-px bg-[var(--color-text-muted)]/20" />
                                        <span>{posts.length} Items</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="secondary"
                                        onClick={() => navigate(`/project/${projectId}/social/campaigns/edit/${campaignId}`)}
                                        icon={<span className="material-symbols-outlined text-[18px]">edit</span>}
                                    >
                                        Edit Campaign
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={handleCreatePost}
                                        icon={<span className="material-symbols-outlined">add</span>}
                                        style={{ backgroundColor: brandColor, borderColor: brandColor }}
                                        className="text-white shadow-lg shadow-current/20"
                                    >
                                        Add Content
                                    </Button>
                                </div>
                            </div>

                            {/* Tabs & AI Action */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[var(--color-surface-border)] gap-4">
                                <div className="flex items-center gap-8 relative">
                                    <button
                                        onClick={() => setActiveTab('overview')}
                                        className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'overview' ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'} `}
                                    >
                                        Strategy & Overview
                                        {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: brandColor }} />}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('content')}
                                        className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'content' ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'} `}
                                    >
                                        Content Board
                                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[10px]">{posts.length}</span>
                                        {activeTab === 'content' && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full" style={{ backgroundColor: brandColor }} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 pb-12">
                        {activeTab === 'overview' ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                                {/* Left: Main Description */}
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-6 shadow-sm">
                                        <h2 className="text-xl font-bold text-[var(--color-text-main)] mb-6 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[var(--color-text-muted)]">description</span>
                                            Campaign Strategy
                                        </h2>

                                        {campaign.description ? (
                                            <div
                                                className="prose prose-sm max-w-none text-[var(--color-text-main)] prose-headings:text-[var(--color-text-main)] prose-strong:text-[var(--color-text-main)] prose-p:text-[var(--color-text-main)] prose-ul:text-[var(--color-text-main)] prose-li:text-[var(--color-text-main)] [&_ol]:text-[var(--color-text-main)]"
                                                dangerouslySetInnerHTML={{
                                                    __html: (() => {
                                                        const text = campaign.description;
                                                        if (text.trim().match(/^<[a-z][\s\S]*>/i)) {
                                                            return text;
                                                        }
                                                        return text
                                                            .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold mt-3 mb-1">$1</h3>')
                                                            .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold mt-4 mb-2">$1</h2>')
                                                            .replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold mt-6 mb-3">$1</h1>')
                                                            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                                                            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                                                            .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
                                                            .replace(/\n/gim, '<br />');
                                                    })()
                                                }}
                                            />
                                        ) : (
                                            <p className="text-[var(--color-text-muted)] italic">No strategy description provided.</p>
                                        )}
                                    </div>


                                    {/* Concepts Preview */}
                                    {concepts.length > 0 && (
                                        <div onClick={() => setActiveTab('content')} className="cursor-pointer group">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold text-[var(--color-text-main)]">Video Concepts</h3>
                                                <span className="text-sm text-[var(--color-primary)] group-hover:underline">View All</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {concepts.slice(0, 2).map(c => (
                                                    <div key={c.id} className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-4 hover:border-[var(--color-primary)] transition-colors">
                                                        <div className="font-bold text-sm mb-1">{c.videoConcept?.title}</div>
                                                        <div className="text-xs text-[var(--color-text-muted)] line-clamp-2">{c.videoConcept?.scriptOutline}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Specs & Stats */}
                                <div className="space-y-6">
                                    {/* Key Stats Card */}
                                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-6 shadow-sm">
                                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">At a Glance</h3>

                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1.5">
                                                    <span className="text-[var(--color-text-muted)]">Timeline Progress</span>
                                                    <span className="font-bold">{Math.round(progress)}%</span>
                                                </div>
                                                <div className="h-2 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}% `, backgroundColor: brandColor }} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div className="p-3 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-center">
                                                    <div className="text-2xl font-black text-[var(--color-text-main)]" style={{ color: brandColor }}>{posts.length}</div>
                                                    <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Total Posts</div>
                                                </div>
                                                <div className="p-3 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] text-center">
                                                    <div className="text-2xl font-black text-[var(--color-text-main)]">{published.length}</div>
                                                    <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Published</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Target Audience */}
                                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-6 shadow-sm">
                                        <div className="flex items-center gap-2 mb-3 text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-[18px]">group</span>
                                            <span className="text-xs font-bold uppercase tracking-wider">Target Audience</span>
                                        </div>
                                        <p className="text-sm font-medium text-[var(--color-text-main)] leading-relaxed">
                                            {campaign.targetAudience || 'Not defined'}
                                        </p>
                                    </div>

                                    {/* Goal & Tone */}
                                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-surface-border)] p-6 shadow-sm space-y-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-[var(--color-text-muted)]">
                                                <span className="material-symbols-outlined text-[18px]">flag</span>
                                                <span className="text-xs font-bold uppercase tracking-wider">Primary Goal</span>
                                            </div>
                                            <p className="text-sm font-bold text-[var(--color-text-main)]">{campaign.goal || 'Not defined'}</p>
                                        </div>
                                        <div className="h-px bg-[var(--color-surface-border)]" />
                                        <div>
                                            <div className="flex items-center gap-2 mb-2 text-[var(--color-text-muted)]">
                                                <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
                                                <span className="text-xs font-bold uppercase tracking-wider">Tone of Voice</span>
                                            </div>
                                            <p className="text-sm font-markit text-[var(--color-text-main)]">{campaign.toneOfVoice || 'Not defined'}</p>
                                        </div>
                                    </div>

                                    {/* Platforms */}
                                    <div>
                                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Platforms</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {campaign.platforms?.map(p => (
                                                <span key={p} className="px-3 py-1.5 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-lg text-xs font-bold text-[var(--color-text-main)] shadow-sm flex items-center gap-1.5">
                                                    {p === 'Instagram' && <span className="w-2 h-2 rounded-full bg-pink-500" />}
                                                    {p === 'LinkedIn' && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                                                    {p === 'YouTube' && <span className="w-2 h-2 rounded-full bg-red-600" />}
                                                    {p === 'TikTok' && <span className="w-2 h-2 rounded-full bg-black dark:bg-white" />}
                                                    {p}
                                                </span>
                                            ))}
                                            {!campaign.platforms?.length && <span className="text-xs text-[var(--color-text-muted)]">No platforms selected</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-in flex flex-col h-full">

                                {/* Layout: Concept Row (Top) + Pipeline Columns (Bottom) */}

                                {/* 1. Concepts Row */}
                                <div className="mb-10 animate-fade-in">
                                    <div className="flex items-center gap-3 mb-4 px-1">
                                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                                            <span className="material-symbols-outlined text-[20px]">lightbulb</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">Concepts</h3>
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-muted)]">
                                            {concepts.length}
                                        </span>
                                        <div className="flex-1" />
                                        <Button
                                            variant="secondary"
                                            onClick={handleOpenConfig}
                                            isLoading={generating}
                                            icon={<span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                                            className="h-8 text-xs bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-700 border-violet-200 hover:from-violet-100 hover:to-fuchsia-100 whitespace-nowrap"
                                        >
                                            Generate Plan
                                        </Button>
                                    </div>

                                    {concepts.length > 0 ? (
                                        <div className="flex overflow-x-auto gap-4 py-2 px-1 -mx-1 custom-scrollbar pb-6">
                                            {concepts.map(post => renderPostCard(post, 'w-[280px] shrink-0'))}
                                        </div>
                                    ) : (
                                        <div className="h-32 border border-dashed border-[var(--color-surface-border)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-surface-card)]/50">
                                            <span className="material-symbols-outlined text-3xl opacity-20 mb-2">lightbulb</span>
                                            <p className="text-sm font-medium opacity-60">No concepts yet</p>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Pipeline Columns */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full pb-12 animate-fade-in delay-75">
                                    {/* Drafting Column */}
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center justify-between mb-4 px-1 sticky top-0 md:static z-20">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[var(--color-text-muted)] text-[20px]">edit_note</span>
                                                <h3 className="font-bold text-base text-[var(--color-text-main)]">Drafting</h3>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-muted)]">
                                                {drafts.length}
                                            </span>
                                        </div>
                                        <DroppableColumn id="Draft" className="flex-1 space-y-4 min-h-[200px]">
                                            {drafts.map(post => (
                                                <DraggablePostCard key={post.id} post={post}>
                                                    {renderPostCard(post, 'w-full')}
                                                </DraggablePostCard>
                                            ))}
                                            {drafts.length === 0 && (
                                                <div className="h-32 border border-dashed border-[var(--color-surface-border)] rounded-xl flex items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-surface-card)]/50">
                                                    <span className="text-xs opacity-60">Drop here to Draft</span>
                                                </div>
                                            )}
                                        </DroppableColumn>
                                    </div>

                                    {/* Scheduled Column */}
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center justify-between mb-4 px-1 sticky top-0 md:static z-20">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-amber-500 text-[20px]">event</span>
                                                <h3 className="font-bold text-base text-[var(--color-text-main)]">Scheduled</h3>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-muted)]">
                                                {scheduled.length}
                                            </span>
                                        </div>
                                        <DroppableColumn id="Scheduled" className="flex-1 space-y-4 min-h-[200px]">
                                            {scheduled.map(post => (
                                                <DraggablePostCard key={post.id} post={post}>
                                                    {renderPostCard(post, 'w-full')}
                                                </DraggablePostCard>
                                            ))}
                                            {scheduled.length === 0 && (
                                                <div className="h-32 border border-dashed border-[var(--color-surface-border)] rounded-xl flex items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-surface-card)]/50">
                                                    <span className="text-xs opacity-60">No scheduled posts</span>
                                                </div>
                                            )}
                                        </DroppableColumn>
                                    </div>

                                    {/* Published Column */}
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center justify-between mb-4 px-1 sticky top-0 md:static z-20">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-green-500 text-[20px]">rocket_launch</span>
                                                <h3 className="font-bold text-base text-[var(--color-text-main)]">Published</h3>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-muted)]">
                                                {published.length}
                                            </span>
                                        </div>
                                        <DroppableColumn id="Published" className="flex-1 space-y-4 min-h-[200px]">
                                            {published.map(post => (
                                                <DraggablePostCard key={post.id} post={post}>
                                                    {renderPostCard(post, 'w-full')}
                                                </DraggablePostCard>
                                            ))}
                                            {published.length === 0 && (
                                                <div className="h-32 border border-dashed border-[var(--color-surface-border)] rounded-xl flex items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-surface-card)]/50">
                                                    <span className="text-xs opacity-60">No published posts</span>
                                                </div>
                                            )}
                                        </DroppableColumn>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Plan Config Modal */}
                <Modal
                    isOpen={showConfigModal}
                    onClose={() => setShowConfigModal(false)}
                    title="Generate Content Plan"
                    size="lg"
                >
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2">Focus / Theme (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-[var(--color-bg-base)] border border-[var(--color-surface-border)] rounded-lg px-4 py-2 text-sm text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                placeholder="e.g. Product Launch, Customer Stories, Flash Sale..."
                                value={configFocus}
                                onChange={(e) => setConfigFocus(e.target.value)}
                            />
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Guide the AI on what this week's content should focus on.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-[var(--color-text-main)] mb-2">Target Platforms</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'].map(platform => (
                                    <label key={platform} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${configPlatforms.includes(platform) ? 'bg-[var(--color-surface-hover)] border-[var(--color-primary)]' : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)]'}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={configPlatforms.includes(platform)}
                                            onChange={() => {
                                                if (configPlatforms.includes(platform)) {
                                                    setConfigPlatforms(prev => prev.filter(p => p !== platform));
                                                } else {
                                                    setConfigPlatforms(prev => [...prev, platform]);
                                                }
                                            }}
                                        />
                                        <span className="material-symbols-outlined text-[var(--color-text-muted)] text-[18px]">{configPlatforms.includes(platform) ? 'check_circle' : 'circle'}</span>
                                        <span className={`text-sm font-medium ${configPlatforms.includes(platform) ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>{platform}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-surface-border)]">
                            <Button variant="ghost" onClick={() => setShowConfigModal(false)}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleGeneratePlan}
                                disabled={configPlatforms.length === 0}
                                icon={<span className="material-symbols-outlined">auto_awesome</span>}
                            >
                                Start Generating
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Plan Review Modal */}
                <Modal
                    isOpen={showPlanModal}
                    onClose={() => setShowPlanModal(false)}
                    title="AI Suggested Content Plan"
                    size="4xl"
                >
                    <div className="space-y-6">
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Here is a 7-day content plan generated for your campaign. Review the drafts below and click save to add them to your board.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                            {generatedPlan.map((draft, i) => (
                                <div key={i} className="bg-[var(--color-surface-bg)] rounded-xl p-4 border border-[var(--color-surface-border)]">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-surface-hover)] px-2 py-1 rounded">Day {draft.scheduledDayOffset + 1}</span>
                                        <span className="text-xs font-bold text-[var(--color-text-muted)]">{draft.platform} • {draft.type}</span>
                                    </div>
                                    <p className="text-sm text-[var(--color-text-main)] mb-3 line-clamp-4">{draft.content}</p>
                                    <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-card)] p-2 rounded mb-2">
                                        <strong className="text-[var(--color-text-main)]">Visual Idea:</strong> {draft.imagePrompt || 'No specific visual'}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {draft.hashtags.map(tag => (
                                            <span key={tag} className="text-[10px] text-blue-500">#{tag.replace('#', '')}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-surface-border)]">
                            <Button variant="ghost" onClick={() => setShowPlanModal(false)}>Discard</Button>
                            <Button variant="primary" onClick={handleSavePlan} icon={<span className="material-symbols-outlined">save</span>}>
                                Save All to Drafts
                            </Button>
                        </div>
                    </div>
                </Modal>

                <DragOverlay>
                    {activeDragItem ? renderPostCard(activeDragItem, 'w-[300px] shadow-2xl opacity-90 rotate-2 cursor-grabbing') : null}
                </DragOverlay>
            </div >
        </DndContext>
    );
};
