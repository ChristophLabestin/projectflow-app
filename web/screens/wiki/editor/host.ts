import type { Editor } from '@tiptap/core';
import type { WikiMentionKind } from '../../../types/wiki';
import type { WikiFileRef } from '../wikiFiles';
import type { SuggestionItem } from './suggestion';

export type WikiT = (key: string, params?: Record<string, string | number>) => string;

export interface WikiMentionItem extends SuggestionItem {
    kind: WikiMentionKind;
    id: string;
    label: string;
    projectId?: string | null;
}

/** Everything the editor needs from the page around it. */
export interface WikiEditorHost {
    t: WikiT;
    pickImage: () => Promise<{ src: string; alt?: string } | null>;
    pickFile: () => Promise<WikiFileRef | null>;
    searchMentions: (query: string) => Promise<WikiMentionItem[]>;
    defaultProjectId: string | null;
}

export const getHost = (editor: Editor): WikiEditorHost => (editor.storage as any).wikiHost.host;

