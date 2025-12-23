import React, { useState } from 'react';
import { TemplateVariable } from '../../../types';

interface VariableManagerProps {
    variables: TemplateVariable[];
    onChange: (variables: TemplateVariable[]) => void;
}

export const VariableManager: React.FC<VariableManagerProps> = ({ variables, onChange }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<TemplateVariable>>({
        name: '',
        label: '',
        type: 'text',
        defaultValue: ''
    });

    const resetForm = () => {
        setFormData({ name: '', label: '', type: 'text', defaultValue: '' });
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSave = () => {
        if (!formData.name || !formData.label) return;

        const newVar: TemplateVariable = {
            id: editingId || crypto.randomUUID(),
            name: formData.name.replace(/\s+/g, ''), // Ensure no spaces in var name
            label: formData.label,
            type: formData.type as any || 'text',
            defaultValue: formData.defaultValue
        };

        if (editingId) {
            onChange(variables.map(v => v.id === editingId ? newVar : v));
        } else {
            onChange([...variables, newVar]);
        }
        resetForm();
    };

    const handleEdit = (v: TemplateVariable) => {
        setFormData(v);
        setEditingId(v.id);
        setIsAdding(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this variable?')) {
            onChange(variables.filter(v => v.id !== id));
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface-paper)] font-sans">
            <div className="p-4 border-b border-[var(--color-surface-border)]">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Variables</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Define dynamic values to use in your template such as {'{{firstName}}'}.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {variables.map(v => (
                    <div key={v.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg group">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-mono text-xs font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-1.5 py-0.5 rounded inline-block mb-1">
                                    {'{{'}{v.name}{'}}'}
                                </div>
                                <div className="text-sm font-medium">{v.label}</div>
                                <div className="text-xs text-zinc-500 mt-1">Type: {v.type}</div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(v)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500">
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button onClick={() => handleDelete(v.id)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-red-500">
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-full py-2 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Add Variable
                    </button>
                )}

                {isAdding && (
                    <div className="bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-surface-border)] p-4 space-y-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500">Variable Name (Key)</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="firstName"
                                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500">Display Label</label>
                            <input
                                type="text"
                                value={formData.label}
                                onChange={e => setFormData({ ...formData, label: e.target.value })}
                                placeholder="First Name"
                                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500">Type</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                            >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                                <option value="url">URL</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500">Default Value</label>
                            <input
                                type="text"
                                value={formData.defaultValue}
                                onChange={e => setFormData({ ...formData, defaultValue: e.target.value })}
                                placeholder="Friend"
                                className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleSave}
                                className="flex-1 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded hover:brightness-110"
                            >
                                {editingId ? 'Update' : 'Create'}
                            </button>
                            <button
                                onClick={resetForm}
                                className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 text-xs font-bold rounded hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
