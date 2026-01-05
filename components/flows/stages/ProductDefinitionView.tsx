import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateProductDefinitionAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface ProductDefinitionViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface Requirement {
    id: string;
    title: string;
    description: string;
    priority: 'must' | 'should' | 'could' | 'wont';
}


export const ProductDefinitionView: React.FC<ProductDefinitionViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);

    // Store definition data in the idea's requirements field as JSON
    const definitionData = (() => {
        try {
            if (idea.requirements && idea.requirements.startsWith('{')) {
                return JSON.parse(idea.requirements);
            }
        } catch { }
        return {
            requirements: [] as Requirement[],
            successCriteria: '',
            scope: '',
            outOfScope: ''
        };
    })();

    const updateDefinition = (updates: Partial<typeof definitionData>) => {
        const newData = { ...definitionData, ...updates };
        onUpdate({ requirements: JSON.stringify(newData) });
    };

    // Helper to manage list-based strings
    const addListItem = (field: 'scope' | 'outOfScope' | 'successCriteria') => {
        const current = definitionData[field] ? definitionData[field].split('\n') : [];
        updateDefinition({ [field]: [...current, ''].join('\n') });
    };

    const updateListItem = (field: 'scope' | 'outOfScope' | 'successCriteria', index: number, value: string) => {
        const current = definitionData[field] ? definitionData[field].split('\n') : [];
        current[index] = value;
        updateDefinition({ [field]: current.join('\n') });
    };

    const removeListItem = (field: 'scope' | 'outOfScope' | 'successCriteria', index: number) => {
        const current = definitionData[field] ? definitionData[field].split('\n') : [];
        current.splice(index, 1);
        updateDefinition({ [field]: current.join('\n') });
    };

    // Requirement Helpers
    const addRequirement = (priority: Requirement['priority']) => {
        const newReq: Requirement = {
            id: Date.now().toString(),
            title: '',
            description: '',
            priority
        };
        updateDefinition({ requirements: [...definitionData.requirements, newReq] });
    };

    const updateRequirement = (id: string, updates: Partial<Requirement>) => {
        const newReqs = definitionData.requirements.map((r: Requirement) =>
            r.id === id ? { ...r, ...updates } : r
        );
        updateDefinition({ requirements: newReqs });
    };

    const removeRequirement = (id: string) => {
        updateDefinition({
            requirements: definitionData.requirements.filter((r: Requirement) => r.id !== id)
        });
    };

    const handleGenerateDefinition = async () => {
        setGenerating(true);
        try {
            const aiData = await generateProductDefinitionAI(idea);

            // Merge strategy: 
            // Append scope/criteria if existing is not empty (add new lines)
            // Append requirements

            const currentScope = definitionData.scope ? definitionData.scope + '\n' : '';
            const currentOutOfScope = definitionData.outOfScope ? definitionData.outOfScope + '\n' : '';
            const currentSuccessCriteria = definitionData.successCriteria ? definitionData.successCriteria + '\n' : '';

            updateDefinition({
                scope: currentScope + aiData.scope,
                outOfScope: currentOutOfScope + aiData.outOfScope,
                successCriteria: currentSuccessCriteria + aiData.successCriteria,
                requirements: [...definitionData.requirements, ...aiData.requirements]
            });
        } catch (error) {
            console.error("Failed to generate definition:", error);
        } finally {
            setGenerating(false);
        }
    };

    const scopeList = definitionData.scope ? definitionData.scope.split('\n').filter(Boolean) : [];
    const outOfScopeList = definitionData.outOfScope ? definitionData.outOfScope.split('\n').filter(Boolean) : [];
    const successList = definitionData.successCriteria ? definitionData.successCriteria.split('\n').filter(Boolean) : [];

    const groupedRequirements = {
        must: definitionData.requirements.filter((r: Requirement) => r.priority === 'must'),
        should: definitionData.requirements.filter((r: Requirement) => r.priority === 'should'),
        could: definitionData.requirements.filter((r: Requirement) => r.priority === 'could'),
        wont: definitionData.requirements.filter((r: Requirement) => r.priority === 'wont')
    };

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-main">{t('flowStages.productDefinition.title')}</h2>
                    <p className="text-sm text-muted">{t('flowStages.productDefinition.subtitle')}</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateDefinition}
                    loading={generating}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-none shadow-md !text-white"
                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                >
                    {t('flowStages.productDefinition.actions.generate')}
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto pr-2 pb-4">

                {/* Left Panel: Specs (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4">

                    {/* In Scope */}
                    <div className="bg-surface-paper p-5 rounded-2xl border border-surface shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between text-main font-bold border-b border-surface pb-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px] text-emerald-500">check_circle</span>
                                {t('flowStages.productDefinition.scope.in')}
                            </div>
                            <button onClick={() => addListItem('scope')} className="text-xs text-primary hover:underline">{t('flowStages.productDefinition.actions.add')}</button>
                        </div>
                        <div className="space-y-2">
                            {scopeList.map((item: string, i: number) => (
                                <div key={i} className="flex gap-2 group">
                                    <span className="mt-2 size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <input
                                        value={item}
                                        onChange={(e) => updateListItem('scope', i, e.target.value)}
                                        className="flex-1 bg-transparent border-none p-0 text-sm text-main placeholder-[var(--color-text-subtle)] focus:ring-0"
                                        placeholder={t('flowStages.productDefinition.scope.inPlaceholder')}
                                    />
                                    <button onClick={() => removeListItem('scope', i)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-500">
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            ))}
                            {scopeList.length === 0 && <span className="text-xs text-muted italic">{t('flowStages.productDefinition.scope.empty')}</span>}
                        </div>
                    </div>

                    {/* Out of Scope */}
                    <div className="bg-surface-paper p-5 rounded-2xl border border-surface shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between text-main font-bold border-b border-surface pb-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px] text-rose-500">cancel</span>
                                {t('flowStages.productDefinition.scope.out')}
                            </div>
                            <button onClick={() => addListItem('outOfScope')} className="text-xs text-primary hover:underline">{t('flowStages.productDefinition.actions.add')}</button>
                        </div>
                        <div className="space-y-2">
                            {outOfScopeList.map((item: string, i: number) => (
                                <div key={i} className="flex gap-2 group">
                                    <span className="mt-2 size-1.5 rounded-full bg-rose-500 shrink-0" />
                                    <input
                                        value={item}
                                        onChange={(e) => updateListItem('outOfScope', i, e.target.value)}
                                        className="flex-1 bg-transparent border-none p-0 text-sm text-main placeholder-[var(--color-text-subtle)] focus:ring-0"
                                        placeholder={t('flowStages.productDefinition.scope.outPlaceholder')}
                                    />
                                    <button onClick={() => removeListItem('outOfScope', i)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-500">
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            ))}
                            {outOfScopeList.length === 0 && <span className="text-xs text-muted italic">{t('flowStages.productDefinition.scope.empty')}</span>}
                        </div>
                    </div>

                    {/* Success Criteria */}
                    <div className="bg-surface-paper p-5 rounded-2xl border border-surface shadow-sm flex flex-col gap-3 flex-1">
                        <div className="flex items-center justify-between text-main font-bold border-b border-surface pb-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px] text-amber-500">ads_click</span>
                                {t('flowStages.productDefinition.success.title')}
                            </div>
                            <button onClick={() => addListItem('successCriteria')} className="text-xs text-primary hover:underline">{t('flowStages.productDefinition.actions.add')}</button>
                        </div>
                        <div className="space-y-2">
                            {successList.map((item: string, i: number) => (
                                <div key={i} className="flex gap-2 group items-start">
                                    <span className="material-symbols-outlined text-[16px] text-amber-500 mt-0.5 shrink-0">flag</span>
                                    <textarea
                                        value={item}
                                        onChange={(e) => updateListItem('successCriteria', i, e.target.value)}
                                        className="flex-1 bg-transparent border-none p-0 text-sm text-main placeholder-[var(--color-text-subtle)] focus:ring-0 resize-none"
                                        placeholder={t('flowStages.productDefinition.success.placeholder')}
                                        rows={2}
                                    />
                                    <button onClick={() => removeListItem('successCriteria', i)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-500">
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            ))}
                            {successList.length === 0 && <span className="text-xs text-muted italic">{t('flowStages.productDefinition.success.empty')}</span>}
                        </div>
                    </div>

                    {/* Advance Action */}
                    <div className="mt-4">
                        <Button
                            className="w-full h-12 text-base justify-between group hover:opacity-90 shadow-lg hover:shadow-xl transition-all rounded-xl border-none"
                            onClick={() => onUpdate({ stage: 'Development' })}
                        >
                            <span className="font-bold pl-1">{t('flowStages.productDefinition.actions.advance')}</span>
                            <div className="size-8 rounded-lg bg-white/20 dark:bg-black/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                        </Button>
                    </div>

                </div>

                {/* Right Panel: Requirements Matrix (8 cols) */}
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">

                    {/* Must Have */}
                    <div className="bg-surface-paper rounded-2xl border border-surface shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border-b border-rose-100 dark:border-rose-900/20 flex justify-between items-center">
                            <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                                <span className="material-symbols-outlined">priority_high</span>
                                {t('flowStages.productDefinition.requirements.must')}
                            </div>
                            <button onClick={() => addRequirement('must')} className="text-xs bg-white dark:bg-slate-800 border border-current rounded-full px-2 py-0.5 text-rose-600 hover:bg-rose-50">{t('flowStages.productDefinition.actions.add')}</button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-3">
                            {groupedRequirements.must.map(req => (
                                <RequirementCard key={req.id} req={req} updateRequirement={updateRequirement} removeRequirement={removeRequirement} />
                            ))}
                        </div>
                    </div>

                    {/* Should Have */}
                    <div className="bg-surface-paper rounded-2xl border border-surface shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20 flex justify-between items-center">
                            <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                <span className="material-symbols-outlined">star</span>
                                {t('flowStages.productDefinition.requirements.should')}
                            </div>
                            <button onClick={() => addRequirement('should')} className="text-xs bg-white dark:bg-slate-800 border border-current rounded-full px-2 py-0.5 text-amber-600 hover:bg-amber-50">{t('flowStages.productDefinition.actions.add')}</button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-3">
                            {groupedRequirements.should.map(req => (
                                <RequirementCard key={req.id} req={req} updateRequirement={updateRequirement} removeRequirement={removeRequirement} />
                            ))}
                        </div>
                    </div>

                    {/* Could Have */}
                    <div className="bg-surface-paper rounded-2xl border border-surface shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 bg-sky-50 dark:bg-sky-900/10 border-b border-sky-100 dark:border-sky-900/20 flex justify-between items-center">
                            <div className="font-bold text-sky-700 dark:text-sky-400 flex items-center gap-2">
                                <span className="material-symbols-outlined">add_circle</span>
                                {t('flowStages.productDefinition.requirements.could')}
                            </div>
                            <button onClick={() => addRequirement('could')} className="text-xs bg-white dark:bg-slate-800 border border-current rounded-full px-2 py-0.5 text-sky-600 hover:bg-sky-50">{t('flowStages.productDefinition.actions.add')}</button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-3">
                            {groupedRequirements.could.map(req => (
                                <RequirementCard key={req.id} req={req} updateRequirement={updateRequirement} removeRequirement={removeRequirement} />
                            ))}
                        </div>
                    </div>

                    {/* Won't Have */}
                    <div className="bg-surface-paper rounded-2xl border border-surface shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                <span className="material-symbols-outlined">do_not_disturb_on</span>
                                {t('flowStages.productDefinition.requirements.wont')}
                            </div>
                            <button onClick={() => addRequirement('wont')} className="text-xs bg-white dark:bg-slate-800 border border-current rounded-full px-2 py-0.5 text-slate-500 hover:bg-slate-50">{t('flowStages.productDefinition.actions.add')}</button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-3">
                            {groupedRequirements.wont.map(req => (
                                <RequirementCard key={req.id} req={req} updateRequirement={updateRequirement} removeRequirement={removeRequirement} />
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// Subcomponent for cleaner rendering
const RequirementCard = ({ req, updateRequirement, removeRequirement }: { req: Requirement, updateRequirement: any, removeRequirement: any }) => {
    const { t } = useLanguage();

    return (
        <div className="p-3 rounded-xl border border-surface bg-surface hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between gap-2 mb-2">
                <input
                    value={req.title}
                    onChange={(e) => updateRequirement(req.id, { title: e.target.value })}
                    className="font-semibold text-sm bg-transparent border-none p-0 focus:ring-0 text-main placeholder-[var(--color-text-subtle)] flex-1 min-w-0"
                    placeholder={t('flowStages.productDefinition.requirements.titlePlaceholder')}
                />
                <button onClick={() => removeRequirement(req.id)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-rose-500">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>
            <textarea
                value={req.description}
                onChange={(e) => updateRequirement(req.id, { description: e.target.value })}
                className="w-full bg-transparent border-none p-0 text-xs text-muted placeholder-[var(--color-text-subtle)] focus:ring-0 resize-none"
                placeholder={t('flowStages.productDefinition.requirements.detailsPlaceholder')}
                rows={2}
            />
        </div>
    );
};
