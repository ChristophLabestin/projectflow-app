import React from 'react';
import { createPortal } from 'react-dom';
import { TemplateVariable } from '../../../types';

interface VariablePickerProps {
    variables: TemplateVariable[];
    onSelect: (variable: TemplateVariable) => void;
    isOpen: boolean;
    onClose: () => void;
    position?: { top: number; left: number };
}

export const VariablePicker: React.FC<VariablePickerProps> = ({ variables, onSelect, isOpen, onClose, position }) => {
    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 z-[2100]" onClick={onClose} />
            <div
                className="fixed z-[2101] bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 w-64 max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
                style={{
                    top: position?.top ?? '50%',
                    left: position?.left ?? '50%',
                    transform: position ? 'none' : 'translate(-50%, -50%)'
                }}
            >
                <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2">Insert Variable</h4>
                </div>
                {variables.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-400">
                        No variables defined. Add them in the Variables tab.
                    </div>
                ) : (
                    <div className="p-1">
                        {variables.map(v => (
                            <button
                                key={v.id}
                                onClick={() => {
                                    onSelect(v);
                                    onClose();
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded flex items-center justify-between group"
                            >
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">{v.label}</span>
                                <span className="font-mono text-xs text-[var(--color-primary)] bg-[var(--color-primary)]/5 px-1 rounded truncate max-w-[100px]">
                                    {'{{'}{v.name}{'}}'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>,
        document.body
    );
};
