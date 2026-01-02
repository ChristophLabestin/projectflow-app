import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createAdCampaign, updateAdCampaign, subscribeAdCampaign } from '../../services/marketingService';
import { subscribeProjectIdeas } from '../../services/dataService';
import { AdCampaign, AdPlatform, AdObjective, AdTargetAudience, Idea } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { DatePicker } from '../../components/ui/DatePicker';
import { auth } from '../../services/firebase';
import { useLanguage } from '../../context/LanguageContext';

const PLATFORMS: { value: AdPlatform; label: string; icon: string; color: string }[] = [
    { value: 'Google', label: 'Google Ads', icon: 'search', color: '#4285F4' },
    { value: 'Meta', label: 'Meta Ads', icon: 'share', color: '#0668E1' },
    { value: 'LinkedIn', label: 'LinkedIn Ads', icon: 'work', color: '#0A66C2' },
    { value: 'TikTok', label: 'TikTok Ads', icon: 'videocam', color: '#000000' },
];

const OBJECTIVES: { value: AdObjective; label: string; description: string; icon: string }[] = [
    { value: 'Traffic', label: 'Traffic', description: 'Drive visitors to your website', icon: 'link' },
    { value: 'Leads', label: 'Lead Generation', description: 'Collect leads through forms', icon: 'person_add' },
    { value: 'Sales', label: 'Sales', description: 'Drive purchases and conversions', icon: 'shopping_cart' },
    { value: 'Brand Awareness', label: 'Brand Awareness', description: 'Maximize reach and impressions', icon: 'visibility' },
    { value: 'Engagement', label: 'Engagement', description: 'Increase likes, comments, shares', icon: 'favorite' },
    { value: 'Video Views', label: 'Video Views', description: 'Promote video content', icon: 'play_circle' },
];

const STEPS = [
    { id: 1, label: 'Platform & Objective' },
    { id: 2, label: 'Budget & Schedule' },
    { id: 3, label: 'Audience' },
    { id: 4, label: 'Review' },
];

