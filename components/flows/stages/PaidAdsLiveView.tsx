import React, { useState } from 'react';
import { Idea, AdCampaign } from '../../../types';
import { Button } from '../../ui/Button';
import { createAdCampaign } from '../../../services/marketingService';
import { updateIdea } from '../../../services/dataService';
import { useParams, Link } from 'react-router-dom';
import { auth } from '../../../services/firebase';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsLiveViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const PaidAdsLiveView: React.FC<PaidAdsLiveViewProps> = ({ idea, onUpdate }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const { adData } = usePaidAdsData(idea, onUpdate);
    const [converting, setConverting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isConverted = !!idea.convertedCampaignId;

    const mapObjective = (obj: string): AdCampaign['objective'] => {
        const map: Record<string, AdCampaign['objective']> = {
            'Traffic': 'Traffic',
            'Leads': 'Leads',
            'Sales': 'Sales',
            'Brand Awareness': 'Brand Awareness',
            'Engagement': 'Engagement',
            'Video Views': 'Video Views',
            'App Installs': 'App Installs',
        };
        return map[obj] || 'Traffic';
    };

    const handleConvertToCampaign = async () => {
        if (!projectId || !auth.currentUser) return;
        setConverting(true);
        setError(null);

        try {
            const budgetAmount = adData.budget?.amount || 0;
            const budgetType = adData.budget?.type || 'Daily';

            const selectedPlatform = (adData.setup?.platforms?.[0] as AdCampaign['platform']) || 'Meta';

            const campaign: Omit<AdCampaign, 'id'> = {
                projectId,
                name: idea.title,
                description: idea.description || adData.creative?.primaryText || '',
                platform: selectedPlatform,
                status: 'Pending',
                budgetType: budgetType,
                budgetDaily: budgetType === 'Daily' ? budgetAmount : undefined,
                budgetTotal: budgetType === 'Lifetime' ? budgetAmount : undefined,
                spend: 0,
                objective: mapObjective(adData.objective || 'Traffic'),
                startDate: adData.budget?.startDate || new Date().toISOString().split('T')[0],
                endDate: adData.budget?.endDate,
                targetAudience: {
                    locations: adData.targeting?.locations || [],
                    ageMin: adData.targeting?.ageMin || 18,
                    ageMax: adData.targeting?.ageMax || 65,
                    genders: adData.targeting?.genders || ['All'],
                    interests: adData.targeting?.interests || [],
                },
                placements: adData.targeting?.placements || [],
                metrics: {
                    impressions: 0,
                    clicks: 0,
                    ctr: 0,
                    cpc: 0,
                    conversions: 0,
                    costPerConversion: 0,
                    roas: 0,
                },
                originIdeaId: idea.id,
                createdBy: auth.currentUser.uid,
                createdAt: new Date(),
            };

            const campaignId = await createAdCampaign(campaign);

            await updateIdea(idea.id, {
                convertedCampaignId: campaignId,
                campaignType: 'ad',
                stage: 'Optimization',
            }, projectId);

            onUpdate({
                convertedCampaignId: campaignId,
                campaignType: 'ad',
                stage: 'Optimization',
            });
        } catch (e) {
            console.error('Failed to create campaign:', e);
            setError('Failed to create campaign. Please try again.');
        } finally {
            setConverting(false);
        }
    };

    if (isConverted) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-12 max-w-2xl w-full border border-emerald-100 dark:border-emerald-900 shadow-2xl relative overflow-hidden text-center">
                    <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 via-green-500 to-teal-400" />

                    <div className="mb-8 relative">
                        <div className="absolute inset-0 bg-emerald-400/20 blur-2xl rounded-full" />
                        <div className="size-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-xl mx-auto relative z-10 animate-bounce-slow">
                            <span className="material-symbols-outlined text-white text-[48px]">rocket_launch</span>
                        </div>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                        Campaign Launched!
                    </h2>
                    <p className="text-lg text-slate-500 dark:text-slate-400 mb-10 max-w-lg mx-auto font-medium leading-relaxed">
                        Your ad campaign has been successfully created. You can now monitor its performance and manage ads in the Marketing Hub.
                    </p>

                    <Link
                        to={`/project/${projectId}/marketing/ads/${idea.convertedCampaignId}`}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform shadow-xl"
                    >
                        <span className="material-symbols-outlined">analytics</span>
                        Go to Campaign Dashboard
                    </Link>

                    <div className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-8">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</div>
                            <div className="text-sm font-black text-amber-500 flex items-center justify-center gap-1">
                                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                                Pending Review
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Budget</div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">${adData.budget?.amount || 0}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Objective</div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">{adData.objective}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
            <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

                {/* Launch Control */}
                <div className="space-y-8 order-2 lg:order-1">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 text-[10px] font-black uppercase tracking-widest mb-4">
                            <span className="material-symbols-outlined text-sm">hub</span>
                            Launch Command
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6">
                            Ready for Liftoff?
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            You're about to publish <span className="text-slate-900 dark:text-white font-bold">{idea.title}</span>.
                            This will create a live ad campaign and begin the review process.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <span className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center material-symbols-outlined">payments</span>
                                <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">Budget Allocation</div>
                                    <div className="text-[10px] font-medium text-slate-500">Daily Max Spend</div>
                                </div>
                            </div>
                            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">${adData.budget?.amount || 0}</div>
                        </div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <span className="size-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center material-symbols-outlined">target</span>
                                <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">Audience Size</div>
                                    <div className="text-[10px] font-medium text-slate-500">Estimated Reach</div>
                                </div>
                            </div>
                            <div className="text-lg font-black text-violet-600 dark:text-violet-400">~120K</div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="size-10 rounded-lg bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center material-symbols-outlined">palette</span>
                                <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">Creative Assets</div>
                                    <div className="text-[10px] font-medium text-slate-500">Images & Copy</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
                                Ready
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium flex items-center gap-2">
                            <span className="material-symbols-outlined">error</span>
                            {error}
                        </div>
                    )}

                    <div className="flex gap-4">
                        <Button
                            onClick={() => onUpdate({ stage: 'Review' })}
                            className="h-14 px-6 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-2xl border border-slate-200 dark:border-slate-800"
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleConvertToCampaign}
                            isLoading={converting}
                            className="flex-1 h-14 hover:bg-slate-800 dark:hover:bg-slate-200 font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all"
                        >
                            <span className="material-symbols-outlined mr-2">rocket_launch</span>
                            Launch Campaign
                        </Button>
                    </div>
                </div>

                {/* Visual Preview */}
                <div className="order-1 lg:order-2 relative h-[500px] bg-slate-900 rounded-[2.5rem] overflow-hidden group shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 opacity-20" />
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />

                    {/* Floating Elements */}
                    <div className="absolute top-10 left-10 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg animate-float-slow">
                        <div className="size-8 rounded bg-fuchsia-500 mb-2" />
                        <div className="h-2 w-12 bg-white/20 rounded mb-1" />
                        <div className="h-2 w-8 bg-white/20 rounded" />
                    </div>

                    <div className="absolute bottom-20 right-10 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg animate-float-delayed">
                        <div className="text-2xl font-black text-white">$12.50</div>
                        <div className="text-[10px] text-white/60 uppercase tracking-widest">CPC Goal</div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-white/20 blur-[60px] rounded-full animate-pulse" />
                            <span className="material-symbols-outlined text-[180px] text-white drop-shadow-2xl relative z-10">
                                campaign
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
