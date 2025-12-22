import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { createIssue } from '../services/dataService';

interface CreateIssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    initialDescription?: string;
    initialTitle?: string;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
    isOpen,
    onClose,
    projectId,
    initialDescription = '',
    initialTitle = ''
}) => {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle(initialTitle || '');
            setDescription(initialDescription || '');
        }
        // Only run when opening the modal, to avoid overwriting user changes if props update unexpectedly
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createIssue(projectId, {
                title,
                description
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div
                className="w-full max-w-2xl bg-[var(--color-surface-card)] rounded-xl shadow-2xl animate-scale-up border border-[var(--color-surface-border)] flex flex-col max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)]">Report Issue</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">Create a new issue in the project.</p>
                    </div>
                    <Button variant="ghost" onClick={onClose} size="sm">Close</Button>
                </div>

                <form onSubmit={handleSave} className="p-6">
                    <div className="flex flex-col gap-6">
                        <Input
                            label="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Issue title"
                            required
                            className="text-lg font-medium"
                        />

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] ml-1">Description</label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the issue..."
                                rows={8}
                                className="min-h-[200px]"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-[var(--color-surface-border)]">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button type="submit" isLoading={loading} disabled={!title.trim()}>Create Issue</Button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
