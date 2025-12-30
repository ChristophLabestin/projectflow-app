import { Node, mergeAttributes } from '@tiptap/core';

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
        // We render a wrapper div for alignment, and the anchor inside?
        // Actually, 'block' node is usually a div.
        // If we want it to be a link, the outer element should be 'a'.
        // But 'a' cannot be block in HTML semantics (it can display:block though).
        // Let's make it a div wrapper (for alignment) -> a (button).
        // Tiptap schema restriction: node must be a single element root?
        // `renderHTML` returns an array.
        // Let's just return the 'a' and set it to display: inline-block or block via CSS.
        // Wait, if it's `group: 'block'`, Tiptap treats it as a block.
        // Let's render 'a' with `display: inline-block` inside a container?
        // Simpler: Just render 'a' with `display: block; width: fit-content; margin: 0 auto;` for center?
        // Let's use a class `editor-button-block`.
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
});
