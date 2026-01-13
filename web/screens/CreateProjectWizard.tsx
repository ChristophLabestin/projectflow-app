import React, { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateProjectDescription, generateProjectBlueprint } from '../services/geminiService';
import { createProject, getWorkspaceMembers, createMilestone, addTask, getUserProfile, linkWithGithub, updateUserData, getWorkspaceGroups } from '../services/dataService';
import { fetchUserRepositories, GithubRepo } from '../services/githubService';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { TextArea } from '../components/common/Input/TextArea';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { Select } from '../components/common/Select/Select';
import { PrioritySelect, type Priority } from '../components/common/PrioritySelect/PrioritySelect';
import { Card } from '../components/common/Card/Card';
import { ImageCropper } from '../components/ui/ImageCropper';
import { ProjectModule, ProjectBlueprint, WorkspaceGroup } from '../types';
import { useToast } from '../context/UIContext';
import { auth } from '../services/firebase';
import { MediaLibrary } from '../components/MediaLibrary/MediaLibraryModal';
import { ModuleSelection } from '../components/common/ModuleSelection/ModuleSelection';
import MemberSelection from '../components/common/MemberSelection/MemberSelection';

import { useModuleAccess } from '../hooks/useModuleAccess';

const STEPS = [
    { id: 0, labelKey: 'createProjectWizard.steps.method' },
    { id: 1, labelKey: 'createProjectWizard.steps.details' },
    { id: 2, labelKey: 'createProjectWizard.steps.modules' },
    { id: 3, labelKey: 'createProjectWizard.steps.team' },
    { id: 4, labelKey: 'createProjectWizard.steps.timeline' },
    { id: 5, labelKey: 'createProjectWizard.steps.assets' },
];

type ModuleOption = {
    id: ProjectModule | 'groups';
    labelKey: string;
    descKey: string;
    icon: string;
};

const MODULE_OPTIONS: ModuleOption[] = [
    { id: 'tasks', labelKey: 'createProjectWizard.modules.tasks.label', descKey: 'createProjectWizard.modules.tasks.desc', icon: 'check_circle' },
    { id: 'sprints', labelKey: 'createProjectWizard.modules.sprints.label', descKey: 'createProjectWizard.modules.sprints.desc', icon: 'directions_run' },
    { id: 'issues', labelKey: 'createProjectWizard.modules.issues.label', descKey: 'createProjectWizard.modules.issues.desc', icon: 'bug_report' },
    { id: 'ideas', labelKey: 'createProjectWizard.modules.flows.label', descKey: 'createProjectWizard.modules.flows.desc', icon: 'lightbulb' },
    { id: 'milestones', labelKey: 'createProjectWizard.modules.milestones.label', descKey: 'createProjectWizard.modules.milestones.desc', icon: 'flag' },
    { id: 'activity', labelKey: 'createProjectWizard.modules.activity.label', descKey: 'createProjectWizard.modules.activity.desc', icon: 'history' },
    { id: 'groups', labelKey: 'createProjectWizard.modules.groups.label', descKey: 'createProjectWizard.modules.groups.desc', icon: 'groups' },
    { id: 'social', labelKey: 'createProjectWizard.modules.social.label', descKey: 'createProjectWizard.modules.social.desc', icon: 'campaign' },
    { id: 'marketing', labelKey: 'createProjectWizard.modules.marketing.label', descKey: 'createProjectWizard.modules.marketing.desc', icon: 'ads_click' },
    { id: 'accounting', labelKey: 'createProjectWizard.modules.accounting.label', descKey: 'createProjectWizard.modules.accounting.desc', icon: 'receipt_long' },
];

