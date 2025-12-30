import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Check, Save, Settings2, BoxSelect, Maximize, Minimize, Columns, LayoutGrid } from 'lucide-react';
import { useUI } from '../../../context/UIContext';

interface CardMenuProps {
    editor: Editor;
}

// Helper to parse "10px 20px 30px 40px" or "10px" into object
const parseFourValues = (value: string | undefined) => {
    if (!value) return { t: '', r: '', b: '', l: '' }; // default empty
    const parts = value.split(' ');

    // CSS Order: Top, Right, Bottom, Left
    if (parts.length === 1) return { t: parts[0], r: parts[0], b: parts[0], l: parts[0] };
    if (parts.length === 2) return { t: parts[0], r: parts[1], b: parts[0], l: parts[1] };
    if (parts.length === 3) return { t: parts[0], r: parts[1], b: parts[2], l: parts[1] };
    if (parts.length === 4) return { t: parts[0], r: parts[1], b: parts[2], l: parts[3] };
    return { t: '', r: '', b: '', l: '' };
};

const formatFourValues = (vals: { t: string, r: string, b: string, l: string }) => {
    // Basic optimization: if all same, return one value
    if (vals.t === vals.r && vals.t === vals.b && vals.t === vals.l) return vals.t;
    // If TB and RL same: "10px 20px"
    if (vals.t === vals.b && vals.r === vals.l) return `${vals.t} ${vals.r}`;
    return `${vals.t} ${vals.r} ${vals.b} ${vals.l}`;
};

// Check if all values are basically the same
const areValuesUnified = (vals: { t: string, r: string, b: string, l: string }) => {
    return vals.t === vals.r && vals.t === vals.b && vals.t === vals.l;
};

