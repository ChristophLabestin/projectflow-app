import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea as TextArea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { DatePicker } from '../../components/ui/DatePicker';
import { SocialCampaign, SocialPlatform } from '../../types';
import { updateCampaign, subscribeCampaigns, updateIdea, createSocialCampaign, getSocialCampaign } from '../../services/dataService';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generateCampaignDetailsAI } from '../../services/geminiService';

const ALL_PLATFORMS: SocialPlatform[] = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];
const GOALS = ['Brand Awareness', 'Engagement', 'Traffic', 'Lead Generation', 'Sales', 'Community Building'];

export const CreateCampaignPage = () => {
    const { id: projectId, campaignId } = useParams<{ id: string; campaignId?: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ideaId = searchParams.get('ideaId');

    // Form State
    const [name, setName] = useState('');
    const [goal, setGoal] = useState('');
    const [status, setStatus] = useState<SocialCampaign['status']>('Planning');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [description, setDescription] = useState('');
    const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
    const [toneOfVoice, setToneOfVoice] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [color, setColor] = useState('#E1306C'); // Default generic pink/red

    const [loading, setLoading] = useState(false);
    const [ideaData, setIdeaData] = useState<any>(null);

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
                        setEndDate(data.endDate || '');

                        // Parse description (Markdown to HTML if needed)
                        let desc = data.description || '';
                        if (desc && !desc.trim().match(/^<[a-z][\s\S]*>/i)) {
                            desc = desc
                                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                                .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                                .replace(/^\s*-\s+(.*$)/gim, '<ul><li>$1</li></ul>') // Basic list
                                .replace(/\n/gim, '<br />');
                        }
                        setDescription(desc);

                        setPlatforms(data.platforms || []);
                        setToneOfVoice(data.toneOfVoice || '');
                        setTargetAudience(data.targetAudience || '');
                        setTags(data.tags || []);
                        setColor(data.color || '#E1306C');
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
                        setIdeaData(idea);
                        setName(idea.title);

                        // Parse concept if available
                        if (idea.concept && idea.concept.startsWith('{')) {
                            const parsed = JSON.parse(idea.concept);
                            setGoal(parsed.goal || '');
                            if (parsed.timelineStart) setStartDate(parsed.timelineStart);
                            if (parsed.timelineEnd) setEndDate(parsed.timelineEnd);
                            // Add logic to extract platforms from concept if stored
                            if (parsed.platforms && Array.isArray(parsed.platforms)) {
                                setPlatforms(parsed.platforms);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch idea", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchIdea();
        }
    }, [projectId, campaignId, ideaId]);

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
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    const handleGenerateAI = async () => {
        if (!name) return;
        setLoading(true);
        try {
            const result = await generateCampaignDetailsAI(name);
            setGoal(result.goal);
            setDescription(result.description);
            setTargetAudience(result.targetAudience);
            setToneOfVoice(result.toneOfVoice);
            setPlatforms(result.platforms as SocialPlatform[]); // Assuming AI returns valid types, might need validation in real app
            setTags(result.tags);
            setStartDate(result.startDate);
            setEndDate(result.endDate);
        } catch (error) {
            console.error("AI Generation failed", error);
            // Optionally add toast error here
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!projectId || !name || !auth.currentUser) return;
        setLoading(true);
        try {
            const data: any = {
                name,
                goal,
                description,
                platforms,
                toneOfVoice,
                targetAudience,
                startDate: startDate || null,
                endDate: endDate || null,
                status,
                projectId,
                tags,
                color,
                ownerId: auth.currentUser.uid,
                originIdeaId: ideaId || (campaignId ? undefined : null) // Keep original idea link if converting
            };

            let newCampaignId = campaignId;
            if (campaignId) {
                await updateCampaign(projectId, campaignId, data);
            } else {
                newCampaignId = await createSocialCampaign(projectId, data);
            }

            if (ideaId && newCampaignId) {
                await updateIdea(projectId, ideaId, {
                    convertedCampaignId: newCampaignId,
                    campaignType: 'social',
                    stage: 'Scheduled'
                });
            }

            navigate(`/project/${projectId}/social/campaigns`);
        } catch (error) {
            console.error("Failed to save campaign", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center p-6 min-h-full w-full bg-[var(--color-bg-base)]">
            <div className="w-full max-w-5xl bg-[var(--color-surface-card)] rounded-3xl shadow-xl border border-[var(--color-surface-border)] overflow-hidden flex flex-col md:flex-row animate-fade-in relative">

                {/* Close Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                {/* Left Panel: Form */}
                <div className="flex-1 flex flex-col border-r border-[var(--color-surface-border)]">
                    <header className="px-8 py-6 border-b border-[var(--color-surface-border)]">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="p-2 bg-orange-100 text-orange-600 rounded-lg material-symbols-outlined">campaign</span>
                            <h1 className="text-xl font-bold text-[var(--color-text-main)]">
                                {campaignId ? 'Edit Campaign' : 'Create New Campaign'}
                            </h1>
                        </div>
                        <p className="text-sm text-[var(--color-text-subtle)] ml-12">
                            {campaignId ? 'Update your campaign details and strategy.' : 'Define your social media campaign strategy and goals.'}
                        </p>
                    </header>

                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-6">

                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Campaign Details</h3>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Input
                                        label="Campaign Name"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Summer Launch 2025"
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
                                    Auto-Fill
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">Status</label>
                                    <Select value={status} onChange={e => setStatus(e.target.value as any)}>
                                        <option value="Backlog">Backlog</option>
                                        <option value="Planning">Planning</option>
                                        <option value="Active">Active</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Paused">Paused</option>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase block">Theme Color</label>
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
                        </div>

                        {/* Strategy */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Campaign Strategy</h3>
                            <Input
                                label="Primary Goal"
                                value={goal}
                                onChange={e => setGoal(e.target.value)}
                                placeholder="e.g. Increase brand awareness by 20%"
                            />

                            <div>
                                <label className="text-sm font-bold text-[var(--color-text-main)] mb-1 block">Description & Strategy</label>
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    placeholder="Outline your campaign strategy, key phases, and messaging pillars..."
                                    className="min-h-[200px]"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextArea
                                    label="Target Audience"
                                    value={targetAudience}
                                    onChange={e => setTargetAudience(e.target.value)}
                                    placeholder="Demographics, psychographics, pain points..."
                                    rows={3}
                                />
                                <TextArea
                                    label="Tone of Voice"
                                    value={toneOfVoice}
                                    onChange={e => setToneOfVoice(e.target.value)}
                                    placeholder="e.g. Witty, Professional, Urgent..."
                                    rows={3}
                                />
                            </div>
                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">Tags</label>
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
                                    placeholder="Add tag + Enter"
                                    className="bg-transparent border-none text-xs focus:ring-0 p-1 min-w-[80px]"
                                />
                            </div>

                        </div>
                        {/* Platforms & Timeline */}
                        <div className="space-y-4 pt-4 border-t border-[var(--color-surface-border)]">
                            <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Platforms & Schedule</h3>

                            <div>
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">Target Platforms</label>
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

                            <div className="grid grid-cols-2 gap-6">
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={setStartDate}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={endDate}
                                    onChange={setEndDate}
                                />
                            </div>

                            {/* Color Picker */}
                            <div>
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2 block">Campaign Color</label>
                                <div className="flex gap-2">
                                    {['#E1306C', '#1877F2', '#0A66C2', '#000000', '#FF0000', '#1DB954', '#F48024'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-[var(--color-text-main)] scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={e => setColor(e.target.value)}
                                        className="w-6 h-6 rounded-full overflow-hidden border-0 p-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>


                    <footer className="px-8 py-5 border-t border-[var(--color-surface-border)] flex gap-3 justify-end bg-[var(--color-surface-card)]">
                        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                        <Button variant="primary" onClick={handleSubmit} isLoading={loading} disabled={!name}>
                            {campaignId ? 'Save Changes' : 'Create Campaign'}
                        </Button>
                    </footer>
                </div>


                {/* Right Panel: Preview / Summary (Optional, purely visual for now) */}
                <div className="w-1/3 bg-[var(--color-surface-bg)] hidden md:flex flex-col p-8 border-l border-[var(--color-surface-border)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                    <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase mb-6 relative z-10">Campaign Card Preview</h2>

                    <div className="relative z-10 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-6 shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${status === 'Active' ? 'bg-green-100 text-green-700' :
                                status === 'Planning' ? 'bg-blue-100 text-blue-700' :
                                    status === 'Completed' ? 'bg-purple-100 text-purple-700' :
                                        status === 'Paused' ? 'bg-amber-100 text-amber-700' :
                                            'bg-gray-100 text-gray-700'
                                }`}>
                                {status}
                            </span>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-hover)]">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">more_horiz</span>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2 line-clamp-2">
                            {name || 'Campaign Name'}
                        </h3>

                        <p className="text-sm text-[var(--color-text-muted)] line-clamp-3 mb-6 min-h-[40px]">
                            {description || 'No description provided.'}
                        </p>

                        <div className="space-y-3">
                            {/* Date */}
                            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                <span>
                                    {startDate ? new Date(startDate).toLocaleDateString() : 'Start Date'} - {endDate ? new Date(endDate).toLocaleDateString() : 'End Date'}
                                </span>
                            </div>

                            {/* Platforms */}
                            <div className="flex flex-wrap gap-1">
                                {platforms.length > 0 ? platforms.map(p => (
                                    <span key={p} className="px-1.5 py-0.5 bg-[var(--color-surface-hover)] rounded text-[10px] font-medium text-[var(--color-text-muted)]">
                                        {p}
                                    </span>
                                )) : <span className="text-[10px] text-[var(--color-text-muted)] italic">No platforms selected</span>}
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-[var(--color-surface-border)] flex justify-between items-center">
                            <div className="flex -space-x-2">
                                <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white dark:border-black" />
                                <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white dark:border-black" />
                            </div>
                            <div className="text-xs font-bold text-[var(--color-primary)]">
                                View Details
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 relative z-10">
                        <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-2">Tips</h4>
                        <ul className="text-xs text-[var(--color-text-subtle)] space-y-2 list-disc pl-4">
                            <li>Set a clear, measurable goal.</li>
                            <li>Define your target audience to tailor content.</li>
                            <li>Align your tone of voice with your brand identity.</li>
                            <li>Choose platforms where your audience is most active.</li>
                        </ul>
                    </div>
                </div>
            </div >
        </div>

    );
};
