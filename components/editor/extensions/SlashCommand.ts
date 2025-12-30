import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { SlashCommandList } from '../menus/SlashCommandList';

export const SlashCommand = Extension.create({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                command: ({ editor, range, props }) => {
                    props.command({ editor, range });
                },
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

export const getSlashCommandSuggestions = (items: any) => ({
    items: ({ query }) => {
        // If no query, show all items (no limit for initial display)
        if (!query) {
            return items;
        }

        const lowerQuery = query.toLowerCase();

        // Filter items by matching query anywhere in title or searchTerms
        return items.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(lowerQuery);
            const searchTermMatch = item.searchTerms?.some((term: string) =>
                term.toLowerCase().includes(lowerQuery)
            );
            return titleMatch || searchTermMatch;
        });
    },
    render: () => {
        let component;
        let popup;

        return {
            onStart: props => {
                component = new ReactRenderer(SlashCommandList, {
                    props,
                    editor: props.editor,
                });

                if (!props.clientRect) {
                    return;
                }

                popup = tippy('body', {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => {
                        // Use the dedicated popup container inside the editor wrapper
                        // This ensures popups work in fullscreen mode
                        const popupContainer = document.getElementById('editor-popup-container');
                        return popupContainer || document.body;
                    },
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                    zIndex: 2147483647, // Max z-index value
                });
            },
            onUpdate(props) {
                component.updateProps(props);

                if (!props.clientRect) {
                    return;
                }

                popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                });
            },
            onKeyDown(props) {
                if (props.event.key === 'Escape') {
                    popup[0].hide();
                    return true;
                }
                return component.ref?.onKeyDown(props);
            },
            onExit() {
                popup[0].destroy();
                component.destroy();
            },
        };
    },
});
