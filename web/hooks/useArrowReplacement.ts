import { ChangeEvent, useCallback } from 'react';

export const useArrowReplacement = <T extends HTMLInputElement | HTMLTextAreaElement>(
    onChange?: (e: ChangeEvent<T>) => void
) => {
    return useCallback((e: ChangeEvent<T>) => {
        const originalValue = e.target.value;
        if (originalValue.includes('-->')) {
            const newValue = originalValue.replace(/-->/g, '→');

            // Calculate new cursor position
            const selectionStart = e.target.selectionStart;
            let newSelectionStart = selectionStart;

            if (selectionStart !== null) {
                const beforeCursor = originalValue.substring(0, selectionStart);
                const matches = beforeCursor.match(/-->/g);
                if (matches) {
                    newSelectionStart = selectionStart - (matches.length * 2);
                }
            }

            // Update the input value directly
            e.target.value = newValue;

            // Restore cursor position
            // using requestAnimationFrame to ensure it runs after any potential react re-renders
            requestAnimationFrame(() => {
                if (e.target) {
                    e.target.setSelectionRange(newSelectionStart, newSelectionStart);
                }
            });
        }

        onChange?.(e);
    }, [onChange]);
};
