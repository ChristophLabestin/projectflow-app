import React, { useEffect, useState } from 'react';
import { addDays } from 'date-fns';
import { Sprint } from '../../types';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { TextInput } from '../common/Input/TextInput';
import { TextArea } from '../common/Input/TextArea';
import { DatePicker } from '../common/DateTime/DatePicker';
import { useLanguage } from '../../context/LanguageContext';

interface CreateSprintModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Sprint>) => Promise<void>;
    initialData?: Sprint | null;
}

export const CreateSprintModal: React.FC<CreateSprintModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [goal, setGoal] = useState('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [autoStart, setAutoStart] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (initialData) {
            setName(initialData.name);
            setGoal(initialData.goal || '');
            setStartDate(initialData.startDate ? new Date(initialData.startDate) : null);
            setEndDate(initialData.endDate ? new Date(initialData.endDate) : null);
            setAutoStart(initialData.autoStart || false);
            return;
        }

        const start = new Date();
        const end = addDays(start, 14);

        setName('');
        setGoal('');
        setStartDate(start);
        setEndDate(end);
        setAutoStart(false);
    }, [isOpen, initialData]);

    const handleSave = async () => {
        if (!startDate || !endDate || !name) return;
        setIsSaving(true);
        try {
            await onSave({
                name,
                goal,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                autoStart
            });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? t('projectSprints.create.title.edit') : t('projectSprints.create.title.new')}
            size="md"
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                        {t('projectSprints.create.actions.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={isSaving}
                        disabled={!name || !startDate || !endDate}
                    >
                        {initialData ? t('projectSprints.create.actions.update') : t('projectSprints.create.actions.create')}
                    </Button>
                </>
            )}
        >
            <div className="sprint-modal">
                <TextInput
                    label={t('projectSprints.create.fields.name')}
                    placeholder={t('projectSprints.create.fields.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                />

                <div className="sprint-modal__dates">
                    <DatePicker
                        label={t('projectSprints.create.fields.startDate')}
                        value={startDate}
                        onChange={setStartDate}
                    />
                    <DatePicker
                        label={t('projectSprints.create.fields.endDate')}
                        value={endDate}
                        onChange={setEndDate}
                    />
                </div>

                <TextArea
                    label={t('projectSprints.create.fields.goal')}
                    placeholder={t('projectSprints.create.fields.goalPlaceholder')}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    rows={3}
                />

                <div className="sprint-modal__switch">
                    <button
                        type="button"
                        onClick={() => setAutoStart(!autoStart)}
                        className={`switch-track ${autoStart ? 'active' : ''}`}
                        role="switch"
                        aria-checked={autoStart}
                    >
                        <span className="switch-handle" />
                    </button>
                    <div>
                        <div className="sprint-modal__switch-title">{t('projectSprints.create.fields.autoStart')}</div>
                        <div className="sprint-modal__switch-hint">{t('projectSprints.create.fields.autoStartHint')}</div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
