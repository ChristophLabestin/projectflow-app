import React, { useState } from 'react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { TextInput } from '../common/Input/TextInput';
import { saveIdea } from '../../services/dataService';
import { useLanguage } from '../../context/LanguageContext';

interface CreateFlowModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onCreated: () => void;
}

import { PIPELINE_CONFIGS, type FlowTone } from './constants';

const FLOW_TYPES = [
    { id: 'Feature', labelKey: 'flows.type.feature', icon: 'stars', tone: 'primary' as FlowTone },
    { id: 'Product', labelKey: 'flows.type.product', icon: 'inventory_2', tone: 'primary' as FlowTone },
    { id: 'Moonshot', labelKey: 'flows.type.moonshot', icon: 'rocket_launch', tone: 'primary' as FlowTone },
    { id: 'Optimization', labelKey: 'flows.type.optimization', icon: 'speed', tone: 'primary' as FlowTone },
    { id: 'Marketing', labelKey: 'flows.type.marketing', icon: 'campaign', tone: 'primary' as FlowTone },
    { id: 'Social', labelKey: 'flows.type.social', icon: 'share', tone: 'primary' as FlowTone },
];

export const CreateFlowModal: React.FC<CreateFlowModalProps> = ({ isOpen, onClose, projectId, onCreated }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('Feature');
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    const selectedType = FLOW_TYPES.find(t => t.id === type) || FLOW_TYPES[0];

    // ... inside component ...
    const handleSave = async () => {
        if (!title.trim()) return;
        setLoading(true);
        try {
            // Get initial stage for the selected type
            const initialStage = PIPELINE_CONFIGS[type]?.[0]?.id || 'Brainstorm';

            await saveIdea({
                title,
                description: '',
                type: type as any,
                projectId,
                stage: initialStage as any,
                generated: false,
                votes: 0,
                comments: 0,
            });
            onCreated();
            handleClose();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle('');
        setType('Feature');
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && title.trim()) {
            e.preventDefault();
            handleSave();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={t('flows.actions.add')}
            size="lg"
            footer={(
                <>
                    <Button variant="ghost" onClick={handleClose} disabled={loading}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        isLoading={loading}
                        disabled={!title.trim()}
                        icon={<span className="material-symbols-outlined">lightbulb</span>}
                    >
                        {t('flows.create.actions.create')}
                    </Button>
                </>
            )}
        >
            <div className={`flow-create flow-tone--${selectedType.tone}`}>
                <div className="flow-create__hero">
                    <div className="flow-create__icon">
                        <span className="material-symbols-outlined">{selectedType.icon}</span>
                    </div>
                    <div className="flow-create__title">
                        <TextInput
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('flows.create.placeholder')}
                            autoFocus
                            className="flow-create__title-input"
                        />
                        <p>{t('flows.create.helper').replace('{key}', 'Enter')}</p>
                    </div>
                </div>

                <div className="flow-create__types">
                    {FLOW_TYPES.map(flowType => (
                        <button
                            key={flowType.id}
                            type="button"
                            onClick={() => setType(flowType.id)}
                            className={`flow-create__type ${type === flowType.id ? 'is-active' : ''}`}
                            aria-pressed={type === flowType.id}
                        >
                            <span className="material-symbols-outlined">{flowType.icon}</span>
                            {t(flowType.labelKey)}
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
