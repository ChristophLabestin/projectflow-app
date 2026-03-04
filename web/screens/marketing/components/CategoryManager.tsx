import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useConfirm, useToast } from '../../../context/UIContext';
import { BlogCategory, fetchCategories, createCategory, updateCategory, deleteCategory } from '../../../services/blogService';
import { useLanguage } from '../../../context/LanguageContext';

interface CategoryManagerProps {
    onClose: () => void;
    onSelect?: (category: BlogCategory) => void;
    projectId: string;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ onClose, onSelect, projectId }) => {
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();
    const { t } = useLanguage();
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
                showSuccess(t('marketing.categoryManager.toast.created'));
            } else if (isEditing) {
                await updateCategory(projectId, isEditing, { name: editName, slug: editSlug || undefined });
                showSuccess(t('marketing.categoryManager.toast.updated'));
            }

            // Re-fetch all to ensure sync and proper data shape
            await loadCategories();

            setIsEditing(null);
            setEditName('');
            setEditSlug('');
        } catch (e) {
            console.error(e);
            showError(t('marketing.categoryManager.toast.saveError'));
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm(
            t('marketing.categoryManager.confirm.deleteTitle'),
            t('marketing.categoryManager.confirm.deleteMessage')
        );
        if (!confirmed) return;
        try {
            await deleteCategory(projectId, id);
            setCategories(categories.filter(c => c.id !== id));
            showSuccess(t('marketing.categoryManager.toast.deleted'));
        } catch (e) {
            showError(t('marketing.categoryManager.toast.deleteError'));
        }
    };

    const startEdit = (cat: BlogCategory) => {
        setIsEditing(cat.id);
        setEditName(cat.name);
        setEditSlug(cat.slug);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-surface rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-surface flex justify-between items-center">
                    <h3 className="font-bold text-lg">{t('marketing.categoryManager.title')}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-full">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                    {loading && categories.length === 0 && (
                        <div className="text-center py-8 text-muted">
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        </div>
                    )}

                    {!loading && categories.length === 0 && !isEditing && (
                        <div className="text-center py-8 text-muted">
                            <p>{t('marketing.categoryManager.empty')}</p>
                        </div>
                    )}

                    {categories.map(cat => (
                        <div key={cat.id} className="group flex items-center justify-between p-3 bg-surface rounded-xl border border-surface hover:border-primary transition-colors">
                            <div>
                                <div className="font-medium">{cat.name}</div>
                                <div className="text-xs text-muted">/{cat.slug}</div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => startEdit(cat)}
                                    className="p-1.5 hover:bg-surface-hover rounded-lg text-muted hover:text-white"
                                >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button
                                    onClick={() => handleDelete(cat.id)}
                                    className="p-1.5 hover:bg-surface-hover rounded-lg text-muted hover:text-red-500"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                                {onSelect && (
                                    <button
                                        onClick={() => { onSelect(cat); onClose(); }}
                                        className="p-1.5 hover:bg-surface-hover rounded-lg text-muted hover:text-primary"
                                        title={t('marketing.categoryManager.actions.select')}
                                    >
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {isEditing && (
                        <div className="p-4 bg-surface rounded-xl border border-primary animate-scale-up">
                            <div className="space-y-3">
                                <Input
                                    label={t('marketing.categoryManager.fields.name')}
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder={t('marketing.categoryManager.fields.namePlaceholder')}
                                    autoFocus
                                />
                                <Input
                                    label={t('marketing.categoryManager.fields.slug')}
                                    value={editSlug}
                                    onChange={(e) => setEditSlug(e.target.value)}
                                    placeholder={t('marketing.categoryManager.fields.slugPlaceholder')}
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(null)}>{t('common.cancel')}</Button>
                                    <Button size="sm" variant="primary" onClick={handleSave}>{t('marketing.categoryManager.actions.save')}</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {!isEditing && (
                    <div className="p-4 border-t border-surface">
                        <Button variant="secondary" className="w-full" onClick={() => {
                            setIsEditing('new');
                            setEditName('');
                            setEditSlug('');
                        }}>
                            <span className="material-symbols-outlined mr-2">add</span>
                            {t('marketing.categoryManager.actions.newCategory')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
