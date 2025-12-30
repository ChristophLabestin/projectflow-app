import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../context/UIContext';
import { BlogCategory, fetchCategories, createCategory, updateCategory, deleteCategory } from '../../../services/blogService';

interface CategoryManagerProps {
    onClose: () => void;
    onSelect?: (category: BlogCategory) => void;
    projectId: string;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ onClose, onSelect, projectId }) => {
    const { showSuccess, showError } = useToast();
    const [categories, setCategories] = useState<BlogCategory[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit/Create State
    const [isEditing, setIsEditing] = useState<string | null>(null); // ID or 'new'
    const [editName, setEditName] = useState('');
    const [editSlug, setEditSlug] = useState('');

    const loadCategories = async () => {
        setLoading(true);
        try {
            const data = await fetchCategories(projectId);
            setCategories(data);
        } catch (e) {
            // Quiet fail or notify
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, [projectId]);

    const handleSave = async () => {
        if (!editName.trim()) return;

        try {
            if (isEditing === 'new') {
                const newCat = await createCategory(projectId, { name: editName, slug: editSlug || undefined });
                if (onSelect) onSelect(newCat);
                showSuccess('Category created');
            } else if (isEditing) {
                const updated = await updateCategory(projectId, isEditing, { name: editName, slug: editSlug || undefined });
                showSuccess('Category updated');
            }

            // Re-fetch all to ensure sync and proper data shape
            await loadCategories();

            setIsEditing(null);
            setEditName('');
            setEditSlug('');
        } catch (e) {
            console.error(e);
            showError('Failed to save category');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        try {
            await deleteCategory(projectId, id);
            setCategories(categories.filter(c => c.id !== id));
            showSuccess('Category deleted');
        } catch (e) {
            showError('Failed to delete category');
        }
    };

    const startEdit = (cat: BlogCategory) => {
        setIsEditing(cat.id);
        setEditName(cat.name);
        setEditSlug(cat.slug);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                    <h3 className="font-bold text-lg">Manage Categories</h3>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface-hover)] rounded-full">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {loading && categories.length === 0 && (
                        <div className="text-center py-8 text-[var(--color-text-muted)]">
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        </div>
                    )}

                    {!loading && categories.length === 0 && !isEditing && (
                        <div className="text-center py-8 text-[var(--color-text-muted)]">
                            <p>No categories found.</p>
                        </div>
                    )}

                    {categories.map(cat => (
                        <div key={cat.id} className="group flex items-center justify-between p-3 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] hover:border-[var(--color-primary)] transition-colors">
                            <div>
                                <div className="font-medium">{cat.name}</div>
                                <div className="text-xs text-[var(--color-text-muted)]">/{cat.slug}</div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => startEdit(cat)}
                                    className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-lg text-[var(--color-text-muted)] hover:text-white"
                                >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button
                                    onClick={() => handleDelete(cat.id)}
                                    className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-lg text-[var(--color-text-muted)] hover:text-red-500"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                                {onSelect && (
                                    <button
                                        onClick={() => { onSelect(cat); onClose(); }}
                                        className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                                        title="Select"
                                    >
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {isEditing && (
                        <div className="p-4 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-primary)] animate-scale-up">
                            <div className="space-y-3">
                                <Input
                                    label="Name"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Category Name"
                                    autoFocus
                                />
                                <Input
                                    label="Slug (optional)"
                                    value={editSlug}
                                    onChange={(e) => setEditSlug(e.target.value)}
                                    placeholder="category-slug"
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>Cancel</Button>
                                    <Button size="sm" variant="primary" onClick={handleSave}>Save</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {!isEditing && (
                    <div className="p-4 border-t border-[var(--color-surface-border)]">
                        <Button variant="secondary" className="w-full" onClick={() => {
                            setIsEditing('new');
                            setEditName('');
                            setEditSlug('');
                        }}>
                            <span className="material-symbols-outlined mr-2">add</span>
                            New Category
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
