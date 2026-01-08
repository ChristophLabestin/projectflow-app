import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { Badge } from '../../common/Badge/Badge';
import { Checkbox } from '../../common/Checkbox/Checkbox';
import { generateProductLaunchAI, generateRiskWinAnalysis } from '../../../services/geminiService';
import { AnalysisDashboard } from '../AnalysisDashboard';
import { useLanguage } from '../../../context/LanguageContext';

interface ProductLaunchViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ChecklistCategory {
    id: string;
    category: string;
    items: { id: string; title: string; done: boolean }[];
    isCollapsed?: boolean;
}

export const ProductLaunchView: React.FC<ProductLaunchViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);
    const [viewMode, setViewMode] = useState<'execution' | 'analysis'>('execution');
    const [analyzing, setAnalyzing] = useState(false);

    const launchData = (() => {
        try {
            if (idea.launchPlan && idea.launchPlan.startsWith('{')) {
                return JSON.parse(idea.launchPlan);
            }
        } catch { }
        return {
            checklist: [] as ChecklistCategory[],
            channels: [] as string[],
            announcement: '' as string
        };
    })();

    const updateLaunchData = (updates: Partial<typeof launchData>) => {
        const newData = { ...launchData, ...updates };
        onUpdate({ launchPlan: JSON.stringify(newData) });
    };

    const addChecklistCategory = () => {
        const newCat: ChecklistCategory = {
            id: Date.now().toString(),
            category: t('flowStages.productLaunch.checklist.defaultCategory'),
            items: [],
            isCollapsed: false
        };
        updateLaunchData({ checklist: [...launchData.checklist, newCat] });
    };

    const updateChecklistCategory = (id: string, updates: Partial<ChecklistCategory>) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) => c.id === id ? { ...c, ...updates } : c);
        updateLaunchData({ checklist: newList });
    };

    const addChecklistItem = (catId: string) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) =>
            c.id === catId ? { ...c, items: [...c.items, { id: Date.now().toString(), title: '', done: false }] } : c
        );
        updateLaunchData({ checklist: newList });
    };

    const updateChecklistItem = (catId: string, itemId: string, updates: Partial<{ title: string; done: boolean }>) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) => {
            if (c.id !== catId) return c;
            const newItems = c.items.map((i) => i.id === itemId ? { ...i, ...updates } : i);
            return { ...c, items: newItems };
        });
        updateLaunchData({ checklist: newList });
    };

    const removeChecklistItem = (catId: string, itemId: string) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) => {
            if (c.id !== catId) return c;
            return { ...c, items: c.items.filter((i) => i.id !== itemId) };
        });
        updateLaunchData({ checklist: newList });
    };

    const removeChecklistCategory = (id: string) => {
        updateLaunchData({ checklist: launchData.checklist.filter((c: ChecklistCategory) => c.id !== id) });
    };

    const addChannel = () => {
        updateLaunchData({ channels: [...launchData.channels, ''] });
    };

    const updateChannel = (index: number, value: string) => {
        const newChannels = [...launchData.channels];
        newChannels[index] = value;
        updateLaunchData({ channels: newChannels });
    };

    const removeChannel = (index: number) => {
        const newChannels = [...launchData.channels];
        newChannels.splice(index, 1);
        updateLaunchData({ channels: newChannels });
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const result = await generateProductLaunchAI(idea);
            const newChecklist = result.checklist.map((c: any, i: number) => ({
                id: `ai-list-${Date.now()}-${i}`,
                category: c.category,
                items: c.items.map((item: string, j: number) => ({ id: `ai-item-${Date.now()}-${i}-${j}`, title: item, done: false })),
                isCollapsed: false
            }));

            updateLaunchData({
                checklist: [...launchData.checklist, ...newChecklist],
                channels: [...launchData.channels, ...result.channels],
                announcement: launchData.announcement ? launchData.announcement : result.announcement
            });
        } catch (error) {
            console.error('Failed to generate launch plan:', error);
        } finally {
            setGenerating(false);
        }
    };

    const handleRunAnalysis = async () => {
        setAnalyzing(true);
        try {
            const result = await generateRiskWinAnalysis(idea);
            onUpdate({ riskWinAnalysis: result });
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    const totalChecks = launchData.checklist.reduce((acc, c) => acc + c.items.length, 0);
    const completedChecks = launchData.checklist.reduce((acc, c) => acc + c.items.filter((i) => i.done).length, 0);
    const progress = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
    const progressLabel = progress === 100
        ? t('flowStages.productLaunch.progressReady')
        : t('flowStages.productLaunch.progress').replace('{progress}', String(progress));

    return (
        <div className="flow-product-launch">
            <div className="flow-product-launch__header">
                <div className="flow-product-launch__header-left">
                    <div className="flow-product-launch__heading">
                        <div className="flow-product-launch__title-row">
                            <h2 className="flow-product-launch__title">{t('flowStages.productLaunch.title')}</h2>
                            {totalChecks > 0 && (
                                <Badge
                                    variant={progress === 100 ? 'success' : 'neutral'}
                                    className="flow-product-launch__progress"
                                >
                                    {progressLabel}
                                </Badge>
                            )}
                        </div>
                        <p className="flow-product-launch__subtitle">{t('flowStages.productLaunch.subtitle')}</p>
                    </div>

                    <div className="flow-product-launch__view-toggle">
                        <button
                            type="button"
                            onClick={() => setViewMode('execution')}
                            className={`flow-product-launch__view-button ${viewMode === 'execution' ? 'is-active' : ''}`}
                            aria-pressed={viewMode === 'execution'}
                        >
                            <span className="material-symbols-outlined">checklist_rtl</span>
                            {t('flowStages.productLaunch.views.execution')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('analysis')}
                            className={`flow-product-launch__view-button ${viewMode === 'analysis' ? 'is-active' : ''}`}
                            aria-pressed={viewMode === 'analysis'}
                        >
                            <span className="material-symbols-outlined">analytics</span>
                            {t('flowStages.productLaunch.views.analysis')}
                        </button>
                    </div>
                </div>

                {viewMode === 'execution' && (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleGenerate}
                        isLoading={generating}
                        icon={<span className="material-symbols-outlined">auto_awesome</span>}
                        className="flow-product-launch__generate"
                    >
                        {t('flowStages.productLaunch.actions.draftPlan')}
                    </Button>
                )}
            </div>

            {viewMode === 'execution' ? (
                <div className="flow-product-launch__grid">
                    <Card className="flow-product-launch__panel flow-product-launch__panel--checklist">
                        <div className="flow-product-launch__panel-header">
                            <div className="flow-product-launch__panel-title">
                                <span className="material-symbols-outlined">checklist</span>
                                {t('flowStages.productLaunch.checklist.title')}
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={addChecklistCategory}
                                icon={<span className="material-symbols-outlined">add</span>}
                                className="flow-product-launch__panel-action"
                            >
                                {t('flowStages.productLaunch.checklist.addCategory')}
                            </Button>
                        </div>

                        <div className="flow-product-launch__panel-body">
                            {launchData.checklist.length === 0 && (
                                <p className="flow-product-launch__empty">
                                    {t('flowStages.productLaunch.checklist.empty')}
                                </p>
                            )}

                            <div className="flow-product-launch__category-list">
                                {launchData.checklist.map((cat) => {
                                    const catTotal = cat.items.length;
                                    const catDone = cat.items.filter((i) => i.done).length;

                                    return (
                                        <div key={cat.id} className={`flow-product-launch__category ${cat.isCollapsed ? 'is-collapsed' : ''}`}>
                                            <div
                                                className="flow-product-launch__category-header"
                                                onClick={(event) => {
                                                    const target = event.target as HTMLElement;
                                                    if (target.closest('button') || target.closest('input') || target.closest('textarea')) return;
                                                    updateChecklistCategory(cat.id, { isCollapsed: !cat.isCollapsed });
                                                }}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        updateChecklistCategory(cat.id, { isCollapsed: !cat.isCollapsed });
                                                    }
                                                }}
                                            >
                                                <div className="flow-product-launch__category-title">
                                                    <input
                                                        value={cat.category}
                                                        onChange={(e) => updateChecklistCategory(cat.id, { category: e.target.value })}
                                                        className="flow-product-launch__category-input"
                                                        placeholder={t('flowStages.productLaunch.checklist.categoryPlaceholder')}
                                                    />
                                                </div>
                                                <div className="flow-product-launch__category-actions">
                                                    <span className="flow-product-launch__category-count">{catDone}/{catTotal}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeChecklistCategory(cat.id)}
                                                        className="flow-product-launch__icon-button"
                                                        aria-label={t('common.delete')}
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                    <span className={`material-symbols-outlined flow-product-launch__collapse-icon ${cat.isCollapsed ? 'is-collapsed' : ''}`}>
                                                        expand_more
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flow-product-launch__category-body">
                                                <div className="flow-product-launch__items">
                                                    {cat.items.map((item) => (
                                                        <div key={item.id} className="flow-product-launch__item">
                                                            <Checkbox
                                                                checked={item.done}
                                                                onChange={() => updateChecklistItem(cat.id, item.id, { done: !item.done })}
                                                                className="flow-product-launch__item-checkbox"
                                                            />
                                                            <input
                                                                value={item.title}
                                                                onChange={(e) => updateChecklistItem(cat.id, item.id, { title: e.target.value })}
                                                                className={`flow-product-launch__item-input ${item.done ? 'is-done' : ''}`}
                                                                placeholder={t('flowStages.productLaunch.checklist.itemPlaceholder')}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeChecklistItem(cat.id, item.id)}
                                                                className="flow-product-launch__icon-button"
                                                                aria-label={t('common.delete')}
                                                            >
                                                                <span className="material-symbols-outlined">close</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => addChecklistItem(cat.id)}
                                                        icon={<span className="material-symbols-outlined">add</span>}
                                                        className="flow-product-launch__add-item"
                                                    >
                                                        {t('flowStages.productLaunch.checklist.addItem')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>

                    <div className="flow-product-launch__aside">
                        <Card className="flow-product-launch__panel">
                            <div className="flow-product-launch__panel-header">
                                <div className="flow-product-launch__panel-title">
                                    <span className="material-symbols-outlined">campaign</span>
                                    {t('flowStages.productLaunch.announcement.title')}
                                </div>
                            </div>
                            <div className="flow-product-launch__panel-body">
                                <TextArea
                                    value={launchData.announcement}
                                    onChange={(e) => updateLaunchData({ announcement: e.target.value })}
                                    className="flow-product-launch__announcement"
                                    placeholder={t('flowStages.productLaunch.announcement.placeholder')}
                                />
                            </div>
                        </Card>

                        <Card className="flow-product-launch__panel">
                            <div className="flow-product-launch__panel-header">
                                <div className="flow-product-launch__panel-title">
                                    <span className="material-symbols-outlined">hub</span>
                                    {t('flowStages.productLaunch.channels.title')}
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={addChannel}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                    className="flow-product-launch__panel-action"
                                >
                                    {t('flowStages.productLaunch.channels.addChannel')}
                                </Button>
                            </div>
                            <div className="flow-product-launch__panel-body">
                                <div className="flow-product-launch__channels">
                                    {launchData.channels.map((channel, i) => (
                                        <TextInput
                                            key={i}
                                            value={channel}
                                            onChange={(e) => updateChannel(i, e.target.value)}
                                            placeholder={t('flowStages.productLaunch.channels.placeholder')}
                                            className="flow-product-launch__channel-input"
                                            rightElement={(
                                                <button
                                                    type="button"
                                                    onClick={() => removeChannel(i)}
                                                    className="flow-product-launch__icon-button"
                                                    aria-label={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            )}
                                        />
                                    ))}

                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={addChannel}
                                        className="flow-product-launch__channel-add"
                                    >
                                        {t('flowStages.productLaunch.channels.add')}
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        <Button
                            className="flow-product-launch__launch"
                            onClick={() => { /* launch action */ }}
                            icon={<span className="material-symbols-outlined">rocket_launch</span>}
                        >
                            {t('flowStages.productLaunch.actions.initialize')}
                        </Button>
                    </div>
                </div>
            ) : (
                <Card className="flow-product-launch__analysis">
                    <AnalysisDashboard
                        analysis={idea.riskWinAnalysis}
                        loading={analyzing}
                        onRunAnalysis={handleRunAnalysis}
                    />
                </Card>
            )}
        </div>
    );
};
