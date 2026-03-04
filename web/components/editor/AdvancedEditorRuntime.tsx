import React, { Suspense, lazy, useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';

const AdvancedEditorCore = lazy(() =>
    import('./AdvancedEditorCore').then((module) => ({ default: module.AdvancedEditorCore }))
);

interface AdvancedEditorRuntimeProps {
    initialContent?: string | JSON;
    onUpdate?: (content: string) => void;
    editable?: boolean;
    placeholder?: string;
    className?: string;
    editorRef?: React.MutableRefObject<Editor | null>;
}

export const AdvancedEditorRuntime: React.FC<AdvancedEditorRuntimeProps> = (props) => {
    const [isActivated, setIsActivated] = useState(false);

    const activate = useCallback(() => {
        setIsActivated(true);
    }, []);

    if (isActivated || props.editable === false) {
        return (
            <Suspense
                fallback={
                    <div className="relative min-h-[500px] rounded-xl border border-surface bg-card">
                        <div className="absolute inset-0 animate-pulse bg-surface/50" />
                    </div>
                }
            >
                <AdvancedEditorCore {...props} />
            </Suspense>
        );
    }

    return (
        <div
            className="relative min-h-[500px] rounded-xl border border-surface bg-card cursor-text overflow-hidden"
            onMouseDown={activate}
            onFocus={activate}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            }}
            tabIndex={0}
        >
            <div className="absolute inset-0 animate-pulse bg-surface/40" />
            <div className="absolute inset-4 rounded-lg border border-dashed border-surface-border/70" />
        </div>
    );
};
