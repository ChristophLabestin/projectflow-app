import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { mergeAttributes } from '@tiptap/core';

export const Divider = HorizontalRule.extend({
    // We can customize the renderHTML if needed, or just rely on CSS styling for <hr>
    // For now we'll just ensure it has a specific class for easier styling if needed
    renderHTML({ HTMLAttributes }) {
        return ['hr', mergeAttributes(HTMLAttributes, { class: 'editor-divider' })];
    },
});
