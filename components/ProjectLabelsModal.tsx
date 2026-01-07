import React, { useState, useEffect } from 'react';
import { getProjectCategories, addProjectCategory, updateProjectCategory, deleteProjectCategory } from '../services/dataService';
import { TaskCategory } from '../types';
import { Modal } from './common/Modal/Modal';
import { Button } from './common/Button/Button';
import { TextInput } from './common/Input/TextInput';
import { useLanguage } from '../context/LanguageContext';
import { useConfirm } from '../context/UIContext';
import './project-labels-modal.scss';

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
    const confirm = useConfirm();

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
        if (!await confirm(t('projectLabels.confirm.deleteTitle'), t('projectLabels.confirm.delete'))) return;
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
            <div className="project-labels">
                {/* Add New Label Form */}
                <form onSubmit={handleAddLabel} className="project-labels__form">
                    <TextInput
                        label={t('projectLabels.new.label')}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t('projectLabels.new.placeholder')}
                        autoComplete="off"
                    />
                    <div className="project-labels__palette">
                        {PRESET_COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setNewColor(color)}
                                className={`project-labels__color ${newColor === color ? 'is-selected' : ''}`}
                                style={{ backgroundColor: color }}
                                aria-label={color}
                            />
                        ))}
                    </div>
                    {error && <p className="project-labels__error">{error}</p>}
                    <Button
                        type="submit"
                        disabled={!newName.trim() || isSaving}
                        isLoading={isSaving}
                        className="project-labels__submit"
                    >
                        {t('projectLabels.actions.create')}
                    </Button>
                </form>

                {/* Labels List */}
                <div className="project-labels__list">
                    <label className="project-labels__list-title">{t('projectLabels.list.title')}</label>
                    <div className="project-labels__items">
                        {loading ? (
                            <div className="project-labels__status">{t('projectLabels.loading')}</div>
                        ) : labels.length === 0 ? (
                            <div className="project-labels__empty">{t('projectLabels.empty')}</div>
                        ) : (
                            labels.map(label => (
                                <div key={label.id} className={`project-labels__item ${editingLabelId === label.id ? 'is-editing' : ''}`}>
                                    <div className="project-labels__item-row">
                                        <div className="project-labels__swatch" style={{ backgroundColor: label.color || 'var(--color-text-muted)' }} />
                                        <div className="project-labels__content">
                                            {editingLabelId === label.id ? (
                                                <input
                                                    autoFocus
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="project-labels__edit-input"
                                                    placeholder={t('projectLabels.edit.placeholder')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleUpdateLabel(label.id, { name: editName.trim(), color: editColor });
                                                        if (e.key === 'Escape') setEditingLabelId(null);
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="project-labels__name"
                                                    onClick={() => {
                                                        setEditingLabelId(label.id);
                                                        setEditName(label.name);
                                                        setEditColor(label.color || PRESET_COLORS[0]);
                                                    }}
                                                >
                                                    {label.name}
                                                </button>
                                            )}
                                        </div>
                                        <div className="project-labels__actions">
                                            {editingLabelId === label.id ? (
                                                <div className="project-labels__edit-actions">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingLabelId(null)}
                                                        className="project-labels__icon-btn"
                                                        title={t('common.cancel')}
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateLabel(label.id, { name: editName.trim(), color: editColor })}
                                                        disabled={!editName.trim() || isSaving}
                                                        className="project-labels__icon-btn project-labels__icon-btn--primary"
                                                        title={t('projectLabels.actions.save')}
                                                    >
                                                        <span className="material-symbols-outlined">check</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="project-labels__view-actions">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingLabelId(label.id);
                                                            setEditName(label.name);
                                                            setEditColor(label.color || PRESET_COLORS[0]);
                                                        }}
                                                        className="project-labels__icon-btn"
                                                    >
                                                        <span className="material-symbols-outlined">edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteLabel(label.id)}
                                                        className="project-labels__icon-btn project-labels__icon-btn--danger"
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {editingLabelId === label.id && (
                                        <div className="project-labels__edit-palette">
                                            {PRESET_COLORS.map(color => (
                                                <button
                                                    key={`edit-${color}`}
                                                    type="button"
                                                    onClick={() => setEditColor(color)}
                                                    className={`project-labels__color ${editColor === color ? 'is-selected' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                    aria-label={color}
                                                />
                                            ))}
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

