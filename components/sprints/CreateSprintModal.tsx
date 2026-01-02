import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { useLanguage } from '../../context/LanguageContext';
import { Sprint } from '../../types';
import { addDays, format } from 'date-fns';
import { DatePicker } from '../../components/ui/DatePicker';

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
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [autoStart, setAutoStart] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setGoal(initialData.goal || '');
                setStartDate(initialData.startDate.split('T')[0]);
                setEndDate(initialData.endDate.split('T')[0]);
                setAutoStart(initialData.autoStart || false);
            } else {
                // Default to next Monday or tomorrow
                const today = new Date();
                const start = today; // Simplified
                const end = addDays(start, 14); // 2 weeks default

                setName('');
                setGoal('');
                setStartDate(format(start, 'yyyy-MM-dd'));
                setEndDate(format(end, 'yyyy-MM-dd'));
                setAutoStart(false);
            }
        }
    }, [isOpen, initialData]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                name,
                goal,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
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
            title={initialData ? "Edit Sprint" : "Create Sprint"}
            size="md"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={!name || !startDate || !endDate}>
                        {initialData ? "Update Sprint" : "Create Sprint"}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Input
                    label="Sprint Name"
                    placeholder="e.g. Sprint 1, Board Overhaul"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <DatePicker
                            label="Start Date"
                            value={startDate}
                            onChange={setStartDate}
                        />
                    </div>
                    <div className="space-y-1">
                        <DatePicker
                            label="End Date"
                            value={endDate}
                            onChange={setEndDate}
                            align="right"
                        />
                    </div>
                </div>

                <Textarea
                    label="Sprint Goal"
                    placeholder="What is the main objective of this sprint?"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    rows={3}
                />

                <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                    <button
                        type="button"
                        onClick={() => setAutoStart(!autoStart)}
                        className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2
                            ${autoStart ? 'bg-[var(--color-primary)]' : 'bg-slate-200 dark:bg-slate-700'}
                        `}
                        role="switch"
                        aria-checked={autoStart}
                    >
                        <span
                            className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${autoStart ? 'translate-x-6' : 'translate-x-1'}
                            `}
                        />
                    </button>
                    <div>
                        <div className="text-sm font-medium text-[var(--color-text-main)]">Auto-start on Start Date</div>
                        <div className="text-xs text-[var(--color-text-muted)]">Automatically change status to Active when the start date arrives</div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
