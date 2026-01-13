import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const Button = Node.create({
    name: 'button',

    group: 'block',

    content: 'inline*', // Allow text inside

    addAttributes() {
        return {
            url: {
                default: '#',
                parseHTML: element => element.getAttribute('href'),
                renderHTML: attributes => ({
                    href: attributes.url,
                }),
            },
            target: {
                default: '_blank',
                renderHTML: attributes => ({
                    target: attributes.target,
                    rel: 'noopener noreferrer nofollow',
                }),
            },
            alignment: {
                default: 'center',
                parseHTML: element => element.style.textAlign,
                renderHTML: attributes => ({
                    style: `text-align: ${attributes.alignment}`,
                }),
            },
            backgroundColor: {
                default: 'var(--color-primary)',
                parseHTML: element => element.style.backgroundColor,
                renderHTML: attributes => ({
                    style: `background-color: ${attributes.backgroundColor}`,
                }),
            },
            textColor: {
                default: '#ffffff',
                parseHTML: element => element.style.color,
                renderHTML: attributes => ({
                    style: `color: ${attributes.textColor}`,
                }),
            },
            borderColor: {
                default: 'transparent',
                parseHTML: element => element.style.borderColor,
                renderHTML: attributes => ({
                    style: `border-color: ${attributes.borderColor}`,
                }),
            },
            borderWidth: {
                default: '0px',
                parseHTML: element => element.style.borderWidth,
                renderHTML: attributes => ({
                    style: `border-width: ${attributes.borderWidth}`,
                }),
            },
            borderStyle: {
                default: 'solid',
                parseHTML: element => element.style.borderStyle,
                renderHTML: attributes => ({
                    style: `border-style: ${attributes.borderStyle}`,
                }),
            },
            borderRadius: {
                default: '6px',
                parseHTML: element => element.style.borderRadius,
                renderHTML: attributes => ({
                    style: `border-radius: ${attributes.borderRadius}`,
                }),
            },
            padding: {
                default: '10px 20px',
                parseHTML: element => element.style.padding,
                renderHTML: attributes => ({
                    style: `padding: ${attributes.padding}`,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'a[data-type="button"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['a', mergeAttributes(HTMLAttributes, { 'data-type': 'button', class: 'editor-button-block no-prose' }), 0];
    },

    addCommands() {
        return {
            setButton: () => ({ commands }) => {
                return commands.insertContent({
                    type: 'button',
                    content: [
                        { type: 'text', text: 'Click Here' }
                    ]
                });
            },
            updateButton: (attributes) => ({ commands }) => {
                return commands.updateAttributes('button', attributes);
            },
        } as any;
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('buttonClickPrevention'),
                props: {
                    handleClick: (view, pos, event) => {
                        const target = event.target as HTMLElement;
                        // Check if the click is on a button block
                        if (target.closest('[data-type="button"]')) {
                            // Prevent the default link navigation
                            event.preventDefault();
                            return true;
                        }
                        return false;
                    },
                    handleDOMEvents: {
                        click: (view, event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest('[data-type="button"]')) {
                                event.preventDefault();
                                return true;
                            }
                            return false;
                        },
                    },
                },
            }),
        ];
    },
});
