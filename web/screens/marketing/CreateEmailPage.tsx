import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { EMAIL_TEMPLATES, getProjectTemplates } from '../../services/dataService';
import { createEmailCampaign } from '../../services/marketingService';
import { format } from 'date-fns';
import { dateLocale } from '../../utils/activityHelpers';
import { EmailTemplate, EmailBlock, TemplateVariable } from '../../types';
import { Button } from '../../components/ui/Button';
import { BlockRenderer } from './components/email-builder/BlockRenderer';
import { RichTextEditor } from './components/email-builder/RichTextEditor';
import { MediaLibrary } from '../../components/MediaLibrary/MediaLibraryModal';
import { useToast } from '../../context/UIContext';
import { Input } from '../../components/ui/Input';

const STEPS = [
    { id: 0, label: 'Select Template' },
    { id: 1, label: 'Campaign Details' },
    { id: 2, label: 'Variables' },
];

export const CreateEmailPage = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [currentStep, setCurrentStep] = useState(0);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

    // Media Library State
    const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
    const [activeVariableForMedia, setActiveVariableForMedia] = useState<string | null>(null);

    // Form Data
    const [campaignName, setCampaignName] = useState('');
    const [subject, setSubject] = useState('');
    const [senderName, setSenderName] = useState('Team ProjectFlow');
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchTemplates = async () => {
            if (!projectId) return;
            try {
                const fetchedTemplates = await getProjectTemplates(projectId);
                // Filter for published templates only
                setTemplates(fetchedTemplates.filter((t: any) => t.status === 'published'));
            } catch (e) {
                console.error("Error fetching templates", e);
            } finally {
                setLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }, [projectId]);

    // Temporary: We will fix the fetch in the next step. 
    // For now, let's scaffold the UI.

    const handleNext = () => setCurrentStep(c => Math.min(c + 1, 2));
    const handleBack = () => setCurrentStep(c => Math.max(c - 1, 0));

    // Variable Helper
    const processedBlocks = useMemo(() => {
        if (!selectedTemplate) return [];

        // Deep clone to avoid mutating state
        const blocksCopy = JSON.parse(JSON.stringify(selectedTemplate.blocks)) as EmailBlock[];

        const replaceVariables = (text: string) => {
            return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                return variableValues[key] || `{{${key}}}`;
            });
        };

        const processBlock = (block: EmailBlock) => {
            // Text Replacement for standard content properties
            if (['text', 'header', 'quote', 'button', 'richtext', 'html'].includes(block.type)) {
                if (block.content.text) {
                    block.content.text = replaceVariables(block.content.text);
                }
                if (block.content.url) {
                    block.content.url = replaceVariables(block.content.url);
                }
            }

            // Image variables
            if (block.type === 'image') {
                if (block.content.src) {
                    block.content.src = replaceVariables(block.content.src);
                }
                if (block.content.url) {
                    block.content.url = replaceVariables(block.content.url);
                }
            }

            // Menu link variables
            if (block.type === 'menu' && block.content.menuLinks) {
                block.content.menuLinks = block.content.menuLinks.map(link => ({
                    ...link,
                    label: replaceVariables(link.label),
                    url: replaceVariables(link.url)
                }));
            }

            // Social link variables
            if (block.type === 'social' && block.content.socialLinks) {
                block.content.socialLinks = block.content.socialLinks.map(link => ({
                    ...link,
                    url: replaceVariables(link.url)
                }));
            }

            // Recursive traversal for containers
            if (block.type === 'columns' && block.content.columns) {
                block.content.columns.forEach(col => {
                    // In current structure, col is an array of blocks
                    col.forEach(processBlock);
                });
            }
            if ((block.type === 'flex' || block.type === 'div') && block.content.children) {
                block.content.children.forEach(processBlock);
            }
        };

        blocksCopy.forEach(processBlock);
        return blocksCopy;
    }, [selectedTemplate, variableValues]);

    const handleCreate = async () => {
        if (!selectedTemplate) return;
        setIsSubmitting(true);
        try {
            await createEmailCampaign({
                projectId: projectId!,
                name: campaignName,
                subject,
                senderName,
                status: 'Draft',
                contentBlocks: processedBlocks, // Store resolved blocks? Or original + variables? Store original + vars is better for editing, but let's store resolved for simplicity of sending.
                // Actually, storing resolved blocks makes it "fixed" at creation time. 
                // Better pattern: Store templateId and variableValues.
                templateId: selectedTemplate.id,
                variableValues,
                stats: { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
            });
            showToast('Email campaign created!', 'success');
            navigate(`/project/${projectId}/marketing/email`);
        } catch (e) {
            console.error(e);
            showToast('Failed to create campaign', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-6 lg:p-8 bg-gradient-to-br from-[var(--color-surface-bg)] via-[var(--color-surface-bg)] to-zinc-100/30 dark:to-zinc-800/10 overflow-hidden">
            <div className="w-full max-w-7xl h-full bg-card rounded-3xl shadow-2xl border border-surface flex overflow-hidden animate-fade-in">

                {/* LEFT: Form Panel */}
                <div className="flex-[0.4] flex flex-col border-r border-surface min-w-[320px] max-w-[500px]">
                    <header className="px-6 py-5 border-b border-surface flex items-center justify-between shrink-0">
                        <div>
                            <h1 className="text-xl font-bold text-main">New Email Campaign</h1>
                            <div className="flex items-center gap-2 mt-2">
                                {STEPS.map((step) => (
                                    <div key={step.id} className={`flex items-center gap-2 ${currentStep === step.id ? 'text-primary' : 'text-muted'}`}>
                                        <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${currentStep === step.id ? 'border-primary bg-primary/10' : 'border-surface'}`}>
                                            {step.id + 1}
                                        </div>
                                        <span className="text-xs font-medium">{step.label}</span>
                                        {step.id < STEPS.length - 1 && <div className="w-4 h-px bg-surface-border" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {currentStep === 0 && (
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <h2 className="text-lg font-bold">Select a Template</h2>
                                    <p className="text-sm text-subtle">Choose a published template to start with.</p>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {/* We will map templates here. For now, empty state or loading */}
                                    {loadingTemplates ? (
                                        <div className="text-center py-10 text-muted">
                                            <span className="material-symbols-outlined animate-spin mb-2">progress_activity</span>
                                            <p>Loading templates...</p>
                                        </div>
                                    ) : templates.length === 0 ? (
                                        <div className="text-center py-10 text-muted border-2 border-dashed border-surface rounded-xl">
                                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">draft</span>
                                            <p>No published templates found.</p>
                                            <button onClick={() => navigate('../builder')} className="mt-4 text-primary font-bold text-sm hover:underline">Create Template</button>
                                        </div>
                                    ) : (
                                        templates.map(tpl => (
                                            <button
                                                key={tpl.id}
                                                onClick={() => setSelectedTemplate(tpl)}
                                                className={`text-left p-4 rounded-xl border transition-all hover:shadow-md w-full ${selectedTemplate?.id === tpl.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-surface bg-surface hover:border-primary/50'}`}
                                            >
                                                <div className="font-bold text-main">{tpl.name}</div>
                                                <div className="text-xs text-muted mt-1">Edited {format(new Date(tpl.updatedAt?.seconds * 1000 || Date.now()), 'MMM d, yyyy', { locale: dateLocale })}</div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Input
                                        label="Campaign Name"
                                        value={campaignName}
                                        onChange={e => setCampaignName(e.target.value)}
                                        placeholder="e.g. January Newsletter"
                                        autoFocus
                                    />
                                    <Input
                                        label="Subject Line"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Enter email subject..."
                                    />
                                    <Input
                                        label="Sender Name"
                                        value={senderName}
                                        onChange={e => setSenderName(e.target.value)}
                                    />
                                </div>

                                {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
                                    <div className="pt-6 border-t border-surface">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3">
                                            <span className="material-symbols-outlined text-blue-500">info</span>
                                            <div>
                                                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">This template has references.</p>
                                                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">You can configure them in the next step.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <h2 className="text-lg font-bold">Customize Variables</h2>
                                    <p className="text-sm text-subtle">Fill in the values for the dynamic fields in this template.</p>
                                </div>
                                {selectedTemplate?.variables && selectedTemplate.variables.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedTemplate.variables.map(variable => (
                                            <div key={variable.name} className="space-y-1">
                                                <label className="text-sm font-medium">{variable.label || variable.name}</label>
                                                {variable.type === 'image' ? (
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={variableValues[variable.name] || ''}
                                                            onChange={e => setVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                                                            placeholder={`Image URL for ${variable.name}`}
                                                            className="flex-1"
                                                            autoFocus={false}
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                setActiveVariableForMedia(variable.name);
                                                                setIsMediaLibraryOpen(true);
                                                            }}
                                                            className="px-3 bg-surface-hover border border-surface rounded-lg hover:brightness-95 transition-all text-zinc-500 hover:text-primary hover:border-primary"
                                                            title="Select from Media Library"
                                                        >
                                                            <span className="material-symbols-outlined">perm_media</span>
                                                        </button>
                                                    </div>
                                                ) : variable.type === 'richtext' ? (
                                                    <div className="rounded-lg border border-surface overflow-hidden">
                                                        <RichTextEditor
                                                            value={variableValues[variable.name] || ''}
                                                            onChange={val => setVariableValues(prev => ({ ...prev, [variable.name]: val }))}
                                                        />
                                                    </div>
                                                ) : (
                                                    <Input
                                                        value={variableValues[variable.name] || ''}
                                                        onChange={e => setVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                                                        placeholder={`Value for ${variable.name}`}
                                                        type={variable.type === 'number' ? 'number' : variable.type === 'date' ? 'date' : 'text'}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-muted border border-dashed border-surface rounded-xl">
                                        <p>No variables found in this template.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <footer className="px-6 py-5 border-t border-surface flex items-center justify-between shrink-0 bg-surface">
                        <Button variant="ghost" onClick={() => currentStep === 0 ? navigate(-1) : handleBack()}>
                            Back
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => currentStep < 2 ? handleNext() : handleCreate()}
                            disabled={(currentStep === 0 && !selectedTemplate) || (currentStep === 1 && (!campaignName || !subject))}
                        >
                            {currentStep < 2 ? 'Next' : (isSubmitting ? 'Creating...' : 'Create Campaign')}
                        </Button>
                    </footer>
                </div>

                {/* RIGHT: Preview Panel */}
                <div className="flex-[0.6] bg-zinc-100 dark:bg-black/20 flex flex-col relative overflow-hidden border-l border-surface">
                    <div className="absolute top-4 right-4 z-10 bg-white dark:bg-zinc-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-zinc-200 dark:border-zinc-700 text-zinc-500">
                        Live Preview
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                        <div className="w-full max-w-[600px] bg-white min-h-[800px] h-fit shadow-xl rounded-none mx-auto origin-top transition-transform duration-300">
                            {selectedTemplate ? (
                                <div className="flex flex-col">
                                    {processedBlocks.map((block) => (
                                        <div key={block.id} className="relative group">
                                            <BlockRenderer block={block} preview={true} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-10 text-center">
                                    <span className="material-symbols-outlined text-6xl mb-4 opacity-20">web</span>
                                    <p className="text-lg font-medium">Select a template to preview</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <MediaLibrary
                isOpen={isMediaLibraryOpen}
                onClose={() => {
                    setIsMediaLibraryOpen(false);
                }}
                onSelect={(asset) => {
                    if (activeVariableForMedia) {
                        setVariableValues(prev => ({ ...prev, [activeVariableForMedia]: asset.url }));
                        setActiveVariableForMedia(null);
                    }
                }}
                projectId={projectId || ''}
            />
        </div>
    );
};
