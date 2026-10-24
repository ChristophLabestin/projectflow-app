// Public form themes (brain/plans/forms-concept.md §7). Colours here are respondent-facing theme data,
// not app styling: the form renderer reads them only through `--form-*` CSS variables.
// Fonts are self-hosted @fontsource packages (no Google Fonts CDN, DSGVO); the server whitelists the ids.

import type { CSSProperties } from 'react';

import type { FormTheme } from '../../../types/forms';

export interface FormFontDef {
    id: string;
    label: string;
    family: string;
    load: () => Promise<unknown>;
}

export const FORM_FONTS: FormFontDef[] = [
    { id: 'plus-jakarta-sans', label: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/plus-jakarta-sans') },
    { id: 'inter', label: 'Inter', family: "'Inter Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/inter') },
    { id: 'manrope', label: 'Manrope', family: "'Manrope Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/manrope') },
    { id: 'dm-sans', label: 'DM Sans', family: "'DM Sans Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/dm-sans') },
    { id: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/space-grotesk') },
    { id: 'ibm-plex-sans', label: 'IBM Plex Sans', family: "'IBM Plex Sans Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/ibm-plex-sans') },
    { id: 'nunito', label: 'Nunito', family: "'Nunito Variable', system-ui, sans-serif", load: () => import('@fontsource-variable/nunito') },
    { id: 'source-serif-4', label: 'Source Serif', family: "'Source Serif 4 Variable', Georgia, serif", load: () => import('@fontsource-variable/source-serif-4') },
    { id: 'fraunces', label: 'Fraunces', family: "'Fraunces Variable', Georgia, serif", load: () => import('@fontsource-variable/fraunces') },
    { id: 'playfair-display', label: 'Playfair Display', family: "'Playfair Display Variable', Georgia, serif", load: () => import('@fontsource-variable/playfair-display') }
];

const fontById = (id: string | undefined) => FORM_FONTS.find((font) => font.id === id) || FORM_FONTS[0];

export const loadFormFont = (id: string | undefined) => fontById(id).load().catch(() => undefined);

type PresetTheme = Omit<FormTheme, 'preset' | 'logoPath' | 'coverPath'>;

export const FORM_THEME_PRESETS: Record<string, PresetTheme> = {
    'projectflow-light': {
        background: { type: 'color', color: '#f4f5f7' }, surface: '#ffffff', text: '#16181d', accent: '#111318', accentText: '#ffffff',
        font: 'plus-jakarta-sans', radius: 16, fieldStyle: 'sunken', density: 'comfortable'
    },
    'projectflow-dark': {
        background: { type: 'color', color: '#0e0f12' }, surface: '#17191e', text: '#eef0f4', accent: '#f2f3f5', accentText: '#111318',
        font: 'plus-jakarta-sans', radius: 16, fieldStyle: 'sunken', density: 'comfortable'
    },
    paper: {
        background: { type: 'color', color: '#f5f0e6' }, surface: '#fffdf8', text: '#2b2620', accent: '#8a4b2a', accentText: '#fffdf8',
        font: 'source-serif-4', radius: 8, fieldStyle: 'underline', density: 'comfortable'
    },
    midnight: {
        background: { type: 'gradient', gradient: { from: '#1b1f3b', to: '#0b0d1a', angle: 160 } }, surface: '#20243f', text: '#eceefe', accent: '#8b9cff', accentText: '#0b0d1a',
        font: 'space-grotesk', radius: 16, fieldStyle: 'filled', density: 'comfortable'
    },
    forest: {
        background: { type: 'color', color: '#e8efe9' }, surface: '#ffffff', text: '#18291f', accent: '#2f6b47', accentText: '#ffffff',
        font: 'manrope', radius: 24, fieldStyle: 'filled', density: 'comfortable'
    },
    sunset: {
        background: { type: 'gradient', gradient: { from: '#ffe2c9', to: '#ffc2c7', angle: 135 } }, surface: '#ffffff', text: '#2d1b1e', accent: '#d9485f', accentText: '#ffffff',
        font: 'fraunces', radius: 16, fieldStyle: 'sunken', density: 'comfortable'
    },
    ocean: {
        background: { type: 'color', color: '#e6f1f8' }, surface: '#ffffff', text: '#0f2333', accent: '#1666a8', accentText: '#ffffff',
        font: 'inter', radius: 8, fieldStyle: 'filled', density: 'compact'
    },
    mono: {
        background: { type: 'color', color: '#ffffff' }, surface: '#ffffff', text: '#000000', accent: '#000000', accentText: '#ffffff',
        font: 'ibm-plex-sans', radius: 0, fieldStyle: 'underline', density: 'compact'
    }
};

export const FORM_THEME_PRESET_IDS = Object.keys(FORM_THEME_PRESETS);
export const DEFAULT_FORM_PRESET = 'projectflow-light';

const HEX = /^#[0-9a-f]{6}$/i;

/** A complete theme: preset values filled in, invalid colours replaced by the preset's. */
export const resolveFormTheme = (theme: Partial<FormTheme> | { themeId: string } | null | undefined): FormTheme => {
    const raw = (theme && !('themeId' in theme) ? theme : {}) as Partial<FormTheme>;
    const presetId = raw.preset && FORM_THEME_PRESETS[raw.preset] ? raw.preset : DEFAULT_FORM_PRESET;
    const base = FORM_THEME_PRESETS[presetId];
    const color = (value: string | undefined, fallback: string) => (value && HEX.test(value) ? value : fallback);
    return {
        preset: presetId,
        background: raw.background && ['color', 'gradient', 'image'].includes(raw.background.type) ? raw.background : base.background,
        surface: color(raw.surface, base.surface),
        text: color(raw.text, base.text),
        accent: color(raw.accent, base.accent),
        accentText: color(raw.accentText, base.accentText),
        font: FORM_FONTS.some((font) => font.id === raw.font) ? (raw.font as string) : base.font,
        radius: ([0, 8, 16, 24] as const).includes(raw.radius as 0) ? (raw.radius as FormTheme['radius']) : base.radius,
        fieldStyle: ['sunken', 'filled', 'underline'].includes(raw.fieldStyle as string) ? (raw.fieldStyle as FormTheme['fieldStyle']) : base.fieldStyle,
        density: raw.density === 'compact' || raw.density === 'comfortable' ? raw.density : base.density,
        logoPath: raw.logoPath,
        coverPath: raw.coverPath
    };
};

/** Theme of a preset (used when the plan allows presets only). */
export const presetTheme = (presetId: string): FormTheme => resolveFormTheme({ preset: presetId });

const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

/** WCAG contrast ratio of two #rrggbb colours (1–21). */
export const contrastRatio = (a: string, b: string) => {
    if (!HEX.test(a) || !HEX.test(b)) return 21;
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

/** Pairs below WCAG AA (4.5:1) — the theme editor warns, it does not block. */
export const themeContrastIssues = (theme: FormTheme): ('text' | 'accent')[] => {
    const issues: ('text' | 'accent')[] = [];
    if (contrastRatio(theme.text, theme.surface) < 4.5) issues.push('text');
    if (contrastRatio(theme.accentText, theme.accent) < 4.5) issues.push('accent');
    return issues;
};

const mix = (hex: string, other: string, weight: number) => {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(other.slice(1), 16);
    const part = (shift: number) => Math.round(((a >> shift) & 255) * (1 - weight) + ((b >> shift) & 255) * weight);
    return `#${[16, 8, 0].map((shift) => part(shift).toString(16).padStart(2, '0')).join('')}`;
};

/** CSS custom properties for the renderer root. `assetUrl` turns stored asset paths into URLs. */
export const formThemeStyle = (theme: FormTheme, assetUrl: (path: string) => string = (path) => path): CSSProperties => {
    const bg = theme.background;
    const background = bg.type === 'gradient' && bg.gradient
        ? `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`
        : bg.type === 'image' && bg.imagePath
            ? `center / cover no-repeat url("${assetUrl(bg.imagePath)}")`
            : bg.color || theme.surface;
    const dark = luminance(theme.surface) < 0.2;
    return {
        '--form-bg': background,
        '--form-surface': theme.surface,
        '--form-text': theme.text,
        '--form-muted': mix(theme.text, theme.surface, 0.42),
        '--form-field': mix(theme.surface, theme.text, dark ? 0.1 : 0.045),
        '--form-field-hover': mix(theme.surface, theme.text, dark ? 0.14 : 0.07),
        '--form-sunken-shadow': dark ? 'inset 0 1px 2px rgba(0, 0, 0, 0.45)' : 'inset 0 1px 2px rgba(0, 0, 0, 0.08)',
        '--form-accent': theme.accent,
        '--form-accent-text': theme.accentText,
        '--form-accent-soft': mix(theme.surface, theme.accent, 0.14),
        '--form-danger': dark ? '#ff8a8a' : '#c62828',
        '--form-radius': `${theme.radius}px`,
        '--form-radius-sm': `${Math.min(theme.radius, 12)}px`,
        '--form-font': fontById(theme.font).family,
        '--form-gap': theme.density === 'compact' ? '16px' : '24px'
    } as CSSProperties;
};