export const CreateAdCampaignPage = () => {
    const { id: projectId, campaignId } = useParams<{ id: string; campaignId?: string }>();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const isEditMode = !!campaignId;

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [platform, setPlatform] = useState<AdPlatform>('Meta');
    const [objective, setObjective] = useState<AdObjective>('Traffic');
    const [budgetType, setBudgetType] = useState<'Daily' | 'Lifetime'>('Daily');
    const [budgetDaily, setBudgetDaily] = useState<number>(50);
    const [budgetTotal, setBudgetTotal] = useState<number>(500);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [targeting, setTargeting] = useState<AdTargetAudience>({
        locations: [],
        ageMin: 18,
        ageMax: 65,
        genders: ['All'],
        interests: [],
    });
    const [originIdeaId, setOriginIdeaId] = useState<string | undefined>();

    // Location input
    const [locationInput, setLocationInput] = useState('');
    const [interestInput, setInterestInput] = useState('');

    // Ideas for linking
    const [ideas, setIdeas] = useState<Idea[]>([]);

    // Load existing campaign for edit mode
    useEffect(() => {
        if (isEditMode && campaignId) {
            const unsub = subscribeAdCampaign(campaignId, (data) => {
                if (data) {
                    setName(data.name);
                    setDescription(data.description || '');
                    setPlatform(data.platform);
                    setObjective(data.objective);
                    setBudgetType(data.budgetType);
                    setBudgetDaily(data.budgetDaily || 50);
                    setBudgetTotal(data.budgetTotal || 500);
                    setStartDate(data.startDate.split('T')[0]);
                    setEndDate(data.endDate?.split('T')[0] || '');
                    if (data.targetAudience) setTargeting(data.targetAudience);
                    setOriginIdeaId(data.originIdeaId);
                }
                setInitialLoading(false);
            });
            return () => unsub();
        }
    }, [isEditMode, campaignId]);

    // Load ideas for Flow linking
    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeProjectIdeas(projectId, (data) => {
            setIdeas(data.filter(i =>
                i.type === 'Marketing' &&
                (i.stage === 'Approved' || i.stage === 'Live') &&
                i.campaignType !== 'ad'
            ));
        });
        return () => unsub();
    }, [projectId]);

    const handleAddLocation = () => {
        if (locationInput.trim() && !targeting.locations?.includes(locationInput.trim())) {
            setTargeting(prev => ({
                ...prev,
                locations: [...(prev.locations || []), locationInput.trim()]
            }));
            setLocationInput('');
        }
    };

    const handleRemoveLocation = (loc: string) => {
        setTargeting(prev => ({
            ...prev,
            locations: prev.locations?.filter(l => l !== loc) || []
        }));
    };

    const handleAddInterest = () => {
        if (interestInput.trim() && !targeting.interests?.includes(interestInput.trim())) {
            setTargeting(prev => ({
                ...prev,
                interests: [...(prev.interests || []), interestInput.trim()]
            }));
            setInterestInput('');
        }
    };

    const handleRemoveInterest = (interest: string) => {
        setTargeting(prev => ({
            ...prev,
            interests: prev.interests?.filter(i => i !== interest) || []
        }));
    };

    const handleSubmit = async () => {
        if (!projectId || !name.trim()) return;
        setLoading(true);

        try {
            const campaignData: Omit<AdCampaign, 'id'> = {
                projectId,
                name: name.trim(),
                description: description.trim() || undefined,
                platform,
                status: 'Draft',
                budgetType,
                budgetDaily: budgetType === 'Daily' ? budgetDaily : undefined,
                budgetTotal: budgetType === 'Lifetime' ? budgetTotal : budgetDaily * 30,
                spend: 0,
                startDate: new Date(startDate).toISOString(),
                endDate: endDate ? new Date(endDate).toISOString() : undefined,
                objective,
                targetAudience: targeting,
                metrics: {
                    impressions: 0,
                    clicks: 0,
                    ctr: 0,
                    cpc: 0,
                    conversions: 0,
                    costPerConversion: 0,
                    roas: 0,
                },
                originIdeaId,
                createdAt: new Date().toISOString(),
                createdBy: auth.currentUser?.uid,
            };

            if (isEditMode && campaignId) {
                await updateAdCampaign(campaignId, campaignData);
            } else {
                await createAdCampaign(campaignData);
            }

            navigate(`/project/${projectId}/marketing/ads`);
        } catch (error) {
            console.error('Failed to save campaign:', error);
        } finally {
            setLoading(false);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1: return !!platform && !!objective;
            case 2: return !!name.trim() && !!startDate && (budgetDaily > 0 || budgetTotal > 0);
            case 3: return true; // Targeting is optional
            case 4: return true;
            default: return true;
        }
    };

    if (initialLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="material-symbols-outlined animate-spin text-3xl text-[var(--color-primary)]">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-6 h-full w-full bg-[var(--color-bg-base)]">
            <div className="w-full max-w-4xl bg-[var(--color-surface-card)] rounded-3xl shadow-2xl border border-[var(--color-surface-border)] overflow-hidden animate-fade-in">

                {/* Header */}
                <header className="px-8 py-6 border-b border-[var(--color-surface-border)]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-xl font-bold text-[var(--color-text-main)]">
                                {isEditMode ? 'Edit Campaign' : 'Create Ad Campaign'}
                            </h1>
                            <p className="text-sm text-[var(--color-text-subtle)]">
                                Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].label}
                            </p>
                        </div>
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    {/* Stepper */}
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

                {/* Content */}
                <div className="p-8 max-h-[500px] overflow-y-auto custom-scrollbar">

                    {/* Step 1: Platform & Objective */}
                    {currentStep === 1 && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-[var(--color-text-main)]">Platform</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {PLATFORMS.map((p) => (
                                        <button
                                            key={p.value}
                                            onClick={() => setPlatform(p.value)}
                                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${platform === p.value
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]'
                                                    : 'border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)]'
                                                }`}
                                        >
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                                                style={{ backgroundColor: p.color }}
                                            >
                                                <span className="material-symbols-outlined">{p.icon}</span>
                                            </div>
                                            <span className="text-xs font-bold">{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-bold text-[var(--color-text-main)]">Campaign Objective</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {OBJECTIVES.map((obj) => (
                                        <button
                                            key={obj.value}
                                            onClick={() => setObjective(obj.value)}
                                            className={`p-4 rounded-xl border-2 transition-all text-left ${objective === obj.value
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                                    : 'border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)]'
                                                }`}
                                        >
                                            <span className={`material-symbols-outlined text-xl mb-2 ${objective === obj.value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                                {obj.icon}
                                            </span>
                                            <h4 className="font-bold text-sm text-[var(--color-text-main)]">{obj.label}</h4>
                                            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{obj.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Link from Flow */}
                            {ideas.length > 0 && (
                                <div className="space-y-3 pt-4 border-t border-[var(--color-surface-border)]">
                                    <label className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-purple-500">lightbulb</span>
                                        Link from Flow (Optional)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {ideas.map(idea => (
                                            <button
                                                key={idea.id}
                                                onClick={() => setOriginIdeaId(originIdeaId === idea.id ? undefined : idea.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${originIdeaId === idea.id
                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 ring-1 ring-purple-500'
                                                        : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                                                    }`}
                                            >
                                                {idea.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Budget & Schedule */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fade-in">
                            <Input
                                label="Campaign Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter a name for your campaign"
                                autoFocus
                            />

                            <Textarea
                                label="Description (Optional)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your campaign goals..."
                                className="min-h-[80px]"
                            />

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-[var(--color-text-main)]">Budget Type</label>
                                    <div className="flex gap-2">
                                        {(['Daily', 'Lifetime'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setBudgetType(type)}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${budgetType === type
                                                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
                                                        : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-[var(--color-text-main)] block mb-2">
                                        {budgetType === 'Daily' ? 'Daily Budget' : 'Total Budget'}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-bold">$</span>
                                        <input
                                            type="number"
                                            value={budgetType === 'Daily' ? budgetDaily : budgetTotal}
                                            onChange={(e) => budgetType === 'Daily'
                                                ? setBudgetDaily(Number(e.target.value))
                                                : setBudgetTotal(Number(e.target.value))
                                            }
                                            className="w-full h-12 pl-8 pr-4 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={setStartDate}
                                />
                                <DatePicker
                                    label="End Date (Optional)"
                                    value={endDate}
                                    onChange={setEndDate}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Audience */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-[var(--color-text-main)]">Locations</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={locationInput}
                                        onChange={(e) => setLocationInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLocation())}
                                        placeholder="Add a location..."
                                        className="flex-1 h-10 px-4 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    />
                                    <button onClick={handleAddLocation} className="px-4 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl font-bold text-sm">
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {targeting.locations?.map(loc => (
                                        <span key={loc} className="px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1">
                                            {loc}
                                            <button onClick={() => handleRemoveLocation(loc)} className="hover:text-red-500">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-[var(--color-text-main)]">Age Range</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            value={targeting.ageMin}
                                            onChange={(e) => setTargeting(prev => ({ ...prev, ageMin: Number(e.target.value) }))}
                                            className="w-20 h-10 px-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm text-center"
                                        />
                                        <span className="text-[var(--color-text-muted)]">to</span>
                                        <input
                                            type="number"
                                            value={targeting.ageMax}
                                            onChange={(e) => setTargeting(prev => ({ ...prev, ageMax: Number(e.target.value) }))}
                                            className="w-20 h-10 px-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm text-center"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-[var(--color-text-main)]">Gender</label>
                                    <div className="flex gap-2">
                                        {(['All', 'Male', 'Female'] as const).map(g => (
                                            <button
                                                key={g}
                                                onClick={() => setTargeting(prev => ({ ...prev, genders: [g] }))}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${targeting.genders?.includes(g)
                                                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
                                                        : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)]'
                                                    }`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-bold text-[var(--color-text-main)]">Interests</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={interestInput}
                                        onChange={(e) => setInterestInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
                                        placeholder="Add an interest..."
                                        className="flex-1 h-10 px-4 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    />
                                    <button onClick={handleAddInterest} className="px-4 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-xl font-bold text-sm">
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {targeting.interests?.map(interest => (
                                        <span key={interest} className="px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg text-xs font-bold flex items-center gap-1">
                                            {interest}
                                            <button onClick={() => handleRemoveInterest(interest)} className="hover:text-red-500">
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="text-center mb-6">
                                <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 mb-3">
                                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text-main)]">Review Your Campaign</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">Double-check everything before creating</p>
                            </div>

                            <div className="bg-[var(--color-surface-bg)] rounded-2xl p-6 space-y-4">
                                <ReviewRow label="Campaign Name" value={name} />
                                <ReviewRow label="Platform" value={PLATFORMS.find(p => p.value === platform)?.label || platform} />
                                <ReviewRow label="Objective" value={OBJECTIVES.find(o => o.value === objective)?.label || objective} />
                                <ReviewRow label="Budget" value={budgetType === 'Daily' ? `$${budgetDaily}/day` : `$${budgetTotal} total`} />
                                <ReviewRow label="Schedule" value={`${startDate} ${endDate ? `to ${endDate}` : '(ongoing)'}`} />
                                {targeting.locations && targeting.locations.length > 0 && (
                                    <ReviewRow label="Locations" value={targeting.locations.join(', ')} />
                                )}
                                <ReviewRow label="Age Range" value={`${targeting.ageMin} - ${targeting.ageMax}`} />
                                {originIdeaId && (
                                    <ReviewRow label="Linked Flow" value={ideas.find(i => i.id === originIdeaId)?.title || 'Unknown'} />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="px-8 py-5 border-t border-[var(--color-surface-border)] flex items-center justify-between bg-[var(--color-surface-card)]">
                    {currentStep > 1 ? (
                        <Button variant="ghost" onClick={() => setCurrentStep(prev => prev - 1)}>
                            <span className="material-symbols-outlined mr-1">arrow_back</span>
                            Back
                        </Button>
                    ) : (
                        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                    )}

                    {currentStep < 4 ? (
                        <Button
                            variant="primary"
                            onClick={() => setCurrentStep(prev => prev + 1)}
                            disabled={!canProceed()}
                        >
                            Next
                            <span className="material-symbols-outlined ml-1">arrow_forward</span>
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            isLoading={loading}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <span className="material-symbols-outlined mr-1">check</span>
                            {isEditMode ? 'Save Changes' : 'Create Campaign'}
                        </Button>
                    )}
                </footer>
            </div>
        </div>
    );
};

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className="font-bold text-[var(--color-text-main)]">{value}</span>
    </div>
);
