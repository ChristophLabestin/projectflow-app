import { Node, mergeAttributes } from '@tiptap/core';

export const Column = Node.create({
    name: 'column',
    content: 'block+',
    isolating: true,
    defining: true,
    group: 'column', // Helper group
    draggable: false,

    addAttributes() {
        return {
            class: {
                default: 'column',
                parseHTML: element => element.getAttribute('class'),
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[class~="column"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'column' }), 0];
    },
});

export const ColumnBlock = Node.create({
    name: 'columnBlock',
    content: 'column column', // Enforce exactly 2 columns for now
    isolating: true,
    defining: true,
    group: 'block',
    draggable: true,

    addAttributes() {
        return {
            class: {
                default: 'column-block',
                parseHTML: element => element.getAttribute('class'),
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[class~="column-block"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'column-block' }), 0];
    },

    addCommands() {
        return {
            setColumns: () => ({ commands }) => {
                return commands.insertContent({
                    type: 'columnBlock',
                    content: [
                        { type: 'column', content: [{ type: 'paragraph' }] },
                        { type: 'column', content: [{ type: 'paragraph' }] }
                    ]
                });
            },
        } as any;
    },
});
