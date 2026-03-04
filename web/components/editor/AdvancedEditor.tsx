import React, { Suspense, lazy } from 'react';
import { Editor } from '@tiptap/react';

const AdvancedEditorRuntime = lazy(() =>
    import('./AdvancedEditorRuntime').then((module) => ({ default: module.AdvancedEditorRuntime }))
);

interface AdvancedEditorProps {
    initialContent?: string | JSON;
    onUpdate?: (content: string) => void;
    editable?: boolean;
    placeholder?: string;
    className?: string;
    editorRef?: React.MutableRefObject<Editor | null>;
}

export const AdvancedEditor: React.FC<AdvancedEditorProps> = (props) => (
    <Suspense
        fallback={
            <div className="relative min-h-[500px] rounded-xl border border-surface bg-card">
                <div className="absolute inset-0 animate-pulse bg-surface/50" />
            </div>
        }
    >
        <AdvancedEditorRuntime {...props} />
    </Suspense>
);
