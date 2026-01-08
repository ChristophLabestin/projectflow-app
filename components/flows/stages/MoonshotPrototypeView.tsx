import React, { useMemo } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { Select } from '../../common/Select/Select';
import { TextArea } from '../../common/Input/TextArea';
import { TextInput } from '../../common/Input/TextInput';
import { useLanguage } from '../../../context/LanguageContext';

interface MoonshotPrototypeViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface PrototypeData {
    specs: string;
    experiments: {
        id: string;
        title: string;
        result: 'Success' | 'Failure' | 'Inconclusive' | 'Pending';
        notes: string;
    }[];
    mediaLinks: string[];
}

export const MoonshotPrototypeView: React.FC<MoonshotPrototypeViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const data: PrototypeData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    specs: parsed.specs || '',
                    experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
                    mediaLinks: Array.isArray(parsed.mediaLinks) ? parsed.mediaLinks : [],
                    ...parsed
                };
            }
        } catch { }
        return {
            specs: '',
            experiments: [],
            mediaLinks: []
        };
    })();

    const updateData = (updates: Partial<PrototypeData>) => {
        const newData = { ...data, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const addExperiment = () => {
        const newExp = {
            id: crypto.randomUUID(),
            title: '',
            result: 'Pending' as const,
            notes: ''
        };
        updateData({ experiments: [...data.experiments, newExp] });
    };

    const updateExperiment = (index: number, updates: Partial<PrototypeData['experiments'][0]>) => {
        const newExps = [...data.experiments];
        newExps[index] = { ...newExps[index], ...updates };
        updateData({ experiments: newExps });
    };

    const removeExperiment = (index: number) => {
        const newExps = [...data.experiments];
        newExps.splice(index, 1);
        updateData({ experiments: newExps });
    };

    const resultOptions = useMemo(() => [
        { value: 'Pending', label: t('flowStages.moonshotPrototype.results.pending') },
        { value: 'Success', label: t('flowStages.moonshotPrototype.results.success') },
        { value: 'Failure', label: t('flowStages.moonshotPrototype.results.failure') },
        { value: 'Inconclusive', label: t('flowStages.moonshotPrototype.results.inconclusive') },
    ], [t]);

    return (
        <div className="flow-moonshot-prototype">
            <div className="flow-moonshot-prototype__grid">
                <Card className="flow-moonshot-prototype__panel">
                    <div className="flow-moonshot-prototype__header">
                        <h2>{t('flowStages.moonshotPrototype.title')}</h2>
                        <p>{t('flowStages.moonshotPrototype.subtitle')}</p>
                    </div>

                    <TextArea
                        label={t('flowStages.moonshotPrototype.specs.label')}
                        value={data.specs}
                        onChange={(event) => updateData({ specs: event.target.value })}
                        placeholder={t('flowStages.moonshotPrototype.specs.placeholder')}
                        className="flow-moonshot-prototype__control flow-moonshot-prototype__control--specs"
                    />

                    <Button
                        className="flow-moonshot-prototype__advance"
                        onClick={() => onUpdate({ stage: 'Greenlight' })}
                        icon={<span className="material-symbols-outlined">arrow_forward</span>}
                        iconPosition="right"
                    >
                        {t('flowStages.moonshotPrototype.actions.advance')}
                    </Button>
                </Card>

                <Card className="flow-moonshot-prototype__panel flow-moonshot-prototype__panel--journal">
                    <div className="flow-moonshot-prototype__header flow-moonshot-prototype__header--row">
                        <div>
                            <h3>{t('flowStages.moonshotPrototype.journal.title')}</h3>
                            <p>{t('flowStages.moonshotPrototype.journal.subtitle')}</p>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={addExperiment}
                            icon={<span className="material-symbols-outlined">science</span>}
                        >
                            {t('flowStages.moonshotPrototype.journal.add')}
                        </Button>
                    </div>

                    {data.experiments.length === 0 ? (
                        <div className="flow-moonshot-prototype__empty">
                            <span className="material-symbols-outlined">biotech</span>
                            <p>{t('flowStages.moonshotPrototype.journal.empty')}</p>
                        </div>
                    ) : (
                        <div className="flow-moonshot-prototype__list">
                            {data.experiments.map((exp, index) => (
                                <div key={exp.id} className="flow-moonshot-prototype__experiment">
                                    <div className="flow-moonshot-prototype__experiment-header">
                                        <TextInput
                                            value={exp.title}
                                            onChange={(event) => updateExperiment(index, { title: event.target.value })}
                                            placeholder={t('flowStages.moonshotPrototype.journal.titlePlaceholder')}
                                            className="flow-moonshot-prototype__control"
                                        />
                                        <Select
                                            value={exp.result}
                                            onChange={(value) => updateExperiment(index, { result: value as any })}
                                            options={resultOptions}
                                            className="flow-moonshot-prototype__select"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeExperiment(index)}
                                            className="flow-moonshot-prototype__remove"
                                            aria-label={t('common.delete')}
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                    <TextArea
                                        value={exp.notes}
                                        onChange={(event) => updateExperiment(index, { notes: event.target.value })}
                                        placeholder={t('flowStages.moonshotPrototype.journal.notesPlaceholder')}
                                        className="flow-moonshot-prototype__control"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
