import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
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

interface DefinitionData {
    requirements: Requirement[];
    successCriteria: string;
    scope: string;
    outOfScope: string;
}

export const ProductDefinitionView: React.FC<ProductDefinitionViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);

    const definitionData: DefinitionData = (() => {
        try {
            if (idea.requirements && idea.requirements.startsWith('{')) {
                const parsed = JSON.parse(idea.requirements);
                return {
                    requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
                    successCriteria: typeof parsed.successCriteria === 'string' ? parsed.successCriteria : '',
                    scope: typeof parsed.scope === 'string' ? parsed.scope : '',
                    outOfScope: typeof parsed.outOfScope === 'string' ? parsed.outOfScope : ''
                };
            }
        } catch {
            // Ignore parse failures and fall back to defaults.
        }
        return {
            requirements: [],
            successCriteria: '',
            scope: '',
            outOfScope: ''
        };
    })();

    const updateDefinition = (updates: Partial<DefinitionData>) => {
        const newData = { ...definitionData, ...updates };
        onUpdate({ requirements: JSON.stringify(newData) });
    };

    const addListItem = (field: 'scope' | 'outOfScope' | 'successCriteria') => {
        const current = definitionData[field] ? definitionData[field].split('\n') : [];
        updateDefinition({ [field]: [...current, ''].join('\n') } as Partial<DefinitionData>);
    };

    const updateListItem = (field: 'scope' | 'outOfScope' | 'successCriteria', index: number, value: string) => {
        const current = definitionData[field] ? definitionData[field].split('\n') : [];
        current[index] = value;
        updateDefinition({ [field]: current.join('\n') } as Partial<DefinitionData>);
    };

    const removeListItem = (field: 'scope' | 'outOfScope' | 'successCriteria', index: number) => {
        const current = definitionData[field] ? definitionData[field].split('\n') : [];
        current.splice(index, 1);
        updateDefinition({ [field]: current.join('\n') } as Partial<DefinitionData>);
    };

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
        const newReqs = definitionData.requirements.map((req) =>
            req.id === id ? { ...req, ...updates } : req
        );
        updateDefinition({ requirements: newReqs });
    };

    const removeRequirement = (id: string) => {
        updateDefinition({
            requirements: definitionData.requirements.filter((req) => req.id !== id)
        });
    };

    const handleGenerateDefinition = async () => {
        setGenerating(true);
        try {
            const aiData = await generateProductDefinitionAI(idea);

            const currentScope = definitionData.scope ? `${definitionData.scope}\n` : '';
            const currentOutOfScope = definitionData.outOfScope ? `${definitionData.outOfScope}\n` : '';
            const currentSuccessCriteria = definitionData.successCriteria ? `${definitionData.successCriteria}\n` : '';

            updateDefinition({
                scope: currentScope + aiData.scope,
                outOfScope: currentOutOfScope + aiData.outOfScope,
                successCriteria: currentSuccessCriteria + aiData.successCriteria,
                requirements: [...definitionData.requirements, ...aiData.requirements]
            });
        } catch (error) {
            console.error('Failed to generate definition:', error);
        } finally {
            setGenerating(false);
        }
    };

    const scopeList = definitionData.scope ? definitionData.scope.split('\n') : [];
    const outOfScopeList = definitionData.outOfScope ? definitionData.outOfScope.split('\n') : [];
    const successList = definitionData.successCriteria ? definitionData.successCriteria.split('\n') : [];

    const groupedRequirements = {
        must: definitionData.requirements.filter((req) => req.priority === 'must'),
        should: definitionData.requirements.filter((req) => req.priority === 'should'),
        could: definitionData.requirements.filter((req) => req.priority === 'could'),
        wont: definitionData.requirements.filter((req) => req.priority === 'wont')
    };

    return (
        <div className="flow-product-definition">
            <div className="flow-product-definition__container">
                <div className="flow-product-definition__header">
                    <div>
                        <h2 className="flow-product-definition__title">{t('flowStages.productDefinition.title')}</h2>
                        <p className="flow-product-definition__subtitle">{t('flowStages.productDefinition.subtitle')}</p>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleGenerateDefinition}
                        isLoading={generating}
                        className="flow-product-definition__generate"
                        icon={<span className="material-symbols-outlined">auto_awesome</span>}
                    >
                        {t('flowStages.productDefinition.actions.generate')}
                    </Button>
                </div>

                <div className="flow-product-definition__layout">
                    <div className="flow-product-definition__sidebar">
                        <Card className="flow-product-definition__panel">
                            <div className="flow-product-definition__panel-header">
                                <div className="flow-product-definition__panel-title">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    <h3>{t('flowStages.productDefinition.scope.in')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-product-definition__panel-action"
                                    onClick={() => addListItem('scope')}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.productDefinition.actions.add')}
                                </Button>
                            </div>
                            <div className="flow-product-definition__list">
                                {scopeList.map((item, index) => (
                                    <div key={index} className="flow-product-definition__list-item">
                                        <span className="flow-product-definition__list-dot" />
                                        <TextInput
                                            value={item}
                                            onChange={(event) => updateListItem('scope', index, event.target.value)}
                                            placeholder={t('flowStages.productDefinition.scope.inPlaceholder')}
                                            className="flow-product-definition__list-input"
                                        />
                                        <button
                                            type="button"
                                            className="flow-product-definition__list-remove"
                                            onClick={() => removeListItem('scope', index)}
                                            aria-label={t('common.delete')}
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ))}
                                {scopeList.length === 0 && (
                                    <p className="flow-product-definition__list-empty">
                                        {t('flowStages.productDefinition.scope.empty')}
                                    </p>
                                )}
                            </div>
                        </Card>

                        <Card className="flow-product-definition__panel">
                            <div className="flow-product-definition__panel-header">
                                <div className="flow-product-definition__panel-title">
                                    <span className="material-symbols-outlined">cancel</span>
                                    <h3>{t('flowStages.productDefinition.scope.out')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-product-definition__panel-action"
                                    onClick={() => addListItem('outOfScope')}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.productDefinition.actions.add')}
                                </Button>
                            </div>
                            <div className="flow-product-definition__list">
                                {outOfScopeList.map((item, index) => (
                                    <div key={index} className="flow-product-definition__list-item">
                                        <span className="flow-product-definition__list-dot" />
                                        <TextInput
                                            value={item}
                                            onChange={(event) => updateListItem('outOfScope', index, event.target.value)}
                                            placeholder={t('flowStages.productDefinition.scope.outPlaceholder')}
                                            className="flow-product-definition__list-input"
                                        />
                                        <button
                                            type="button"
                                            className="flow-product-definition__list-remove"
                                            onClick={() => removeListItem('outOfScope', index)}
                                            aria-label={t('common.delete')}
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ))}
                                {outOfScopeList.length === 0 && (
                                    <p className="flow-product-definition__list-empty">
                                        {t('flowStages.productDefinition.scope.empty')}
                                    </p>
                                )}
                            </div>
                        </Card>

                        <Card className="flow-product-definition__panel">
                            <div className="flow-product-definition__panel-header">
                                <div className="flow-product-definition__panel-title">
                                    <span className="material-symbols-outlined">ads_click</span>
                                    <h3>{t('flowStages.productDefinition.success.title')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-product-definition__panel-action"
                                    onClick={() => addListItem('successCriteria')}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.productDefinition.actions.add')}
                                </Button>
                            </div>
                            <div className="flow-product-definition__list">
                                {successList.map((item, index) => (
                                    <div key={index} className="flow-product-definition__list-item flow-product-definition__list-item--textarea">
                                        <span className="flow-product-definition__list-dot" />
                                        <TextArea
                                            value={item}
                                            onChange={(event) => updateListItem('successCriteria', index, event.target.value)}
                                            placeholder={t('flowStages.productDefinition.success.placeholder')}
                                            className="flow-product-definition__list-textarea"
                                        />
                                        <button
                                            type="button"
                                            className="flow-product-definition__list-remove"
                                            onClick={() => removeListItem('successCriteria', index)}
                                            aria-label={t('common.delete')}
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>
                                ))}
                                {successList.length === 0 && (
                                    <p className="flow-product-definition__list-empty">
                                        {t('flowStages.productDefinition.success.empty')}
                                    </p>
                                )}
                            </div>
                        </Card>

                        <Button
                            className="flow-product-definition__advance"
                            onClick={() => onUpdate({ stage: 'Development' })}
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.productDefinition.actions.advance')}
                        </Button>
                    </div>

                    <div className="flow-product-definition__matrix">
                        <Card className="flow-product-definition__column" data-priority="must">
                            <div className="flow-product-definition__column-header">
                                <div className="flow-product-definition__column-title">
                                    <span className="material-symbols-outlined">priority_high</span>
                                    <h3>{t('flowStages.productDefinition.requirements.must')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-product-definition__column-action"
                                    onClick={() => addRequirement('must')}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.productDefinition.actions.add')}
                                </Button>
                            </div>
                            <div className="flow-product-definition__column-body">
                                {groupedRequirements.must.map((req) => (
                                    <RequirementCard
                                        key={req.id}
                                        req={req}
                                        updateRequirement={updateRequirement}
                                        removeRequirement={removeRequirement}
                                    />
                                ))}
                            </div>
                        </Card>

                        <Card className="flow-product-definition__column" data-priority="should">
                            <div className="flow-product-definition__column-header">
                                <div className="flow-product-definition__column-title">
                                    <span className="material-symbols-outlined">star</span>
                                    <h3>{t('flowStages.productDefinition.requirements.should')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-product-definition__column-action"
                                    onClick={() => addRequirement('should')}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.productDefinition.actions.add')}
                                </Button>
                            </div>
                            <div className="flow-product-definition__column-body">
                                {groupedRequirements.should.map((req) => (
                                    <RequirementCard
                                        key={req.id}
                                        req={req}
                                        updateRequirement={updateRequirement}
                                        removeRequirement={removeRequirement}
                                    />
                                ))}
                            </div>
                        </Card>

                        <Card className="flow-product-definition__column" data-priority="could">
                            <div className="flow-product-definition__column-header">
                                <div className="flow-product-definition__column-title">
                                    <span className="material-symbols-outlined">add_circle</span>
                                    <h3>{t('flowStages.productDefinition.requirements.could')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-product-definition__column-action"
                                    onClick={() => addRequirement('could')}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.productDefinition.actions.add')}
                                </Button>
                            </div>
                            <div className="flow-product-definition__column-body">
                                {groupedRequirements.could.map((req) => (
                                    <RequirementCard
                                        key={req.id}
                                        req={req}
                                        updateRequirement={updateRequirement}
                                        removeRequirement={removeRequirement}
                                    />
                                ))}
                            </div>
                        </Card>

                        <Card className="flow-product-definition__column" data-priority="wont">
                            <div className="flow-product-definition__column-header">
                                <div className="flow-product-definition__column-title">
                                    <span className="material-symbols-outlined">do_not_disturb_on</span>
                                    <h3>{t('flowStages.productDefinition.requirements.wont')}</h3>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flow-product-definition__column-action"
                                    onClick={() => addRequirement('wont')}
                                    icon={<span className="material-symbols-outlined">add</span>}
                                >
                                    {t('flowStages.productDefinition.actions.add')}
                                </Button>
                            </div>
                            <div className="flow-product-definition__column-body">
                                {groupedRequirements.wont.map((req) => (
                                    <RequirementCard
                                        key={req.id}
                                        req={req}
                                        updateRequirement={updateRequirement}
                                        removeRequirement={removeRequirement}
                                    />
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

const RequirementCard = ({
    req,
    updateRequirement,
    removeRequirement
}: {
    req: Requirement;
    updateRequirement: (id: string, updates: Partial<Requirement>) => void;
    removeRequirement: (id: string) => void;
}) => {
    const { t } = useLanguage();

    return (
        <div className="flow-product-definition__requirement">
            <div className="flow-product-definition__requirement-header">
                <TextInput
                    value={req.title}
                    onChange={(event) => updateRequirement(req.id, { title: event.target.value })}
                    placeholder={t('flowStages.productDefinition.requirements.titlePlaceholder')}
                    className="flow-product-definition__requirement-title"
                />
                <button
                    type="button"
                    className="flow-product-definition__requirement-remove"
                    onClick={() => removeRequirement(req.id)}
                    aria-label={t('common.delete')}
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <TextArea
                value={req.description}
                onChange={(event) => updateRequirement(req.id, { description: event.target.value })}
                placeholder={t('flowStages.productDefinition.requirements.detailsPlaceholder')}
                className="flow-product-definition__requirement-details"
            />
        </div>
    );
};
