import { Node, mergeAttributes } from '@tiptap/core';

export const Card = Node.create({
    name: 'card',

    group: 'block',

    content: 'block+',

    addAttributes() {
        return {
            class: {
                default: 'card-block',
            },
            backgroundColor: {
                default: '#f3f4f6',
                parseHTML: element => element.style.backgroundColor,
                renderHTML: attributes => {
                    return {
                        style: `background-color: ${attributes.backgroundColor}`,
                    };
                },
            },
            borderRadius: {
                default: '8px',
                parseHTML: element => element.style.borderRadius,
                renderHTML: attributes => {
                    return {
                        style: `border-radius: ${attributes.borderRadius}`,
                    };
                },
            },
            padding: {
                default: '16px',
                parseHTML: element => element.style.padding,
                renderHTML: attributes => {
                    return {
                        style: `padding: ${attributes.padding}`,
                    };
                },
            },
            borderColor: {
                default: 'var(--color-surface-border)',
                parseHTML: element => element.style.borderColor,
                renderHTML: attributes => {
                    return {
                        style: `border-color: ${attributes.borderColor}`,
                    };
                },
            },
            borderWidth: {
                default: '1px',
                parseHTML: element => element.style.borderWidth,
                renderHTML: attributes => {
                    return {
                        style: `border-width: ${attributes.borderWidth}`,
                    };
                },
            },
            borderStyle: {
                default: 'solid',
                parseHTML: element => element.style.borderStyle,
                renderHTML: attributes => {
                    return {
                        style: `border-style: ${attributes.borderStyle}`,
                    };
                },
            },
            textColor: {
                default: 'inherit',
                parseHTML: element => element.style.color,
                renderHTML: attributes => {
                    return {
                        style: `color: ${attributes.textColor}`,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div',
                getAttrs: (element) => (element as HTMLElement).classList.contains('card-block') && null,
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'card-block' }), 0];
    },

    addCommands() {
        return {
            setCard: (attributes) => ({ commands }) => {
                return commands.wrapIn('card', attributes);
            },
            toggleCard: (attributes) => ({ commands }) => {
                return commands.toggleWrap('card', attributes);
            },
            unsetCard: () => ({ commands }) => {
                return commands.lift('card');
            },
            setCardAttribute: (attr, value) => ({ commands }) => {
                return commands.updateAttributes('card', { [attr]: value });
            }
        } as any;
    },
});
