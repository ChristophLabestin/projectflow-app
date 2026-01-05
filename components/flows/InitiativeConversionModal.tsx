import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { Idea } from '../../../types';

interface InitiativeConversionModalProps {
    idea: Idea;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (startDate: string | undefined, dueDate: string | undefined) => void;
}

export const InitiativeConversionModal: React.FC<InitiativeConversionModalProps> = ({ idea, isOpen, onClose, onConfirm }) => {
    const [startDate, setStartDate] = useState<string>('');
    const [dueDate, setDueDate] = useState<string>('');
    const [converting, setConverting] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = () => {
        setConverting(true);
        // Add a small delay for better UX or validation if needed
        onConfirm(startDate || undefined, dueDate || undefined);
    };

    return (
        <div className="fixed inset-0 z[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 border border-surface animate-in zoom-in-95 duration-200">
                <div className="text-center mb-6">
                    <div className="size-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="material-symbols-outlined text-2xl">rocket_launch</span>
                    </div>
                    <h3 className="text-xl font-bold text-main">Launch Initiative</h3>
                    <p className="text-sm text-muted mt-1">
                        Convert "<strong>{idea.title}</strong>" into a strategic initiative.
                    </p>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-subtle uppercase">Start Date</label>
                        <DatePicker
                            value={startDate}
                            onChange={setStartDate}
                            placeholder="Select start date..."
                            className="bg-surface"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-subtle uppercase">Target Completion</label>
                        <DatePicker
                            value={dueDate}
                            onChange={setDueDate}
                            placeholder="Select due date..."
                            className="bg-surface"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1"
                        disabled={converting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-500/25"
                        isLoading={converting}
                        icon={<span className="material-symbols-outlined">arrow_forward</span>}
                    >
                        Launch Initiative
                    </Button>
                </div>
            </div>
        </div>
    );
};