export const CardMenu: React.FC<CardMenuProps> = ({ editor }) => {
    const { showSuccess } = useUI();
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    // Form states
    const [presetName, setPresetName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);

    // Attributes
    const [localPadding, setLocalPadding] = useState({ t: '', r: '', b: '', l: '' });
    const [localRadius, setLocalRadius] = useState({ t: '', r: '', b: '', l: '' });

    // UI Toggles
    const [isUnifiedPadding, setIsUnifiedPadding] = useState(true);
    const [isUnifiedRadius, setIsUnifiedRadius] = useState(true);
    const [activeTab, setActiveTab] = useState<'fill' | 'border' | 'text'>('fill');

    const updateMenu = () => {
        if (!editor) return;

        // If menu inputs are focused, we skip updates to prevent overwriting user input
        // This effectively 'pauses' the menu syncing while the user types
        if (menuRef.current?.contains(document.activeElement)) {
            return;
        }

        if (!editor.isActive('card')) {
            if (isVisible) setIsVisible(false);
            return;
        }

        const { state, view } = editor;
        const { selection } = state;
        const { $from } = selection;

        // Find card node position
        let cardPos = -1;
        for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === 'card') {
                cardPos = $from.before(d);
                break;
            }
        }

        if (cardPos !== -1) {
            // Found a card, and we are not focused in the menu.
            // Sync state from editor to local forms.
            const { padding, borderRadius } = editor.getAttributes('card');

            // Padding
            const pVals = parseFourValues(padding || '16px');
            setLocalPadding(pVals);
            setIsUnifiedPadding(areValuesUnified(pVals));

            // BorderRadius
            const rVals = parseFourValues(borderRadius || '8px');
            setLocalRadius(rVals);
            setIsUnifiedRadius(areValuesUnified(rVals));

            // Position
            const nodeDOM = view.nodeDOM(cardPos) as HTMLElement;
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
        // Removing 'focus' listener as it causes unnecessary re-syncs when focusing back from inputs
        editor.on('blur', updateMenu);
        // We also want to listen to scrolling to update position if needed,
        // though Tiptap usually handles this via 'update' or we might need specific scroll listener.
        // For now standard events are enough.

        return () => {
            editor.off('selectionUpdate', updateMenu);
            editor.off('update', updateMenu);
            // editor.off('focus', updateMenu);
            editor.off('blur', updateMenu);
        };
    }, [editor, isVisible]); // isVisible dependency ensures we can toggle visibility state correctly

    // if (!isVisible) return null; // Removed to prevent unmounting/remounting which kills focus

    const attrs = editor.getAttributes('card');
    const { backgroundColor, textColor, borderColor, borderWidth, borderStyle } = attrs;

    const colors = ['#f3f4f6', '#fffbeb', '#ecfdf5', '#fef2f2', '#eff6ff', '#fafafa', '#18181b'];
    const textColors = ['inherit', '#000000', '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6'];

    const updateAttribute = (attr: string, value: string) => {
        // Use commands.updateAttributes to avoid stealing focus from the input fields
        editor.commands.updateAttributes('card', { [attr]: value });
    };

    const ensureUnit = (val: string) => {
        val = val.trim();
        if (!val) return '0px';
        if (/^[0-9]+(\.[0-9]+)?$/.test(val)) return `${val}px`;
        return val;
    };

    const commitPadding = () => {
        const cleaned = {
            t: ensureUnit(localPadding.t),
            r: ensureUnit(localPadding.r),
            b: ensureUnit(localPadding.b),
            l: ensureUnit(localPadding.l)
        };
        // Update local state with cleaned values so UI reflects the change (e.g. 10 -> 10px) immediately
        setLocalPadding(cleaned);
        const val = formatFourValues(cleaned);
        updateAttribute('padding', val);
    };

    const commitRadius = () => {
        const cleaned = {
            t: ensureUnit(localRadius.t),
            r: ensureUnit(localRadius.r),
            b: ensureUnit(localRadius.b),
            l: ensureUnit(localRadius.l)
        };
        setLocalRadius(cleaned);
        const val = formatFourValues(cleaned);
        updateAttribute('borderRadius', val);
    };

    const handleUnifiedChange = (type: 'padding' | 'radius', value: string) => {
        const newVal = { t: value, r: value, b: value, l: value };
        if (type === 'padding') {
            setLocalPadding(newVal);
        } else {
            setLocalRadius(newVal);
        }
    };

    const handleSavePreset = () => {
        if (!presetName.trim()) return;

        const newPreset = {
            title: presetName,
            description: 'Custom card preset',
            icon: 'web_asset',
            attributes: {
                backgroundColor,
                borderRadius: formatFourValues(localRadius),
                padding: formatFourValues(localPadding),
                textColor
            }
        };

        const existing = JSON.parse(localStorage.getItem('card_presets') || '[]');
        localStorage.setItem('card_presets', JSON.stringify([...existing, newPreset]));

        window.dispatchEvent(new Event('storage'));
        setShowSaveInput(false);
        setPresetName('');
        showSuccess(`Saved preset "${presetName}".`);
    };

    return (
        <div
            ref={menuRef}
            className={`fixed z-[100000] flex flex-col gap-1 p-3 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-2xl w-80 transition-opacity duration-100 ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            style={{
                top: position.top,
                left: position.left,
                transform: 'translateY(-100%)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-bold text-[var(--color-text-main)]">Card Settings</span>
                {/* Save Preset Button - Small and integrated into header */}
                {!showSaveInput ? (
                    <button
                        onClick={() => setShowSaveInput(true)}
                        className="p-1 hover:bg-[var(--color-surface-hover)] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                        title="Save as Preset"
                    >
                        <Save size={14} />
                    </button>
                ) : (
                    <div className="flex bg-[var(--color-surface-bg)] rounded-md border border-[var(--color-surface-border)] overflow-hidden h-6">
                        <input
                            type="text"
                            placeholder="Name"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            className="w-20 text-[10px] px-2 bg-transparent outline-none text-[var(--color-text-main)]"
                            autoFocus
                        />
                        <button
                            onClick={handleSavePreset}
                            className="bg-[var(--color-primary)] text-white px-2 hover:bg-[var(--color-primary-dark)]"
                        >
                            <Check size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* TABS */}
            <div className="flex gap-1 p-1 bg-[var(--color-surface-bg)] rounded-lg mb-3 border border-[var(--color-surface-border)]">
                {(['fill', 'border', 'text'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-all capitalize ${activeTab === tab ? 'bg-[var(--color-surface-card)] shadow-sm text-[var(--color-primary)] font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT */}
            <div className="mb-4 min-h-[80px]">
                {activeTab === 'fill' && (
                    <div className="animate-in fade-in duration-200">
                        <div className="text-[10px] font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Background Color</div>
                        <div className="flex flex-wrap gap-2">
                            {colors.map(color => (
                                <button
                                    key={color}
                                    onClick={() => updateAttribute('backgroundColor', color)}
                                    className={`w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform ${backgroundColor === color ? 'ring-2 ring-offset-1 ring-[var(--color-primary)]' : ''}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-[var(--color-surface-border)] shadow-sm group hover:border-[var(--color-text-muted)] transition-colors">
                                <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-50" />
                                <input
                                    type="color"
                                    value={backgroundColor || '#f3f4f6'}
                                    onChange={(e) => updateAttribute('backgroundColor', e.target.value)}
                                    className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer opacity-0"
                                    title="Custom Color"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'border' && (
                    <div className="animate-in fade-in duration-200 space-y-3">
                        <div>
                            <div className="text-[10px] font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Color</div>
                            <div className="flex flex-wrap gap-2">
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => updateAttribute('borderColor', color)}
                                        className={`w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform ${borderColor === color ? 'ring-2 ring-offset-1 ring-[var(--color-primary)] border-transparent' : 'border-black/10'}`}
                                        style={{ borderColor: color, backgroundColor: 'transparent' }}
                                    />
                                ))}
                                <div className="relative w-6 h-6 rounded-full overflow-hidden border-2 border-[var(--color-surface-border)] group hover:border-[var(--color-text-muted)] transition-colors">
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-20" />
                                    <input
                                        type="color"
                                        value={borderColor || '#e5e7eb'}
                                        onChange={(e) => updateAttribute('borderColor', e.target.value)}
                                        className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer opacity-0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[var(--color-surface-bg)] rounded-lg p-2 border border-[var(--color-surface-border)]">
                                <span className="text-[9px] text-[var(--color-text-muted)] uppercase block mb-1">Width</span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={borderWidth || '1px'}
                                        onChange={(e) => updateAttribute('borderWidth', ensureUnit(e.target.value))}
                                        className="w-full text-xs font-medium bg-transparent outline-none p-0.5"
                                        placeholder="1px"
                                    />
                                </div>
                            </div>
                            <div className="bg-[var(--color-surface-bg)] rounded-lg p-2 border border-[var(--color-surface-border)]">
                                <span className="text-[9px] text-[var(--color-text-muted)] uppercase block mb-1">Style</span>
                                <select
                                    value={borderStyle || 'solid'}
                                    onChange={(e) => updateAttribute('borderStyle', e.target.value)}
                                    className="w-full text-xs font-medium bg-transparent outline-none appearance-none cursor-pointer"
                                >
                                    <option value="solid">Solid</option>
                                    <option value="dashed">Dashed</option>
                                    <option value="dotted">Dotted</option>
                                    <option value="double">Double</option>
                                    <option value="none">None</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'text' && (
                    <div className="animate-in fade-in duration-200">
                        <div className="text-[10px] font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Text Color</div>
                        <div className="flex flex-wrap gap-2">
                            {/* Auto Button */}
                            <button
                                onClick={() => updateAttribute('textColor', 'inherit')}
                                className={`w-6 h-6 rounded-full border border-dashed border-[var(--color-text-muted)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] ${textColor === 'inherit' ? 'ring-2 ring-offset-1 ring-[var(--color-primary)]' : ''}`}
                                title="Inherit / Auto"
                            >
                                <span className="text-[9px] font-bold text-[var(--color-text-muted)]">A</span>
                            </button>
                            {/* Colors excluding inherit which is manual above */}
                            {textColors.filter(c => c !== 'inherit').map(color => (
                                <button
                                    key={color}
                                    onClick={() => updateAttribute('textColor', color)}
                                    className={`w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform ${textColor === color ? 'ring-2 ring-offset-1 ring-[var(--color-primary)]' : ''}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-[var(--color-surface-border)] shadow-sm group hover:border-[var(--color-text-muted)] transition-colors">
                                <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-50" />
                                <input
                                    type="color"
                                    value={textColor && textColor !== 'inherit' ? textColor : '#000000'}
                                    onChange={(e) => updateAttribute('textColor', e.target.value)}
                                    className="absolute inset-[-4px] w-[150%] h-[150%] p-0 border-none cursor-pointer opacity-0"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="h-px bg-[var(--color-surface-border)] my-1 opacity-50" />

            {/* DIMENSIONS (Always Visible) */}
            <div className="space-y-3 pt-1">
                {/* Radius */}
                <div className="bg-[var(--color-surface-bg)] rounded-lg p-2 border border-[var(--color-surface-border)]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                            <Maximize size={12} />
                            <span className="text-[10px] uppercase font-medium tracking-wide">Radius</span>
                        </div>
                        <button
                            onClick={() => setIsUnifiedRadius(!isUnifiedRadius)}
                            className={`p-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors ${!isUnifiedRadius ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-[var(--color-text-muted)]'}`}
                            title="Toggle individual corners"
                        >
                            <LayoutGrid size={12} />
                        </button>
                    </div>

                    {isUnifiedRadius ? (
                        <input
                            type="text"
                            value={localRadius.t}
                            onChange={(e) => handleUnifiedChange('radius', e.target.value)}
                            onBlur={commitRadius}
                            onKeyDown={(e) => e.key === 'Enter' && commitRadius()}
                            className="w-full p-1.5 text-xs rounded bg-[var(--color-surface-card)] border-none focus:ring-1 focus:ring-[var(--color-primary)] text-center outline-none transition-shadow"
                            placeholder="e.g. 8px"
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {['t', 'r', 'b', 'l'].map((key) => (
                                <div key={`radius-${key}`} className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-[var(--color-text-muted)] font-bold uppercase pointer-events-none">
                                        {key === 't' ? 'TL' : key === 'r' ? 'TR' : key === 'b' ? 'BR' : 'BL'}
                                    </span>
                                    <input
                                        type="text"
                                        value={(localRadius as any)[key]}
                                        onChange={(e) => setLocalRadius({ ...localRadius, [key]: e.target.value })}
                                        onBlur={commitRadius}
                                        onKeyDown={(e) => e.key === 'Enter' && commitRadius()}
                                        className="w-full p-1.5 pl-6 text-xs rounded bg-[var(--color-surface-card)] border-none focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-right transition-shadow"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Padding */}
                <div className="bg-[var(--color-surface-bg)] rounded-lg p-2 border border-[var(--color-surface-border)]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                            <BoxSelect size={12} />
                            <span className="text-[10px] uppercase font-medium tracking-wide">Padding</span>
                        </div>
                        <button
                            onClick={() => setIsUnifiedPadding(!isUnifiedPadding)}
                            className={`p-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors ${!isUnifiedPadding ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-[var(--color-text-muted)]'}`}
                            title="Toggle individual sides"
                        >
                            <LayoutGrid size={12} />
                        </button>
                    </div>

                    {isUnifiedPadding ? (
                        <input
                            type="text"
                            value={localPadding.t}
                            onChange={(e) => handleUnifiedChange('padding', e.target.value)}
                            onBlur={commitPadding}
                            onKeyDown={(e) => e.key === 'Enter' && commitPadding()}
                            className="w-full p-1.5 text-xs rounded bg-[var(--color-surface-card)] border-none focus:ring-1 focus:ring-[var(--color-primary)] text-center outline-none transition-shadow"
                            placeholder="e.g. 16px"
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {['t', 'r', 'b', 'l'].map((key) => (
                                <div key={`padding-${key}`} className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-[var(--color-text-muted)] font-bold uppercase pointer-events-none">
                                        {key}
                                    </span>
                                    <input
                                        type="text"
                                        value={(localPadding as any)[key]}
                                        onChange={(e) => setLocalPadding({ ...localPadding, [key]: e.target.value })}
                                        onBlur={commitPadding}
                                        onKeyDown={(e) => e.key === 'Enter' && commitPadding()}
                                        className="w-full p-1.5 pl-6 text-xs rounded bg-[var(--color-surface-card)] border-none focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-right transition-shadow"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
