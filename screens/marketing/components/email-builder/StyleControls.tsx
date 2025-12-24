import React, { useState, useId } from 'react';
import { EmailBlockStyle } from '../../../types';

// --- Reusable Section ---
export const SettingsGroup = ({ title, children, defaultOpen = true }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const sectionId = useId();

    return (
        <div className="border-b border-[var(--color-surface-border)] last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={sectionId}
                className="flex items-center justify-between w-full py-2.5 px-4 text-left hover:bg-[var(--color-surface-hover)] transition-colors focus:outline-none"
            >
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{title}</span>
                <span className={`material-symbols-outlined text-[16px] text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}>
                    expand_more
                </span>
            </button>
            <div
                id={sectionId}
                className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-[2000px] opacity-100 mb-6' : 'max-h-0 opacity-0'}`}
            >
                <div className={`space-y-4 px-2 transition-all duration-500 delay-75 ${isOpen ? 'translate-y-0' : 'translate-y-4'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- Standard Controls ---

// --- Standard Controls ---

interface ControlRowProps {
    label: string;
    htmlFor?: string;
    children: React.ReactNode;
    vertical?: boolean;
    icon?: string;
    onLabelMouseDown?: (e: React.MouseEvent) => void;
}

export const ControlRow = ({ label, htmlFor, children, vertical = false, icon, onLabelMouseDown }: ControlRowProps) => (
    <div className={`flex ${vertical ? 'flex-col gap-1.5' : 'flex-row items-center justify-between gap-3'}`}>
        <div
            className={`flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] font-medium shrink-0 ${onLabelMouseDown ? 'cursor-ew-resize select-none hover:text-[var(--color-primary)] transition-colors' : ''}`}
            onMouseDown={onLabelMouseDown}
        >
            {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
            <label htmlFor={htmlFor} className="cursor-inherit">{label}</label>
        </div>
        <div className={`flex min-w-0 ${vertical ? 'w-full' : 'justify-end'}`}>
            {children}
        </div>
    </div>
);

export const PropertyGrid = ({ children, cols = 2 }: { children: React.ReactNode, cols?: number }) => (
    <div className={`grid grid-cols-${cols} gap-3`}>
        {children}
    </div>
);

// --- Compact Pro Inputs ---

interface ScrubbableInputProps {
    id?: string;
    label: string;
    icon?: string;
    value: number | string;
    onChange: (v: any) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    units?: string[];
    placeholder?: string;
}

export const ScrubbableInput = ({ id, label, icon, value, onChange, min = -1000, max = 2000, step = 1, unit = 'px', units, placeholder }: ScrubbableInputProps) => {
    const inputId = id || useId();
    const isNumeric = typeof value === 'number';

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isNumeric) return;
        const startX = e.pageX;
        const startValue = Number(value) || 0;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.pageX - startX;
            const newValue = Math.min(max, Math.max(min, startValue + Math.round(delta / 2) * step));
            onChange(newValue);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    return (
        <div className="flex flex-col gap-1 group/input">
            <div
                className={`flex items-center gap-1.5 px-1 ${isNumeric ? 'cursor-ew-resize select-none' : ''}`}
                onMouseDown={handleMouseDown}
            >
                {icon && <span className="material-symbols-outlined text-[12px] opacity-40">{icon}</span>}
                <label htmlFor={inputId} className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest group-focus-within/input:text-[var(--color-primary)] transition-colors">
                    {label}
                </label>
            </div>
            <div className="relative flex items-center bg-[var(--color-surface-sunken)] rounded border border-[var(--color-surface-border)] group-hover/input:border-[var(--color-primary)]/30 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/10 focus-within:border-[var(--color-primary)]/50 transition-all">
                <input
                    id={inputId}
                    type={isNumeric ? "number" : "text"}
                    value={value ?? ''}
                    placeholder={placeholder}
                    onChange={(e) => onChange(isNumeric ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
                    className={`w-full ${(units && units.length > 0) || unit ? 'pr-8' : 'pr-2'} pl-2 py-1.5 text-[10px] font-mono bg-transparent border-none outline-none appearance-none text-[var(--color-text-main)]`}
                />
                {units && units.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => {
                            const valStr = String(value);
                            const currentUnit = units.find(u => valStr.endsWith(u)) || (isNumeric ? '' : '');
                            const currentIndex = units.indexOf(currentUnit);
                            const nextIndex = (currentIndex + 1) % units.length;
                            const nextUnit = units[nextIndex];

                            if (nextUnit === 'auto') {
                                onChange('auto');
                            } else {
                                const numericPart = parseFloat(valStr) || 0;
                                onChange(nextUnit === '' ? numericPart : `${numericPart}${nextUnit}`);
                            }
                        }}
                        className="absolute right-2 text-[8px] font-black text-[var(--color-text-muted)] opacity-50 uppercase hover:opacity-100 hover:text-[var(--color-primary)] transition-all px-1 cursor-pointer select-none"
                    >
                        {units.find(u => String(value).endsWith(u)) || (value === 'auto' ? 'auto' : (unit || 'px'))}
                    </button>
                ) : unit && (
                    <span className="absolute right-2 text-[8px] font-black text-[var(--color-text-muted)] opacity-30 uppercase select-none pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
        </div>
    );
};

export const SliderInput = ({ id, label, value, onChange, min = 0, max = 100, step = 1, unit = 'px' }: SliderInputProps) => {
    const inputId = id || useId();

    const handleMouseDown = (e: React.MouseEvent) => {
        const startX = e.pageX;
        const startValue = value || 0;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.pageX - startX;
            const newValue = Math.min(max, Math.max(min, startValue + Math.round(delta / 2) * step));
            onChange(newValue);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    return (
        <div className="flex flex-col gap-2 group/slider">
            <div className="flex justify-between items-center px-1">
                <div
                    className="flex items-center gap-1.5 cursor-ew-resize select-none"
                    onMouseDown={handleMouseDown}
                >
                    <label htmlFor={inputId} className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest group-focus-within/slider:text-[var(--color-primary)] transition-colors">
                        {label}
                    </label>
                </div>
                <div className="flex items-center gap-0.5 bg-[var(--color-surface-sunken)] px-1.5 py-0.5 rounded border border-[var(--color-surface-border)]">
                    <input
                        type="number"
                        value={value ?? 0}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="w-10 h-3 text-right text-[9px] font-mono bg-transparent border-none outline-none appearance-none"
                    />
                    <span className="text-[8px] text-[var(--color-text-muted)] font-black opacity-30">{unit}</span>
                </div>
            </div>
            <div className="relative flex items-center h-4 px-1">
                <div className="absolute inset-x-1 h-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[var(--color-primary)] transition-all duration-75"
                        style={{ width: `${(((value || 0) - min) / (max - min)) * 100}%` }}
                    />
                </div>
                <input
                    type="range"
                    id={inputId}
                    min={min}
                    max={max}
                    step={step}
                    value={value ?? 0}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute inset-x-1 w-[calc(100%-8px)] opacity-0 cursor-pointer z-10"
                />
                <div
                    className="absolute size-2.5 bg-white dark:bg-zinc-200 rounded-full shadow-md border border-zinc-200 dark:border-zinc-700 pointer-events-none transition-all duration-75"
                    style={{ left: `calc(${(((value || 0) - min) / (max - min)) * 100}% - 5px)` }}
                />
            </div>
        </div>
    );
};

interface SegmentedControlProps {
    label?: string;
    value: any;
    options: { value: any; icon?: string; text?: string; ariaLabel: string }[];
    onChange: (v: any) => void;
}
export const SegmentedControl = ({ label, value, options, onChange }: SegmentedControlProps) => {
    return (
        <div className={label ? 'space-y-1.5' : ''}>
            {label && <div className="text-[11px] text-[var(--color-text-muted)] font-medium">{label}</div>}
            <div className="flex p-0.5 bg-[var(--color-surface-sunken)] rounded-md border border-[var(--color-surface-border)]" role="group">
                {options.map((opt) => (
                    <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        aria-pressed={value === opt.value}
                        title={opt.ariaLabel}
                        className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-[4px] text-[10px] font-bold transition-all ${value === opt.value
                            ? 'bg-white dark:bg-zinc-700 text-[var(--color-primary)] shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                    >
                        {opt.icon ? <span className="material-symbols-outlined text-[16px]">{opt.icon}</span> : opt.text}
                    </button>
                ))}
            </div>
        </div>
    );
};

const BRAND_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#000000', '#ffffff', 'transparent'
];

export const ColorPicker = ({ label, value, onChange }: ColorPickerProps) => {
    const inputId = useId();
    const isTransparent = !value || value === 'transparent';
    return (
        <ControlRow label={label} htmlFor={inputId}>
            <div className="flex flex-col gap-2 w-full max-w-[140px]">
                <div className="flex items-center gap-2 group">
                    <div className="relative size-5 rounded-sm overflow-hidden border border-black/10 dark:border-white/10 shrink-0 shadow-sm transition-transform hover:scale-110">
                        <div className="absolute inset-0 bg-checkerboard opacity-20" style={{ backgroundSize: '4px 4px', backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)` }} />
                        <div className="absolute inset-0 transition-colors" style={{ backgroundColor: value || 'transparent' }} />
                        <input
                            type="color"
                            id={inputId}
                            value={isTransparent ? '#ffffff' : value}
                            onChange={(e) => onChange(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer scale-150"
                        />
                    </div>
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="None"
                        className="flex-1 bg-transparent text-[10px] font-mono border-none outline-none text-[var(--color-text-main)] uppercase"
                    />
                </div>
                <div className="flex flex-wrap gap-1">
                    {BRAND_COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => onChange(c)}
                            title={c}
                            className={`size-3 rounded-full border border-black/5 dark:border-white/5 transition-transform hover:scale-125 ${value === c ? 'ring-1 ring-[var(--color-primary)] ring-offset-1 dark:ring-offset-zinc-900' : ''}`}
                            style={{ backgroundColor: c === 'transparent' ? 'white' : c }}
                        >
                            {c === 'transparent' && <div className="w-full h-px bg-red-500 rotate-45" />}
                        </button>
                    ))}
                </div>
            </div>
        </ControlRow>
    );
};

