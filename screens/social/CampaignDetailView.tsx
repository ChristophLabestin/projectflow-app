import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeCampaigns, subscribeSocialPosts, deleteSocialPost, createSocialPost, getProjectById, updateSocialPost, updateCampaign, getIdeaById, updateIdea } from '../../services/dataService';
import { SocialCampaign, SocialPost, Project, Idea } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useConfirm, useToast } from '../../context/UIContext';
import { generateCampaignContentPlan, SocialPostDraft } from '../../services/geminiService';
import { format } from 'date-fns';
import { dateLocale, dateFormat } from '../../utils/activityHelpers';
import { CampaignStrategyView } from './tabs/CampaignStrategyView';
import { CampaignKanbanView } from './tabs/CampaignKanbanView';
import { CampaignCalendarView } from './tabs/CampaignCalendarView';
import { CampaignDashboardView } from './tabs/CampaignDashboardView';
import { CampaignHeader } from './components/CampaignHeader';
import { SocialCampaignReviewView } from '../../components/flows/stages/SocialCampaignReviewView';
import { PlannedPostsSelectModal } from './components/PlannedPostsSelectModal';

export const CampaignDetailView = () => {
    const { id: projectId, campaignId } = useParams<{ id: string; campaignId: string }>();
    const navigate = useNavigate();

    const [campaign, setCampaign] = useState<SocialCampaign | null>(null);
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [conceptIdea, setConceptIdea] = useState<Idea | null>(null);
    const [allProjectPosts, setAllProjectPosts] = useState<SocialPost[]>([]); // Store all posts for context
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'strategy' | 'board' | 'calendar'>('dashboard');
    const [generating, setGenerating] = useState(false);
    const [generatedPlan, setGeneratedPlan] = useState<SocialPostDraft[]>([]);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showPlannedContentModal, setShowPlannedContentModal] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);

    // Config Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [configFocus, setConfigFocus] = useState('');
    const [configPlatforms, setConfigPlatforms] = useState<string[]>([]);

    // Derived metrics for UI pill
    const publishedCount = posts.filter(p => p.status === 'Published').length;

    const confirm = useConfirm();
    const { showSuccess, showError } = useToast();

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
            setAllProjectPosts(allPosts);
            const linked = allPosts.filter(p => p.campaignId === campaignId);
            setPosts(linked);
            setLoading(false);
        });

        return () => {
            unsubCampaigns();
            unsubPosts();
        };
    }, [projectId, campaignId]);

    // Fetch original idea if this is a concept
    useEffect(() => {
        const fetchIdea = async () => {
            if (campaign?.status === 'Concept' && campaign.originIdeaId && projectId) {
                const idea = await getIdeaById(campaign.originIdeaId, projectId);
                setConceptIdea(idea);
            }
        };
        fetchIdea();
    }, [campaign?.status, campaign?.originIdeaId, projectId]);

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

                // 1. Sanitize Platforms to array
                const draftPlatforms = draft.platforms || [draft.platform];
                const validPlatformsList = validPlatforms.map(p => p.toLowerCase());

                // Filter valid platforms
                const platforms = draftPlatforms
                    .filter(p => validPlatformsList.includes(p.toLowerCase()))
                    .map(p => validPlatforms.find(vp => vp.toLowerCase() === p.toLowerCase()) as any);

                // Default to Instagram if empty
                if (platforms.length === 0) platforms.push('Instagram');

                // Primary platform for compatibility
                const platform = platforms[0];

                // 2. Sanitize Format
                const formatCandidate = validFormats.find(f => f.toLowerCase() === draft.type.toLowerCase());
                const format = (formatCandidate || 'Image') as any;

                // 3. Construct Payload (avoid undefined)
                const isVideo = ['Video', 'Reel', 'Short'].includes(format);

                const postPayload: any = {
                    projectId,
                    campaignId,
                    platform,
                    platforms,
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
                    updatedAt: new Date(),
                    isConcept: true
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
            setActiveTab('board');
        } catch (error) {
            console.error("Failed to save plan", error);
            showError("Failed to save posts");
        }
    };

    const handleCreatePost = () => {
        navigate(`/project/${projectId}/social/create?campaignId=${campaignId}`);
    };

    const handleViewPlannedContent = () => {
        setShowPlannedContentModal(true);
    };

    const handleDebugSyncPlan = async () => {
        if (!campaign || !projectId || !campaign.originIdeaId) {
            showError("No linked flow found");
            return;
        }

        try {
            const idea = await getIdeaById(campaign.originIdeaId, projectId);
            if (!idea || !idea.concept) {
                showError("Flow has no concept data");
                return;
            }

            const conceptData = JSON.parse(idea.concept);
            if (!conceptData.planningPosts || !Array.isArray(conceptData.planningPosts)) {
                showError("No planned posts found in concept");
                return;
            }

            await updateCampaign(projectId, campaign.id, {
                plannedContent: conceptData.planningPosts
            });

            showSuccess(`Synced ${conceptData.planningPosts.length} planned items`);
            // The subscription will auto-update the UI
        } catch (error) {
            console.error(error);
            showError("Failed to sync plan");
        }
    };

    const handleSelectPlannedPost = async (post: any) => {
        if (!projectId || !campaignId) return;

        const confirmed = await confirm(
            'Create this planned post?',
            `Do you want to create a new post draft based on "${post.hook || post.visualDirection || 'this planned item'}"?`
        );

        if (confirmed) {
            setShowPlannedContentModal(false);

            // Determine Platform and Format
            let platformParam = post.platform;
            let formatParam = post.contentType || post.format || 'Post'; // Default

            // Handle array of platforms (take first)
            if (Array.isArray(post.platforms) && post.platforms.length > 0) {
                platformParam = post.platforms[0];
            } else if (!platformParam && Array.isArray(post.channel) && post.channel.length > 0) {
                // Fallback if 'channel' property is used
                platformParam = post.channel[0];
            }

            // Normalizing YouTube logic
            if (typeof platformParam === 'string' && platformParam.toLowerCase().includes('youtube')) {
                platformParam = 'YouTube';

                // If content type explicitly says Short or Video, respect it.
                // Otherwise default to Video if not specified.
                if (formatParam !== 'Short' && formatParam !== 'Video') {
                    formatParam = 'Video';
                }
            }

            // Construct Query Params
            const params = new URLSearchParams();
            params.set('campaignId', campaignId);
            if (platformParam) params.set('platform', platformParam);
            if (formatParam) params.set('format', formatParam);

            // Prefill content
            // We use 'caption' for normal posts, or 'title' for video/youtube if available
            // but CreateSocialPost usually looks for caption or title in its state init logic?
            // Wait, CreateSocialPost reads: defaultDate, preselectedCampaignId.
            // It DOES NOT read 'caption', 'platform', 'format' from URL params currently in the useEffect.
            // WE NEED TO UPDATE CreateSocialPost TO READ THESE PARAMS.
            // For now, let's pass them and I will accept the Task 7 to update CreateSocialPost.

            if (post.hook) params.set('caption', post.hook);
            // If visual direction exists, maybe append to caption or separate param?
            // Let's passed it as visualDirection for context if needed, though CreateSocialPost might not use it yet.
            if (post.visualDirection) params.set('visualDirection', post.visualDirection);

            navigate(`/project/${projectId}/social/create?${params.toString()}`);
        }
    };

    const handleEditPost = (post: SocialPost) => {
        navigate(`/project/${projectId}/social/edit/${post.id}?campaignId=${campaignId}`);
    };

    const handleSchedulePost = async (postId: string, date: Date | null) => {
        if (!projectId || !campaignId) return;

        // Optimistic Update
        const originalPosts = [...posts];
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                if (date) {
                    // Schedule
                    return { ...p, status: 'Scheduled', scheduledFor: date.toISOString(), isConcept: false };
                } else {
                    // Unschedule -> Back to Draft
                    return { ...p, status: 'Draft', scheduledFor: undefined, isConcept: false };
                }
            }
            return p;
        }));

        try {
            await updateSocialPost(projectId, postId, {
                status: date ? 'Scheduled' : 'Draft',
                scheduledFor: date ? date.toISOString() : '', // Assuming empty string clears it in DB adapt
                isConcept: false
            });
            showSuccess(date ? `Scheduled for ${format(date, dateFormat, { locale: dateLocale })}` : 'Unscheduled');
        } catch (error) {
            console.error("Failed to schedule post", error);
            showError("Failed to update schedule");
            setPosts(originalPosts);
        }
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

    // Central Update Logic
    const handleUpdateStatus = async (postId: string, newStatus: string) => {
        if (!projectId || !campaignId) return;

        // Optimistic Update
        const originalPosts = [...posts];
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                // If moving to Ideas, make it a concept
                if (newStatus === 'Ideas') {
                    return { ...p, status: 'Draft' as any, isConcept: true };
                }
                return { ...p, status: newStatus as any, isConcept: false };
            }
            return p;
        }));

        try {
            await updateSocialPost(projectId, postId, {
                status: newStatus === 'Ideas' ? 'Draft' as any : newStatus as any,
                isConcept: newStatus === 'Ideas'
            });
            showSuccess(`Moved to ${newStatus}`);
        } catch (error) {
            console.error("Failed to move post", error);
            showError("Failed to update post status");
            setPosts(originalPosts);
        }
    };

    const handleSplitPost = async (originalPost: SocialPost, newPostsData: Partial<SocialPost>[]) => {
        if (!campaign || !projectId) return;
        try {
            // 1. Create the new drafts
            for (const data of newPostsData) {
                await createSocialPost(projectId, {
                    ...data,
                    campaignId: campaign.id,
                    status: 'Draft',
                    originPostId: originalPost.id // Track lineage
                } as Omit<SocialPost, 'id'>);
            }

            // 2. Handle the original concept
            // Determine which platforms were "consumed"
            const consumedPlatforms = newPostsData.map(p => p.platform);
            const originalPlatforms = originalPost.platforms || [originalPost.platform];

            // Calculate remaining platforms
            const remainingPlatforms = originalPlatforms.filter(p => !consumedPlatforms.includes(p));

            if (remainingPlatforms.length > 0) {
                // Partial Split: Update original idea to only show remaining platforms
                await updateSocialPost(projectId, originalPost.id, {
                    platforms: remainingPlatforms,
                    // If the main 'platform' field was one of the consumed ones, update it to the first remaining one
                    ...(consumedPlatforms.includes(originalPost.platform) ? { platform: remainingPlatforms[0] } : {})
                });
            } else {
                // Full Split: Archive the original idea instead of deleting
                await updateSocialPost(projectId, originalPost.id, {
                    status: 'Archived' as SocialPostStatus
                });
            }
            showSuccess(`Created ${newPostsData.length} drafts from concept`);
        } catch (error) {
            console.error("Failed to split post", error);
            showError("Failed to create drafts");
        }
    };

    const handleReviewAction = async (post: SocialPost, action: 'approve' | 'reject', reason?: string) => {
        if (!projectId) return;
        try {
            if (action === 'approve') {
                await updateSocialPost(projectId, post.id, {
                    ...post,
                    status: post.scheduledFor ? 'Scheduled' : 'Draft',
                    rejectionReason: null as any,
                    approvals: [{
                        required: true,
                        status: 'Approved',
                        approvedBy: 'User',
                        approvedAt: new Date(),
                    }]
                });
                showSuccess("Post approved!");
            } else {
                await updateSocialPost(projectId, post.id, {
                    ...post,
                    status: 'Draft',
                    rejectionReason: reason,
                    approvals: [{
                        required: true,
                        status: 'Rejected',
                        approvedBy: 'User',
                        approvedAt: new Date()
                    }]
                });
                showSuccess("Post rejected and moved to Drafts");
            }
        } catch (e) {
            console.error(e);
            showError("Failed to update post status");
        }
    };

    const handleRevertDraft = async (draftPost: SocialPost) => {
        if (!projectId) return;
        try {
            // 1. Try to find the original concept
            if (draftPost.originPostId) {
                const originalPost = posts.find(p => p.id === draftPost.originPostId);

                if (originalPost) {
                    // Scenario A: Original concept exists (Active or Archived)
                    const currentPlatforms = originalPost.platforms || [originalPost.platform];

                    // Add this platform back if not present
                    if (!currentPlatforms.includes(draftPost.platform)) {
                        const updatedPlatforms = [...currentPlatforms, draftPost.platform];

                        await updateSocialPost(projectId, originalPost.id, {
                            platforms: updatedPlatforms,
                            // If it was Archived, reactivate it to 'Draft' status (concept mode)
                            ...(originalPost.status === 'Archived' ? { status: 'Draft' } : {})
                        });
                    } else if (originalPost.status === 'Archived') {
                        // Even if platform exists (weird edge case), ensure it is unarchived
                        await updateSocialPost(projectId, originalPost.id, { status: 'Draft' });
                    }

                    // Delete the draft
                    await deleteSocialPost(projectId, draftPost.id);
                    showSuccess(`Reverted ${draftPost.platform} draft to concept`);
                    return;
                }
            }

            // Scenario B: Original concept lost/deleted OR no origin ID
            // Convert this draft ITSELF into a single-platform concept
            await updateSocialPost(projectId, draftPost.id, {
                isConcept: true,
                status: 'Draft', // Ensure it shows in Ideas column
                scheduledFor: null as any, // Clear schedule
                videoConcept: {
                    title: draftPost.content.caption?.slice(0, 50) || 'Reverted Draft',
                    thumbnailIdea: '',
                    scriptOutline: ''
                },
                platforms: [draftPost.platform] // It becomes a concept for this platform
            });
            showSuccess(`Converted draft to concept`);

        } catch (error) {
            console.error("Failed to revert draft", error);
            showError("Failed to revert draft");
        }
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

    const brandColor = campaign.color || '#E1306C';

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-[var(--color-bg-base)]">

            {/* Scrollable Container - Disable main scroll for board to allow generic column scroll, or focus mode */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                {/* Concept Review Mode */}
                {campaign.status === 'Concept' ? (
                    <div className="flex-1 overflow-auto bg-[var(--color-surface-bg)]">
                        {conceptIdea ? (
                            <SocialCampaignReviewView
                                idea={conceptIdea}
                                onUpdate={() => { }} // No-op, we update campaign instead
                                mode="campaign"
                                isApproved={campaign.status === 'Planning' || campaign.status === 'Active'}
                                onApprove={async () => {
                                    if (!projectId || !campaignId) return;

                                    // Extract data from Concept
                                    let conceptData: any = {};
                                    try {
                                        if (conceptIdea?.concept && conceptIdea.concept.startsWith('{')) {
                                            conceptData = JSON.parse(conceptIdea.concept);
                                        }
                                    } catch (e) { console.error("Failed to parse concept", e); }

                                    const updates: Partial<SocialCampaign> = {
                                        status: 'Planning',
                                        bigIdea: conceptData.bigIdea,
                                        hook: conceptData.hook,
                                        visualDirection: conceptData.visualDirection,
                                        mood: conceptData.mood,
                                        phases: conceptData.phases,
                                        kpis: conceptData.kpis,
                                        audienceSegments: conceptData.audienceSegments,
                                        channelStrategy: conceptData.platforms,
                                        targetAudience: Array.isArray(conceptData.audienceSegments) ? conceptData.audienceSegments.join(', ') : conceptData.targetAudience,
                                        platforms: Array.isArray(conceptData.platforms)
                                            ? [...new Set(conceptData.platforms.map((p: any) => {
                                                const id = p.id || p;
                                                // Normalize YouTube variants to just 'YouTube'
                                                if (typeof id === 'string' && id.toLowerCase().includes('youtube')) return 'YouTube';
                                                return id;
                                            }))]
                                            : campaign.platforms,
                                        plannedContent: conceptData.planningPosts
                                    };

                                    if (conceptIdea?.riskWinAnalysis) {
                                        updates.risks = conceptIdea.riskWinAnalysis.risks?.map(r => ({ title: r.title, severity: r.severity, mitigation: r.mitigation || '' }));
                                        updates.wins = conceptIdea.riskWinAnalysis.wins?.map(w => ({ title: w.title, impact: w.impact }));
                                    }

                                    await updateCampaign(projectId, campaignId, updates);
                                    showSuccess("Campaign Approved! moved to Planning.");
                                    // Local state update handled by subscription
                                }}
                                onReject={async (reason) => {
                                    if (!projectId || !campaignId) return;

                                    // 2. Move Idea back to CHANGE REQUESTED for rework
                                    if (campaign.originIdeaId) {
                                        await updateIdea(campaign.originIdeaId, {
                                            stage: 'ChangeRequested', // Send to specific ChangeRequested stage
                                            lastRejectionReason: reason || "Changes Requested"
                                        }, projectId);
                                    }

                                    // 2. FORCE Campaign Status to remain 'Concept' (Fixing user reported issue where it moved to Backlog)
                                    // This overrides any potential side-effects from updateIdea
                                    await updateCampaign(projectId, campaignId, { status: 'Concept' });

                                    showSuccess("Changes Requested. Feedback sent to Flow Concept.");
                                    navigate(`../campaigns`);
                                }}
                                onRejectEntirely={async () => {
                                    if (!projectId || !campaignId) return;
                                    const confirmed = await confirm('Reject Campaign?', 'Are you sure you want to completely reject this campaign and its original concept? This cannot be easily undone.');
                                    if (!confirmed) return;

                                    try {
                                        // 1. Update Campaign Status
                                        await updateCampaign(projectId, campaignId, { status: 'Rejected' });

                                        // 2. Update Original Idea if linked
                                        if (campaign.originIdeaId) {
                                            await updateIdea(campaign.originIdeaId, { stage: 'Rejected' }, projectId);
                                        }

                                        showSuccess("Campaign and Concept Rejected.");
                                        navigate(`../campaigns`);
                                    } catch (e) {
                                        console.error("Failed to reject campaign", e);
                                        showError("Failed to reject campaign");
                                    }
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <span className="material-symbols-outlined animate-spin text-3xl text-[var(--color-primary)]">progress_activity</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Hero Banner Area (Hidden in Focus Mode) */}
                        {!isFocusMode && (
                            <CampaignHeader
                                campaign={campaign}
                                posts={posts}
                                onEdit={() => navigate(`/project/${projectId}/social/campaigns/edit/${campaignId}`)}
                                onAIPlan={handleOpenConfig}
                                onViewPlannedContent={campaign.plannedContent && campaign.plannedContent.length > 0 ? handleViewPlannedContent : undefined}
                                onAddContent={handleCreatePost}
                                onBack={() => navigate('../campaigns')}
                                brandColor={brandColor}
                                isGenerating={generating}
                            />
                        )}

                        {/* Tab Navigation */}
                        <div className="px-8 pt-2">
                            <div className="flex items-center justify-between">
                                {/* Tabs */}
                                <div className="flex items-center gap-8">
                                    {[
                                        { id: 'dashboard', label: 'Overview', icon: 'space_dashboard' },
                                        { id: 'strategy', label: 'Strategy', icon: 'lightbulb' },
                                        { id: 'board', label: 'Production', icon: 'view_kanban', badge: posts.length },
                                        { id: 'calendar', label: 'Calendar', icon: 'calendar_month' },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`group relative pb-3 flex items-center gap-2 transition-colors ${activeTab === tab.id
                                                ? 'text-[var(--color-text-main)]'
                                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                                }`}
                                        >
                                            <span
                                                className={`material-symbols-outlined text-[18px] transition-colors ${activeTab === tab.id ? '' : 'opacity-60 group-hover:opacity-100'
                                                    }`}
                                                style={activeTab === tab.id ? { color: brandColor } : {}}
                                            >
                                                {tab.icon}
                                            </span>
                                            <span className="text-sm font-semibold">{tab.label}</span>
                                            {tab.badge !== undefined && (
                                                <span
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                    style={activeTab === tab.id
                                                        ? { backgroundColor: `${brandColor}20`, color: brandColor }
                                                        : { backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }
                                                    }
                                                >
                                                    {tab.badge}
                                                </span>
                                            )}
                                            {/* Active Indicator */}
                                            <div
                                                className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition-all ${activeTab === tab.id ? 'opacity-100' : 'opacity-0'
                                                    }`}
                                                style={{ backgroundColor: brandColor }}
                                            />
                                        </button>
                                    ))}
                                </div>

                                {/* Focus Mode */}
                                <button
                                    onClick={() => setIsFocusMode(!isFocusMode)}
                                    className={`flex items-center gap-1.5 text-xs font-semibold transition-all px-3 py-1.5 rounded-lg ${isFocusMode
                                        ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">
                                        {isFocusMode ? 'unfold_more' : 'unfold_less'}
                                    </span>
                                    {isFocusMode ? 'Expand' : 'Focus'}
                                </button>
                            </div>
                            <div className="h-px bg-[var(--color-surface-border)] -mx-8" style={{ marginTop: '-1px' }} />
                        </div>

                        {/* Scrollable Container - Internal scroll only */}
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {activeTab === 'dashboard' && (
                                <div className="h-full overflow-y-auto custom-scrollbar px-8 pb-12 pt-4">
                                    <CampaignDashboardView
                                        campaign={campaign}
                                        posts={posts}
                                    />
                                </div>
                            )}

                            {activeTab === 'strategy' && (
                                <div className="h-full overflow-y-auto custom-scrollbar px-8 pb-12 pt-4">
                                    <CampaignStrategyView
                                        campaign={campaign}
                                        posts={posts}
                                        onTabChange={setActiveTab}
                                    />
                                </div>
                            )}

                            {activeTab === 'board' && (
                                <div className="h-full flex flex-col pt-4">
                                    <CampaignKanbanView
                                        posts={posts}
                                        onUpdateStatus={handleUpdateStatus}
                                        onEditPost={handleEditPost}
                                        onDeletePost={handleDeletePost}
                                        onReviewAction={handleReviewAction}
                                        onSplitPost={handleSplitPost}
                                        onRevertDraft={handleRevertDraft}
                                    />
                                </div>
                            )}

                            {activeTab === 'calendar' && (
                                <div className="h-full flex flex-col overflow-hidden">
                                    <CampaignCalendarView
                                        posts={allProjectPosts}
                                        currentCampaignId={campaignId}
                                        onSchedulePost={handleSchedulePost}
                                        onEditPost={handleEditPost}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

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
                                    <div className="flex gap-1">
                                        {(draft.platforms || [draft.platform]).map(p => (
                                            <span key={p} className="text-xs font-bold text-[var(--color-text-muted)]">{p}</span>
                                        ))}
                                    </div>
                                    <span className="text-xs font-bold text-[var(--color-text-muted)]">• {draft.type}</span>
                                </div>
                                <p className="text-sm text-[var(--color-text-main)] mb-3 line-clamp-4">{draft.content}</p>
                                <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-card)] p-2 rounded mb-2">
                                    <strong className="text-[var(--color-text-main)]">Visual Flow:</strong> {draft.imagePrompt || 'No specific visual'}
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
            {/* Planned Content Modal */}
            {campaign && (
                <PlannedPostsSelectModal
                    isOpen={showPlannedContentModal}
                    onClose={() => setShowPlannedContentModal(false)}
                    plannedContent={campaign.plannedContent || []}
                    onSelect={handleSelectPlannedPost}
                />
            )}
        </div >
    );
};
