import React, { useState, useEffect } from 'react';
import { X, Search, Layout, Plus, Trash2, FileText, CheckCircle } from 'lucide-react';
import { BlogTemplate, getBlogTemplates, saveBlogTemplate, deleteBlogTemplate } from '../../../services/blogService';
import { useToast, useConfirm } from '../../../context/UIContext';
import { Button } from '../../../components/ui/Button';

interface TemplateManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentContent: string;
    projectId: string;
    onLoadTemplate: (content: string) => void;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
    isOpen,
    onClose,
    currentContent,
    projectId,
    onLoadTemplate
}) => {
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();
    const [templates, setTemplates] = useState<BlogTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<'list' | 'save'>('list');
    const [newTemplateName, setNewTemplateName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen && projectId) {
            loadTemplates();
        }
    }, [isOpen, projectId]);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await getBlogTemplates(projectId);
            setTemplates(data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
        } catch (error) {
            console.error(error);
            showError('Failed to load templates');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) {
            showError('Please enter a template name');
            return;
        }

        try {
            await saveBlogTemplate(projectId, newTemplateName, currentContent);
            showSuccess('Template saved successfully');
            setNewTemplateName('');
            setMode('list');
            loadTemplates();
        } catch (error) {
            console.error(error);
            showError('Failed to save template');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (await confirm('Delete Template', 'Are you sure you want to delete this template? This action cannot be undone.')) {
            try {
                await deleteBlogTemplate(id);
                showSuccess('Template deleted');
                setTemplates(prev => prev.filter(t => t.id !== id));
            } catch (error) {
                console.error(error);
                showError('Failed to delete template');
            }
        }
    };

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-surface-border)]">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Layout className="text-[var(--color-primary)]" />
                        Template Manager
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
                    {mode === 'list' && (
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search templates..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                    />
                                </div>
                                <Button
                                    onClick={() => setMode('save')}
                                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors gap-2"
                                >
                                    <Plus size={16} />
                                    Save Current as Template
                                </Button>
                            </div>

                            {isLoading ? (
                                <div className="flex items-center justify-center h-40">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="text-center py-12 text-[var(--color-text-muted)]">
                                    <Layout size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>No templates found.</p>
                                    <p className="text-sm mt-1">Save your current layout as a template to get started.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {filteredTemplates.map(template => (
                                        <div
                                            key={template.id}
                                            onClick={async () => {
                                                if (await confirm('Load Template', 'Load this template? Current content will be replaced with the template content.')) {
                                                    onLoadTemplate(template.content);
                                                    onClose();
                                                }
                                            }}
                                            className="group relative p-4 rounded-xl border border-[var(--color-surface-border)] hover:border-[var(--color-primary)] bg-[var(--color-surface-bg)] cursor-pointer transition-all hover:shadow-md"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="p-2 rounded-lg bg-[var(--color-surface-card)] text-[var(--color-primary)]">
                                                    <FileText size={20} />
                                                </div>
                                                <button
                                                    onClick={(e) => handleDelete(template.id, e)}
                                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete Template"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <h3 className="font-semibold text-[var(--color-text-main)] mb-1">{template.name}</h3>
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                Created {new Date(template.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'save' && (
                        <div className="max-w-md mx-auto py-8">
                            <h3 className="text-lg font-semibold mb-2">Save as Template</h3>
                            <p className="text-sm text-[var(--color-text-muted)] mb-6">
                                Create a reusable template from your current editor content.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 uppercase">Template Name</label>
                                    <input
                                        type="text"
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                        placeholder="e.g., Monthly Newsletter Layout"
                                        className="w-full p-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setMode('list')}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <Button
                                        onClick={handleSaveTemplate}
                                        disabled={!newTemplateName.trim()}
                                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                                    >
                                        Save Template
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
