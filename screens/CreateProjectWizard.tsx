import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateProjectDescription, generateProjectBlueprint } from '../services/geminiService';
import { createProject, getWorkspaceMembers, createMilestone, addTask, getUserProfile, linkWithGithub, updateUserData, getWorkspaceGroups } from '../services/dataService';
import { fetchUserRepositories, GithubRepo } from '../services/githubService';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { ImageCropper } from '../components/ui/ImageCropper';
import { DatePicker } from '../components/ui/DatePicker';
import { ProjectModule, ProjectBlueprint, WorkspaceGroup } from '../types';
import { useToast } from '../context/UIContext';
import { auth, storage } from '../services/firebase'; // Added storage for manual uploads if needed (though MediaLibrary handles it)
import { MediaLibrary } from '../components/MediaLibrary/MediaLibraryModal';

const STEPS = [
    { id: 0, label: 'Method' },
    { id: 1, label: 'Details' },
    { id: 2, label: 'Modules' },
    { id: 3, label: 'Team' },
    { id: 4, label: 'Timeline' },
    { id: 5, label: 'Assets' },
];

export const CreateProjectWizard = () => {
    const navigate = useNavigate();
    const { can } = useWorkspacePermissions();
    const { showToast } = useToast();
    const { dateFormat, dateLocale } = useLanguage();

    const [currentStep, setCurrentStep] = useState(0);
    const [creationMode, setCreationMode] = useState<'scratch' | 'ai' | null>(null);

    // Form Data
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [projectType, setProjectType] = useState<'standard' | 'software' | 'creative'>('standard');
    const [modules, setModules] = useState<ProjectModule[]>(['tasks', 'ideas', 'activity']);
    const [availableMembers, setAvailableMembers] = useState<any[]>([]);
    const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [visibilityGroupIds, setVisibilityGroupIds] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [status, setStatus] = useState('Planning');
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [squareIconFile, setSquareIconFile] = useState<File | null>(null);
    const [links, setLinks] = useState<{ title: string; url: string }[]>([]);
    const [externalResources, setExternalResources] = useState<{ title: string; url: string; icon?: string }[]>([]);

    // Media Library State
    const [mediaPickerTarget, setMediaPickerTarget] = useState<'cover' | 'icon' | null>(null);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [squareIconUrl, setSquareIconUrl] = useState<string | null>(null);
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);

    // AI State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Cropper State
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [cropAspectRatio, setCropAspectRatio] = useState(1);
    const [cropType, setCropType] = useState<'cover' | 'icon' | null>(null);

    // GitHub State
    const [githubToken, setGithubToken] = useState<string | null>(null);
    const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
    const [selectedGithubRepo, setSelectedGithubRepo] = useState<string>('');
    const [loadingGithub, setLoadingGithub] = useState(false);
    const [connectingGithub, setConnectingGithub] = useState(false);

    const handleAiPromptChange = useArrowReplacement((e) => setAiPrompt(e.target.value));

    useEffect(() => {
        getWorkspaceMembers().then(members => {
            setAvailableMembers(members.filter(m => m.role !== 'Guest'));
        });
        getWorkspaceGroups().then(setWorkspaceGroups).catch(console.error);
        // Load GitHub token
        const loadGithubData = async () => {
            const user = auth.currentUser;
            if (user) {
                const profile = await getUserProfile(user.uid);
                if (profile?.githubToken) {
                    setGithubToken(profile.githubToken);
                    setLoadingGithub(true);
                    try {
                        const repos = await fetchUserRepositories(profile.githubToken);
                        setGithubRepos(repos);
                    } catch (e) {
                        console.error('Failed to fetch repos', e);
                    } finally {
                        setLoadingGithub(false);
                    }
                }
            }
        };
        loadGithubData();
    }, []);

    useEffect(() => {
        if (creationMode === 'scratch') {
            const defaults: Record<string, ProjectModule[]> = {
                standard: ['tasks', 'ideas', 'milestones', 'activity'],
                software: ['tasks', 'issues', 'activity'],
                creative: ['ideas', 'mindmap', 'activity']
            };
            setModules(defaults[projectType] || defaults.standard);
        }
    }, [projectType, creationMode]);

    const handleNext = () => setCurrentStep(c => Math.min(c + 1, 5));
    const handleBack = () => {
        if (currentStep === 1) {
            setCurrentStep(0);
            setCreationMode(null);
            setBlueprint(null);
        } else {
            setCurrentStep(c => Math.max(c - 1, 0));
        }
    };

    const handleMethodSelect = (mode: 'scratch' | 'ai') => {
        setCreationMode(mode);
        setCurrentStep(1);
    };

    const handleExecuteAI = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const result = await generateProjectBlueprint(aiPrompt);
            setBlueprint(result);
            setName(result.title);
            setDescription(result.description);
            setModules(['tasks', 'milestones', 'activity', 'ideas']);
            handleNext();
        } catch (e) {
            console.error(e);
            showToast('Failed to generate blueprint.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateDesc = async () => {
        if (!name) return;
        setIsGenerating(true);
        try {
            const desc = await generateProjectDescription(name, `A ${projectType} project`);
            setDescription(desc);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'icon') => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = () => {
                setCropImageSrc(reader.result as string);
                setCropType(type);
                setCropAspectRatio(type === 'cover' ? 16 / 9 : 1);
            };
            reader.readAsDataURL(e.target.files[0]);

            // Clear URL if picking a local file
            if (type === 'cover') setCoverUrl(null);
            else setSquareIconUrl(null);
        }
        e.target.value = '';
    };

    const handleCropComplete = (blob: Blob) => {
        const file = new File([blob], cropType === 'cover' ? "cover.jpg" : "icon.jpg", { type: "image/jpeg" });
        if (cropType === 'cover') {
            setCoverFile(file);
            setCoverUrl(null);
        } else {
            setSquareIconFile(file);
            setSquareIconUrl(null);
        }
        setCropImageSrc(null);
        setCropType(null);
    };

    const handleSubmit = async () => {
        if (!name) return;
        setIsSubmitting(true);
        try {
            const projectId = await createProject({
                title: name,
                description,
                startDate,
                dueDate,
                priority,
                status: status as any,
                modules,
                links: links.filter(l => l.title && l.url),
                externalResources: externalResources.filter(r => r.title && r.url),
                ...(selectedGithubRepo && { githubRepo: selectedGithubRepo, githubIssueSync: true })
            }, coverUrl || coverFile || undefined, squareIconUrl || squareIconFile || undefined, undefined, selectedMemberIds, undefined, visibilityGroupIds);

            if (blueprint) {
                for (const ms of blueprint.milestones) {
                    await createMilestone(projectId, { title: ms.title, description: ms.description, status: 'Pending' });
                }
                for (const task of blueprint.initialTasks) {
                    await addTask(projectId, task.title, undefined, undefined, task.priority, { category: ['AI Generated'] });
                }
            }

            navigate('/projects');
            showToast(`Project "${name}" created.`, 'success');
        } catch (e) {
            console.error(e);
            setIsSubmitting(false);
            showToast('Failed to create project.', 'error');
        }
    };

    if (!can('canCreateProjects')) return <div className="p-10 text-center text-[var(--color-text-subtle)]">Access Denied</div>;

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'software': return 'terminal';
            case 'creative': return 'palette';
            default: return 'folder_open';
        }
    };

    return (
        <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-gradient-to-br from-[var(--color-surface-bg)] via-[var(--color-surface-bg)] to-zinc-100/30 dark:to-zinc-800/10 overflow-auto">
            <ImageCropper
                isOpen={!!cropImageSrc}
                imageSrc={cropImageSrc}
                aspectRatio={cropAspectRatio}
                onCropComplete={handleCropComplete}
                onCancel={() => { setCropImageSrc(null); setCropType(null); }}
            />

            <MediaLibrary
                isOpen={showMediaLibrary}
                onClose={() => setShowMediaLibrary(false)}
                projectId={""} // No project yet
                deferredUpload={true}
                onSelect={(asset) => {
                    if (mediaPickerTarget === 'cover') {
                        if (asset.source === 'local_file' && asset.file) {
                            setCoverFile(asset.file);
                            setCoverUrl(null);
                        } else {
                            setCoverUrl(asset.url);
                            setCoverFile(null);
                        }
                    } else if (mediaPickerTarget === 'icon') {
                        if (asset.source === 'local_file' && asset.file) {
                            setSquareIconFile(asset.file);
                            setSquareIconUrl(null);
                        } else {
                            setSquareIconUrl(asset.url);
                            setSquareIconFile(null);
                        }
                    }
                    setShowMediaLibrary(false);
                }}
            />

            {/* Main Split Card Container - Fixed Height */}
            <div className="w-full max-w-6xl h-[780px] bg-[var(--color-surface-card)] rounded-3xl shadow-2xl border border-[var(--color-surface-border)] flex overflow-hidden animate-fade-in">

                {/* LEFT: Form Panel */}
                <div className="w-[55%] flex flex-col border-r border-[var(--color-surface-border)]">

                    {/* Header */}
                    <header className="px-8 py-5 border-b border-[var(--color-surface-border)] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-lg font-bold text-[var(--color-text-main)]">New Project</h1>
                                {currentStep > 0 && (
                                    <p className="text-[11px] text-[var(--color-text-subtle)] font-medium">Step {currentStep} of 5 — {STEPS[currentStep]?.label}</p>
                                )}
                            </div>
                        </div>

                        {/* Step Pills */}
                        <div className="flex items-center gap-1">
                            {STEPS.slice(1).map((step) => (
                                <div
                                    key={step.id}
                                    className={`h-2 rounded-full transition-all duration-500 ${currentStep >= step.id
                                        ? 'w-6 bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 shadow-sm shadow-zinc-500/15'
                                        : 'w-2 bg-[var(--color-surface-border)]'
                                        }`}
                                />
                            ))}
                        </div>
                    </header>

                    {/* Content Area - Fixed Height with Overflow */}
                    <div className="flex-1 p-8 overflow-y-auto overflow-x-visible custom-scrollbar">

                        {/* Step 0: Method */}
                        {currentStep === 0 && (
                            <div className="space-y-8 animate-fade-in h-full flex flex-col">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">How would you like to start?</h2>
                                    <p className="text-sm text-[var(--color-text-subtle)]">Choose a method to set up your project.</p>
                                </div>

                                <div className="grid gap-5 flex-1 content-center">
                                    <button
                                        onClick={() => handleMethodSelect('scratch')}
                                        className="group py-12 px-8 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] transition-all flex items-center gap-6 text-left hover:scale-[1.01] hover:shadow-lg hover:shadow-zinc-500/10"
                                    >
                                        <div className="size-16 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-800 flex items-center justify-center shadow-lg shadow-zinc-500/15">
                                            <span className="material-symbols-outlined text-[28px]">edit_note</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-lg font-bold text-[var(--color-text-main)]">Start from Scratch</div>
                                            <div className="text-sm text-[var(--color-text-subtle)] mt-1">Manually configure all project settings and customize every detail.</div>
                                        </div>
                                        <span className="material-symbols-outlined text-[var(--color-text-muted)] text-[28px] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                    </button>

                                    <button
                                        onClick={() => handleMethodSelect('ai')}
                                        className="group py-12 px-8 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] transition-all flex items-center gap-6 text-left hover:scale-[1.01] hover:shadow-lg hover:shadow-zinc-500/10"
                                    >
                                        <div className="size-16 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-800 flex items-center justify-center shadow-lg shadow-zinc-500/15">
                                            <span className="material-symbols-outlined text-[28px]">auto_awesome</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-lg font-bold text-[var(--color-text-main)]">Use AI Architect</div>
                                            <div className="text-sm text-[var(--color-text-subtle)] mt-1">Describe your flow and let AI generate a complete project blueprint.</div>
                                        </div>
                                        <span className="material-symbols-outlined text-[var(--color-text-muted)] text-[28px] group-hover:translate-x-1 transition-transform">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Details (AI) */}
                        {currentStep === 1 && creationMode === 'ai' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Describe Your Project</h2>
                                    <p className="text-sm text-[var(--color-text-subtle)]">Provide a brief description and AI will generate a structure.</p>
                                </div>

                                <textarea
                                    value={aiPrompt}
                                    onChange={handleAiPromptChange}
                                    placeholder="e.g. A mobile app for tracking personal fitness goals with social features..."
                                    className="w-full min-h-[200px] p-4 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 outline-none resize-none transition-all"
                                />

                                <Button
                                    onClick={handleExecuteAI}
                                    disabled={!aiPrompt.trim() || isGenerating}
                                    className="w-full h-12 bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 hover:from-indigo-600 hover:to-violet-600"
                                    variant="primary"
                                >
                                    {isGenerating ? (
                                        <><span className="material-symbols-outlined animate-spin text-[18px] mr-2">progress_activity</span>Generating Blueprint...</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-[18px] mr-2">magic_button</span>Generate Blueprint</>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Step 1: Details (Scratch) */}
                        {currentStep === 1 && creationMode === 'scratch' && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Project Details</h2>
                                    <p className="text-sm text-[var(--color-text-subtle)]">Give your project a name and description.</p>
                                </div>

                                <div className="space-y-4">
                                    <Input
                                        label="Project Name"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Q1 Marketing Campaign"
                                        autoFocus
                                    />

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Description</label>
                                            <button onClick={handleGenerateDesc} disabled={!name || isGenerating} className="text-[10px] font-semibold text-[var(--color-text-main)] hover:text-[var(--color-text-main)] disabled:opacity-30 flex items-center gap-1">
                                                <span className={`material-symbols-outlined text-sm ${isGenerating ? 'animate-spin' : ''}`}>auto_awesome</span>
                                                AI Compose
                                            </button>
                                        </div>
                                        <Textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="Briefly describe the goals and scope..."
                                            className="min-h-[80px]"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Type</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {(['standard', 'software', 'creative'] as const).map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setProjectType(t)}
                                                    className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all hover:scale-[1.02] hover:shadow-md ${projectType === t
                                                        ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-800 shadow-lg shadow-zinc-500/10'
                                                        : 'bg-black/[0.03] dark:bg-white/[0.03] text-[var(--color-text-subtle)]'
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-[24px]">{getTypeIcon(t)}</span>
                                                    <span className="text-[10px] font-bold uppercase">{t}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Modules - GRID LAYOUT */}
                        {currentStep === 2 && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Select Modules</h2>
                                    <p className="text-sm text-[var(--color-text-subtle)]">Choose the tools you need for this project.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'tasks', label: 'Tasks', desc: 'Track work items', icon: 'check_circle' },
                                        { id: 'issues', label: 'Issues', desc: 'Bug tracking', icon: 'bug_report' },
                                        { id: 'ideas', label: 'Flows', desc: 'Brainstorming', icon: 'lightbulb' },
                                        { id: 'milestones', label: 'Milestones', desc: 'Key deadlines', icon: 'flag' },
                                        { id: 'social', label: 'Social', desc: 'Campaign Manager', icon: 'campaign' },
                                        { id: 'marketing', label: 'Marketing', desc: 'Ads & Email', icon: 'ads_click' },
                                        { id: 'mindmap', label: 'Mind Map', desc: 'Visual structures', icon: 'account_tree' },
                                        { id: 'activity', label: 'Activity', desc: 'Change log', icon: 'history' },
                                    ].map(m => {
                                        const isActive = modules.includes(m.id as any);
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => setModules(curr => isActive ? curr.filter(x => x !== m.id) : [...curr, m.id as any])}
                                                className={`p-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02] hover:shadow-md ${isActive
                                                    ? 'bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 shadow-lg shadow-zinc-500/10'
                                                    : 'bg-black/[0.03] dark:bg-white/[0.03]'
                                                    }`}
                                            >
                                                <div className={`size-9 rounded-lg flex items-center justify-center transition-all shrink-0 ${isActive ? 'bg-white/20 dark:bg-black/10 text-white dark:text-zinc-800' : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)]'}`}>
                                                    <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                                                </div>
                                                <div className="flex-1 text-left min-w-0">
                                                    <div className={`text-sm font-semibold truncate ${isActive ? 'text-white dark:text-zinc-800' : 'text-[var(--color-text-main)]'}`}>{m.label}</div>
                                                    <div className={`text-[10px] truncate ${isActive ? 'text-white/70 dark:text-zinc-600' : 'text-[var(--color-text-subtle)]'}`}>{m.desc}</div>
                                                </div>
                                                {isActive && <span className="material-symbols-outlined text-white dark:text-zinc-800 text-[18px] shrink-0">check_circle</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Team */}
                        {currentStep === 3 && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Add Team Members</h2>
                                    <p className="text-sm text-[var(--color-text-subtle)]">Select people to invite to this project.</p>
                                </div>

                                {availableMembers.length === 0 ? (
                                    <div className="text-center py-12 text-[var(--color-text-subtle)]">
                                        <span className="material-symbols-outlined text-5xl opacity-30">group</span>
                                        <p className="mt-3 text-sm">No team members available.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {availableMembers.map(user => {
                                            const isSelected = selectedMemberIds.includes(user.uid);
                                            return (
                                                <button
                                                    key={user.uid}
                                                    onClick={() => setSelectedMemberIds(curr => isSelected ? curr.filter(id => id !== user.uid) : [...curr, user.uid])}
                                                    className={`p-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02] hover:shadow-md ${isSelected
                                                        ? 'bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 shadow-lg shadow-zinc-500/10'
                                                        : 'bg-black/[0.03] dark:bg-white/[0.03]'
                                                        }`}
                                                >
                                                    <div className={`size-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/20 dark:bg-black/10' : 'bg-[var(--color-surface-bg)]'}`}>
                                                        {user.photoURL ? <img src={user.photoURL} className="size-full object-cover" /> : <span className={`material-symbols-outlined text-base ${isSelected ? 'text-white dark:text-zinc-800' : 'text-[var(--color-text-subtle)]'}`}>person</span>}
                                                    </div>
                                                    <div className="flex-1 text-left min-w-0">
                                                        <div className={`text-sm font-semibold truncate ${isSelected ? 'text-white dark:text-zinc-800' : 'text-[var(--color-text-main)]'}`}>{user.displayName}</div>
                                                        <div className={`text-[10px] truncate ${isSelected ? 'text-white/70 dark:text-zinc-600' : 'text-[var(--color-text-subtle)]'}`}>{user.email}</div>
                                                    </div>
                                                    {isSelected && <span className="material-symbols-outlined text-white dark:text-zinc-800 text-[18px] shrink-0">check_circle</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Project Visibility Section */}
                                <div className="pt-6 mt-2 border-t border-[var(--color-surface-border)]">
                                    <div className="space-y-2 mb-4">
                                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">Visibility</h3>
                                        <p className="text-sm text-[var(--color-text-subtle)]">Who can see this project?</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setVisibilityGroupIds([])}
                                            className={`p-4 rounded-xl flex flex-col items-start gap-2 transition-all hover:scale-[1.02] ${visibilityGroupIds.length === 0
                                                ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-800 shadow-lg'
                                                : 'bg-black/[0.03] dark:bg-white/[0.03] text-[var(--color-text-main)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[20px]">public</span>
                                                <span className="text-sm font-bold">Everyone</span>
                                            </div>
                                            <span className={`text-[10px] ${visibilityGroupIds.length === 0 ? 'text-white/70 dark:text-zinc-600' : 'text-[var(--color-text-subtle)]'}`}>
                                                Visible to all workspace members
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (visibilityGroupIds.length === 0 && workspaceGroups.length > 0) {
                                                    setVisibilityGroupIds([workspaceGroups[0].id]);
                                                }
                                            }}
                                            disabled={workspaceGroups.length === 0}
                                            className={`p-4 rounded-xl flex flex-col items-start gap-2 transition-all hover:scale-[1.02] ${visibilityGroupIds.length > 0
                                                ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-800 shadow-lg'
                                                : 'bg-black/[0.03] dark:bg-white/[0.03] text-[var(--color-text-main)]'
                                                } ${workspaceGroups.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[20px]">lock_person</span>
                                                <span className="text-sm font-bold">Specific Groups</span>
                                            </div>
                                            <span className={`text-[10px] ${visibilityGroupIds.length > 0 ? 'text-white/70 dark:text-zinc-600' : 'text-[var(--color-text-subtle)]'}`}>
                                                {workspaceGroups.length === 0 ? 'No groups available' : 'Restricted to selected groups'}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Group Selector Dropdown */}
                                    {visibilityGroupIds.length > 0 && workspaceGroups.length > 0 && (
                                        <div className="mt-4 animate-fade-in">
                                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">
                                                Select Allowed Groups
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {workspaceGroups.map(group => {
                                                    const isSelected = visibilityGroupIds.includes(group.id);
                                                    return (
                                                        <button
                                                            key={group.id}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    // Don't allow deselecting the last one directly from here (keeps "Specific Group" active), 
                                                                    // or maybe allow it but if empty switch back to "Everyone"? 
                                                                    // Let's allow deselecting, and if empty it technically means "Specific Group" but none selected... 
                                                                    // typically empty array means "Everyone" in my logic? 
                                                                    // Actually, my logic says "visibilityGroupIds.length === 0" is Everyone.
                                                                    // So if they deselect the last one, it becomes Public. That's fine.
                                                                    setVisibilityGroupIds(prev => prev.filter(id => id !== group.id));
                                                                } else {
                                                                    setVisibilityGroupIds(prev => [...prev, group.id]);
                                                                }
                                                            }}
                                                            className={`p-3 rounded-xl flex items-center gap-3 border transition-all ${isSelected
                                                                ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50'
                                                                }`}
                                                        >
                                                            <div
                                                                className="size-3 rounded-full shrink-0"
                                                                style={{ backgroundColor: group.color || '#9ca3af' }}
                                                            />
                                                            <span className="text-sm font-medium truncate">{group.name}</span>
                                                            {isSelected && (
                                                                <span className="material-symbols-outlined text-[16px] ml-auto">check</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 4: Timeline */}
                        {currentStep === 4 && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Set Timeline</h2>
                                    <p className="text-sm text-[var(--color-text-subtle)]">Define the project schedule and priority.</p>
                                </div>

                                <div className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 relative">
                                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Start Date</label>
                                            <DatePicker value={startDate} onChange={setStartDate} />
                                        </div>
                                        <div className="space-y-2 relative">
                                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Due Date</label>
                                            <DatePicker value={dueDate} onChange={setDueDate} align="right" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Priority</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setPriority(p)}
                                                    className={`py-3 rounded-xl text-xs font-bold uppercase transition-all hover:scale-[1.02] hover:shadow-md ${priority === p
                                                        ? 'bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 text-white dark:text-zinc-800 shadow-md shadow-zinc-500/10'
                                                        : 'bg-black/[0.03] dark:bg-white/[0.03] text-[var(--color-text-subtle)]'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Initial Status</label>
                                        <select
                                            className="w-full h-11 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl px-4 text-sm text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500"
                                            value={status}
                                            onChange={e => setStatus(e.target.value)}
                                        >
                                            <option>Planning</option>
                                            <option>Active</option>
                                            <option>On Hold</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Assets */}
                        {currentStep === 5 && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">Upload Assets</h2>
                                    <p className="text-sm text-[var(--color-text-subtle)]">Add a cover image and icon for your project.</p>
                                </div>

                                <div className="space-y-5">
                                    <div className="flex gap-4">
                                        {/* Cover Selection */}
                                        <div className="flex-1 space-y-2">
                                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Project Cover</label>
                                            <div
                                                onClick={() => { setMediaPickerTarget('cover'); setShowMediaLibrary(true); }}
                                                className="relative h-32 rounded-2xl bg-gradient-to-br from-[var(--color-surface-bg)] to-[var(--color-surface-hover)] border border-dashed border-[var(--color-surface-border)] overflow-hidden flex flex-col items-center justify-center gap-2 group transition-all hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 cursor-pointer"
                                            >
                                                {coverUrl || coverFile ? (
                                                    <>
                                                        <img src={coverUrl || (coverFile ? URL.createObjectURL(coverFile) : '')} className="absolute inset-0 size-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                                Change
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setCoverUrl(null); setCoverFile(null); }}
                                                            className="absolute top-2 right-2 size-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors z-20"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                                                        <span className="material-symbols-outlined text-[24px]">image</span>
                                                        <span className="text-xs font-semibold">Select Cover</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Icon Selection */}
                                        <div className="flex-1 space-y-2">
                                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Project Icon</label>
                                            <div
                                                onClick={() => { setMediaPickerTarget('icon'); setShowMediaLibrary(true); }}
                                                className="relative h-32 rounded-2xl bg-gradient-to-br from-[var(--color-surface-bg)] to-[var(--color-surface-hover)] border border-dashed border-[var(--color-surface-border)] overflow-hidden flex flex-col items-center justify-center gap-2 group transition-all hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 cursor-pointer"
                                            >
                                                {squareIconUrl || squareIconFile ? (
                                                    <>
                                                        <img src={squareIconUrl || (squareIconFile ? URL.createObjectURL(squareIconFile) : '')} className="absolute inset-4 size-[calc(100%-32px)] object-cover rounded-xl shadow-sm" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <span className="text-white text-xs font-bold flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                                Change
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSquareIconUrl(null); setSquareIconFile(null); }}
                                                            className="absolute top-2 right-2 size-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors z-20"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                                                        <span className="material-symbols-outlined text-[24px]">smart_button</span>
                                                        <span className="text-xs font-semibold">Select Icon</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* GitHub Integration - Only for Software Projects */}
                                    {projectType === 'software' && (
                                        <div className="pt-4 border-t border-[var(--color-surface-border)]">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">GitHub Integration</label>
                                                    <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5">Link a repository to sync issues.</p>
                                                </div>
                                            </div>
                                            {!githubToken ? (
                                                <button
                                                    onClick={async () => {
                                                        const user = auth.currentUser;
                                                        if (!user) return;
                                                        setConnectingGithub(true);
                                                        try {
                                                            const token = await linkWithGithub();
                                                            await updateUserData(user.uid, { githubToken: token });
                                                            setGithubToken(token);
                                                            const repos = await fetchUserRepositories(token);
                                                            setGithubRepos(repos);
                                                        } catch (e: any) {
                                                            console.error('Failed to link GitHub', e);
                                                        } finally {
                                                            setConnectingGithub(false);
                                                        }
                                                    }}
                                                    disabled={connectingGithub}
                                                    className="w-full p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-4"
                                                >
                                                    <div className="size-10 rounded-lg bg-[#24292f] dark:bg-white flex items-center justify-center">
                                                        <svg className="size-5 text-white dark:text-[#24292f]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <div className="text-sm font-semibold text-[var(--color-text-main)]">
                                                            {connectingGithub ? 'Connecting...' : 'Connect GitHub'}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--color-text-subtle)]">Link your account to select a repository</div>
                                                    </div>
                                                    <span className="material-symbols-outlined text-[var(--color-text-muted)]">arrow_forward</span>
                                                </button>
                                            ) : (
                                                <div className="space-y-2">
                                                    <select
                                                        value={selectedGithubRepo}
                                                        onChange={(e) => setSelectedGithubRepo(e.target.value)}
                                                        disabled={loadingGithub}
                                                        className="w-full h-11 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl px-4 text-sm text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500"
                                                    >
                                                        <option value="">{loadingGithub ? 'Loading repositories...' : 'Select a repository'}</option>
                                                        {githubRepos.map(repo => (
                                                            <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
                                                        ))}
                                                    </select>
                                                    {selectedGithubRepo && (
                                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                            Issue sync will be enabled for this project
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Links & Resources - Card Style */}
                                    <div className="space-y-4 pt-4 border-t border-[var(--color-surface-border)]">
                                        {/* Links & Resources - Updated Card Style */}
                                        <div className="space-y-4 pt-4 border-t border-[var(--color-surface-border)]">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">link</span>
                                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Quick Links</label>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
                                                {/* Combined List of all links for cleaner UI */}

                                                {/* Sidebar Resources */}
                                                {externalResources.map((res, idx) => (
                                                    <div key={`res-${idx}`} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] group focus-within:ring-2 focus-within:ring-zinc-500/10 focus-within:border-zinc-500/50 transition-all">
                                                        <div className="size-8 rounded-lg bg-[var(--color-surface-card)] flex items-center justify-center shrink-0 text-[var(--color-text-subtle)]">
                                                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <input
                                                                placeholder="Resource Label"
                                                                value={res.title}
                                                                onChange={(e) => {
                                                                    const newRes = [...externalResources];
                                                                    newRes[idx].title = e.target.value;
                                                                    setExternalResources(newRes);
                                                                }}
                                                                className="w-full text-sm font-medium bg-transparent text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                                                            />
                                                            <input
                                                                placeholder="https://example.com"
                                                                value={res.url}
                                                                onChange={(e) => {
                                                                    const newRes = [...externalResources];
                                                                    newRes[idx].url = e.target.value;
                                                                    setExternalResources(newRes);
                                                                }}
                                                                className="w-full text-xs bg-transparent text-[var(--color-text-subtle)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => setExternalResources(externalResources.filter((_, i) => i !== idx))}
                                                            className="p-2 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Overview Links */}
                                                {links.map((link, idx) => (
                                                    <div key={`link-${idx}`} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] group focus-within:ring-2 focus-within:ring-zinc-500/10 focus-within:border-zinc-500/50 transition-all">
                                                        <div className="size-8 rounded-lg bg-[var(--color-surface-card)] flex items-center justify-center shrink-0 text-[var(--color-text-subtle)]">
                                                            <span className="material-symbols-outlined text-[18px]">link</span>
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <input
                                                                placeholder="Link Label"
                                                                value={link.title}
                                                                onChange={(e) => {
                                                                    const newLinks = [...links];
                                                                    newLinks[idx].title = e.target.value;
                                                                    setLinks(newLinks);
                                                                }}
                                                                className="w-full text-sm font-medium bg-transparent text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                                                            />
                                                            <input
                                                                placeholder="https://example.com"
                                                                value={link.url}
                                                                onChange={(e) => {
                                                                    const newLinks = [...links];
                                                                    newLinks[idx].url = e.target.value;
                                                                    setLinks(newLinks);
                                                                }}
                                                                className="w-full text-xs bg-transparent text-[var(--color-text-subtle)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                                                            className="p-2 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </div>
                                                ))}

                                                <div className="flex gap-2 pt-2">
                                                    <button
                                                        onClick={() => setExternalResources([...externalResources, { title: '', url: '', icon: 'open_in_new' }])}
                                                        className="flex-1 py-3 px-4 rounded-xl border border-dashed border-[var(--color-surface-border)] text-xs font-medium text-[var(--color-text-subtle)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-bg)] transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                                        Add Sidebar Resource
                                                    </button>
                                                    <button
                                                        onClick={() => setLinks([...links, { title: '', url: '' }])}
                                                        className="flex-1 py-3 px-4 rounded-xl border border-dashed border-[var(--color-surface-border)] text-xs font-medium text-[var(--color-text-subtle)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-bg)] transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                                        Add Overview Link
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <footer className="px-8 py-5 border-t border-[var(--color-surface-border)] flex items-center justify-between shrink-0">
                        <div>
                            {currentStep > 0 && (
                                <button onClick={handleBack} className="px-4 py-2 text-sm font-semibold text-[var(--color-text-subtle)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-all flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                    Back
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {currentStep > 0 && currentStep < 5 && (
                                <Button onClick={handleNext} disabled={currentStep === 1 && !name} variant="primary" className="px-8 h-11 bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 hover:from-zinc-900 hover:to-black dark:hover:from-zinc-100 dark:hover:to-white !text-white dark:!text-zinc-900">
                                    Continue
                                </Button>
                            )}
                            {currentStep === 5 && (
                                <Button onClick={handleSubmit} disabled={isSubmitting || !name} variant="primary" className="px-8 h-11 bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100 hover:from-zinc-900 hover:to-black dark:hover:from-zinc-100 dark:hover:to-white !text-white dark:!text-zinc-900">
                                    {isSubmitting ? 'Creating...' : 'Create Project'}
                                </Button>
                            )}
                        </div>
                    </footer>
                </div>

                {/* RIGHT: Preview Panel */}
                <div className="w-[45%] bg-gradient-to-br from-slate-50 to-zinc-100/50 dark:from-slate-900/50 dark:to-zinc-800/30 flex items-center justify-center p-6 relative overflow-hidden">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-zinc-400/10 to-zinc-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-zinc-400/5 to-zinc-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                    {/* Preview Card */}
                    <div className="w-full max-w-sm bg-[var(--color-surface-card)] rounded-2xl shadow-2xl border border-[var(--color-surface-border)] overflow-hidden relative z-10 group">
                        {/* Cover */}
                        <div className="h-36 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 relative overflow-hidden">
                            {coverFile ? (
                                <img src={URL.createObjectURL(coverFile)} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            ) : (
                                <div className="size-full flex items-center justify-center opacity-20">
                                    <span className="material-symbols-outlined text-6xl">landscape</span>
                                </div>
                            )}
                            <div className="absolute top-3 right-3">
                                <span className="px-2.5 py-1 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-main)] shadow-sm">
                                    {status}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 pt-0 relative">
                            <div className="size-16 bg-white dark:bg-zinc-900 rounded-xl absolute -top-8 left-6 shadow-xl border-4 border-[var(--color-surface-card)] overflow-hidden flex items-center justify-center">
                                {squareIconFile ? (
                                    <img src={URL.createObjectURL(squareIconFile)} className="size-full object-cover" />
                                ) : (
                                    <span className="material-symbols-outlined text-2xl text-[var(--color-text-main)]/50">{getTypeIcon(projectType)}</span>
                                )}
                            </div>

                            <div className="pt-12 space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-[var(--color-text-main)] leading-tight truncate">{name || 'Project Name'}</h3>
                                    <p className="text-xs text-[var(--color-text-subtle)] line-clamp-2">
                                        {description || 'Your project description will appear here...'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-4 border-y border-[var(--color-surface-border)]">
                                    <div className="space-y-1">
                                        <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Team</div>
                                        <div className="flex -space-x-2 h-7">
                                            {selectedMemberIds.length > 0 ? selectedMemberIds.slice(0, 3).map(id => (
                                                <div key={id} className="size-7 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 dark:from-zinc-300 dark:to-zinc-400 border-2 border-[var(--color-surface-card)] flex items-center justify-center font-bold text-[9px] text-white overflow-hidden">
                                                    {availableMembers.find(m => m.uid === id)?.photoURL ?
                                                        <img src={availableMembers.find(m => m.uid === id).photoURL} className="size-full object-cover" /> :
                                                        availableMembers.find(m => m.uid === id)?.displayName?.charAt(0) || '?'
                                                    }
                                                </div>
                                            )) : <span className="text-[10px] text-[var(--color-text-muted)] leading-7">—</span>}
                                            {selectedMemberIds.length > 3 && (
                                                <div className="size-7 rounded-full bg-[var(--color-surface-bg)] border-2 border-[var(--color-surface-card)] flex items-center justify-center text-[9px] font-bold text-[var(--color-text-subtle)]">
                                                    +{selectedMemberIds.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Deadline</div>
                                        <div className="text-sm font-bold text-[var(--color-text-main)]">{dueDate ? format(new Date(dueDate), dateFormat, { locale: dateLocale }) : '—'}</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1.5">
                                        {modules.slice(0, 5).map(m => (
                                            <div key={m} className="size-2 rounded-full bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-100" />
                                        ))}
                                        {modules.length > 5 && <span className="text-[8px] text-[var(--color-text-muted)] ml-0.5">+{modules.length - 5}</span>}
                                    </div>
                                    <span className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase ${priority === 'Urgent' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                        priority === 'High' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400' :
                                            priority === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                                'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                        }`}>
                                        {priority}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
