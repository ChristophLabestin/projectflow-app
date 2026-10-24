import React, { useRef, useState } from 'react';

import { Button } from '../../common/Button/Button';
import { Select } from '../../common/Select/Select';
import { useLanguage } from '../../../context/LanguageContext';
import { formAssetUrl } from '../../../services/forms/publicFormsApi';
import type { FormTheme } from '../../../types/forms';
import {
    FORM_FONTS,
    FORM_THEME_PRESETS,
    FORM_THEME_PRESET_IDS,
    formThemeStyle,
    presetTheme,
    themeContrastIssues
} from '../theme/formThemes';

interface ThemeEditorProps {
    theme: FormTheme;
    onChange: (theme: FormTheme) => void;
    fullTheme: boolean;
    onUpload: (kind: 'logo' | 'cover' | 'background', file: File) => Promise<string>;
}

const ColorField: React.FC<{ label: string; value: string; onChange: (value: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => {
    const [text, setText] = useState(value);
    React.useEffect(() => setText(value), [value]);
    return (
        <label className="form-theme__color">
            <span>{label}</span>
            <span className="form-theme__color-input">
                <input type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label={label} />
                <input className="form-builder__input" value={text} disabled={disabled} maxLength={7}
                    onChange={(event) => {
                        setText(event.target.value);
                        if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase());
                    }} />
            </span>
        </label>
    );
};

const ImageSlot: React.FC<{
    label: string;
    path?: string;
    disabled?: boolean;
    onPick: (file: File) => Promise<void>;
    onClear: () => void;
}> = ({ label, path, disabled, onPick, onClear }) => {
    const { t } = useLanguage();
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    return (
        <div className="form-theme__image">
            <span className="form-builder__label">{label}</span>
            {path ? (
                <div className="form-theme__image-preview" style={{ backgroundImage: `url("${formAssetUrl(path)}")` }} />
            ) : null}
            <div className="form-theme__image-actions">
                <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
                    onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setBusy(true);
                        setFailed(false);
                        try { await onPick(file); } catch { setFailed(true); } finally {
                            setBusy(false);
                            if (ref.current) ref.current.value = '';
                        }
                    }} />
                <Button variant="secondary" size="sm" isLoading={busy} disabled={disabled} onClick={() => ref.current?.click()}>
                    {path ? t('forms.theme.replaceImage') : t('forms.theme.uploadImage')}
                </Button>
                {path && <Button variant="ghost" size="sm" disabled={disabled} onClick={onClear}>{t('forms.theme.removeImage')}</Button>}
            </div>
            {failed && <p className="form-builder__error">{t('forms.theme.uploadFailed')}</p>}
        </div>
    );
};

