import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Link, Palette, BoxSelect, AlignLeft, AlignCenter, AlignRight, Save, Check, LayoutGrid, Maximize } from 'lucide-react';

interface ButtonMenuProps {
    editor: Editor;
}

const ensureUnit = (val: string) => {
    val = val.trim();
    if (!val) return '0px';
    if (/^[0-9]+(\.[0-9]+)?$/.test(val)) return `${val}px`;
    return val;
};

export const ButtonMenu: React.FC<ButtonMenuProps> = ({ editor }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState<'link' | 'style' | 'layout'>('link');

    // Local form state
    const [localUrl, setLocalUrl] = useState('');
    const [localPadding, setLocalPadding] = useState('');
    const [localRadius, setLocalRadius] = useState('');

    const updateMenu = () => {
        if (!editor) return;

        if (menuRef.current?.contains(document.activeElement)) {
            return;
        }

        if (!editor.isActive('button')) {
            if (isVisible) setIsVisible(false);
            return;
        }

        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;

        let nodePos = -1;
        for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'button') {
                nodePos = $from.before(d);
                break;
            }
        }

        if (nodePos !== -1) {
            const attrs = editor.getAttributes('button');
            setLocalUrl(attrs.url || '#');
            setLocalPadding(attrs.padding || '10px 20px');
            setLocalRadius(attrs.borderRadius || '6px');

            const nodeDOM = view.nodeDOM(nodePos) as HTMLElement;
            if (nodeDOM) {
                const rect = nodeDOM.getBoundingClientRect();
                setPosition({
                    top: rect.top - 10,
                    left: rect.left
                });
                if (!isVisible) setIsVisible(true);
            }
        } else {
            if (isVisible) setIsVisible(false);
        }
    };

    useEffect(() => {
        editor.on('selectionUpdate', updateMenu);
        editor.on('update', updateMenu);
        editor.on('blur', updateMenu);

        return () => {
            editor.off('selectionUpdate', updateMenu);
            editor.off('update', updateMenu);
            editor.off('blur', updateMenu);
        };
    }, [editor, isVisible]);

    const attrs = editor.getAttributes('button');
    const { backgroundColor, textColor, borderColor, borderWidth, borderStyle, alignment } = attrs;

    const updateAttribute = (attr: string, value: string) => {
        editor.commands.updateAttributes('button', { [attr]: value });
    };

    const commitUrl = () => {
        updateAttribute('url', localUrl);
    };

    const commitPadding = () => {
        updateAttribute('padding', localPadding);
    };

    const commitRadius = () => {
        updateAttribute('borderRadius', ensureUnit(localRadius));
    };

    const colors = ['var(--color-primary)', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#18181b', '#f3f4f6'];
    const textColorOptions = ['#ffffff', '#000000', 'inherit'];

    return (
        <div
            ref={menuRef}
            className={`fixed z-[100000] flex flex-col gap-1 p-3 rounded-xl bg-card border border-surface shadow-2xl w-80 transition-opacity duration-100 ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            style={{
                top: position.top,
                left: position.left,
                transform: 'translateY(-100%)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-bold text-main">Button Settings</span>
            </div>

            {/* TABS */}
            <div className="flex gap-1 p-1 bg-surface rounded-lg mb-3 border border-surface">
                {(['link', 'style', 'layout'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-all capitalize ${activeTab === tab ? 'bg-card shadow-sm text-primary font-bold' : 'text-muted hover:text-main'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div className="mb-3 min-h-[80px]">
                {activeTab === 'link' && (
                    <div className="animate-in fade-in duration-200 space-y-3">
                        <div>
                            <div className="text-[10px] font-medium text-muted mb-2 uppercase tracking-wide">Link URL</div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={localUrl}
                                    onChange={(e) => setLocalUrl(e.target.value)}
                                    onBlur={commitUrl}
                                    onKeyDown={(e) => e.key === 'Enter' && commitUrl()}
                                    placeholder="https://..."
                                    className="flex-1 p-2 text-xs rounded-lg bg-surface border border-surface focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-medium text-muted mb-2 uppercase tracking-wide">Target</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateAttribute('target', '_blank')}
                                    className={`flex-1 py-1.5 text-[10px] rounded-md border ${attrs.target === '_blank' ? 'bg-primary/10 border-primary text-primary' : 'border-surface text-muted'}`}
                                >
                                    New Tab
                                </button>
                                <button
                                    onClick={() => updateAttribute('target', '_self')}
                                    className={`flex-1 py-1.5 text-[10px] rounded-md border ${attrs.target === '_self' ? 'bg-primary/10 border-primary text-primary' : 'border-surface text-muted'}`}
                                >
                                    Same Tab
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'style' && (
                    <div className="animate-in fade-in duration-200 space-y-3">
                        {/* Background Color */}
                        <div>
                            <div className="text-[10px] font-medium text-muted mb-2 uppercase tracking-wide">Background</div>
                            <div className="flex flex-wrap gap-2">
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => updateAttribute('backgroundColor', color)}
                                        className={`w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform ${backgroundColor === color ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-surface shadow-sm">
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-50" />
                                    <input
                                        type="color"
                                        value={backgroundColor?.startsWith('var') ? '#3b82f6' : (backgroundColor || '#3b82f6')}
                                        onChange={(e) => updateAttribute('backgroundColor', e.target.value)}
                                        className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer opacity-0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Text Color */}
                        <div>
                            <div className="text-[10px] font-medium text-muted mb-2 uppercase tracking-wide">Text</div>
                            <div className="flex flex-wrap gap-2">
                                {textColorOptions.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => updateAttribute('textColor', color)}
                                        className={`w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform flex items-center justify-center ${textColor === color ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                                        style={{ backgroundColor: color === 'inherit' ? 'transparent' : color }}
                                    >
                                        {color === 'inherit' && <span className="text-[9px] font-bold text-muted">A</span>}
                                    </button>
                                ))}
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-surface shadow-sm">
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-50" />
                                    <input
                                        type="color"
                                        value={textColor && textColor !== 'inherit' ? textColor : '#ffffff'}
                                        onChange={(e) => updateAttribute('textColor', e.target.value)}
                                        className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer opacity-0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Border */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-surface rounded-lg p-2 border border-surface">
                                <span className="text-[9px] text-muted uppercase block mb-1">Border W</span>
                                <input
                                    type="text"
                                    value={borderWidth || '0px'}
                                    onChange={(e) => updateAttribute('borderWidth', ensureUnit(e.target.value))}
                                    className="w-full text-xs font-medium bg-transparent outline-none"
                                    placeholder="0px"
                                />
                            </div>
                            <div className="bg-surface rounded-lg p-2 border border-surface">
                                <span className="text-[9px] text-muted uppercase block mb-1">Style</span>
                                <select
                                    value={borderStyle || 'solid'}
                                    onChange={(e) => updateAttribute('borderStyle', e.target.value)}
                                    className="w-full text-xs font-medium bg-transparent outline-none appearance-none cursor-pointer"
                                >
                                    <option value="solid">Solid</option>
                                    <option value="dashed">Dashed</option>
                                    <option value="dotted">Dotted</option>
                                    <option value="none">None</option>
                                </select>
                            </div>
                            <div className="bg-surface rounded-lg p-2 border border-surface flex items-center justify-center">
                                <div className="relative w-5 h-5 rounded-full overflow-hidden border-2" style={{ borderColor: borderColor || 'transparent' }}>
                                    <input
                                        type="color"
                                        value={borderColor || '#000000'}
                                        onChange={(e) => updateAttribute('borderColor', e.target.value)}
                                        className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer opacity-0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'layout' && (
                    <div className="animate-in fade-in duration-200 space-y-3">
                        {/* Alignment */}
                        <div>
                            <div className="text-[10px] font-medium text-muted mb-2 uppercase tracking-wide">Alignment</div>
                            <div className="flex gap-2">
                                {[
                                    { value: 'left', icon: AlignLeft },
                                    { value: 'center', icon: AlignCenter },
                                    { value: 'right', icon: AlignRight },
                                ].map(({ value, icon: Icon }) => (
                                    <button
                                        key={value}
                                        onClick={() => updateAttribute('alignment', value)}
                                        className={`flex-1 py-2 rounded-md flex items-center justify-center transition-colors ${alignment === value ? 'bg-primary/10 text-primary' : 'bg-surface text-muted hover:text-main'}`}
                                    >
                                        <Icon size={16} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Padding */}
                        <div className="bg-surface rounded-lg p-2 border border-surface">
                            <div className="flex items-center gap-1.5 text-muted mb-2">
                                <BoxSelect size={12} />
                                <span className="text-[10px] uppercase font-medium tracking-wide">Padding</span>
                            </div>
                            <input
                                type="text"
                                value={localPadding}
                                onChange={(e) => setLocalPadding(e.target.value)}
                                onBlur={commitPadding}
                                onKeyDown={(e) => e.key === 'Enter' && commitPadding()}
                                className="w-full p-1.5 text-xs rounded bg-card border-none focus:ring-1 focus:ring-primary text-center outline-none"
                                placeholder="10px 20px"
                            />
                        </div>

                        {/* Radius */}
                        <div className="bg-surface rounded-lg p-2 border border-surface">
                            <div className="flex items-center gap-1.5 text-muted mb-2">
                                <Maximize size={12} />
                                <span className="text-[10px] uppercase font-medium tracking-wide">Radius</span>
                            </div>
                            <input
                                type="text"
                                value={localRadius}
                                onChange={(e) => setLocalRadius(e.target.value)}
                                onBlur={commitRadius}
                                onKeyDown={(e) => e.key === 'Enter' && commitRadius()}
                                className="w-full p-1.5 text-xs rounded bg-card border-none focus:ring-1 focus:ring-primary text-center outline-none"
                                placeholder="6px"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
