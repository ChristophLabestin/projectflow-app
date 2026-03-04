import React, { useState } from 'react';
import { TemplateVariable } from '../../../types';
import { useConfirm } from '../../../../context/UIContext';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { useLanguage } from '../../../../context/LanguageContext';

interface VariableManagerProps {
    variables: TemplateVariable[];
    onChange: (variables: TemplateVariable[]) => void;
}

export const VariableManager: React.FC<VariableManagerProps> = ({ variables, onChange }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const confirm = useConfirm();
    const { t } = useLanguage();

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

    const handleDelete = async (id: string) => {
        if (await confirm(
            t('marketing.variableManager.confirm.deleteTitle'),
            t('marketing.variableManager.confirm.deleteMessage')
        )) {
            onChange(variables.filter(v => v.id !== id));
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-paper font-sans">
            <div className="p-4 border-b border-surface">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted">{t('marketing.variableManager.title')}</h3>
                <p className="text-xs text-muted mt-1">{t('marketing.variableManager.subtitle')}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {variables.map(v => {
                    const isSystem = v.id.startsWith('recipient.');
                    return (
                        <div key={v.id} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg group">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded inline-block mb-1">
                                        {'{{'}{v.name}{'}}'}
                                    </div>
                                    <div className="text-sm font-medium">{v.label}</div>
                                    <div className="text-xs text-zinc-500 mt-1">
                                        {t('marketing.variableManager.typeLabel').replace('{type}', v.type)}
                                    </div>
                                </div>
                                {!isSystem && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(v)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500">
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(v.id)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-red-500">
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                )}
                                {isSystem && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                            {t('marketing.variableManager.badges.system')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-full py-2 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        {t('marketing.variableManager.actions.add')}
                    </button>
                )}

                {isAdding && (
                    <div className="bg-card rounded-lg border border-surface p-4 space-y-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                        <Input
                            label={t('marketing.variableManager.form.nameLabel')}
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder={t('marketing.variableManager.form.namePlaceholder')}
                            className="font-mono"
                        />
                        <Input
                            label={t('marketing.variableManager.form.displayLabel')}
                            value={formData.label || ''}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            placeholder={t('marketing.variableManager.form.displayPlaceholder')}
                        />
                        <Select
                            label={t('marketing.variableManager.form.type')}
                            value={formData.type || 'text'}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        >
                            <option value="text">{t('marketing.variableManager.types.text')}</option>
                            <option value="number">{t('marketing.variableManager.types.number')}</option>
                            <option value="date">{t('marketing.variableManager.types.date')}</option>
                            <option value="url">{t('marketing.variableManager.types.url')}</option>
                            <option value="image">{t('marketing.variableManager.types.image')}</option>
                            <option value="richtext">{t('marketing.variableManager.types.richtext')}</option>
                        </Select>
                        <Input
                            label={t('marketing.variableManager.form.defaultValue')}
                            value={formData.defaultValue || ''}
                            onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                            placeholder={t('marketing.variableManager.form.defaultPlaceholder')}
                        />
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleSave}
                                className="flex-1 py-2 bg-primary text-on-primary text-xs font-bold rounded hover:brightness-110"
                            >
                                {editingId
                                    ? t('marketing.variableManager.actions.update')
                                    : t('marketing.variableManager.actions.create')}
                            </button>
                            <button
                                onClick={resetForm}
                                className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 text-xs font-bold rounded hover:bg-zinc-50"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
