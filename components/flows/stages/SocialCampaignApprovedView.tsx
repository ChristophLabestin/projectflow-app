import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/Button';
import { Idea, SocialCampaign } from '../../../types';
import { getProjectMembers, getUserProfile, getSocialCampaign } from '../../../services/dataService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { format } from 'date-fns';
import { dateLocale, dateFormat } from '../../../utils/activityHelpers';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignApprovedViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const SocialCampaignApprovedView: React.FC<SocialCampaignApprovedViewProps> = ({
    idea,
    onUpdate,
}) => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [teamMembers, setTeamMembers] = useState<Array<{ id: string; displayName: string; photoURL?: string }>>([]);
    const [linkedCampaign, setLinkedCampaign] = useState<SocialCampaign | null>(null);

    // Data Loading
    useEffect(() => {
        const loadData = async () => {
            if (!idea.projectId) return;
            try {
                // Load team members
                const memberIds = await getProjectMembers(idea.projectId, idea.tenantId || 'public');
                const profiles = await Promise.all(memberIds.map(uid => getUserProfile(uid)));
                setTeamMembers(profiles.filter(p => p !== null).map(p => ({
                    id: p.uid, displayName: p.displayName, photoURL: p.photoURL
                })));

                // Load linked campaign
                if (idea.convertedCampaignId) {
                    const campaign = await getSocialCampaign(idea.projectId, idea.convertedCampaignId);
                    if (campaign) setLinkedCampaign(campaign);
                }
            } catch (e) { console.error(e) }
        };
        loadData();
    }, [idea.projectId, idea.convertedCampaignId, idea.tenantId]);

    const concept = useMemo(() => {
        try { return idea.concept && idea.concept.startsWith('{') ? JSON.parse(idea.concept) : {}; }
        catch { return {}; }
    }, [idea.concept]);

    const platforms = useMemo(() => Array.isArray(concept.platforms) ? concept.platforms : [], [concept]);
    const phases = useMemo(() => Array.isArray(concept.phases) ? concept.phases : [], [concept]);
    const kpis = useMemo(() => Array.isArray(concept.kpis) ? concept.kpis : [], [concept]);
    const audienceSegments = useMemo(() => Array.isArray(concept.audienceSegments) ? concept.audienceSegments : [], [concept]);

    const assignedMembers = teamMembers.filter(m => (idea.assignedUserIds || []).includes(m.id));
    const analysis = idea.riskWinAnalysis;

    const approvedDate = idea.approvedAt ? format(new Date(idea.approvedAt), dateFormat, { locale: dateLocale }) : null;
    const approvedSummaryTemplate = t('flowStages.socialCampaignApproved.hero.summary');
    const [approvedSummaryBefore, approvedSummaryAfter] = approvedSummaryTemplate.split('{title}');
    const approvedOn = approvedDate
        ? t('flowStages.socialCampaignApproved.hero.approvedOn').replace('{date}', approvedDate)
        : null;

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-emerald-500';
        if (score >= 5) return 'text-amber-500';
        return 'text-red-500';
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">

                {/* Hero Header - Approved State */}
                <div className="bg-gradient-to-br from-green-100 via-emerald-50 to-white dark:from-green-900/30 dark:via-emerald-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-green-200 dark:border-green-800/50 relative overflow-hidden shadow-xl shadow-green-100 dark:shadow-none">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-green-600 rotate-12 -translate-y-10 translate-x-10">verified</span>
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="px-3 py-1 bg-green-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-green-200 dark:shadow-none flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                        {t('flowStages.socialCampaignApproved.hero.badge')}
                                    </div>
                                    <div className="h-[1px] w-8 bg-green-200 dark:bg-green-800 rounded-full" />
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {t('flowStages.socialCampaignApproved.hero.title')}
                                </h1>
                            </div>
                            <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-green-100/50 dark:shadow-none backdrop-blur-md">
                                <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    {approvedSummaryBefore}
                                    <span className="text-green-600 font-black">"{concept.bigIdea || idea.title}"</span>
                                    {approvedSummaryAfter}
                                    {approvedOn && <span className="text-slate-500 ml-1">{approvedOn}</span>}
                                </p>
                            </div>
                        </div>
                        {/* Quick Stats */}
                        <div className="flex gap-4">
                            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/50 dark:border-slate-700/50 min-w-[80px]">
                                <div className="text-2xl font-black text-green-600">{platforms.length}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t('flowStages.socialCampaignApproved.hero.stats.channels')}</div>
                            </div>
                            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/50 dark:border-slate-700/50 min-w-[80px]">
                                <div className="text-2xl font-black text-green-600">{phases.length}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t('flowStages.socialCampaignApproved.hero.stats.phases')}</div>
                            </div>
                            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/50 dark:border-slate-700/50 min-w-[80px]">
                                <div className="text-2xl font-black text-green-600">{kpis.length}</div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{t('flowStages.socialCampaignApproved.hero.stats.kpis')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left Column: Campaign Overview (8 cols) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Campaign Manifesto */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-200 dark:shadow-none">
                                    <span className="material-symbols-outlined">description</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCampaignApproved.manifesto.title')}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1">{t('flowStages.socialCampaignApproved.manifesto.subtitle')}</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <p className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                    "{concept.bigIdea || idea.title}"
                                </p>
                                {concept.hook && (
                                    <p className="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">
                                        {concept.hook}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {platforms.map((p: any) => (
                                        <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                            <div className="size-5"><PlatformIcon platform={p.id} /></div>
                                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{p.id}</span>
                                        </div>
                                    ))}
                                </div>
                                {concept.themes?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-6">
                                        {concept.themes.map((t: string, i: number) => (
                                            <span key={i} className="px-3 py-1 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                                #{t}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Campaign Phases Timeline */}
                        {phases.length > 0 && (
                            <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-none">
                                        <span className="material-symbols-outlined">timeline</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCampaignApproved.phases.title')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">{t('flowStages.socialCampaignApproved.phases.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {phases.map((phase: any, index: number) => (
                                        <div key={index} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                                                <span className="text-sm font-black text-blue-600 dark:text-blue-400">{index + 1}</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{phase.name}</h4>
                                                {phase.description && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{phase.description}</p>
                                                )}
                                                {(phase.startDate || phase.endDate) && (
                                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                                                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                                                        {phase.startDate && format(new Date(phase.startDate), 'MMM d', { locale: dateLocale })}
                                                        {phase.startDate && phase.endDate && ' → '}
                                                        {phase.endDate && format(new Date(phase.endDate), 'MMM d', { locale: dateLocale })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* KPIs & Targets */}
                        {kpis.length > 0 && (
                            <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="size-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200 dark:shadow-none">
                                        <span className="material-symbols-outlined">trending_up</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCampaignApproved.kpis.title')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">{t('flowStages.socialCampaignApproved.kpis.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {kpis.map((kpi: any, index: number) => (
                                        <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{kpi.name}</span>
                                                {kpi.target && (
                                                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                                                        {t('flowStages.socialCampaignApproved.kpis.target').replace('{target}', kpi.target)}
                                                    </span>
                                                )}
                                            </div>
                                            {kpi.description && (
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">{kpi.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Analysis Summary */}
                        {analysis && (
                            <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                                        <span className="material-symbols-outlined">psychology</span>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCampaignApproved.analysis.title')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">{t('flowStages.socialCampaignApproved.analysis.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-700">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('flowStages.socialCampaignApproved.analysis.successRate')}</div>
                                        <div className={`text-2xl font-black ${getScoreColor(analysis.successProbability / 10)}`}>
                                            {analysis.successProbability}%
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-700">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('flowStages.socialCampaignApproved.analysis.marketFit')}</div>
                                        <div className={`text-2xl font-black ${getScoreColor(analysis.marketFitScore)}`}>
                                            {analysis.marketFitScore}/10
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-700">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('flowStages.socialCampaignApproved.analysis.feasibility')}</div>
                                        <div className={`text-2xl font-black ${getScoreColor(analysis.technicalFeasibilityScore)}`}>
                                            {analysis.technicalFeasibilityScore}/10
                                        </div>
                                    </div>
                                </div>
                                {analysis.recommendation && (
                                    <div className="mt-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('flowStages.socialCampaignApproved.analysis.recommendation')}</div>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 italic">"{analysis.recommendation}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Sidebar (4 cols) */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Status Card */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-3xl border border-green-200 dark:border-green-800/50 p-6 md:p-8 shadow-sm">
                            <div className="text-center">
                                <div className="inline-flex size-16 bg-green-100 dark:bg-green-900/50 rounded-3xl items-center justify-center mb-4 text-green-600">
                                    <span className="material-symbols-outlined text-4xl">verified</span>
                                </div>
                                <h4 className="font-black text-green-900 dark:text-green-100 mb-2 text-lg">{t('flowStages.socialCampaignApproved.status.title')}</h4>
                                <p className="text-sm text-green-700 dark:text-green-300 mb-6">{t('flowStages.socialCampaignApproved.status.subtitle')}</p>

                                {linkedCampaign && (
                                    <Button
                                        onClick={() => navigate(`/project/${idea.projectId}/social/campaigns/${linkedCampaign.id}`)}
                                        className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider text-xs shadow-lg shadow-green-200 dark:shadow-none"
                                    >
                                        <span className="material-symbols-outlined text-lg mr-2">open_in_new</span>
                                        {t('flowStages.socialCampaignApproved.status.viewDashboard')}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Campaign Team */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCampaignApproved.team.title')}</h3>
                                <span className="text-[10px] font-bold text-slate-400">{t('flowStages.socialCampaignApproved.team.count').replace('{count}', `${assignedMembers.length}`)}</span>
                            </div>
                            <div className="space-y-3">
                                {assignedMembers.length > 0 ? assignedMembers.map(m => (
                                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <div className="size-8 rounded-full ring-2 ring-white dark:ring-slate-900 overflow-hidden bg-slate-200 relative">
                                            {m.photoURL ? <img src={m.photoURL} className="size-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-500">{m.displayName[0]}</span>}
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{m.displayName}</span>
                                    </div>
                                )) : (
                                    <div className="text-center py-4 text-xs text-slate-400 italic">{t('flowStages.socialCampaignApproved.team.empty')}</div>
                                )}
                            </div>
                        </div>

                        {/* Audience Segments */}
                        {audienceSegments.length > 0 && (
                            <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                                <div className="flex items-center gap-4 mb-6">
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCampaignApproved.audience.title')}</h3>
                                </div>
                                <div className="space-y-3">
                                    {audienceSegments.map((segment: any, index: number) => (
                                        <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{segment.name || segment}</span>
                                            {segment.description && (
                                                <p className="text-[10px] text-slate-500 mt-1">{segment.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Token Usage */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCampaignApproved.aiResources.title')}</h3>
                                <span className="material-symbols-outlined text-base text-violet-500">auto_awesome</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                                <div className="flex items-end gap-2 mb-3">
                                    <span className="text-3xl font-black text-slate-900 dark:text-white">{(idea.aiTokensUsed || 0).toLocaleString()}</span>
                                    <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">{t('flowStages.socialCampaignApproved.aiResources.tokens')}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                                        style={{ width: `${Math.min(((idea.aiTokensUsed || 0) / 50000) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-4">{t('flowStages.socialCampaignApproved.actions.title')}</h3>
                            <div className="space-y-3">
                                <Button
                                    onClick={() => navigate('/social')}
                                    className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold uppercase tracking-wider text-xs"
                                    variant="secondary"
                                >
                                    <span className="material-symbols-outlined text-sm mr-2">arrow_back</span>
                                    {t('flowStages.socialCampaignApproved.actions.back')}
                                </Button>
                                {linkedCampaign && (
                                    <Button
                                        onClick={() => navigate(`/project/${idea.projectId}/social/campaigns/${linkedCampaign.id}/calendar`)}
                                        className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold uppercase tracking-wider text-xs"
                                        variant="secondary"
                                    >
                                        <span className="material-symbols-outlined text-sm mr-2">calendar_month</span>
                                        {t('flowStages.socialCampaignApproved.actions.calendar')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
