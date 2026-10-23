import React from 'react';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';

export interface SuggestionItem {
    key: string;
    title: string;
    subtitle?: string;
    icon: string;
    group?: string;
}

export interface SuggestionListHandle {
    onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

/** Floating suggestion layer positioned at the caret; flips above when there is no room below. */
export const createSuggestionRender = (Component: React.ComponentType<any>) => () => {
    let renderer: ReactRenderer<SuggestionListHandle, any> | null = null;
    let layer: HTMLDivElement | null = null;

    const position = (props: SuggestionProps<any, any>) => {
        const rect = props.clientRect?.();
        if (!rect || !layer) return;
        const height = layer.offsetHeight || 320;
        const width = layer.offsetWidth || 300;
        const below = rect.bottom + 6;
        const fitsBelow = below + height < window.innerHeight - 8;
        layer.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
        layer.style.top = `${fitsBelow ? below : Math.max(8, rect.top - height - 6)}px`;
        layer.dataset.side = fitsBelow ? 'bottom' : 'top';
    };

    const destroy = () => {
        renderer?.destroy();
        layer?.remove();
        renderer = null;
        layer = null;
    };

    return {
        onStart: (props: SuggestionProps<any, any>) => {
            layer = document.createElement('div');
            layer.className = 'wiki-suggest-layer';
            document.body.appendChild(layer);
            renderer = new ReactRenderer(Component, { props, editor: props.editor });
            layer.appendChild(renderer.element);
            requestAnimationFrame(() => position(props));
        },
        onUpdate: (props: SuggestionProps<any, any>) => {
            renderer?.updateProps(props);
            requestAnimationFrame(() => position(props));
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === 'Escape') {
                destroy();
                return true;
            }
            return renderer?.ref?.onKeyDown(props) ?? false;
        },
        onExit: destroy,
    };
};

interface SuggestionListProps<T extends SuggestionItem> {
    items: T[];
    command: (item: T) => void;
    emptyLabel?: string;
    loadingLabel?: string;
}

/** Keyboard-driven grouped list used by the slash menu and @-mentions. */
export const SuggestionList = React.forwardRef<SuggestionListHandle, SuggestionListProps<SuggestionItem>>(
    ({ items, command, emptyLabel }, ref) => {
        const [active, setActive] = React.useState(0);
        const listRef = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => setActive(0), [items]);
        React.useEffect(() => {
            listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
        }, [active]);

        React.useImperativeHandle(ref, () => ({
            onKeyDown: ({ event }) => {
                if (!items.length) return false;
                if (event.key === 'ArrowDown') {
                    setActive((index) => (index + 1) % items.length);
                    return true;
                }
                if (event.key === 'ArrowUp') {
                    setActive((index) => (index - 1 + items.length) % items.length);
                    return true;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                    command(items[active]);
                    return true;
                }
                return false;
            },
        }), [active, command, items]);

        let lastGroup: string | undefined;
        return (
            <div className="wiki-suggest" ref={listRef} role="listbox">
                {!items.length && <div className="wiki-suggest__empty">{emptyLabel}</div>}
                {items.map((item, index) => {
                    const header = item.group && item.group !== lastGroup ? item.group : null;
                    lastGroup = item.group;
                    return (
                        <React.Fragment key={item.key}>
                            {header && <div className="wiki-suggest__group">{header}</div>}
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === active}
                                data-index={index}
                                className={`wiki-suggest__item${index === active ? ' is-active' : ''}`}
                                onMouseEnter={() => setActive(index)}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    command(item);
                                }}
                            >
                                <span className="wiki-suggest__icon material-symbols-outlined">{item.icon}</span>
                                <span className="wiki-suggest__text">
                                    <span className="wiki-suggest__title">{item.title}</span>
                                    {item.subtitle && <span className="wiki-suggest__subtitle">{item.subtitle}</span>}
                                </span>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    },
);
SuggestionList.displayName = 'SuggestionList';
