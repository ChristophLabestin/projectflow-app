import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generateProjectDescription } from '../services/geminiService';
import { createProject } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Card } from '../components/ui/Card';
import { ProjectModule } from '../types';

import { ImageCropper } from '../components/ui/ImageCropper';

import { useWorkspacePermissions } from '../hooks/useWorkspacePermissions';
import { useModuleAccess } from '../hooks/useModuleAccess';

export const CreateProjectForm = () => {
    const navigate = useNavigate();
    const { can } = useWorkspacePermissions();
    const { hasAccess: isSocialAllowed } = useModuleAccess('social');
    const { hasAccess: isMarketingAllowed } = useModuleAccess('marketing');
    const { hasAccess: isAccountingAllowed } = useModuleAccess('accounting');


    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [status, setStatus] = useState('Planning');
    const [modules, setModules] = useState<ProjectModule[]>(['tasks', 'ideas', 'activity']);
    const [links, setLinks] = useState<{ title: string; url: string }[]>([]);

    // File & Cropping State
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [squareIconFile, setSquareIconFile] = useState<File | null>(null);
    const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);

    // Cropper Modal State
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [cropAspectRatio, setCropAspectRatio] = useState(1);
    const [cropType, setCropType] = useState<'cover' | 'icon' | null>(null);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const minDueDate = useMemo(() => (startDate ? startDate : undefined), [startDate]);

    const handleGenerateDesc = async () => {
        if (!name) return;
        setIsGenerating(true);
        try {
            const desc = await generateProjectDescription(name, 'A software development project');
            setDescription(desc);
        } catch (err) {
            console.error('Failed to generate description:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'icon') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCropImageSrc(reader.result as string);
                setCropType(type);
                setCropAspectRatio(type === 'cover' ? 16 / 9 : 1);
            };
            reader.readAsDataURL(file);
        }
        // Reset input value to allow re-selecting same file
        e.target.value = '';
    };

    const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setScreenshotFiles(prev => [...prev, ...files]);
        }
        e.target.value = '';
    };

    const handleCropComplete = (croppedBlob: Blob) => {
        if (cropType === 'cover') {
            const file = new File([croppedBlob], "cover.jpg", { type: "image/jpeg" });
            setCoverFile(file);
        } else if (cropType === 'icon') {
            const file = new File([croppedBlob], "icon.jpg", { type: "image/jpeg" });
            setSquareIconFile(file);
        }
        closeCropper();
    };

    const closeCropper = () => {
        setCropImageSrc(null);
        setCropType(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setIsSubmitting(true);
        try {
            await createProject(
                {
                    title: name,
                    description,
                    startDate,
                    dueDate,
                    priority,
                    status: status as any,
                    modules,
                    links
                },
                coverFile || undefined,
                squareIconFile || undefined,
                screenshotFiles.length ? screenshotFiles : undefined
            );
            navigate('/projects');
        } catch (error) {
            console.error('Error creating project:', error);
        } finally {
            setIsSubmitting(false);
        }
    };


    if (!can('canCreateProjects')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <span className="material-symbols-outlined text-4xl text-gray-400">lock</span>
                <h2 className="text-xl font-bold">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to create projects.</p>
                <Link to="/projects">
                    <Button>Back to Projects</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10 p-4 animate-fade-up">
            {/* Cropper Modal */}
            <ImageCropper
                isOpen={!!cropImageSrc}
                imageSrc={cropImageSrc}
                aspectRatio={cropAspectRatio}
                onCropComplete={handleCropComplete}
                onCancel={closeCropper}
            />

            <div className="flex flex-col gap-2">
                <nav className="flex text-sm text-[var(--color-text-muted)] font-medium items-center gap-2">
                    <Link to="/projects" className="hover:text-[var(--color-text-main)] transition-colors">Projects</Link>
                    <span>/</span>
                    <Link to="/create" className="hover:text-[var(--color-text-main)] transition-colors">New</Link>
                </nav>
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="h2 text-[var(--color-text-main)]">
                            {step === 1 ? 'Choose Template' : 'Project Details'}
                        </h1>
                        <p className="text-[var(--color-text-muted)] text-sm">
                            {step === 1
                                ? 'Start with a pre-configured setup or customize your modules.'
                                : 'Define your project goals and timeline.'}
                        </p>
                    </div>

                    {step === 2 && (
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                            <Button onClick={handleSubmit} isLoading={isSubmitting} icon={<span className="material-symbols-outlined">check</span>}>
                                Create Project
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Step 1: Templates & Modules */}
            {step === 1 && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { id: 'default', title: 'Standard', desc: 'Tasks, Flows & Activity', modules: ['tasks', 'ideas', 'activity'] },
                            { id: 'software', title: 'Software', desc: 'Tasks, Issues & Activity', modules: ['tasks', 'issues', 'activity'] },
                            { id: 'creative', title: 'Creative', desc: 'Flows, Tasks & Activity', modules: ['ideas', 'tasks', 'activity'] },
                        ].map((tmpl) => (
                            <div
                                key={tmpl.id}
                                onClick={() => setModules(tmpl.modules as any)}
                                className={`
                                    cursor-pointer p-6 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-4 group
                                    ${JSON.stringify(modules.sort()) === JSON.stringify(tmpl.modules.sort())
                                        ? 'border-[var(--color-text-main)] bg-[var(--color-surface-card)] shadow-lg'
                                        : 'border-[var(--color-surface-border)] bg-[var(--color-surface-card)] hover:border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'}
                                `}
                            >
                                <div className={`
                                    size-14 rounded-full flex items-center justify-center transition-colors
                                    ${JSON.stringify(modules.sort()) === JSON.stringify(tmpl.modules.sort())
                                        ? 'bg-[var(--color-text-main)] text-[var(--color-surface-bg)]'
                                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] group-hover:bg-[var(--color-surface-border)]'}
                                `}>
                                    <span className="material-symbols-outlined text-[28px]">
                                        {tmpl.id === 'default' ? 'folder_open' : tmpl.id === 'software' ? 'terminal' : 'palette'}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">{tmpl.title}</h4>
                                    <p className="text-sm text-[var(--color-text-muted)]">{tmpl.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Card className="p-6">
                        <h3 className="h4 flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined">tune</span>
                            Customize Modules
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { id: 'tasks', label: 'Tasks', desc: 'Manage todos and milestones' },
                                { id: 'ideas', label: 'Flows', desc: 'Brainstorming and concepts' },
                                { id: 'activity', label: 'Activity', desc: 'Track project history' },
                                { id: 'issues', label: 'Issues', desc: 'Bug tracking and tickets' },
                                { id: 'social', label: 'Social', desc: 'Social media management' },
                                { id: 'marketing', label: 'Marketing', desc: 'Campaigns and ads' },
                                { id: 'accounting', label: 'Accounting', desc: 'Financial planning' },
                            ].map((mod) => {
                                if (mod.id === 'social' && !isSocialAllowed) return null;
                                if (mod.id === 'marketing' && !isMarketingAllowed) return null;
                                if (mod.id === 'accounting' && !isAccountingAllowed) return null;

                                return (
                                    <div key={mod.id}
                                        onClick={() => {
                                            const newModules = modules.includes(mod.id as any)
                                                ? modules.filter(m => m !== mod.id)
                                                : [...modules, mod.id as any];
                                            setModules(newModules);
                                        }}
                                        className={`
                                        cursor-pointer p-3 rounded-lg border transition-all flex items-center gap-3
                                        ${modules.includes(mod.id as any)
                                                ? 'border-[var(--color-text-main)] bg-[var(--color-surface-hover)]'
                                                : 'border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'}
                                    `}
                                    >
                                        <div className={`
                                        size-5 rounded border flex items-center justify-center transition-colors
                                        ${modules.includes(mod.id as any)
                                                ? 'bg-[var(--color-text-main)] border-[var(--color-text-main)]'
                                                : 'border-[var(--color-text-subtle)]'}
                                    `}>
                                            {modules.includes(mod.id as any) && <span className="material-symbols-outlined text-[var(--color-surface-bg)] text-[14px] font-bold">check</span>}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">{mod.label}</h4>
                                            <p className="text-xs text-[var(--color-text-muted)]">{mod.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button size="lg" onClick={() => setStep(2)} icon={<span className="material-symbols-outlined">arrow_forward</span>}>
                            Next Step
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 2: Details Form */}
            {step === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="space-y-6">
                            <h3 className="h4 flex items-center gap-2 border-b border-[var(--color-surface-border)] pb-3">
                                <span className="material-symbols-outlined">feed</span>
                                Essentials
                            </h3>
                            <div className="space-y-4">
                                <Input label="Project Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 Marketing Campaign" required autoFocus />

                                <Textarea
                                    label="Description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the project goals..."
                                    rows={5}
                                />
                            </div>
                        </Card>

                        <Card className="space-y-6">
                            <h3 className="h4 flex items-center gap-2 border-b border-[var(--color-surface-border)] pb-3">
                                <span className="material-symbols-outlined">date_range</span>
                                Planning
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                <Input label="Due Date" type="date" value={dueDate} min={minDueDate} onChange={(e) => setDueDate(e.target.value)} />
                                <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                                    {['Low', 'Medium', 'High', 'Urgent'].map(o => <option key={o}>{o}</option>)}
                                </Select>
                                <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                                    {['Planning', 'Active', 'On Hold'].map(o => <option key={o}>{o}</option>)}
                                </Select>
                            </div>
                        </Card>

                        {/* Links Section */}
                        <Card className="space-y-4">
                            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 border-b border-[var(--color-surface-border)] pb-3">External Links</h3>
                            <div className="space-y-3">
                                {links.map((link, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                placeholder="Title"
                                                value={link.title}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx].title = e.target.value;
                                                    setLinks(newLinks);
                                                }}
                                                className="w-full"
                                            />
                                            <Input
                                                placeholder="URL"
                                                value={link.url}
                                                onChange={(e) => {
                                                    const newLinks = [...links];
                                                    newLinks[idx].url = e.target.value;
                                                    setLinks(newLinks);
                                                }}
                                                className="w-full"
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => setLinks(links.filter((_, i) => i !== idx))}>
                                            <span className="material-symbols-outlined">close</span>
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="secondary" size="sm" onClick={() => setLinks([...links, { title: '', url: '' }])} icon={<span className="material-symbols-outlined">add</span>}>
                                    Add Link
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="space-y-4">
                            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 border-b border-[var(--color-surface-border)] pb-3">Assets</h3>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Cover Image</label>
                                <label className="w-full h-32 rounded-xl border-2 border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface-hover)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-text-main)] transition-colors relative overflow-hidden group">
                                    <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'cover')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                    {coverFile ? (
                                        <>
                                            <img src={URL.createObjectURL(coverFile)} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute top-2 right-2 z-20">
                                                <Button size="icon" variant="danger" onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setCoverFile(null);
                                                }}>
                                                    <span className="material-symbols-outlined">delete</span>
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]">
                                            <span className="material-symbols-outlined">image</span>
                                            <span className="text-xs font-semibold">Upload Cover</span>
                                        </div>
                                    )}
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Icon</label>
                                <label className="size-20 rounded-xl border-2 border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface-hover)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-text-main)] transition-colors relative overflow-hidden group">
                                    <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, 'icon')} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                    {squareIconFile ? (
                                        <>
                                            <img src={URL.createObjectURL(squareIconFile)} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute -top-1 -right-1 z-20 scale-75">
                                                <Button size="icon" variant="danger" onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setSquareIconFile(null);
                                                }}>
                                                    <span className="material-symbols-outlined">close</span>
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="material-symbols-outlined text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]">apps</span>
                                    )}
                                </label>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Gallery</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {screenshotFiles.map((file, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-[var(--color-surface-border)] group">
                                            <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                            <div className="absolute top-1 right-1">
                                                <Button size="icon" variant="danger" className="size-6" onClick={() => setScreenshotFiles(prev => prev.filter((_, i) => i !== idx))}>
                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    <label className="aspect-video rounded-lg border-2 border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface-hover)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-text-main)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                                        <input type="file" accept="image/*" multiple onChange={handleGallerySelect} className="hidden" />
                                        <span className="material-symbols-outlined">add_photo_alternate</span>
                                        <span className="text-xs font-semibold mt-1">Add Images</span>
                                    </label>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};