export const CreateProjectWizard = () => {
    const navigate = useNavigate();
    const user = auth.currentUser;
    const { can } = useWorkspacePermissions();
    const { hasAccess: isSocialAllowed } = useModuleAccess('social');
    const { hasAccess: isMarketingAllowed } = useModuleAccess('marketing');
    const { hasAccess: isAccountingAllowed } = useModuleAccess('accounting');
    const { showToast } = useToast();
    const { dateFormat, dateLocale, t } = useLanguage();
    const descriptionFieldId = useId();

    const [currentStep, setCurrentStep] = useState(0);
    const [furthestVisitedStep, setFurthestVisitedStep] = useState(0); // Track max progress
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
    const [isPrivate, setIsPrivate] = useState(false);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [priority, setPriority] = useState<Priority>('medium');
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
                creative: ['ideas', 'tasks', 'activity']
            };
            setModules(defaults[projectType] || defaults.standard);
        }
    }, [projectType, creationMode]);

    const handleNext = () => {
        setCurrentStep(c => {
            const next = Math.min(c + 1, 5);
            setFurthestVisitedStep(max => Math.max(max, next));
            return next;
        });
    };

    const handleBack = () => {
        if (currentStep === 1) {
            setCurrentStep(0);
            setCreationMode(null);
            setBlueprint(null);
        } else {
            setCurrentStep(c => Math.max(c - 1, 0));
        }
    };

    const handleStepClick = (stepIndex: number) => {
        // Only allow navigation to visited steps or the very next step
        if (stepIndex <= furthestVisitedStep) {
            setCurrentStep(stepIndex);
        }
    };

    const handleMethodSelect = (mode: 'scratch' | 'ai') => {
        setCreationMode(mode);
        setCurrentStep(1);
        setFurthestVisitedStep(max => Math.max(max, 1));
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
            showToast(t('createProjectWizard.errors.generateBlueprint'), 'error');
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
            const formattedStartDate = startDate ? format(startDate, 'yyyy-MM-dd') : '';
            const formattedDueDate = dueDate ? format(dueDate, 'yyyy-MM-dd') : '';
            const projectId = await createProject({
                title: name,
                description,
                startDate: formattedStartDate,
                dueDate: formattedDueDate,
                priority: priorityValue,
                status: status as any,
                isPrivate,
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
                    await addTask(projectId, task.title, undefined, undefined, task.priority, { category: ['CORA Generated'] });
                }
            }

            navigate('/projects');
            showToast(t('createProjectWizard.toast.created').replace('{name}', name), 'success');
        } catch (e) {
            console.error(e);
            setIsSubmitting(false);
            showToast(t('createProjectWizard.errors.createProject'), 'error');
        }
    };

    const handleModuleToggle = (moduleId: string) => {
        // Map 'flows' from ModuleSelection to 'ideas' used in Wizard/Backend
        const targetId = moduleId === 'flows' ? 'ideas' : moduleId as ProjectModule;

        setModules(prev => {
            if (prev.includes(targetId)) {
                return prev.filter(m => m !== targetId);
            } else {
                return [...prev, targetId];
            }
        });
    };

    if (!can('canCreateProjects')) {
        return <div className="create-project__blocked">{t('createProjectWizard.errors.accessDenied')}</div>;
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'software': return 'terminal';
            case 'creative': return 'palette';
            default: return 'folder_open';
        }
    };

    const typeLabels: Record<typeof projectType, string> = {
        standard: t('createProjectWizard.type.standard'),
        software: t('createProjectWizard.type.software'),
        creative: t('createProjectWizard.type.creative'),
    };

    const priorityLabels: Record<Priority, string> = {
        low: t('tasks.priority.low'),
        medium: t('tasks.priority.medium'),
        high: t('tasks.priority.high'),
        urgent: t('tasks.priority.urgent'),
    };

    const priorityValueMap: Record<Priority, 'Low' | 'Medium' | 'High' | 'Urgent'> = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent',
    };

    const priorityValue = priorityValueMap[priority];

    const statusLabels: Record<string, string> = {
        Planning: t('dashboard.projectStatus.planning'),
        Active: t('dashboard.projectStatus.active'),
        'On Hold': t('dashboard.projectStatus.onHold'),
    };
    const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
        value,
        label
    }));
    const statusLabel = statusLabels[status] || status;

    const githubOptions = githubRepos.map((repo) => ({
        label: repo.full_name,
        value: repo.full_name,
    }));
    const githubPlaceholder = loadingGithub
        ? t('createProjectWizard.github.loadingRepos')
        : t('createProjectWizard.github.selectRepo');
    const githubValue = selectedGithubRepo || null;
    const githubSelectDisabled = loadingGithub || githubOptions.length === 0;

    const coverPreview = coverUrl || (coverFile ? URL.createObjectURL(coverFile) : '');
    const iconPreview = squareIconUrl || (squareIconFile ? URL.createObjectURL(squareIconFile) : '');
    const teamEmptyLabel = t('createProjectWizard.preview.teamEmpty');
    const deadlineValue = dueDate
        ? format(dueDate, dateFormat, { locale: dateLocale })
        : t('createProjectWizard.preview.deadlineEmpty');

    const totalSteps = STEPS.length - 1;
    const currentStepLabel = t(STEPS[currentStep]?.labelKey);

    return (
        <div className="create-project">
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

            <div className="create-project__shell animate-fade-in">

                {/* LEFT: Form Panel */}
                <section className="create-project__form">

                    {/* Header */}
                    <header className="create-project__header">
                        <div className="create-project__header-title">
                            <div>
                                <h1>{t('createProjectWizard.header.title')}</h1>

                            </div>
                        </div>

                        {/* Step Pills */}
                        {/* Stepper Navigation */}
                        {/* Stepper Navigation (Pills) */}
                        <div className="create-project__stepper">
                            {STEPS.map((step, index) => {
                                const isActive = currentStep === index;
                                const isCompleted = currentStep > index;
                                const isClickable = index <= furthestVisitedStep;

                                return (
                                    <div
                                        key={step.id}
                                        className={`create-project__step-item ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''} ${isClickable ? 'is-clickable' : ''}`}
                                        onClick={() => handleStepClick(index)}
                                        role="button"
                                        tabIndex={isClickable ? 0 : -1}
                                        title={t(step.labelKey)} // Tooltip for context
                                    >
                                        <div className="create-project__step-indicator" />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="create-project__progress" style={{ display: 'none' }}>
                            {STEPS.slice(1).map((step) => (
                                <div
                                    key={step.id}
                                    className={`create-project__progress-pill ${currentStep >= step.id ? 'is-active' : ''}`}
                                />
                            ))}
                        </div>
                    </header>

                    {/* Content Area - Fixed Height with Overflow */}
                    <div className="create-project__content">

                        {/* Step 0: Method */}
                        {currentStep === 0 && (
                            <div className="create-project__step create-project__step--method animate-fade-in">
                                <div className="create-project__step-header">
                                    <h2>{t('createProjectWizard.method.title')}</h2>
                                    <p>{t('createProjectWizard.method.subtitle')}</p>
                                </div>

                                <div className="create-project__method-grid">
                                    <button
                                        onClick={() => handleMethodSelect('scratch')}
                                        type="button"
                                        className="create-project__method-card"
                                        data-mode="scratch"
                                    >
                                        <div className="create-project__method-icon">
                                            <span className="material-symbols-outlined">edit_note</span>
                                        </div>
                                        <div className="create-project__method-text">
                                            <div className="create-project__method-title">{t('createProjectWizard.method.scratch.title')}</div>
                                            <div className="create-project__method-description">{t('createProjectWizard.method.scratch.description')}</div>
                                        </div>
                                        <span className="material-symbols-outlined create-project__method-chevron">chevron_right</span>
                                    </button>

                                    <button
                                        onClick={() => handleMethodSelect('ai')}
                                        type="button"
                                        className="create-project__method-card"
                                        data-mode="ai"
                                    >
                                        <div className="create-project__method-icon">
                                            <span className="material-symbols-outlined">auto_awesome</span>
                                        </div>
                                        <div className="create-project__method-text">
                                            <div className="create-project__method-title">{t('createProjectWizard.method.ai.title')}</div>
                                            <div className="create-project__method-description">{t('createProjectWizard.method.ai.description')}</div>
                                        </div>
                                        <span className="material-symbols-outlined create-project__method-chevron">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Details (AI) */}
                        {currentStep === 1 && creationMode === 'ai' && (
                            <div className="create-project__step animate-fade-in">
                                <div className="create-project__step-header">
                                    <h2>{t('createProjectWizard.ai.title')}</h2>
                                    <p>{t('createProjectWizard.ai.subtitle')}</p>
                                </div>

                                <TextArea
                                    value={aiPrompt}
                                    onChange={handleAiPromptChange}
                                    placeholder={t('createProjectWizard.ai.placeholder')}
                                    className="create-project__ai-input"
                                />

                                <Button
                                    onClick={handleExecuteAI}
                                    disabled={!aiPrompt.trim()}
                                    isLoading={isGenerating}
                                    icon={<span className="material-symbols-outlined">magic_button</span>}
                                    className="create-project__ai-action"
                                >
                                    {isGenerating ? t('createProjectWizard.ai.generating') : t('createProjectWizard.ai.action')}
                                </Button>
                            </div>
                        )}

                        {/* Step 1: Details (Scratch) */}
                        {currentStep === 1 && creationMode === 'scratch' && (
                            <div className="create-project__step animate-fade-in">
                                <div className="create-project__step-header">
                                    <h2>{t('createProjectWizard.details.title')}</h2>
                                    <p>{t('createProjectWizard.details.subtitle')}</p>
                                </div>

                                <div className="create-project__form-grid">
                                    <TextInput
                                        label={t('createProjectWizard.details.name.label')}
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder={t('createProjectWizard.details.name.placeholder')}
                                        autoFocus
                                    />

                                    <div className="create-project__field">
                                        <div className="create-project__field-header">
                                            <label htmlFor={descriptionFieldId}>
                                                {t('createProjectWizard.details.description.label')}
                                            </label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleGenerateDesc}
                                                disabled={!name || isGenerating}
                                                icon={<span className={`material-symbols-outlined ${isGenerating ? 'create-project__spin' : ''}`}>auto_awesome</span>}
                                                className="create-project__ai-helper"
                                            >
                                                {t('createProjectWizard.details.description.aiCompose')}
                                            </Button>
                                        </div>
                                        <TextArea
                                            id={descriptionFieldId}
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder={t('createProjectWizard.details.description.placeholder')}
                                            className="create-project__description-input"
                                        />
                                    </div>

                                    <div className="create-project__field">
                                        <label>{t('createProjectWizard.details.type.label')}</label>
                                        <div className="create-project__type-grid">
                                            {(['standard', 'software', 'creative'] as const).map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setProjectType(type)}
                                                    className={`create-project__type-card ${projectType === type ? 'is-active' : ''}`}
                                                >
                                                    <span className="material-symbols-outlined">{getTypeIcon(type)}</span>
                                                    <span>{typeLabels[type]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Modules - GRID LAYOUT */}
                        {currentStep === 2 && (
                            <div className="create-project__step animate-fade-in">
                                <div className="create-project__step-header">
                                    <h2>{t('createProjectWizard.modules.title')}</h2>
                                    <p>{t('createProjectWizard.modules.subtitle')}</p>
                                </div>

                                <div className="create-project__selection-container">
                                    <ModuleSelection
                                        selectedModules={modules.map(m => m === 'ideas' ? 'flows' : m)}
                                        onToggle={handleModuleToggle}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 3: Team */}
                        {currentStep === 3 && (
                            <div className="create-project__step animate-fade-in">
                                <div className="create-project__step-header">
                                    <h2>{t('createProjectWizard.team.title')}</h2>
                                    <p>{t('createProjectWizard.team.subtitle')}</p>
                                </div>

                                {availableMembers.length === 0 ? (
                                    <div className="create-project__empty">
                                        <span className="material-symbols-outlined">group</span>
                                        <p>{t('createProjectWizard.team.empty')}</p>
                                    </div>
                                ) : (
                                    <MemberSelection
                                        members={availableMembers}
                                        selectedIds={selectedMemberIds}
                                        onToggle={(id) => setSelectedMemberIds(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])}
                                    />
                                )}

                                <div className="create-project__visibility">
                                    <div className="create-project__visibility-header">
                                        <h3>{t('createProjectWizard.visibility.title')}</h3>
                                        <p>{t('createProjectWizard.visibility.subtitle')}</p>
                                    </div>

                                    <div className="create-project__visibility-grid">
                                        <button
                                            type="button"
                                            onClick={() => { setVisibilityGroupIds([]); setIsPrivate(false); }}
                                            className={`create-project__visibility-card ${!isPrivate && visibilityGroupIds.length === 0 ? 'is-active' : ''}`}
                                        >
                                            <div className="create-project__visibility-title">
                                                <span className="material-symbols-outlined">public</span>
                                                {t('createProjectWizard.visibility.everyone')}
                                            </div>
                                            <span className="create-project__visibility-hint">
                                                {t('createProjectWizard.visibility.everyoneHint')}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsPrivate(false);
                                                if (visibilityGroupIds.length === 0 && workspaceGroups.length > 0) {
                                                    setVisibilityGroupIds([workspaceGroups[0].id]);
                                                }
                                            }}
                                            disabled={workspaceGroups.length === 0}
                                            className={`create-project__visibility-card ${!isPrivate && visibilityGroupIds.length > 0 ? 'is-active' : ''}`}
                                        >
                                            <div className="create-project__visibility-title">
                                                <span className="material-symbols-outlined">lock_person</span>
                                                {t('createProjectWizard.visibility.groups')}
                                            </div>
                                            <span className="create-project__visibility-hint">
                                                {workspaceGroups.length === 0 ? t('createProjectWizard.visibility.noGroups') : t('createProjectWizard.visibility.groupsHint')}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => { setIsPrivate(true); setVisibilityGroupIds([]); }}
                                            className={`create-project__visibility-card ${isPrivate ? 'is-active' : ''}`}
                                        >
                                            <div className="create-project__visibility-title">
                                                <span className="material-symbols-outlined">lock</span>
                                                {t('createProjectWizard.visibility.private')}
                                            </div>
                                            <span className="create-project__visibility-hint">
                                                {t('createProjectWizard.visibility.privateHint')}
                                            </span>
                                        </button>
                                    </div>

                                    {!isPrivate && visibilityGroupIds.length > 0 && workspaceGroups.length > 0 && (
                                        <div className="create-project__group-select animate-fade-in">
                                            <label>{t('createProjectWizard.visibility.selectGroups')}</label>
                                            <div className="create-project__group-grid">
                                                {workspaceGroups.map(group => {
                                                    const isSelected = visibilityGroupIds.includes(group.id);
                                                    return (
                                                        <button
                                                            key={group.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setVisibilityGroupIds(prev => prev.filter(id => id !== group.id));
                                                                } else {
                                                                    setVisibilityGroupIds(prev => [...prev, group.id]);
                                                                }
                                                            }}
                                                            className={`create-project__group-chip ${isSelected ? 'is-active' : ''}`}
                                                        >
                                                            <span
                                                                className="create-project__group-dot"
                                                                style={{ backgroundColor: group.color || 'var(--color-text-subtle)' }}
                                                            />
                                                            <span className="create-project__group-name">{group.name}</span>
                                                            {isSelected && (
                                                                <span className="material-symbols-outlined">check</span>
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
                            <div className="create-project__step animate-fade-in">
                                <div className="create-project__step-header">
                                    <h2>{t('createProjectWizard.timeline.title')}</h2>
                                    <p>{t('createProjectWizard.timeline.subtitle')}</p>
                                </div>

                                <div className="create-project__timeline-grid">
                                    <DatePicker
                                        label={t('createProjectWizard.timeline.startDate')}
                                        value={startDate}
                                        onChange={setStartDate}
                                    />
                                    <DatePicker
                                        label={t('createProjectWizard.timeline.dueDate')}
                                        value={dueDate}
                                        onChange={setDueDate}
                                    />
                                    <div className="create-project__field">
                                        <label>{t('createProjectWizard.timeline.priority')}</label>
                                        <PrioritySelect value={priority} onChange={setPriority} variant="group" />
                                    </div>
                                    <Select
                                        label={t('createProjectWizard.timeline.status')}
                                        value={status}
                                        onChange={(value) => setStatus(String(value))}
                                        options={statusOptions}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 5: Assets */}
                        {currentStep === 5 && (
                            <div className="create-project__step animate-fade-in">
                                <div className="create-project__step-header">
                                    <h2>{t('createProjectWizard.assets.title')}</h2>
                                    <p>{t('createProjectWizard.assets.subtitle')}</p>
                                </div>

                                <div className="create-project__assets">
                                    <div className="create-project__asset-grid">
                                        {/* Cover Selection */}
                                        <div className="create-project__asset">
                                            <label className="create-project__asset-label">{t('createProjectWizard.assets.cover.label')}</label>
                                            <div
                                                onClick={() => { setMediaPickerTarget('cover'); setShowMediaLibrary(true); }}
                                                className="create-project__asset-card"
                                                data-asset="cover"
                                            >
                                                {coverUrl || coverFile ? (
                                                    <>
                                                        <img src={coverPreview} className="create-project__asset-image" />
                                                        <div className="create-project__asset-overlay">
                                                            <span>
                                                                <span className="material-symbols-outlined">edit</span>
                                                                {t('createProjectWizard.assets.change')}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setCoverUrl(null); setCoverFile(null); }}
                                                            className="create-project__asset-remove"
                                                        >
                                                            <span className="material-symbols-outlined">close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="create-project__asset-placeholder">
                                                        <span className="material-symbols-outlined">image</span>
                                                        <span>{t('createProjectWizard.assets.cover.select')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Icon Selection */}
                                        <div className="create-project__asset">
                                            <label className="create-project__asset-label">{t('createProjectWizard.assets.icon.label')}</label>
                                            <div
                                                onClick={() => { setMediaPickerTarget('icon'); setShowMediaLibrary(true); }}
                                                className="create-project__asset-card create-project__asset-card--icon"
                                                data-asset="icon"
                                            >
                                                {squareIconUrl || squareIconFile ? (
                                                    <>
                                                        <img src={iconPreview} className="create-project__asset-image create-project__asset-image--icon" />
                                                        <div className="create-project__asset-overlay">
                                                            <span>
                                                                <span className="material-symbols-outlined">edit</span>
                                                                {t('createProjectWizard.assets.change')}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setSquareIconUrl(null); setSquareIconFile(null); }}
                                                            className="create-project__asset-remove"
                                                        >
                                                            <span className="material-symbols-outlined">close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="create-project__asset-placeholder">
                                                        <span className="material-symbols-outlined">smart_button</span>
                                                        <span>{t('createProjectWizard.assets.icon.select')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* GitHub Integration - Only for Software Projects */}
                                    {projectType === 'software' && (
                                        <div className="create-project__github">
                                            <div className="create-project__section-header">
                                                <h3 className="create-project__section-title">{t('createProjectWizard.github.title')}</h3>
                                                <p className="create-project__section-subtitle">{t('createProjectWizard.github.subtitle')}</p>
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
                                                    className="create-project__github-connect"
                                                    type="button"
                                                    aria-busy={connectingGithub}
                                                >
                                                    <div className="create-project__github-icon">
                                                        <svg className="create-project__github-mark" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                                                    </div>
                                                    <div className="create-project__github-text">
                                                        <div className="create-project__github-title">
                                                            {connectingGithub ? t('createProjectWizard.github.connecting') : t('createProjectWizard.github.connect')}
                                                        </div>
                                                        <div className="create-project__github-hint">{t('createProjectWizard.github.connectHint')}</div>
                                                    </div>
                                                    <span className="material-symbols-outlined create-project__github-arrow">arrow_forward</span>
                                                </button>
                                            ) : (
                                                <div className="create-project__github-select">
                                                    <Select
                                                        value={githubValue}
                                                        onChange={(value) => setSelectedGithubRepo(String(value))}
                                                        options={githubOptions}
                                                        placeholder={githubPlaceholder}
                                                        disabled={githubSelectDisabled}
                                                        className="create-project__github-select-input"
                                                    />
                                                    {selectedGithubRepo && (
                                                        <div className="create-project__github-note">
                                                            <span className="material-symbols-outlined">check_circle</span>
                                                            {t('createProjectWizard.github.syncNotice')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="create-project__links">
                                        <div className="create-project__links-header">
                                            <span className="material-symbols-outlined">link</span>
                                            <h3 className="create-project__links-title">{t('createProjectWizard.links.title')}</h3>
                                        </div>

                                        <div className="create-project__links-list">
                                            {externalResources.map((res, idx) => (
                                                <div key={`res-${idx}`} className="create-project__link-row">
                                                    <div className="create-project__link-icon">
                                                        <span className="material-symbols-outlined">open_in_new</span>
                                                    </div>
                                                    <div className="create-project__link-fields">
                                                        <input
                                                            placeholder={t('createProjectWizard.links.resourcePlaceholder')}
                                                            value={res.title}
                                                            onChange={(e) => {
                                                                const newRes = [...externalResources];
                                                                newRes[idx].title = e.target.value;
                                                                setExternalResources(newRes);
                                                            }}
                                                            className="create-project__link-input create-project__link-input--title"
                                                        />
                                                        <input
                                                            placeholder={t('createProjectWizard.links.urlPlaceholder')}
                                                            value={res.url}
                                                            onChange={(e) => {
                                                                const newRes = [...externalResources];
                                                                newRes[idx].url = e.target.value;
                                                                setExternalResources(newRes);
                                                            }}
                                                            className="create-project__link-input create-project__link-input--url"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setExternalResources(externalResources.filter((_, i) => i !== idx))}
                                                        className="create-project__link-remove"
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                            ))}

                                            {links.map((link, idx) => (
                                                <div key={`link-${idx}`} className="create-project__link-row">
                                                    <div className="create-project__link-icon">
                                                        <span className="material-symbols-outlined">link</span>
                                                    </div>
                                                    <div className="create-project__link-fields">
                                                        <input
                                                            placeholder={t('createProjectWizard.links.linkPlaceholder')}
                                                            value={link.title}
                                                            onChange={(e) => {
                                                                const newLinks = [...links];
                                                                newLinks[idx].title = e.target.value;
                                                                setLinks(newLinks);
                                                            }}
                                                            className="create-project__link-input create-project__link-input--title"
                                                        />
                                                        <input
                                                            placeholder={t('createProjectWizard.links.urlPlaceholder')}
                                                            value={link.url}
                                                            onChange={(e) => {
                                                                const newLinks = [...links];
                                                                newLinks[idx].url = e.target.value;
                                                                setLinks(newLinks);
                                                            }}
                                                            className="create-project__link-input create-project__link-input--url"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setLinks(links.filter((_, i) => i !== idx))}
                                                        className="create-project__link-remove"
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="create-project__links-actions">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setExternalResources([...externalResources, { title: '', url: '', icon: 'open_in_new' }])}
                                                icon={<span className="material-symbols-outlined">add</span>}
                                                className="create-project__link-add"
                                            >
                                                {t('createProjectWizard.links.addResource')}
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setLinks([...links, { title: '', url: '' }])}
                                                icon={<span className="material-symbols-outlined">add</span>}
                                                className="create-project__link-add"
                                            >
                                                {t('createProjectWizard.links.addOverview')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <footer className="create-project__footer">
                        <div>
                            {currentStep > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    icon={<span className="material-symbols-outlined">arrow_back</span>}
                                >
                                    {t('createProjectWizard.actions.back')}
                                </Button>
                            )}
                        </div>
                        <div className="create-project__footer-actions">
                            {currentStep > 0 && currentStep < 5 && (
                                <Button onClick={handleNext} disabled={currentStep === 1 && !name}>
                                    {t('createProjectWizard.actions.continue')}
                                </Button>
                            )}
                            {currentStep === 5 && (
                                <Button onClick={handleSubmit} disabled={isSubmitting || !name} isLoading={isSubmitting}>
                                    {isSubmitting ? t('createProjectWizard.actions.creating') : t('createProjectWizard.actions.create')}
                                </Button>
                            )}
                        </div>
                    </footer>
                </section>

                {/* RIGHT: Preview Panel */}
                <aside className="create-project__preview">
                    <Card className="create-project__preview-card">
                        <div className="create-project__preview-cover">
                            {coverPreview ? (
                                <img src={coverPreview} className="create-project__preview-cover-image" alt="" />
                            ) : (
                                <div className="create-project__preview-cover-placeholder">
                                    <span className="material-symbols-outlined">landscape</span>
                                </div>
                            )}
                            <div className="create-project__preview-status">
                                {statusLabel}
                            </div>
                        </div>

                        <div className="create-project__preview-body">
                            <div className="create-project__preview-icon">
                                {iconPreview ? (
                                    <img src={iconPreview} className="create-project__preview-icon-image" alt="" />
                                ) : (
                                    <span className="material-symbols-outlined create-project__preview-icon-fallback">{getTypeIcon(projectType)}</span>
                                )}
                            </div>

                            <div className="create-project__preview-info">
                                <h3 className="create-project__preview-title">{name || t('createProjectWizard.preview.nameFallback')}</h3>
                                <p className="create-project__preview-description">
                                    {description || t('createProjectWizard.preview.descriptionFallback')}
                                </p>
                            </div>

                            <div className="create-project__preview-meta">
                                <div className="create-project__preview-meta-block">
                                    <span className="create-project__preview-label">{t('createProjectWizard.preview.team')}</span>
                                    <div className="create-project__preview-team">
                                        <div className="create-project__preview-team-list">
                                            {selectedMemberIds.length > 0 ? selectedMemberIds.slice(0, 3).map((id) => {
                                                const member = availableMembers.find((item) => item.uid === id);
                                                return (
                                                    <div key={id} className="create-project__preview-avatar">
                                                        {member?.photoURL ? (
                                                            <img src={member.photoURL} className="create-project__preview-avatar-image" alt="" />
                                                        ) : (
                                                            member?.displayName?.charAt(0) || '?'
                                                        )}
                                                    </div>
                                                );
                                            }) : (
                                                <span className="create-project__preview-empty">{teamEmptyLabel}</span>
                                            )}
                                            {selectedMemberIds.length > 3 && (
                                                <div className="create-project__preview-avatar create-project__preview-avatar--more">
                                                    +{selectedMemberIds.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="create-project__preview-meta-block create-project__preview-meta-block--right">
                                    <span className="create-project__preview-label">{t('createProjectWizard.preview.deadline')}</span>
                                    <span className="create-project__preview-date">{deadlineValue}</span>
                                </div>
                            </div>

                            <div className="create-project__preview-footer">
                                <div className="create-project__preview-modules">
                                    {modules.slice(0, 5).map((module) => (
                                        <span key={module} className="create-project__preview-module-dot" />
                                    ))}
                                    {modules.length > 5 && (
                                        <span className="create-project__preview-module-more">+{modules.length - 5}</span>
                                    )}
                                </div>
                                <span className={`create-project__preview-priority create-project__preview-priority--${priority}`}>
                                    {priorityLabels[priority] || priority}
                                </span>
                            </div>
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    );
};
