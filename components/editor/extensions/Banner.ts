import { Node, mergeAttributes } from '@tiptap/core';

export const Banner = Node.create({
    name: 'banner',
    content: 'paragraph+', // Can contain paragraphs
    group: 'block',
    defining: true,
    draggable: true,

    addAttributes() {
        return {
            type: {
                default: 'info',
                parseHTML: element => element.getAttribute('data-type'),
                renderHTML: attributes => ({ 'data-type': attributes.type }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[class~="banner"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const type = HTMLAttributes['data-type'] || 'info';
        return ['div', mergeAttributes(HTMLAttributes, { class: `banner banner-${type}` }), 0];
    },

    addCommands() {
        return {
            setBanner: (options: { type: 'info' | 'warning' | 'success' | 'error' } = { type: 'info' }) => ({ commands }) => {
                return commands.wrapIn(this.name, options);
            },
            toggleBanner: (options: { type: 'info' | 'warning' | 'success' | 'error' } = { type: 'info' }) => ({ commands }) => {
                return commands.toggleWrap(this.name, options);
            },
            unsetBanner: () => ({ commands }) => {
                return commands.lift(this.name);
            },
        } as any;
    },
});
