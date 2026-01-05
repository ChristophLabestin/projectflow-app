import React, { useState, useEffect } from 'react';
import { getProjectCategories, addProjectCategory, updateProjectCategory, deleteProjectCategory } from '../services/dataService';
import { TaskCategory } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useLanguage } from '../context/LanguageContext';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    tenantId?: string;
    onLabelsChange?: () => void;
};

const PRESET_COLORS = [
    '#64748b', // Slate
    '#ef4444', // Red
    '#f97316', // Orange
    '#f59e0b', // Amber
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#22c55e', // Green
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#a855f7', // Purple
    '#d946ef', // Fuchsia
    '#ec4899', // Pink
    '#f43f5e', // Rose
];

export const ProjectLabelsModal: React.FC<Props> = ({ isOpen, onClose, projectId, tenantId, onLabelsChange }) => {
    const [labels, setLabels] = useState<TaskCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLanguage();

    const loadLabels = async () => {
        setLoading(true);
        try {
            const data = await getProjectCategories(projectId, tenantId);
            setLabels(data);
        } catch (err) {
            console.error('Failed to load labels', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadLabels();
        }
    }, [isOpen, projectId, tenantId]);

    const handleAddLabel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || isSaving) return;
        setIsSaving(true);
        setError(null);
        try {
            await addProjectCategory(projectId, newName.trim(), newColor, tenantId);
            setNewName('');
            loadLabels();
            onLabelsChange?.();
        } catch (err: any) {
            setError(err.message || t('projectLabels.errors.addFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateLabel = async (id: string, updates: Partial<TaskCategory>) => {
        try {
            await updateProjectCategory(projectId, id, updates, tenantId);
            loadLabels();
            onLabelsChange?.();
            setEditingLabelId(null);
        } catch (err) {
            console.error('Failed to update label', err);
        }
    };

    const handleDeleteLabel = async (id: string) => {
        if (!window.confirm(t('projectLabels.confirm.delete'))) return;
        try {
            await deleteProjectCategory(projectId, id, tenantId);
            loadLabels();
            onLabelsChange?.();
        } catch (err) {
            console.error('Failed to delete label', err);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('projectLabels.title')}
            size="md"
        >
            <div className="space-y-5">
                {/* Add New Label Form / Compacted */}
                <form onSubmit={handleAddLabel} className="space-y-4 p-3.5 rounded-xl bg-surface border border-surface">
                    <div className="flex flex-col gap-3">
                        <Input
                            label={t('projectLabels.new.label')}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={t('projectLabels.new.placeholder')}
                            autoComplete="off"
                        />
                        <div>
                            <div className="flex flex-wrap gap-1.5">
                                {PRESET_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setNewColor(color)}
                                        className={`size-5 rounded-full border transition-all ${newColor === color ? 'border-[var(--color-text-main)] scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                        {error && <p className="text-xs text-rose-500">{error}</p>}
                        <Button
                            type="submit"
                            disabled={!newName.trim() || isSaving}
                            isLoading={isSaving}
                            className="w-full py-2 h-9 text-sm"
                        >
                            {t('projectLabels.actions.create')}
                        </Button>
                    </div>
                </form>

                {/* Labels List / More Compact */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block px-1">{t('projectLabels.list.title')}</label>
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                        {loading ? (
                            <div className="py-8 text-center text-muted animate-pulse">{t('projectLabels.loading')}</div>
                        ) : labels.length === 0 ? (
                            <div className="py-8 text-center text-muted italic text-sm">{t('projectLabels.empty')}</div>
                        ) : (
                            labels.map(label => (
                                <div key={label.id} className={`flex flex-col p-1.5 rounded-lg transition-all border ${editingLabelId === label.id ? 'bg-card border-surface shadow-sm' : 'hover:bg-surface-hover border-transparent group'}`}>
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color || '#64748b' }} />
                                        <div className="flex-1">
                                            {editingLabelId === label.id ? (
                                                <input
                                                    autoFocus
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="bg-transparent border-none outline-none text-sm font-semibold w-full text-main"
                                                    placeholder={t('projectLabels.edit.placeholder')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateLabel(label.id, { name: editName.trim(), color: editColor });
                                                        if (e.key === 'Escape') setEditingLabelId(null);
                                                    }}
                                                />
                                            ) : (
                                                <span
                                                    className="text-sm font-medium text-main cursor-pointer"
                                                    onClick={() => {
                                                        setEditingLabelId(label.id);
                                                        setEditName(label.name);
                                                        setEditColor(label.color || PRESET_COLORS[0]);
                                                    }}
                                                >
                                                    {label.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {editingLabelId === label.id ? (
                                                <div className="flex items-center gap-0.5">
                                                    <button
                                                        onClick={() => setEditingLabelId(null)}
                                                        className="p-1 rounded-md hover:bg-surface text-muted"
                                                        title={t('common.cancel')}
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateLabel(label.id, { name: editName.trim(), color: editColor })}
                                                        disabled={!editName.trim() || isSaving}
                                                        className="p-1 rounded-md hover:bg-primary/10 text-primary"
                                                        title={t('projectLabels.actions.save')}
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">check</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingLabelId(label.id);
                                                            setEditName(label.name);
                                                            setEditColor(label.color || PRESET_COLORS[0]);
                                                        }}
                                                        className="p-1 rounded-md hover:bg-surface text-muted hover:text-main"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLabel(label.id)}
                                                        className="p-1 rounded-md hover:bg-surface text-muted hover:text-rose-500"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {editingLabelId === label.id && (
                                        <div className="mt-2 pt-2 border-t border-surface">
                                            <div className="flex flex-wrap gap-1">
                                                {PRESET_COLORS.map(color => (
                                                    <button
                                                        key={`edit-${color}`}
                                                        type="button"
                                                        onClick={() => setEditColor(color)}
                                                        className={`size-4 rounded-full border transition-all ${editColor === color ? 'border-[var(--color-text-main)] scale-110' : 'border-transparent hover:scale-105'}`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
