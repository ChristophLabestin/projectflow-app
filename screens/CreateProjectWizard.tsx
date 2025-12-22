import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateProjectDescription } from '../services/geminiService';
import { createProject, getWorkspaceMembers } from '../services/dataService';
import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { ImageCropper } from '../components/ui/ImageCropper';
import { DatePicker } from '../components/ui/DatePicker';
import { ProjectModule } from '../types';

export const CreateProjectWizard = () => {
    const navigate = useNavigate();
    const { can } = useWorkspacePermissions();

    // --- State ---
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 5;

    // Data
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [projectType, setProjectType] = useState<'standard' | 'software' | 'creative'>('standard');

    const [modules, setModules] = useState<ProjectModule[]>(['tasks', 'ideas', 'activity']);

    const [availableMembers, setAvailableMembers] = useState<any[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [status, setStatus] = useState('Planning');

    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [squareIconFile, setSquareIconFile] = useState<File | null>(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Cropper
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [cropAspectRatio, setCropAspectRatio] = useState(1);
    const [cropType, setCropType] = useState<'cover' | 'icon' | null>(null);

    // --- Effects ---
    useEffect(() => {
        getWorkspaceMembers().then(members => {
            setAvailableMembers(members.filter(m => m.role !== 'Guest'));
        });
    }, []);

    useEffect(() => {
        // Auto-set modules based on type
        const defaults: Record<string, ProjectModule[]> = {
            standard: ['tasks', 'ideas', 'milestones', 'activity'],
            software: ['tasks', 'issues', 'activity'],
            creative: ['ideas', 'mindmap', 'activity']
        };
        setModules(defaults[projectType] || defaults.standard);
    }, [projectType]);

    // --- Handlers ---
    const handleNext = () => { if (currentStep < totalSteps) setCurrentStep(c => c + 1); };
    const handleBack = () => { if (currentStep > 1) setCurrentStep(c => c - 1); };

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
        }
        e.target.value = '';
    };

    const handleCropComplete = (blob: Blob) => {
        const file = new File([blob], cropType === 'cover' ? "cover.jpg" : "icon.jpg", { type: "image/jpeg" });
        if (cropType === 'cover') setCoverFile(file);
        else setSquareIconFile(file);
        setCropImageSrc(null); setCropType(null);
    };

    const handleSubmit = async () => {
        if (!name) return;
        setIsSubmitting(true);
        try {
            await createProject({
                title: name, description, startDate, dueDate, priority, status: status as any, modules
            }, coverFile || undefined, squareIconFile || undefined, undefined, selectedMemberIds);
            navigate('/projects');
        } catch (e) { console.error(e); setIsSubmitting(false); }
    };

    if (!can('canCreateProjects')) return <div className="p-10 text-center">Access Denied</div>;

    // --- Render Helpers ---

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'software': return 'terminal';
            case 'creative': return 'palette';
            default: return 'folder_open';
        }
    };

    return (
        <div className="flex h-full w-full overflow-hidden bg-[var(--color-surface-bg)] text-[var(--color-text-main)] font-sans transition-colors duration-300">
            <ImageCropper isOpen={!!cropImageSrc} imageSrc={cropImageSrc} aspectRatio={cropAspectRatio} onCropComplete={handleCropComplete} onCancel={() => { setCropImageSrc(null); setCropType(null); }} />

            {/* --- LEFT PANEL: CONTROL CENTER (40%) --- */}
            <div className="w-[40%] h-full flex flex-col border-r border-[var(--color-surface-border)] bg-[var(--color-surface-card)] relative z-10 shadow-xl">
                {/* Header */}
                <div className="p-8 pb-4">
                    <Button variant="ghost" className="mb-6 -ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]" onClick={() => navigate('/projects')} icon={<span className="material-symbols-outlined">arrow_back</span>}>Exit</Button>
                    <div className="flex items-center justify-between mb-2">
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-main)]">Create Project</h1>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-surface-border)]">Step {currentStep} of {totalSteps}</span>
                    </div>
                    <div className="w-full h-1 bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--color-primary)] transition-all duration-500 ease-out" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
                    </div>
                </div>

                {/* Scrollable Form Area */}
                <div className="flex-1 overflow-y-auto px-8 py-4 space-y-8 custom-scrollbar">

                    {/* STEP 1: IDENTITY */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-[var(--color-text-main)]">What are we building?</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">Give your initiative a name and direction.</p>
                            </div>
                            <Input label="Project Name" autoFocus className="text-lg" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Apollo Launch" />
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-sm font-semibold text-[var(--color-text-main)]">Description</label>
                                    <button onClick={handleGenerateDesc} disabled={!name || isGenerating} className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1 transition-colors">
                                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                        {isGenerating ? 'Magic...' : 'Auto-Generate'}
                                    </button>
                                </div>
                                <Textarea className="min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the mission..." />
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-[var(--color-text-main)]">Project Type</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['standard', 'software', 'creative'].map((t: any) => (
                                        <button key={t} onClick={() => setProjectType(t)} className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 
                                            ${projectType === t
                                                ? 'border-[var(--color-primary)] bg-indigo-50 dark:bg-indigo-900/20 text-[var(--color-primary)]'
                                                : 'border-[var(--color-surface-border)] hover:border-[var(--color-primary-light)] text-[var(--color-text-muted)] bg-[var(--color-surface-card)]'}`}>
                                            <span className="material-symbols-outlined">{getTypeIcon(t)}</span>
                                            <span className="text-xs font-bold capitalize">{t}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: MODULES */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-[var(--color-text-main)]">Choose your tools</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">Enable the features your team needs.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { id: 'tasks', label: 'Tasks', desc: 'Kanban boards & Lists', icon: 'check_circle' },
                                    { id: 'ideas', label: 'Ideas', desc: 'Brainstorming & Validation', icon: 'lightbulb' },
                                    { id: 'milestones', label: 'Milestones', desc: 'Roadmap & Goals', icon: 'flag' },
                                    { id: 'mindmap', label: 'Mindmap', desc: 'Visual planning canvas', icon: 'account_tree' },
                                    { id: 'issues', label: 'Issues', desc: 'Bug tracking & Tickets', icon: 'bug_report' },
                                    { id: 'activity', label: 'Activity', desc: 'Audit logs & History', icon: 'history' },
                                ].map(m => (
                                    <div key={m.id} onClick={() => setModules(curr => curr.includes(m.id as any) ? curr.filter(x => x !== m.id) : [...curr, m.id as any])}
                                        className={`p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all 
                                            ${modules.includes(m.id as any)
                                                ? 'border-[var(--color-primary)] bg-[var(--color-surface-hover)] shadow-sm'
                                                : 'border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] bg-[var(--color-surface-card)]'}`}>
                                        <div className={`size-10 rounded-full flex items-center justify-center transition-colors 
                                            ${modules.includes(m.id as any)
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'}`}>
                                            <span className="material-symbols-outlined">{m.icon}</span>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-[var(--color-text-main)]">{m.label}</div>
                                            <div className="text-xs text-[var(--color-text-muted)]">{m.desc}</div>
                                        </div>
                                        <div className="ml-auto">
                                            {modules.includes(m.id as any) && <span className="material-symbols-outlined text-[var(--color-primary)]">check</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: TEAM */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-[var(--color-text-main)]">Assemble the Squad</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">Select members to invite immediately.</p>
                            </div>
                            <Input placeholder="Search people..." icon="search" className="mb-2" />
                            <div className="space-y-2">
                                {availableMembers.map(user => (
                                    <div key={user.uid} onClick={() => setSelectedMemberIds(curr => curr.includes(user.uid) ? curr.filter(id => id !== user.uid) : [...curr, user.uid])}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all 
                                            ${selectedMemberIds.includes(user.uid)
                                                ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20'
                                                : 'border-transparent hover:bg-[var(--color-surface-hover)]'}`}>
                                        <div className="size-10 rounded-full bg-[var(--color-surface-hover)] overflow-hidden flex items-center justify-center text-[var(--color-text-muted)]">
                                            {user.photoURL ? <img src={user.photoURL} className="size-full object-cover" /> : <span className="material-symbols-outlined">person</span>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-sm text-[var(--color-text-main)]">{user.displayName}</div>
                                            <div className="text-xs text-[var(--color-text-muted)]">{user.email}</div>
                                        </div>
                                        <div className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors 
                                            ${selectedMemberIds.includes(user.uid)
                                                ? 'border-green-500 bg-green-500 text-white'
                                                : 'border-[var(--color-surface-border)]'}`}>
                                            {selectedMemberIds.includes(user.uid) && <span className="material-symbols-outlined text-[14px]">check</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: PLANNING */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-[var(--color-text-main)]">Set the Pace</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">Define timeline and urgency.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 px-1">
                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Start Date</label>
                                    <DatePicker value={startDate} onChange={setStartDate} placeholder="Pick start date" />
                                </div>
                                <div className="space-y-1.5 px-1">
                                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Due Date</label>
                                    <DatePicker value={dueDate} onChange={setDueDate} placeholder="Pick due date" align="right" />
                                </div>
                            </div>
                            <div className="space-y-3 pt-2">
                                <label className="text-sm font-semibold text-[var(--color-text-main)]">Priority Level</label>
                                <div className="flex gap-2">
                                    {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                                        <button key={p} onClick={() => setPriority(p)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all 
                                            ${priority === p
                                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500'
                                                : 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3 pt-2">
                                <label className="text-sm font-semibold text-[var(--color-text-main)]">Initial Status</label>
                                <select className="w-full p-3 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-input-bg)] text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all" value={status} onChange={e => setStatus(e.target.value)}>
                                    <option>Planning</option>
                                    <option>Active</option>
                                    <option>On Hold</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: BRANDING */}
                    {currentStep === 5 && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold text-[var(--color-text-main)]">Final Touches</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">Make it recognizable.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer relative group bg-[var(--color-surface-card)]">
                                    <input type="file" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={e => handleFileSelect(e, 'cover')} accept="image/*" />
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <div className="size-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                            <span className="material-symbols-outlined">image</span>
                                        </div>
                                        <div className="font-bold text-sm text-[var(--color-text-main)]">Upload Cover Image</div>
                                        <div className="text-xs text-[var(--color-text-muted)]">Recommended 1200x600</div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] hover:bg-blue-50/30 transition-all cursor-pointer relative group">
                                    <input type="file" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={e => handleFileSelect(e, 'icon')} accept="image/*" />
                                    <div className="flex items-center gap-4">
                                        <div className="size-14 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)]">
                                            {squareIconFile ? <img src={URL.createObjectURL(squareIconFile)} className="size-full object-cover rounded-xl" /> : <span className="material-symbols-outlined">apps</span>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-[var(--color-text-main)]">Upload Icon</div>
                                            <div className="text-xs text-[var(--color-text-muted)]">Square ratio recommended</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="p-8 pt-4 border-t border-[var(--color-surface-border)] flex justify-between bg-[var(--color-surface-card)]">
                    {currentStep > 1 ? (
                        <Button variant="ghost" onClick={handleBack} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">Back</Button>
                    ) : <div></div>}

                    {currentStep < totalSteps ? (
                        <Button onClick={handleNext} disabled={!name} icon={<span className="material-symbols-outlined">arrow_forward</span>}>Continue</Button>
                    ) : (
                        <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting} className="w-32">Launch 🚀</Button>
                    )}
                </div>
            </div>

            {/* --- RIGHT PANEL: IMMERSIVE PREVIEW (60%) --- */}
            <div className="w-[60%] h-full bg-[var(--color-surface-bg)] relative overflow-hidden flex items-center justify-center p-12">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-full opacity-40 dark:opacity-20 pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-200 dark:bg-purple-900 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-200 dark:bg-blue-900 rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 w-full max-w-2xl transform transition-all duration-700 ease-out animate-fade-in-up">
                    <div className="bg-white/80 dark:bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 dark:border-white/10 overflow-hidden">
                        {/* Fake Browser Header */}
                        <div className="h-8 bg-gray-100/50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700 flex items-center px-4 gap-2">
                            <div className="flex gap-1.5">
                                <div className="size-3 rounded-full bg-red-400" />
                                <div className="size-3 rounded-full bg-amber-400" />
                                <div className="size-3 rounded-full bg-green-400" />
                            </div>
                            <div className="mx-auto text-[10px] font-mono text-gray-400 dark:text-gray-500">project-preview.local</div>
                        </div>

                        {/* Project Card Preview */}
                        <div className="relative group bg-white dark:bg-zinc-900">
                            {/* Cover */}
                            <div className="h-48 w-full bg-slate-200 dark:bg-zinc-800 relative overflow-hidden">
                                {coverFile ? (
                                    <img src={URL.createObjectURL(coverFile)} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-slate-400 dark:text-zinc-600">
                                        <span className="material-symbols-outlined text-4xl">image</span>
                                    </div>
                                )}
                                <div className="absolute top-4 right-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${status === 'Planning' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                        {status}
                                    </span>
                                </div>
                            </div>

                            {/* Icon & Content */}
                            <div className="p-8 pt-0 relative">
                                <div className="size-20 rounded-2xl bg-white dark:bg-zinc-900 shadow-lg border-2 border-white dark:border-zinc-800 absolute -top-10 left-8 flex items-center justify-center overflow-hidden">
                                    {squareIconFile ? (
                                        <img src={URL.createObjectURL(squareIconFile)} className="size-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">{getTypeIcon(projectType)}</span>
                                    )}
                                </div>

                                <div className="pt-14 space-y-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">{name || 'Unlimited Potential'}</h1>
                                        <p className="text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{description || 'Your project description will appear here. It describes the goals and scope of your new initiative.'}</p>
                                    </div>

                                    {/* Stats / Meta */}
                                    <div className="flex gap-6 py-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
                                        <div>
                                            <div className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Team</div>
                                            <div className="flex -space-x-2 mt-1">
                                                {selectedMemberIds.slice(0, 3).map((uid) => {
                                                    const member = availableMembers.find(m => m.uid === uid);
                                                    return (
                                                        <div key={uid} className="size-8 rounded-full bg-indigo-100 dark:bg-indigo-900 ring-2 ring-white dark:ring-zinc-900 overflow-hidden flex items-center justify-center">
                                                            {member?.photoURL ? (
                                                                <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-xs font-bold text-indigo-500 dark:text-indigo-300">
                                                                    {member?.displayName?.charAt(0) || '?'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {selectedMemberIds.length === 0 && <div className="text-sm text-gray-400 font-medium">Just you</div>}
                                                {selectedMemberIds.length > 3 && <div className="size-8 rounded-full bg-gray-100 dark:bg-zinc-800 ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center text-xs text-gray-500">+{selectedMemberIds.length - 3}</div>}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Deadline</div>
                                            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-2">{dueDate ? new Date(dueDate).toLocaleDateString() : 'TBD'}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Modules</div>
                                            <div className="flex gap-1 mt-2">
                                                {modules.slice(0, 4).map(m => (
                                                    <span key={m} className="size-2 rounded-full bg-gray-300 dark:bg-zinc-600" title={m} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-2">
                                        <div className={`px-2 py-1 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-500 text-xs font-bold rounded uppercase border border-amber-200 dark:border-amber-900`}>
                                            {priority} Priority
                                        </div>
                                        <div className="text-xs text-gray-400 dark:text-zinc-500 italic">Pre-launch Preview</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mt-8 space-y-2 opacity-50">
                        <p className="text-sm font-medium text-[var(--color-text-muted)]">Live Workspace Preview</p>
                        <p className="text-xs text-[var(--color-text-subtle)]">Everything looks good? Launch it.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
