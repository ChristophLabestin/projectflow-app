import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RichTextEditor } from './RichTextEditor';
import { TemplateVariable } from '../../../types';

interface RichTextModalProps {
    isOpen: boolean;
    initialContent: string;
    onSave: (content: string) => void;
    onClose: () => void;
    variables?: TemplateVariable[];
}

export const RichTextModal = ({ isOpen, initialContent, onSave, onClose, variables }: RichTextModalProps) => {
    const [content, setContent] = useState(initialContent);
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setContent(initialContent);
    }, [initialContent]);

    useEffect(() => {
        if (isOpen && modalRef.current) {
            // Center the modal on open
            const rect = modalRef.current.getBoundingClientRect();
            setPosition({
                x: Math.max(50, (window.innerWidth - rect.width) / 2),
                y: Math.max(50, (window.innerHeight - rect.height) / 3)
            });
        }
    }, [isOpen]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.modal-header')) {
            setIsDragging(true);
            dragOffset.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y
            };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.current.x)),
                    y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.current.y))
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleSave = () => {
        onSave(content);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000] pointer-events-none">
            {/* Backdrop - doesn't block interaction with rest of page */}
            <div
                ref={modalRef}
                className="pointer-events-auto absolute bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                style={{
                    left: position.x,
                    top: position.y,
                    width: '600px',
                    maxHeight: '80vh'
                }}
                onMouseDown={handleMouseDown}
            >
                {/* Draggable Header */}
                <div className="modal-header flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 cursor-move select-none">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">edit_note</span>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Rich Text Editor</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider mr-2">Drag to move</span>
                        <button
                            onClick={onClose}
                            className="size-7 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                            <span className="material-symbols-outlined text-zinc-500 text-lg">close</span>
                        </button>
                    </div>
                </div>

                {/* Editor Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    <RichTextEditor
                        value={content}
                        onChange={setContent}
                        variables={variables}
                    />
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-bold text-[var(--color-primary-text)] bg-[var(--color-primary)] hover:opacity-90 rounded-lg shadow-sm transition-all"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