// --- Specialized Visual Controls ---

export const BoxModelControl = ({ styles, onChange, onBulkChange }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void, onBulkChange?: (updates: Record<string, any>) => void }) => {
    const properties = [
        { key: 'paddingTop', label: 'T', top: 0, left: '50%', transform: 'translateX(-50%)' },
        { key: 'paddingBottom', label: 'B', bottom: 0, left: '50%', transform: 'translateX(-50%)' },
        { key: 'paddingLeft', label: 'L', left: 0, top: '50%', transform: 'translateY(-50%)' },
        { key: 'paddingRight', label: 'R', right: 0, top: '50%', transform: 'translateY(-50%)' },
    ];

    return (
        <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative w-full max-w-[180px] aspect-[1.6/1] bg-[var(--color-surface-sunken)] rounded-md border border-[var(--color-surface-border)] overflow-hidden">
                {/* Visual Guide Labels */}
                <div className="absolute inset-4 border border-dashed border-[var(--color-text-muted)]/20 rounded-sm flex items-center justify-center">
                    <span className="text-[8px] font-black text-[var(--color-text-muted)]/30 uppercase tracking-widest pointer-events-none">Content</span>
                </div>

                {/* Interaction Points */}
                {properties.map(p => {
                    const value = styles[p.key as keyof EmailBlockStyle] as number || 0;

                    const handleMouseDown = (e: React.MouseEvent) => {
                        const startX = e.pageX;
                        const startY = e.pageY;
                        const startValue = value;
                        const isVertical = p.key === 'paddingTop' || p.key === 'paddingBottom';

                        const handleMouseMove = (mv: MouseEvent) => {
                            const delta = isVertical
                                ? (p.key === 'paddingTop' ? mv.pageY - startY : startY - mv.pageY)
                                : (p.key === 'paddingLeft' ? mv.pageX - startX : startX - mv.pageX);
                            const newValue = Math.max(0, Math.min(100, startValue + Math.round(delta / 2)));

                            if (mv.metaKey && onBulkChange) {
                                // Command: All 4 sides
                                onBulkChange({
                                    paddingTop: newValue,
                                    paddingBottom: newValue,
                                    paddingLeft: newValue,
                                    paddingRight: newValue
                                });
                            } else if (mv.altKey && onBulkChange) {
                                // Option: Opposite sides
                                const oppositeKeyMap: Record<string, string> = {
                                    paddingTop: 'paddingBottom',
                                    paddingBottom: 'paddingTop',
                                    paddingLeft: 'paddingRight',
                                    paddingRight: 'paddingLeft'
                                };
                                onBulkChange({
                                    [p.key]: newValue,
                                    [oppositeKeyMap[p.key]]: newValue
                                });
                            } else {
                                onChange(p.key, newValue);
                            }
                        };

                        const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                            document.body.style.cursor = 'default';
                            document.body.style.userSelect = 'auto';
                        };

                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                        document.body.style.cursor = isVertical ? 'ns-resize' : 'ew-resize';
                        document.body.style.userSelect = 'none';
                    };

                    return (
                        <div
                            key={p.key}
                            onMouseDown={handleMouseDown}
                            className="absolute flex items-center justify-center cursor-pointer group"
                            style={{
                                top: p.top, bottom: p.bottom, left: p.left, right: p.right,
                                transform: p.transform,
                                width: (p.key === 'paddingLeft' || p.key === 'paddingRight') ? '24px' : '60px',
                                height: (p.key === 'paddingTop' || p.key === 'paddingBottom') ? '24px' : '40px'
                            }}
                        >
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">{value}</span>
                                <span className="text-[7px] font-black opacity-30 uppercase">{p.label}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-4 gap-1 w-full mt-2">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 px-1 py-1 bg-[var(--color-surface-sunken)] rounded border border-[var(--color-surface-border)] focus-within:border-[var(--color-primary)]/50 transition-colors">
                        <span className="text-[8px] font-black opacity-30 select-none">T</span>
                        <input type="number" value={styles.paddingTop || 0} onChange={e => onChange('paddingTop', Number(e.target.value))} className="w-full text-[10px] font-mono bg-transparent outline-none text-right" />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 px-1 py-1 bg-[var(--color-surface-sunken)] rounded border border-[var(--color-surface-border)] focus-within:border-[var(--color-primary)]/50 transition-colors">
                        <span className="text-[8px] font-black opacity-30 select-none">B</span>
                        <input type="number" value={styles.paddingBottom || 0} onChange={e => onChange('paddingBottom', Number(e.target.value))} className="w-full text-[10px] font-mono bg-transparent outline-none text-right" />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 px-1 py-1 bg-[var(--color-surface-sunken)] rounded border border-[var(--color-surface-border)] focus-within:border-[var(--color-primary)]/50 transition-colors">
                        <span className="text-[8px] font-black opacity-30 select-none">L</span>
                        <input type="number" value={styles.paddingLeft || 0} onChange={e => onChange('paddingLeft', Number(e.target.value))} className="w-full text-[10px] font-mono bg-transparent outline-none text-right" />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 px-1 py-1 bg-[var(--color-surface-sunken)] rounded border border-[var(--color-surface-border)] focus-within:border-[var(--color-primary)]/50 transition-colors">
                        <span className="text-[8px] font-black opacity-30 select-none">R</span>
                        <input type="number" value={styles.paddingRight || 0} onChange={e => onChange('paddingRight', Number(e.target.value))} className="w-full text-[10px] font-mono bg-transparent outline-none text-right" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Composite Control Sections ---

export const SpacingControl = ({ styles, onChange, onBulkChange }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void, onBulkChange?: (updates: Record<string, any>) => void }) => (
    <BoxModelControl styles={styles} onChange={onChange} onBulkChange={onBulkChange} />
);

export const TypographyControl = ({ styles, onChange, hideDivider }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void, hideDivider?: boolean }) => {
    const fontFamilyId = useId();
    return (
        <div className="space-y-5">
            <ControlRow label="Font" htmlFor={fontFamilyId}>
                <select
                    id={fontFamilyId}
                    value={styles.fontFamily || ''}
                    onChange={(e) => onChange('fontFamily', e.target.value)}
                    className="w-full px-2 py-1.5 text-[10px] font-bold rounded bg-[var(--color-surface-sunken)] border border-[var(--color-surface-border)] focus:border-[var(--color-primary)] outline-none appearance-none cursor-pointer"
                >
                    <option value="">Default</option>
                    <option value="'Inter', sans-serif">Inter</option>
                    <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Courier New', Courier, monospace">Courier</option>
                </select>
            </ControlRow>

            <div className="grid grid-cols-2 gap-3">
                <ScrubbableInput
                    label="Size"
                    icon="format_size"
                    value={styles.fontSize ?? 14}
                    onChange={(v) => onChange('fontSize', v)}
                    min={8}
                    max={120}
                    units={['px', 'em', '%']}
                />
                <ScrubbableInput
                    label="Height"
                    icon="format_line_spacing"
                    value={styles.lineHeight ?? 1.5}
                    onChange={(v) => onChange('lineHeight', v)}
                    min={0.5}
                    max={5}
                    step={0.1}
                    unit="-"
                />
                <ScrubbableInput
                    label="Spacing"
                    icon="format_letter_spacing"
                    value={styles.letterSpacing ?? 0}
                    onChange={(v) => onChange('letterSpacing', v)}
                    min={-5}
                    max={20}
                    unit="px"
                />
                <SegmentedControl
                    label="Weight"
                    value={styles.fontWeight || 'normal'}
                    onChange={(v) => onChange('fontWeight', v)}
                    options={[
                        { value: 'normal', text: 'REG', ariaLabel: 'Regular' },
                        { value: 'bold', text: 'BOLD', ariaLabel: 'Bold' },
                    ]}
                />
            </div>

            <div className={`flex gap-2 ${hideDivider ? '' : 'pt-2 border-t border-[var(--color-surface-border)]/30'}`}>
                <SegmentedControl
                    label="Align"
                    value={styles.textAlign || 'left'}
                    onChange={(v) => onChange('textAlign', v)}
                    options={[
                        { value: 'left', icon: 'format_align_left', ariaLabel: 'Left' },
                        { value: 'center', icon: 'format_align_center', ariaLabel: 'Center' },
                        { value: 'right', icon: 'format_align_right', ariaLabel: 'Right' },
                        { value: 'justify', icon: 'format_align_justify', ariaLabel: 'Justify' },
                    ]}
                />
                <div className="flex flex-col gap-1.5 w-full">
                    <div className="text-[11px] text-[var(--color-text-muted)] font-medium">Decoration</div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => onChange('textTransform', styles.textTransform === 'uppercase' ? 'none' : 'uppercase')}
                            title="Uppercase"
                            className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${styles.textTransform === 'uppercase' ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">abc</span>
                        </button>
                        <button
                            onClick={() => onChange('fontStyle', styles.fontStyle === 'italic' ? 'normal' : 'italic')}
                            title="Italic"
                            className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${styles.fontStyle === 'italic' ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">format_italic</span>
                        </button>
                        <button
                            onClick={() => onChange('textDecoration', styles.textDecoration === 'underline' ? 'none' : 'underline')}
                            title="Underline"
                            className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${styles.textDecoration === 'underline' ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">format_underlined</span>
                        </button>
                        <button
                            onClick={() => onChange('textDecoration', styles.textDecoration === 'line-through' ? 'none' : 'line-through')}
                            title="Strikethrough"
                            className={`flex-1 flex items-center justify-center py-1.5 rounded border text-[10px] font-black transition-all ${styles.textDecoration === 'line-through' ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/30'}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">format_strikethrough</span>
                        </button>
                    </div>
                </div>
            </div>
            <ColorPicker label="Text Color" value={styles.color || '#000000'} onChange={(v) => onChange('color', v)} />
        </div>
    );
};

export const SizeControl = ({ styles, onChange }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void }) => {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <ScrubbableInput
                    label="Width"
                    icon="width"
                    value={styles.width ?? '100%'}
                    onChange={(v) => onChange('width', v)}
                    placeholder="100%"
                    units={['%', 'px', 'auto']}
                />
                <ScrubbableInput
                    label="Height"
                    icon="height"
                    value={styles.height ?? 'auto'}
                    onChange={(v) => onChange('height', v)}
                    placeholder="auto"
                    units={['px', 'auto']}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <ScrubbableInput
                    label="Min W"
                    icon="remove"
                    value={styles.minWidth ?? ''}
                    onChange={(v) => onChange('minWidth', v)}
                    placeholder="0px"
                    units={['px', '%', 'auto']}
                />
                <ScrubbableInput
                    label="Max W"
                    icon="add"
                    value={styles.maxWidth ?? ''}
                    onChange={(v) => onChange('maxWidth', v)}
                    placeholder="none"
                    units={['px', '%', 'auto']}
                />
            </div>
        </div>
    );
};

export const BorderControl = ({ styles, onChange }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void }) => {
    const [showIndividualCorners, setShowIndividualCorners] = useState(false);
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Radius</label>
                    <button
                        onClick={() => setShowIndividualCorners(!showIndividualCorners)}
                        className={`material-symbols-outlined text-[14px] transition-colors ${showIndividualCorners ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] opacity-40 hover:opacity-100'}`}
                    >
                        {showIndividualCorners ? 'grid_view' : 'rounded_corner'}
                    </button>
                </div>

                {showIndividualCorners ? (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--color-surface-sunken)]/50 rounded-lg border border-[var(--color-surface-border)] shadow-inner">
                        <ScrubbableInput label="TL" value={styles.borderTopLeftRadius ?? styles.borderRadius ?? 0} onChange={v => onChange('borderTopLeftRadius', v)} unit="px" />
                        <ScrubbableInput label="TR" value={styles.borderTopRightRadius ?? styles.borderRadius ?? 0} onChange={v => onChange('borderTopRightRadius', v)} unit="px" />
                        <ScrubbableInput label="BL" value={styles.borderBottomLeftRadius ?? styles.borderRadius ?? 0} onChange={v => onChange('borderBottomLeftRadius', v)} unit="px" />
                        <ScrubbableInput label="BR" value={styles.borderBottomRightRadius ?? styles.borderRadius ?? 0} onChange={v => onChange('borderBottomRightRadius', v)} unit="px" />
                    </div>
                ) : (
                    <ScrubbableInput label="All Corners" icon="rounded_corner" value={styles.borderRadius ?? 0} onChange={(v) => onChange('borderRadius', v)} max={100} />
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--color-surface-border)]/30">
                <ScrubbableInput label="Weight" icon="line_weight" value={styles.borderWidth ?? 0} onChange={(v) => onChange('borderWidth', v)} max={20} />
                <SegmentedControl
                    label="Style"
                    value={styles.borderStyle || 'none'}
                    onChange={(v) => onChange('borderStyle', v)}
                    options={[
                        { value: 'none', text: 'NONE', ariaLabel: 'None' },
                        { value: 'solid', text: 'SOLID', ariaLabel: 'Solid' },
                        { value: 'dashed', text: 'DASH', ariaLabel: 'Dashed' },
                    ]}
                />
            </div>
            <ColorPicker label="Border Color" value={styles.borderColor || 'transparent'} onChange={(v) => onChange('borderColor', v)} />
        </div>
    );
};

export const BackgroundControl = ({ styles, onChange }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void }) => (
    <ColorPicker label="Background Color" value={styles.backgroundColor || 'transparent'} onChange={(v) => onChange('backgroundColor', v)} />
);

export const ShadowControl = ({ styles, onChange }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void }) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <ScrubbableInput label="X Offset" value={styles.shadowX ?? 0} onChange={v => onChange('shadowX', v)} unit="px" />
                <ScrubbableInput label="Y Offset" value={styles.shadowY ?? 0} onChange={v => onChange('shadowY', v)} unit="px" />
                <ScrubbableInput label="Blur" value={styles.shadowBlur ?? 0} onChange={v => onChange('shadowBlur', v)} unit="px" />
                <ScrubbableInput label="Spread" value={styles.shadowSpread ?? 0} onChange={v => onChange('shadowSpread', v)} unit="px" />
            </div>
            <ColorPicker label="Shadow Color" value={styles.shadowColor || 'rgba(0,0,0,0.1)'} onChange={v => onChange('shadowColor', v)} />
        </div>
    );
};