/** Design mode: presets for every plan, full theme (colours, background, font, shape, images) where the plan allows. */
export const ThemeEditor: React.FC<ThemeEditorProps> = ({ theme, onChange, fullTheme, onUpload }) => {
    const { t } = useLanguage();
    const set = (patch: Partial<FormTheme>) => onChange({ ...theme, ...patch });
    const contrast = themeContrastIssues(theme);
    const bg = theme.background;

    return (
        <div className="form-theme">
            <section className="form-theme__group">
                <h3>{t('forms.theme.presets')}</h3>
                <div className="form-theme__presets">
                    {FORM_THEME_PRESET_IDS.map((id) => {
                        const preset = presetTheme(id);
                        return (
                            <button key={id} type="button" className={`form-theme__preset${theme.preset === id ? ' is-selected' : ''}`}
                                aria-pressed={theme.preset === id}
                                onClick={() => onChange({ ...preset, logoPath: theme.logoPath, coverPath: theme.coverPath })}>
                                <span className="form-theme__swatch" style={formThemeStyle(preset)}>
                                    <span className="form-theme__swatch-card">
                                        <span className="form-theme__swatch-line" />
                                        <span className="form-theme__swatch-button" />
                                    </span>
                                </span>
                                <span>{t(`forms.theme.preset.${id}`)}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {!fullTheme && <p className="form-builder__upsell">{t('forms.plan.theme')}</p>}

            <fieldset className="form-theme__group" disabled={!fullTheme}>
                <h3>{t('forms.theme.colors')}</h3>
                <div className="form-theme__colors">
                    <ColorField label={t('forms.theme.surface')} value={theme.surface} onChange={(surface) => set({ surface })} />
                    <ColorField label={t('forms.theme.text')} value={theme.text} onChange={(text) => set({ text })} />
                    <ColorField label={t('forms.theme.accent')} value={theme.accent} onChange={(accent) => set({ accent })} />
                    <ColorField label={t('forms.theme.accentText')} value={theme.accentText} onChange={(accentText) => set({ accentText })} />
                </div>
                {contrast.length > 0 && (
                    <p className="form-builder__warning" role="status">
                        <span className="material-symbols-outlined" aria-hidden="true">contrast</span>
                        {contrast.map((issue) => t(`forms.theme.contrast.${issue}`)).join(' ')}
                    </p>
                )}
            </fieldset>

            <fieldset className="form-theme__group" disabled={!fullTheme}>
                <h3>{t('forms.theme.background')}</h3>
                <Select
                    value={bg.type}
                    onChange={(value) => {
                        const type = value as FormTheme['background']['type'];
                        if (type === 'color') set({ background: { type, color: bg.color || FORM_THEME_PRESETS[theme.preset || 'projectflow-light']?.surface || theme.surface } });
                        if (type === 'gradient') set({ background: { type, gradient: bg.gradient || { from: theme.surface, to: theme.accent, angle: 135 } } });
                        if (type === 'image') set({ background: { type, imagePath: bg.imagePath } });
                    }}
                    options={(['color', 'gradient', 'image'] as const).map((type) => ({ value: type, label: t(`forms.theme.bg.${type}`) }))}
                    disabled={!fullTheme}
                />
                {bg.type === 'color' && (
                    <ColorField label={t('forms.theme.bgColor')} value={bg.color || '#ffffff'} onChange={(color) => set({ background: { type: 'color', color } })} />
                )}
                {bg.type === 'gradient' && bg.gradient && (
                    <div className="form-theme__colors">
                        <ColorField label={t('forms.theme.from')} value={bg.gradient.from} onChange={(from) => set({ background: { type: 'gradient', gradient: { ...bg.gradient!, from } } })} />
                        <ColorField label={t('forms.theme.to')} value={bg.gradient.to} onChange={(to) => set({ background: { type: 'gradient', gradient: { ...bg.gradient!, to } } })} />
                        <label className="form-theme__color">
                            <span>{t('forms.theme.angle')}</span>
                            <input className="form-builder__input" type="number" min={0} max={360} value={bg.gradient.angle}
                                onChange={(event) => set({ background: { type: 'gradient', gradient: { ...bg.gradient!, angle: Math.max(0, Math.min(360, Number(event.target.value) || 0)) } } })} />
                        </label>
                    </div>
                )}
                {bg.type === 'image' && (
                    <ImageSlot label={t('forms.theme.bgImage')} path={bg.imagePath} disabled={!fullTheme}
                        onPick={async (file) => set({ background: { type: 'image', imagePath: await onUpload('background', file) } })}
                        onClear={() => set({ background: { type: 'image' } })} />
                )}
            </fieldset>

            <fieldset className="form-theme__group" disabled={!fullTheme}>
                <h3>{t('forms.theme.typeAndShape')}</h3>
                <div className="form-builder__grid">
                    <label className="form-builder__field">
                        <span>{t('forms.theme.font')}</span>
                        <Select value={theme.font} onChange={(font) => set({ font: String(font) })} disabled={!fullTheme}
                            options={FORM_FONTS.map((font) => ({ value: font.id, label: font.label }))} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.theme.radius')}</span>
                        <Select value={theme.radius} onChange={(radius) => set({ radius: Number(radius) as FormTheme['radius'] })} disabled={!fullTheme}
                            options={[0, 8, 16, 24].map((radius) => ({ value: radius, label: t(`forms.theme.radius.${radius}`) }))} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.theme.fieldStyle')}</span>
                        <Select value={theme.fieldStyle} onChange={(fieldStyle) => set({ fieldStyle: fieldStyle as FormTheme['fieldStyle'] })} disabled={!fullTheme}
                            options={(['sunken', 'filled', 'underline'] as const).map((style) => ({ value: style, label: t(`forms.theme.fieldStyle.${style}`) }))} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.theme.density')}</span>
                        <Select value={theme.density} onChange={(density) => set({ density: density as FormTheme['density'] })} disabled={!fullTheme}
                            options={(['comfortable', 'compact'] as const).map((density) => ({ value: density, label: t(`forms.theme.density.${density}`) }))} />
                    </label>
                </div>
            </fieldset>

            <fieldset className="form-theme__group form-theme__images" disabled={!fullTheme}>
                <h3>{t('forms.theme.images')}</h3>
                <ImageSlot label={t('forms.theme.logo')} path={theme.logoPath} disabled={!fullTheme}
                    onPick={async (file) => set({ logoPath: await onUpload('logo', file) })} onClear={() => set({ logoPath: undefined })} />
                <ImageSlot label={t('forms.theme.cover')} path={theme.coverPath} disabled={!fullTheme}
                    onPick={async (file) => set({ coverPath: await onUpload('cover', file) })} onClear={() => set({ coverPath: undefined })} />
            </fieldset>
        </div>
    );
};
