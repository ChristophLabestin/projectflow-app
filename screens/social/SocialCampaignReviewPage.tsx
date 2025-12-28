import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIdeaById, getSocialCampaign, createSocialCampaign, updateIdea, updateCampaign } from '../../services/dataService';
import { Idea, SocialCampaign } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { PlatformIcon } from './components/PlatformIcon';
import { generateRiskWinAnalysis } from '../../services/geminiService';
import { useHelpCenter } from '../../context/HelpCenterContext';

const PHASE_COLORS = [
    { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-300' },
    { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300' },
    { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' },
    { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-300' },
    { dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-300' },
];

const CONTENT_TYPE_STYLES: Record<string, string> = {
    Post: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800/40',
    Reel: 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-800/40',
    Story: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/40',
    Carousel: 'bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800/40',
    Short: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800/40',
    Video: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/40',
    Text: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const formatStatus = (value?: string) => {
    if (!value) return 'Draft';
    return value.replace(/([a-z])([A-Z])/g, '$1 $2');
};

export const SocialCampaignReviewPage = () => {
    const { id: projectId, ideaId } = useParams<{ id: string; ideaId: string }>();
    const navigate = useNavigate();
    const { openHelpCenter } = useHelpCenter();
    const [idea, setIdea] = useState<Idea | null>(null);
    const [linkedCampaign, setLinkedCampaign] = useState<SocialCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

    // Approval/Rejection State
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectType, setRejectType] = useState<'changes' | 'permanent'>('changes');
    const [rejectionReason, setRejectionReason] = useState('');
    const [weekOffset, setWeekOffset] = useState(0);

    useEffect(() => {
        const load = async () => {
            if (!projectId || !ideaId) return;
            try {
                const i = await getIdeaById(ideaId, projectId);
                setIdea(i);
                if (i?.convertedCampaignId) {
                    const c = await getSocialCampaign(projectId, i.convertedCampaignId);
                    setLinkedCampaign(c);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [projectId, ideaId]);

    const handleUpdate = async (updates: Partial<Idea>) => {
        if (!idea || !projectId) return;
        await updateIdea(idea.id, updates, projectId);
        setIdea(prev => prev ? { ...prev, ...updates } : null);
    };

    const handleApprove = async () => {
        if (!idea || !projectId) return;

        // Re-parse concept to ensure we have the absolute latest data at moment of approval
        let currentConcept: any = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                currentConcept = JSON.parse(idea.concept);
            }
        } catch (e) { console.error("Failed to parse concept during approval", e); }

        const currentPlanningPosts = Array.isArray(currentConcept.planningPosts) ? currentConcept.planningPosts : [];
        const currentPhases = Array.isArray(currentConcept.phases) ? currentConcept.phases : [];
        const currentKpis = Array.isArray(currentConcept.kpis) ? currentConcept.kpis : [];
        const currentAudiences = Array.isArray(currentConcept.audienceSegments) ? currentConcept.audienceSegments : [];

        // Prepare rich data
        const richPlatforms = Array.isArray(currentConcept.platforms) ? currentConcept.platforms : [];
        const rawPlatformNames = richPlatforms.map((p: any) => p.id || p.platform);

        // Normalize YouTube variants (YouTube Shorts, YouTube Video) to just YouTube
        const normalizedPlatformNames = rawPlatformNames.map((p: string) => {
            if (typeof p === 'string' && p.toLowerCase().includes('youtube')) return 'YouTube';
            return p;
        });
        const platformNames = [...new Set(normalizedPlatformNames)]; // Deduplicate

        const campaignId = await createSocialCampaign(projectId, {
            name: idea.title,
            description: idea.description || '',
            status: 'Active',
            ownerId: idea.ownerId || '',
            projectId: projectId,
            originIdeaId: idea.id,
            color: '#10b981',

            // Rich Data Transfer
            platforms: platformNames.length > 0 ? platformNames : ['Instagram'],
            channelStrategy: richPlatforms,
            bigIdea: currentConcept.bigIdea,
            hook: currentConcept.hook,
            visualDirection: currentConcept.visualDirection,
            mood: currentConcept.mood,
            phases: currentPhases,
            kpis: currentKpis,
            audienceSegments: currentAudiences,
            targetAudience: Array.isArray(currentAudiences) ? currentAudiences.join(', ') : currentConcept.targetAudience,
            plannedContent: currentPlanningPosts,

            // AI Analysis Data
            risks: idea.riskWinAnalysis?.risks?.map((r: any) => ({
                title: typeof r === 'string' ? r : r.title,
                severity: r.severity || 'Medium',
                mitigation: r.mitigation || ''
            })),
            wins: idea.riskWinAnalysis?.wins?.map((w: any) => ({
                title: typeof w === 'string' ? w : w.title,
                impact: w.impact || 'Medium'
            })),

            assignedUserIds: idea.assignedUserIds || [],
            approvalHistory: [{ id: Date.now().toString(), type: 'approval', date: new Date().toISOString(), actorId: 'current-user' }]
        });

        await updateIdea(idea.id, {
            convertedCampaignId: campaignId,
            stage: 'Approved',
            approvedAt: new Date().toISOString(),
            approvedBy: 'current-user'
        }, projectId);

        navigate(`/project/${projectId}/social`);
    };

    const handleRequestChanges = async (reason?: string) => {
        if (!idea || !projectId) return;
        await updateIdea(idea.id, {
            stage: 'ChangeRequested',
            lastRejectionReason: reason
        }, projectId);
        navigate(`/project/${projectId}/social`);
    };

    const handlePermanentReject = async (reason?: string) => {
        if (!idea || !projectId) return;
        if (idea.convertedCampaignId) {
            await updateCampaign(projectId, idea.convertedCampaignId, { status: 'Rejected' });
        }
        await updateIdea(idea.id, {
            stage: 'Rejected',
            lastRejectionReason: reason
        }, projectId);
        navigate(`/project/${projectId}/social`);
    };

    const handleRunAnalysis = async () => {
        if (!idea) return;
        setAnalyzing(true);
        try {
            const result = await generateRiskWinAnalysis(idea);
            handleUpdate({ riskWinAnalysis: result });
        } catch (e) { console.error(e); }
        finally { setAnalyzing(false); }
    };

    // Data Parsing
    const concept = useMemo(() => {
        try { return idea?.concept && idea.concept.startsWith('{') ? JSON.parse(idea.concept) : {}; }
        catch { return {}; }
    }, [idea?.concept]);

    const phases = useMemo(() => Array.isArray(concept.phases) ? concept.phases : [], [concept]);
    const platforms = useMemo(() => Array.isArray(concept.platforms) ? concept.platforms : [], [concept]);
    const kpis = useMemo(() => Array.isArray(concept.kpis) ? concept.kpis : [], [concept]);
    const audienceSegments = useMemo(() => Array.isArray(concept.audienceSegments) ? concept.audienceSegments : [], [concept]);
    const themes = useMemo(() => Array.isArray(concept.themes) ? concept.themes : [], [concept]);
    const planningPosts = useMemo(() => Array.isArray(concept.planningPosts) ? concept.planningPosts : [], [concept]);

    // Scores
    const score = idea?.riskWinAnalysis?.successProbability || 0;
    const marketFit = (idea?.riskWinAnalysis?.marketFitScore || 0) * 10;
    const feasibility = (idea?.riskWinAnalysis?.technicalFeasibilityScore || 0) * 10;

    const campaignStatus = linkedCampaign?.status;
    const viewMode = useMemo(() => {
        if (campaignStatus === 'PendingReview' || idea?.stage === 'PendingReview') return 'reviewer-pending';
        if (campaignStatus === 'ChangesRequested' || idea?.stage === 'ChangeRequested') return 'creator-changes-requested';
        if (campaignStatus === 'Rejected' || idea?.stage === 'Rejected') return 'rejected';
        return 'approved';
    }, [campaignStatus, idea?.stage]);

    const statusLabel = useMemo(
        () => formatStatus(campaignStatus || idea?.stage || 'Draft'),
        [campaignStatus, idea?.stage]
    );

    const statusVariant = useMemo<'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline'>(() => {
        const key = (campaignStatus || idea?.stage || '').toLowerCase();
        if (key.includes('reject')) return 'error';
        if (key.includes('pending') || key.includes('review') || key.includes('change')) return 'warning';
        if (key.includes('active') || key.includes('approved')) return 'success';
        if (key.includes('draft') || key.includes('concept')) return 'secondary';
        return 'default';
    }, [campaignStatus, idea?.stage]);

    const maxPlannedDay = useMemo(() => {
        return planningPosts.reduce((max: number, post: any) => {
            const offset = typeof post.dayOffset === 'number' ? post.dayOffset : -1;
            return Math.max(max, offset);
        }, -1);
    }, [planningPosts]);

    const phaseRanges = useMemo(() => {
        let startDay = 0;
        return phases.map((phase: any, index: number) => {
            const val = phase.durationValue || 0;
            const unit = phase.durationUnit || 'Days';
            const days = unit === 'Weeks' ? val * 7 : unit === 'Months' ? val * 30 : val;
            const range = {
                phase,
                startDay,
                endDay: startDay + Math.max(days, 1) - 1,
                color: PHASE_COLORS[index % PHASE_COLORS.length],
            };
            startDay += Math.max(days, 1);
            return range;
        });
    }, [phases]);

    const totalDuration = phases.reduce((acc: number, p: any) => {
        const val = p.durationValue || 0;
        const unit = p.durationUnit || 'Days';
        const days = unit === 'Weeks' ? val * 7 : unit === 'Months' ? val * 30 : val;
        return acc + days;
    }, 0);

    const totalDays = Math.max(Math.ceil(totalDuration), maxPlannedDay + 1);
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

    const weekCounts = useMemo(() => {
        const counts = Array.from({ length: totalWeeks }, () => 0);
        planningPosts.forEach((post: any) => {
            const offset = typeof post.dayOffset === 'number' ? post.dayOffset : 0;
            const week = Math.floor(offset / 7);
            if (week >= 0 && week < counts.length) counts[week] += 1;
        });
        return counts;
    }, [planningPosts, totalWeeks]);

    const weekData = useMemo(() => {
        const startDay = weekOffset * 7;
        const days = Array.from({ length: 7 }, (_, i) => {
            const dayOffset = startDay + i;
            const isInCampaign = dayOffset < totalDays;
            const phase = phaseRanges.find(r => dayOffset >= r.startDay && dayOffset <= r.endDay);
            const posts = planningPosts.filter((post: any) => post.dayOffset === dayOffset);
            return { dayOffset, dayNum: dayOffset + 1, isInCampaign, phase, posts };
        });
        const postsThisWeek = days.reduce((sum, day) => sum + day.posts.length, 0);
        return { days, postsThisWeek };
    }, [weekOffset, totalDays, phaseRanges, planningPosts]);

    useEffect(() => {
        setWeekOffset((prev) => Math.min(prev, Math.max(0, totalWeeks - 1)));
    }, [totalWeeks]);

    const summaryStats = [
        { label: 'Phases', value: phases.length, icon: 'timeline' },
        { label: 'Duration', value: `${Math.ceil(totalDuration)}d`, icon: 'schedule' },
        { label: 'Platforms', value: platforms.length, icon: 'public' },
        { label: 'Audiences', value: audienceSegments.length, icon: 'groups' },
    ];

    if (loading) return <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">Loading review...</div>;
    if (!idea) return <div className="p-10 text-center text-[var(--color-text-muted)]">Campaign not found.</div>;

    return (
        <div className="min-h-full w-full pb-24">
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(`/project/${projectId}/social`)}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Back to Social
                    </button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openHelpCenter({ pageId: 'social-studio', sectionId: 'review-approval' })}
                        icon={<span className="material-symbols-outlined text-[16px]">help</span>}
                    >
                        Review help
                    </Button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-8">
                    <aside className="space-y-4">
                        <Card className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Campaign</div>
                                <Badge variant={statusVariant}>{statusLabel}</Badge>
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-main)]">{idea.title}</h1>
                                <div className="text-xs text-[var(--color-text-muted)] font-medium">ID: {idea.id.slice(0, 6)}</div>
                            </div>
                            {linkedCampaign && (
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-surface-border)] pt-3">
                                    <span className="material-symbols-outlined text-[16px]">campaign</span>
                                    <span className="font-medium text-[var(--color-text-main)] truncate">{linkedCampaign.name}</span>
                                </div>
                            )}
                        </Card>

                        <Card className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Performance Outlook</div>
                                    <p className="text-xs text-[var(--color-text-muted)]">AI forecast for success</p>
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleRunAnalysis}
                                    isLoading={analyzing}
                                    icon={<span className="material-symbols-outlined text-[16px]">refresh</span>}
                                >
                                    Refresh
                                </Button>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative size-16">
                                    <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                                        <circle className="text-[var(--color-surface-border)] stroke-current" strokeWidth="10" cx="50" cy="50" r="40" fill="transparent" />
                                        <circle
                                            className="text-[var(--color-success)] stroke-current transition-all duration-700"
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            cx="50"
                                            cy="50"
                                            r="40"
                                            fill="transparent"
                                            strokeDasharray="251.2"
                                            strokeDashoffset={251.2 - (251.2 * score) / 100}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-sm font-bold text-[var(--color-text-main)]">{score}%</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-[var(--color-text-main)]">Success Probability</div>
                                    <p className="text-xs text-[var(--color-text-muted)]">Based on current inputs</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                                        <span>Market Fit</span>
                                        <span className="font-semibold text-[var(--color-text-main)]">{marketFit}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-[var(--color-surface-border)] overflow-hidden">
                                        <div className="h-full bg-[var(--color-primary)]" style={{ width: `${marketFit}%` }} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                                        <span>Feasibility</span>
                                        <span className="font-semibold text-[var(--color-text-main)]">{feasibility}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-[var(--color-surface-border)] overflow-hidden">
                                        <div className="h-full bg-[var(--color-primary-light)]" style={{ width: `${feasibility}%` }} />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="space-y-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Quick Stats</div>
                            <div className="grid grid-cols-2 gap-3">
                                {summaryStats.map((stat) => (
                                    <div
                                        key={stat.label}
                                        className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-3"
                                    >
                                        <div className="flex items-center justify-between text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-[16px]">{stat.icon}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
                                        </div>
                                        <div className="mt-2 text-lg font-bold text-[var(--color-text-main)]">{stat.value}</div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </aside>

                    <div className="space-y-6">
                        <Card className="space-y-6">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Strategic Intent</div>
                            <div className="space-y-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Core Flow</div>
                                <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text-main)]">
                                    "{concept.bigIdea || idea.description || 'No core flow defined'}"
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--color-surface-border)]">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">The Hook</div>
                                    <p className="text-sm font-medium italic text-[var(--color-text-main)] leading-relaxed">
                                        "{concept.hook || 'No hook provided.'}"
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Visual Direction</div>
                                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                            {concept.visualDirection || 'No specific direction provided.'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {concept.mood && (
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)] text-[var(--color-text-muted)]">
                                                {concept.mood}
                                            </span>
                                        )}
                                        {themes.map((t: string) => (
                                            <span
                                                key={t}
                                                className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-[var(--color-text-muted)] border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]"
                                            >
                                                #{t}
                                            </span>
                                        ))}
                                        {!concept.mood && themes.length === 0 && (
                                            <span className="text-xs text-[var(--color-text-muted)]">No themes defined.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <Card className="space-y-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Execution Channels</div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-1 space-y-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Audience Segments</div>
                                    <div className="space-y-2">
                                        {audienceSegments.length ? (
                                            audienceSegments.map((seg: string, i: number) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-main)] bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2"
                                                >
                                                    <span className="size-1.5 rounded-full bg-[var(--color-primary)]" />
                                                    {seg}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] border border-dashed border-[var(--color-surface-border)] rounded-lg p-3">
                                                No audience segments defined.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {platforms.length ? (
                                        platforms.map((p: any, index: number) => {
                                            const isString = typeof p === 'string';
                                            const platformId = isString ? p : p.id || p.platform || `platform-${index}`;
                                            const roleText = isString ? '' : (p.role || '');
                                            const roleParts = roleText.split(':');
                                            const roleTitle = roleParts.length > 1 ? roleParts[0].trim() : 'Role';
                                            const roleBody = roleParts.length > 1 ? roleParts.slice(1).join(':').trim() : roleText.trim();
                                            const hasFrequencyValue = !isString && typeof p.frequencyValue === 'number';
                                            const frequencyLabel = isString
                                                ? 'TBD'
                                                : hasFrequencyValue
                                                    ? `${p.frequencyValue}/${p.frequencyUnit?.replace('Posts/', '') || 'Wk'}`
                                                    : p.frequency || '1/Wk';
                                            const formatLabel = isString ? 'Standard' : (p.format || 'Standard');
                                            return (
                                                <div
                                                    key={platformId}
                                                    className="group bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-11 rounded-2xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] flex items-center justify-center">
                                                            <div className="size-6">
                                                                <PlatformIcon platform={platformId} />
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-base font-bold text-[var(--color-text-main)] leading-tight">{platformId}</div>
                                                            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Execution Channel</div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 space-y-1">
                                                        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{roleTitle}</div>
                                                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                                                            {roleBody || 'No role defined yet.'}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4 pt-3 border-t border-[var(--color-surface-border)] grid grid-cols-2 gap-3 text-xs text-[var(--color-text-muted)]">
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] uppercase tracking-wider">Frequency</div>
                                                            {!isString && Array.isArray(p.phaseFrequencies) && p.phaseFrequencies.length > 0 ? (
                                                                <div className="space-y-1 mt-1">
                                                                    {p.phaseFrequencies.map((pf: any, i: number) => {
                                                                        const phaseName = phases.find((ph: any) => ph.id === pf.phaseId)?.name || `Phase ${i + 1}`;
                                                                        return (
                                                                            <div key={i} className="flex justify-between items-center text-[10px] gap-2">
                                                                                <span className="text-[var(--color-text-muted)] truncate max-w-[80px]" title={phaseName}>{phaseName}</span>
                                                                                <span className="font-semibold text-[var(--color-text-main)]">
                                                                                    {pf.frequencyValue}/{pf.frequencyUnit?.replace('Posts/', '') || 'Wk'}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm font-semibold text-[var(--color-text-main)]">{frequencyLabel}</div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1 text-right">
                                                            <div className="text-[10px] uppercase tracking-wider">Format</div>
                                                            <div className="text-sm font-semibold text-[var(--color-text-main)]">{formatLabel}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="sm:col-span-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] border border-dashed border-[var(--color-surface-border)] rounded-lg p-4">
                                            No platforms defined.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Card className="space-y-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Action Plan</div>
                            {phases.length ? (
                                <div className="relative">
                                    {phases.length > 1 && (
                                        <div className="absolute left-[28px] top-6 bottom-6 w-px bg-[var(--color-surface-border)] z-0" />
                                    )}
                                    <div className="space-y-5">
                                        {phases.map((phase: any, i: number) => {
                                            const style = PHASE_COLORS[i % PHASE_COLORS.length];
                                            const phaseTitle = phase.name || `Phase ${i + 1}`;
                                            const phaseDuration = phase.durationValue
                                                ? `${phase.durationValue} ${phase.durationUnit || 'Days'}`
                                                : 'Duration TBD';
                                            return (
                                                <div key={i} className="grid grid-cols-[3.5rem_1fr] gap-4 relative z-10">
                                                    <div className="flex items-start justify-center pt-1 relative z-10">
                                                        <div className={`size-12 rounded-2xl ${style.dot} text-white text-sm font-bold flex items-center justify-center shadow-sm ring-4 ring-[var(--color-surface-card)]`}>
                                                            {i + 1}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4">
                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                                                                    Phase {i + 1}
                                                                </div>
                                                                <h4 className="text-base font-bold text-[var(--color-text-main)]">{phaseTitle}</h4>
                                                            </div>
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] ${style.text}`}>
                                                                {phaseDuration}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">
                                                            {phase.focus || 'No focus provided.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] border border-dashed border-[var(--color-surface-border)] rounded-lg p-4 text-center">
                                    No phases defined.
                                </div>
                            )}
                        </Card>

                        <Card className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Content Timeline</div>
                                    <span className="text-xs text-[var(--color-text-muted)]">{planningPosts.length} posts</span>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
                                            disabled={weekOffset === 0}
                                            className="size-8 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                        </button>
                                        <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                                            Week {weekOffset + 1} of {totalWeeks}
                                            {weekData.postsThisWeek > 0 && (
                                                <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                                                    {weekData.postsThisWeek} posts
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setWeekOffset((prev) => Math.min(totalWeeks - 1, prev + 1))}
                                            disabled={weekOffset >= totalWeeks - 1}
                                            className="size-8 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                        </button>
                                    </div>

                                    {totalWeeks > 1 && (
                                        <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1">
                                            {Array.from({ length: totalWeeks }).map((_, i) => {
                                                const isActive = i === weekOffset;
                                                const count = weekCounts[i] || 0;
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setWeekOffset(i)}
                                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${isActive
                                                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] border-[var(--color-surface-border)] shadow-sm'
                                                            : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'
                                                            }`}
                                                    >
                                                        Week {i + 1}
                                                        {count > 0 && (
                                                            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-[var(--color-text-main)] text-[var(--color-text-ondark)]' : 'bg-[var(--color-surface-border)] text-[var(--color-text-muted)]'}`}>
                                                                {count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {totalDays > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                                    {weekData.days.map((day) => (
                                        <div
                                            key={day.dayOffset}
                                            className={`flex flex-col rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] overflow-visible ${day.isInCampaign ? '' : 'opacity-60'}`}
                                        >
                                            <div className="p-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Day</span>
                                                    {day.phase && <span className={`size-2 rounded-full ${day.phase.color.dot}`} />}
                                                </div>
                                                <div className="text-lg font-bold text-[var(--color-text-main)]">
                                                    {day.isInCampaign ? day.dayNum : '—'}
                                                </div>
                                            </div>

                                            <div className="flex-1 p-2 space-y-2">
                                                {day.posts.length ? (
                                                    day.posts.map((post: any) => {
                                                        const postPlatforms = Array.isArray(post.platforms)
                                                            ? post.platforms
                                                            : (post.platform ? [post.platform] : []);
                                                        const contentType = post.contentType || 'Post';
                                                        const typeStyle = CONTENT_TYPE_STYLES[contentType] || CONTENT_TYPE_STYLES.Post;
                                                        const hookText = post.hook || post.visualDirection || 'No hook defined.';
                                                        return (
                                                            <div
                                                                key={post.id}
                                                                className="relative group rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-2 transition-shadow hover:shadow-md"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex -space-x-1">
                                                                        {postPlatforms.slice(0, 2).map((p: string) => (
                                                                            <div
                                                                                key={p}
                                                                                className="size-4 rounded-md overflow-hidden ring-1 ring-[var(--color-surface-border)] bg-[var(--color-surface-card)]"
                                                                            >
                                                                                <PlatformIcon platform={p} />
                                                                            </div>
                                                                        ))}
                                                                        {!postPlatforms.length && (
                                                                            <div className="size-4 rounded-md border border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface-card)]" />
                                                                        )}
                                                                    </div>
                                                                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${typeStyle}`}>
                                                                        {contentType}
                                                                    </span>
                                                                </div>
                                                                <p className="mt-1 text-[10px] text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                                                                    {hookText}
                                                                </p>
                                                                <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 translate-y-1 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3 shadow-lg opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 z-20">
                                                                    <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
                                                                        <span>Preview</span>
                                                                        {post.status && <span>{post.status}</span>}
                                                                    </div>
                                                                    <div className="mt-2 text-xs font-semibold text-[var(--color-text-main)]">
                                                                        {contentType}
                                                                    </div>
                                                                    <div className="mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-4">
                                                                        {hookText}
                                                                    </div>
                                                                    {post.visualDirection && (
                                                                        <div className="mt-2 text-[10px] text-[var(--color-text-subtle)] line-clamp-3">
                                                                            {post.visualDirection}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-[10px] text-[var(--color-text-subtle)] text-center py-6">
                                                        {day.isInCampaign ? 'No posts' : 'Outside range'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] border border-dashed border-[var(--color-surface-border)] rounded-lg p-4 text-center">
                                    No planned posts yet.
                                </div>
                            )}
                        </Card>

                        <Card className="space-y-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Risk Mitigation</div>
                            {idea.riskWinAnalysis ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {idea.riskWinAnalysis.risks.slice(0, 4).map((risk: any, i) => (
                                        <div key={i} className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4">
                                            <div className="flex items-start gap-3 mb-3">
                                                <span className="material-symbols-outlined text-[var(--color-warning)] text-lg">warning</span>
                                                <div className="text-sm font-semibold text-[var(--color-text-main)] leading-tight">
                                                    {typeof risk === 'string' ? risk : risk.title}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-3">
                                                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                                    <span className="font-bold text-[var(--color-success)] uppercase text-[10px] mr-2">Mitigation</span>
                                                    {risk.mitigation || 'No mitigation protocol provided.'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] border border-dashed border-[var(--color-surface-border)] rounded-lg p-4 text-center">
                                    No risks identified.
                                </div>
                            )}
                        </Card>

                        <Card className="space-y-4">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-[16px]">monitoring</span>
                                Success Metrics
                            </div>
                            {kpis.length ? (
                                <div className="space-y-2">
                                    {kpis.map((kpi: any, index: number) => {
                                        const metric = typeof kpi === 'string' ? kpi : kpi.metric || 'Metric';
                                        const target = typeof kpi === 'string' ? '' : kpi.target;
                                        return (
                                            <div
                                                key={`${metric}-${index}`}
                                                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] px-3 py-2 text-sm"
                                            >
                                                <span className="font-medium text-[var(--color-text-main)]">{metric}</span>
                                                {target ? (
                                                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">{target}</span>
                                                ) : (
                                                    <span className="text-xs text-[var(--color-text-subtle)]">Target TBD</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] border border-dashed border-[var(--color-surface-border)] rounded-lg p-3">
                                    No KPIs defined.
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {viewMode === 'reviewer-pending' && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                    <div className="flex items-center gap-2 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-lg rounded-full p-2 pl-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] hidden sm:block">
                            Review Actions
                        </span>
                        <div className="h-4 w-px bg-[var(--color-surface-border)] hidden sm:block" />

                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full text-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-red-50"
                            onClick={() => {
                                setRejectType('permanent');
                                setShowRejectModal(true);
                            }}
                        >
                            Reject
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full text-[var(--color-warning)] hover:text-[var(--color-warning)] hover:bg-amber-50"
                            onClick={() => {
                                setRejectType('changes');
                                setShowRejectModal(true);
                            }}
                        >
                            Request Changes
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="rounded-full group hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-xl hover:shadow-emerald-500/30"
                            onClick={handleApprove}
                            icon={<span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-12 group-hover:scale-110">rocket_launch</span>}
                        >
                            Approve Campaign
                        </Button>
                    </div>
                </div>
            )}

            <Modal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                title={rejectType === 'changes' ? "Request Changes" : "Reject Campaign"}
                size="md"
            >
                <div className="space-y-6">
                    <div className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] p-4 rounded-lg">
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {rejectType === 'changes'
                                ? "This will return the campaign to the creator with your feedback."
                                : "This will permanently reject the campaign flow."}
                        </p>
                    </div>

                    <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter your feedback..."
                        className="min-h-[140px] resize-none"
                        autoFocus
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            className={rejectType === 'changes'
                                ? "bg-[var(--color-warning)] text-white hover:opacity-90"
                                : "bg-[var(--color-error)] text-white hover:opacity-90"}
                            onClick={() => {
                                if (rejectType === 'changes') handleRequestChanges(rejectionReason);
                                if (rejectType === 'permanent') handlePermanentReject(rejectionReason);
                                setShowRejectModal(false);
                                setRejectionReason('');
                            }}
                            disabled={!rejectionReason.trim()}
                        >
                            {rejectType === 'changes' ? "Send Request" : "Reject Campaign"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