export const LayoutControl = ({ styles, onChange }: { styles: EmailBlockStyle, onChange: (k: string, v: any) => void }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
            <SegmentedControl
                label="Direction"
                value={styles.flexDirection || 'row'}
                onChange={(v) => onChange('flexDirection', v)}
                options={[
                    { value: 'row', icon: 'arrow_right_alt', ariaLabel: 'Horizontal' },
                    { value: 'column', icon: 'arrow_downward', ariaLabel: 'Vertical' },
                ]}
            />
            <ScrubbableInput
                label="Gap"
                icon="grid_4x4"
                value={styles.gap ?? 0}
                onChange={(v) => onChange('gap', v)}
                max={100}
                unit="px"
            />
        </div>
        <div className="space-y-3 pt-3 border-t border-[var(--color-surface-border)]/50">
            <SegmentedControl
                label="Align"
                value={styles.alignItems || 'stretch'}
                onChange={(v) => onChange('alignItems', v)}
                options={[
                    { value: 'flex-start', text: 'START', ariaLabel: 'Start' },
                    { value: 'center', text: 'CENTER', ariaLabel: 'Center' },
                    { value: 'flex-end', text: 'END', ariaLabel: 'End' },
                    { value: 'stretch', text: 'STRETCH', ariaLabel: 'Stretch' },
                ]}
            />
            <SegmentedControl
                label="Justify"
                value={styles.justifyContent || 'flex-start'}
                onChange={(v) => onChange('justifyContent', v)}
                options={[
                    { value: 'flex-start', text: 'START', ariaLabel: 'Start' },
                    { value: 'center', text: 'CENTER', ariaLabel: 'Center' },
                    { value: 'space-between', text: 'BETWEEN', ariaLabel: 'Between' },
                ]}
            />
        </div>
    </div>
);
