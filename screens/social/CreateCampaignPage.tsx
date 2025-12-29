import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/UIContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea as TextArea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { DatePicker } from '../../components/ui/DatePicker';
import { SocialCampaign, SocialPlatform, CampaignPhase } from '../../types';
import { updateCampaign, createSocialCampaign, getSocialCampaign, updateIdea } from '../../services/dataService';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generateCampaignDetailsAI, generateCampaignDescriptionAI } from '../../services/geminiService';
import { format } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';
import { getSocialCampaignStatusLabel } from '../../utils/socialLocalization';

const ALL_PLATFORMS: SocialPlatform[] = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];

export const CreateCampaignPage = () => {
    const { id: projectId, campaignId } = useParams<{ id: string; campaignId?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ideaId = searchParams.get('ideaId');
    const { showError } = useToast();
    const { t, dateLocale, dateFormat } = useLanguage();

    // Mode State
    const [editMode, setEditMode] = useState<'simple' | 'advanced'>('simple');

    // Core Identity
    const [name, setName] = useState('');
    const [goal, setGoal] = useState('');
    const [status, setStatus] = useState<SocialCampaign['status']>('Planning');
    const [color, setColor] = useState('#E1306C');

    // Dates
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Strategy & Content
    const [description, setDescription] = useState('');
    const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
    const [bigIdea, setBigIdea] = useState('');
    const [hook, setHook] = useState('');
    const [toneOfVoice, setToneOfVoice] = useState('');
    const [visualDirection, setVisualDirection] = useState('');
    const [mood, setMood] = useState('');

    // Audience
    const [targetAudience, setTargetAudience] = useState('');
    const [audienceSegments, setAudienceSegments] = useState<string[]>([]);
    const [segmentInput, setSegmentInput] = useState('');

    // Tags
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    // Dynamic Lists
    const [phases, setPhases] = useState<CampaignPhase[]>([]);
    const [kpis, setKpis] = useState<{ metric: string, target: string }[]>([]);
    const [risks, setRisks] = useState<{ title: string, severity: string, mitigation: string }[]>([]);
    const [wins, setWins] = useState<{ title: string, impact: string }[]>([]);

    const [loading, setLoading] = useState(false);
    const [originIdeaId, setOriginIdeaId] = useState<string | null>(null);

    // Derived: Is end date auto-calculated?
    const isEndDateDerived = !!originIdeaId && phases.length > 0;

    // Initial Load
    useEffect(() => {
        if (!projectId) return;

        // If Editing an existing campaign
        if (campaignId) {
            setLoading(true);
            const fetchCampaign = async () => {
                try {
                    const data = await getSocialCampaign(projectId, campaignId);
                    if (data) {
                        setName(data.name);
                        setGoal(data.goal || '');
                        setStatus(data.status);
                        setStartDate(data.startDate || '');
                        setEndDate(data.endDate || '');
                        setDescription(data.description || '');
                        setPlatforms(data.platforms || []);
                        setToneOfVoice(data.toneOfVoice || '');
                        setTargetAudience(data.targetAudience || '');
                        setTags(data.tags || []);
                        setColor(data.color || '#E1306C');

                        // Rich Strategy Fields
                        setBigIdea(data.bigIdea || '');
                        setHook(data.hook || '');
                        setVisualDirection(data.visualDirection || '');
                        setMood(data.mood || '');
                        setPhases(data.phases || []);
                        setKpis(data.kpis || []);
                        setAudienceSegments(data.audienceSegments || []);
                        setRisks(data.risks || []);
                        setWins(data.wins || []);
                        setOriginIdeaId(data.originIdeaId || null);
                    }
                } catch (e) {
                    console.error("Failed to fetch campaign", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchCampaign();
        }

        // If Creating from an Idea
        else if (ideaId) {
            setLoading(true);
            const fetchIdea = async () => {
                try {
                    const snap = await getDoc(doc(db, 'ideas', ideaId));
                    if (snap.exists()) {
                        const idea = snap.data();
                        setName(idea.title);

                        // Parse concept if available
                        if (idea.concept && idea.concept.startsWith('{')) {
                            const parsed = JSON.parse(idea.concept);
                            setGoal(parsed.goal || '');
                            if (parsed.timelineStart) setStartDate(parsed.timelineStart);
                            if (parsed.timelineEnd) setEndDate(parsed.timelineEnd);
                            if (parsed.platforms && Array.isArray(parsed.platforms)) {
                                // Platforms in concept are stored as objects with 'id' field (CampaignChannelStrategy)
                                const rawPlatforms = parsed.platforms.map((p: any) => typeof p === 'string' ? p : p.id).filter(Boolean);

                                // Normalize YouTube variants (YouTube Shorts, YouTube Video) to just YouTube
                                const normalizedPlatforms = rawPlatforms.map((p: string) => {
                                    if (p.toLowerCase().includes('youtube')) return 'YouTube';
                                    return p;
                                });

                                // Deduplicate
                                const uniquePlatforms = [...new Set(normalizedPlatforms)] as SocialPlatform[];
                                setPlatforms(uniquePlatforms);
                            }
                            // Rich Fields map
                            setBigIdea(parsed.bigIdea || '');
                            setHook(parsed.hook || '');
                            setVisualDirection(parsed.visualDirection || '');
                            setMood(parsed.mood || '');
                            if (parsed.phases) setPhases(parsed.phases);
                            if (parsed.kpis) setKpis(parsed.kpis);
                            if (parsed.audienceSegments) setAudienceSegments(parsed.audienceSegments);
                        }
                        // Mark as idea-derived
                        setOriginIdeaId(ideaId);
                    }
                } catch (e) {
                    console.error("Failed to fetch flow", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchIdea();
        }
    }, [projectId, campaignId, ideaId]);

    // Auto-calculate end date from start date + phases for idea-derived campaigns
    useEffect(() => {
        if (!isEndDateDerived || !startDate) return;

        // Calculate total days from phases
        let totalDays = 0;
        phases.forEach(phase => {
            const val = phase.durationValue || 0;
            const unit = phase.durationUnit || 'Days';
            if (unit === 'Weeks') {
                totalDays += val * 7;
            } else if (unit === 'Months') {
                totalDays += val * 30; // Approximation
            } else {
                totalDays += val;
            }
        });

        if (totalDays > 0) {
            const start = new Date(startDate);
            start.setDate(start.getDate() + totalDays);
            setEndDate(start.toISOString().split('T')[0]);
        }
    }, [isEndDateDerived, startDate, phases]);

    // --- Helpers ---

    const togglePlatform = (p: SocialPlatform) => {
        if (platforms.includes(p)) {
            setPlatforms(platforms.filter(pl => pl !== p));
        } else {
            setPlatforms([...platforms, p]);
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };
    const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

    const handleAddSegment = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && segmentInput.trim()) {
            e.preventDefault();
            if (!audienceSegments.includes(segmentInput.trim())) setAudienceSegments([...audienceSegments, segmentInput.trim()]);
            setSegmentInput('');
        }
    };
    const removeSegment = (seg: string) => setAudienceSegments(audienceSegments.filter(s => s !== seg));

    // AI Generation
    const handleGenerateAI = async () => {
        if (!name) return;
        setLoading(true);
        try {
            const result = await generateCampaignDetailsAI(name);
            setGoal(result.goal);
            setDescription(result.description);
            setTargetAudience(result.targetAudience);
            setToneOfVoice(result.toneOfVoice);
            setPlatforms(result.platforms as SocialPlatform[]);
            setTags(result.tags);
            setStartDate(result.startDate);
            setEndDate(result.endDate);
        } catch (error) {
            console.error("AI Generation failed", error);
        } finally {
            setLoading(false);
        }
    };

    // AI Description Generation (uses all campaign data)
    const [generatingDescription, setGeneratingDescription] = useState(false);
    const handleGenerateDescription = async () => {
        if (!name) return;
        setGeneratingDescription(true);
        try {
            const campaignData = {
                name,
                goal,
                bigIdea,
                hook,
                platforms: platforms.join(', '),
                targetAudience,
                toneOfVoice,
                mood,
                visualDirection,
                phases: phases.map(p => p.name).join(', '),
                startDate,
                endDate
            };
            const result = await generateCampaignDescriptionAI(campaignData);
            setDescription(result);
        } catch (error) {
            console.error("Failed to generate description", error);
            showError(t('social.campaignForm.errors.generateDescription'));
        } finally {
            setGeneratingDescription(false);
        }
    };

    const handleSubmit = async () => {
        if (!projectId || !name || !auth.currentUser) return;
        setLoading(true);
        try {
            const data: any = {
                ownerId: auth.currentUser.uid,
                projectId,
                name,
                status,
                goal,
                description,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                platforms,
                tags,
                color,
                // Rich Strategy Data - Save all regardless of mode
                bigIdea,
                hook,
                toneOfVoice,
                visualDirection,
                mood,
                targetAudience,
                audienceSegments,
                phases,
                kpis,
                risks,
                wins
            };

            if (ideaId) {
                data.originIdeaId = ideaId;
            }

            // Sanitize payload
            const payload = JSON.parse(JSON.stringify(data));

            let newCampaignId = campaignId;
            if (campaignId) {
                await updateCampaign(projectId, campaignId, payload);
            } else {
                newCampaignId = await createSocialCampaign(projectId, payload);
            }

            if (ideaId && newCampaignId) {
                await updateIdea(ideaId, {
                    convertedCampaignId: newCampaignId,
                    campaignType: 'social',
                    stage: 'Scheduled'
                }, projectId);
            }

            navigate(`/project/${projectId}/social/campaigns/${newCampaignId}`);
        } catch (error: any) {
            console.error("Failed to save campaign", error);
            showError(t('social.campaignForm.errors.save')
                .replace('{error}', error.message || t('social.campaignForm.errors.unknown')));
        } finally {
            setLoading(false);
        }
    };

    // --- Dynamic List Components ---
    const addPhase = () => setPhases([...phases, { name: '', durationValue: 1, durationUnit: 'Weeks', focus: '' }]);
    const updatePhase = (index: number, field: string, value: any) => {
        const newPhases = [...phases];
        newPhases[index] = { ...newPhases[index], [field]: value };
        setPhases(newPhases);
    };
    const removePhase = (index: number) => setPhases(phases.filter((_, i) => i !== index));

    const addKPI = () => setKpis([...kpis, { metric: '', target: '' }]);
    const updateKPI = (index: number, field: string, value: any) => {
        const newKpis = [...kpis];
        newKpis[index] = { ...newKpis[index], [field]: value };
        setKpis(newKpis);
    };
    const removeKPI = (index: number) => setKpis(kpis.filter((_, i) => i !== index));

    const addRisk = () => setRisks([...risks, { title: '', severity: 'Medium', mitigation: '' }]);
    const updateRisk = (index: number, field: string, value: any) => {
        const newRisks = [...risks];
        newRisks[index] = { ...newRisks[index], [field]: value };
        setRisks(newRisks);
    };
    const removeRisk = (index: number) => setRisks(risks.filter((_, i) => i !== index));

    const addWin = () => setWins([...wins, { title: '', impact: 'Medium' }]);
    const updateWin = (index: number, field: string, value: any) => {
        const newWins = [...wins];
        newWins[index] = { ...newWins[index], [field]: value };
        setWins(newWins);
    };
    const removeWin = (index: number) => setWins(wins.filter((_, i) => i !== index));


    return (
        <div className="flex items-center justify-center p-6 min-h-full w-full bg-[var(--color-bg-base)]">
            <div className={`w-full ${editMode === 'simple' ? 'max-w-4xl' : 'max-w-6xl'} bg-[var(--color-surface-card)] rounded-3xl shadow-xl border border-[var(--color-surface-border)] overflow-hidden flex flex-col md:flex-row animate-fade-in relative transition-all duration-300`}>

                {/* Close Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* Left Panel: Form */}
                <div className="flex-1 flex flex-col border-r border-[var(--color-surface-border)]">
                    <header className="px-8 py-6 border-b border-[var(--color-surface-border)] flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="p-2 bg-orange-100 text-orange-600 rounded-lg material-symbols-outlined">campaign</span>
                                <h1 className="text-xl font-bold text-[var(--color-text-main)]">
                                    {campaignId ? t('social.campaignForm.title.edit') : t('social.campaignForm.title.create')}
                                </h1>
                            </div>
                            <p className="text-sm text-[var(--color-text-subtle)] ml-12">
                                {editMode === 'simple' ? t('social.campaignForm.subtitle.simple') : t('social.campaignForm.subtitle.advanced')}
                            </p>
                        </div>

                        {/* Mode Toggle */}
                        <div className="flex bg-[var(--color-surface-bg)] rounded-lg p-1 border border-[var(--color-surface-border)]">
                            <button
                                onClick={() => setEditMode('simple')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${editMode === 'simple' ? 'bg-[var(--color-surface-card)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {t('social.campaignForm.mode.simple')}
                            </button>
                            <button
                                onClick={() => setEditMode('advanced')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${editMode === 'advanced' ? 'bg-[var(--color-surface-card)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {t('social.campaignForm.mode.advanced')}
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-8">

                        {/* --- SIMPLE MODE FIELDS (Always Visible) --- */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">info</span>
                                {t('social.campaignForm.section.general')}
                            </h3>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Input
                                        label={t('social.campaignForm.fields.name')}
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder={t('social.campaignForm.placeholders.name')}
                                        autoFocus
                                    />
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={handleGenerateAI}
                                    disabled={!name || loading}
                                    icon={<span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                                    className="mb-[2px] h-[42px] bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-700 border-violet-200 hover:from-violet-200 hover:to-fuchsia-200"
                                >
                                    {t('social.campaignForm.actions.autoFill')}
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">{t('social.campaignForm.fields.status')}</label>
                                    <Select value={status} onChange={e => setStatus(e.target.value as any)}>
                                        <option value="Backlog">{t('social.campaign.status.backlog')}</option>
                                        <option value="Planning">{t('social.campaign.status.planning')}</option>
                                        <option value="Active">{t('social.campaign.status.active')}</option>
                                        <option value="Completed">{t('social.campaign.status.completed')}</option>
                                        <option value="Paused">{t('social.campaign.status.paused')}</option>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase block">{t('social.campaignForm.fields.themeColor')}</label>
                                    <div className="flex gap-2">
                                        {['#E1306C', '#1877F2', '#0A66C2', '#000000', '#FF0000', '#7C3AED'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setColor(c)}
                                                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-[var(--color-text-main)] scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <DatePicker label={t('social.campaignForm.fields.startDate')} value={startDate} onChange={setStartDate} />
                                <div className="space-y-1">
                                    <DatePicker
                                        label={t('social.campaignForm.fields.endDate')}
                                        value={endDate}
                                        onChange={setEndDate}
                                        disabled={isEndDateDerived}
                                    />
                                    {isEndDateDerived && (
                                        <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">info</span>
                                            {t('social.campaignForm.fields.endDateDerived')
                                                .replace('{count}', String(phases.length))}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <Input
                                label={t('social.campaignForm.fields.primaryGoal')}
                                value={goal}
                                onChange={e => setGoal(e.target.value)}
                                placeholder={t('social.campaignForm.placeholders.primaryGoal')}
                            />

                            {/* Platforms - Basic */}
                            <div>
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">{t('social.campaignForm.fields.platforms')}</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_PLATFORMS.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => togglePlatform(p)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${platforms.includes(p)
                                                ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300 shadow-sm'
                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                                                }`}
                                        >
                                            {platforms.includes(p) && <span className="material-symbols-outlined text-[14px]">check</span>}
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-sm font-bold text-[var(--color-text-main)]">{t('social.campaignForm.fields.description')}</label>
                                    <button
                                        onClick={handleGenerateDescription}
                                        disabled={generatingDescription || !name}
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-all bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-700 hover:from-violet-200 hover:to-fuchsia-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className={`material-symbols-outlined text-[14px] ${generatingDescription ? 'animate-spin' : ''}`}>
                                            {generatingDescription ? 'progress_activity' : 'auto_awesome'}
                                        </span>
                                        {generatingDescription ? t('social.campaignForm.actions.generating') : t('social.campaignForm.actions.generateDescription')}
                                    </button>
                                </div>
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    placeholder={t('social.campaignForm.placeholders.description')}
                                    className="min-h-[150px]"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">{t('social.campaignForm.fields.tags')}</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-[var(--color-surface-hover)] rounded-md text-xs font-medium flex items-center gap-1 group">
                                            #{tag}
                                            <button onClick={() => removeTag(tag)} className="hover:text-red-500"><span className="material-symbols-outlined text-[14px]">close</span></button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                        placeholder={t('social.campaignForm.placeholders.tag')}
                                        className="bg-transparent border-none text-xs focus:ring-0 p-1 min-w-[80px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* --- ADVANCED MODE FIELDS --- */}
                        {editMode === 'advanced' && (
                            <>
                                {/* Core Strategy */}
                                <div className="space-y-4 pt-4 border-t border-[var(--color-surface-border)] animate-fade-in">
                                    <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                                        {t('social.campaignForm.section.strategy')}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label={t('social.campaignForm.fields.coreConcept')}
                                            value={bigIdea}
                                            onChange={e => setBigIdea(e.target.value)}
                                            placeholder={t('social.campaignForm.placeholders.coreConcept')}
                                        />
                                        <Input
                                            label={t('social.campaignForm.fields.hook')}
                                            value={hook}
                                            onChange={e => setHook(e.target.value)}
                                            placeholder={t('social.campaignForm.placeholders.hook')}
                                        />
                                    </div>
                                </div>

                                {/* Visuals & Mood */}
                                <div className="space-y-4 pt-4 border-t border-[var(--color-surface-border)] animate-fade-in">
                                    <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">palette</span>
                                        {t('social.campaignForm.section.visuals')}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <TextArea
                                            label={t('social.campaignForm.fields.visualDirection')}
                                            value={visualDirection}
                                            onChange={e => setVisualDirection(e.target.value)}
                                            placeholder={t('social.campaignForm.placeholders.visualDirection')}
                                            rows={3}
                                        />
                                        <div className="space-y-4">
                                            <Input
                                                label={t('social.campaignForm.fields.mood')}
                                                value={mood}
                                                onChange={e => setMood(e.target.value)}
                                                placeholder={t('social.campaignForm.placeholders.mood')}
                                            />
                                            <Input
                                                label={t('social.campaignForm.fields.tone')}
                                                value={toneOfVoice}
                                                onChange={e => setToneOfVoice(e.target.value)}
                                                placeholder={t('social.campaignForm.placeholders.tone')}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Audience - Advanced */}
                                <div className="space-y-4 pt-4 border-t border-[var(--color-surface-border)] animate-fade-in">
                                    <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">group</span>
                                        {t('social.campaignForm.section.audience')}
                                    </h3>
                                    <TextArea
                                        label={t('social.campaignForm.fields.targetAudience')}
                                        value={targetAudience}
                                        onChange={e => setTargetAudience(e.target.value)}
                                        placeholder={t('social.campaignForm.placeholders.targetAudience')}
                                        rows={2}
                                    />
                                    <div>
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">{t('social.campaignForm.fields.audienceSegments')}</label>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {audienceSegments.map(seg => (
                                                <span key={seg} className="px-2 py-1 bg-[var(--color-surface-hover)] rounded-md text-xs font-medium flex items-center gap-1 group">
                                                    {seg}
                                                    <button onClick={() => removeSegment(seg)} className="hover:text-red-500"><span className="material-symbols-outlined text-[14px]">close</span></button>
                                                </span>
                                            ))}
                                            <input
                                                type="text"
                                                value={segmentInput}
                                                onChange={e => setSegmentInput(e.target.value)}
                                                onKeyDown={handleAddSegment}
                                                placeholder={t('social.campaignForm.placeholders.segment')}
                                                className="bg-transparent border-none text-xs focus:ring-0 p-1 min-w-[120px]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Phases & KPI & Analysis */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--color-surface-border)] animate-fade-in">
                                    {/* Phases */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-[16px]">timeline</span>
                                            {t('social.campaignForm.section.phases')}
                                        </h3>
                                        {phases.map((phase, idx) => (
                                            <div key={idx} className="bg-[var(--color-surface-bg)] rounded-xl p-3 border border-[var(--color-surface-border)] space-y-2">
                                                <div className="flex gap-2">
                                                    <input
                                                        className="flex-1 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded px-2 py-1 text-sm font-bold"
                                                        placeholder={t('social.campaignForm.placeholders.phaseName')}
                                                        value={phase.name}
                                                        onChange={e => updatePhase(idx, 'name', e.target.value)}
                                                    />
                                                    <button onClick={() => removePhase(idx)} className="text-[var(--color-text-muted)] hover:text-red-500">
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        className="w-20 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded px-2 py-1 text-xs"
                                                        type="number"
                                                        value={phase.durationValue}
                                                        onChange={e => updatePhase(idx, 'durationValue', parseInt(e.target.value) || 1)}
                                                    />
                                                    <select
                                                        className="w-24 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded px-2 py-1 text-xs"
                                                        value={phase.durationUnit}
                                                        onChange={e => updatePhase(idx, 'durationUnit', e.target.value)}
                                                    >
                                                        <option value="Days">{t('social.campaignForm.units.days')}</option>
                                                        <option value="Weeks">{t('social.campaignForm.units.weeks')}</option>
                                                    </select>
                                                </div>
                                                <input
                                                    className="w-full bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded px-2 py-1 text-xs"
                                                    placeholder={t('social.campaignForm.placeholders.phaseFocus')}
                                                    value={phase.focus}
                                                    onChange={e => updatePhase(idx, 'focus', e.target.value)}
                                                />
                                            </div>
                                        ))}
                                        <Button variant="secondary" size="sm" onClick={addPhase} className="text-xs w-full">{t('social.campaignForm.actions.addPhase')}</Button>
                                    </div>

                                    {/* KPIs */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-[16px]">flag</span>
                                            {t('social.campaignForm.section.kpis')}
                                        </h3>
                                        {kpis.map((kpi, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    className="flex-1 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded px-3 py-2 text-sm"
                                                    placeholder={t('social.campaignForm.placeholders.kpiMetric')}
                                                    value={kpi.metric}
                                                    onChange={e => updateKPI(idx, 'metric', e.target.value)}
                                                />
                                                <input
                                                    className="w-24 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded px-3 py-2 text-sm"
                                                    placeholder={t('social.campaignForm.placeholders.kpiTarget')}
                                                    value={kpi.target}
                                                    onChange={e => updateKPI(idx, 'target', e.target.value)}
                                                />
                                                <button onClick={() => removeKPI(idx)} className="text-[var(--color-text-muted)] hover:text-red-500 px-1">
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                        <Button variant="secondary" size="sm" onClick={addKPI} className="text-xs w-full">{t('social.campaignForm.actions.addKpi')}</Button>
                                    </div>
                                </div>
                            </>
                        )}

                    </div>


                    <footer className="px-8 py-5 border-t border-[var(--color-surface-border)] flex gap-3 justify-end bg-[var(--color-surface-card)]">
                        <Button variant="ghost" onClick={() => navigate(-1)}>{t('social.campaignForm.actions.cancel')}</Button>
                        <Button variant="primary" onClick={handleSubmit} isLoading={loading} disabled={!name}>
                            {campaignId ? t('social.campaignForm.actions.save') : t('social.campaignForm.actions.create')}
                        </Button>
                    </footer>
                </div>


                {/* Right Panel: Preview / Summary */}
                <div className="w-80 min-w-[320px] bg-[var(--color-surface-bg)] hidden lg:flex flex-col p-6 border-l border-[var(--color-surface-border)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                    <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase mb-6 relative z-10">{t('social.campaignForm.preview.title')}</h2>

                    <div className="relative z-10 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-6 shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${status === 'Active' ? 'bg-green-100 text-green-700' :
                                status === 'Planning' ? 'bg-blue-100 text-blue-700' :
                                    status === 'Completed' ? 'bg-purple-100 text-purple-700' :
                                        status === 'Paused' ? 'bg-amber-100 text-amber-700' :
                                            'bg-gray-100 text-gray-700'
                                }`}>
                                {getSocialCampaignStatusLabel(status, t)}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2 line-clamp-2">
                            {name || t('social.campaignForm.preview.nameFallback')}
                        </h3>

                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-3 mb-6 min-h-[40px]">
                            {bigIdea || description || t('social.campaignForm.preview.descriptionFallback')}
                        </p>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                <span>
                                    {startDate ? format(new Date(startDate), dateFormat, { locale: dateLocale }) : t('social.campaignForm.preview.startDateFallback')} - {endDate ? format(new Date(endDate), dateFormat, { locale: dateLocale }) : t('social.campaignForm.preview.endDateFallback')}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                                {platforms.length > 0 ? platforms.map(p => (
                                    <span key={p} className="px-1.5 py-0.5 bg-[var(--color-surface-hover)] rounded text-[10px] font-medium text-[var(--color-text-muted)]">
                                        {p}
                                    </span>
                                )) : <span className="text-[10px] text-[var(--color-text-muted)] italic">{t('social.campaignForm.preview.noPlatforms')}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 relative z-10">
                        <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-2">{t('social.campaignForm.preview.tipsTitle')}</h4>
                        <ul className="text-xs text-[var(--color-text-subtle)] space-y-2 list-disc pl-4">
                            <li><strong>{t('social.campaignForm.preview.tipCore.label')}</strong> {t('social.campaignForm.preview.tipCore.text')}</li>
                            <li><strong>{t('social.campaignForm.preview.tipHook.label')}</strong> {t('social.campaignForm.preview.tipHook.text')}</li>
                            <li><strong>{t('social.campaignForm.preview.tipVisuals.label')}</strong> {t('social.campaignForm.preview.tipVisuals.text')}</li>
                        </ul>
                    </div>
                </div>
            </div >
        </div>
    );
};
