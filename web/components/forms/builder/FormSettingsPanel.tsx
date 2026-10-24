import React from 'react';

import { Select } from '../../common/Select/Select';
import { SettingsSwitch } from '../../settings/SettingsSwitch';
import { useLanguage } from '../../../context/LanguageContext';
import type { FormAudience, FormLanguage, FormSettings } from '../../../types/forms';
import { FORM_RETENTION_MONTHS, type FormQuota } from '../../../utils/formsLogic';

export interface FormSettingsValue {
    audience: FormAudience;
    anonymous: boolean;
    allowGuests: boolean;
    language: FormLanguage;
    settings: FormSettings;
}

interface FormSettingsPanelProps {
    value: FormSettingsValue;
    onChange: (patch: Partial<FormSettingsValue>) => void;
    quota: FormQuota | null;
}

const dateInput = (ms: number | null | undefined) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

const SwitchRow: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }> = ({ label, hint, checked, onChange, disabled }) => (
    <div className="form-builder__switch-row">
        <span>
            {label}
            {hint && <small>{hint}</small>}
        </span>
        <SettingsSwitch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
);

/** Settings mode: audience, language, confirmation, limits, retention, privacy text, branding. */
export const FormSettingsPanel: React.FC<FormSettingsPanelProps> = ({ value, onChange, quota }) => {
    const { t } = useLanguage();
    const settings = value.settings;
    const setSettings = (patch: Partial<FormSettings>) => onChange({ settings: { ...settings, ...patch } });
    const workspaceAllowed = !!quota?.workspaceAudience;

    return (
        <div className="form-settings">
            <section className="form-settings__group">
                <h3>{t('forms.settings.audience')}</h3>
                <div className="form-settings__choices" role="radiogroup" aria-label={t('forms.settings.audience')}>
                    {(['public', 'workspace'] as const).map((audience) => {
                        const disabled = audience === 'workspace' && !workspaceAllowed && value.audience !== 'workspace';
                        return (
                            <button key={audience} type="button" role="radio" aria-checked={value.audience === audience}
                                className={`form-settings__choice${value.audience === audience ? ' is-selected' : ''}`}
                                disabled={disabled} onClick={() => onChange({ audience })}>
                                <span className="material-symbols-outlined" aria-hidden="true">{audience === 'public' ? 'public' : 'groups'}</span>
                                <strong>{t(`forms.settings.audience.${audience}`)}</strong>
                                <small>{disabled ? t('forms.plan.workspaceAudience') : t(`forms.settings.audience.${audience}.hint`)}</small>
                            </button>
                        );
                    })}
                </div>
                {value.audience === 'workspace' && (
                    <>
                        <SwitchRow label={t('forms.settings.anonymous')} hint={t('forms.settings.anonymous.hint')} checked={value.anonymous} onChange={(anonymous) => onChange({ anonymous })} />
                        <SwitchRow label={t('forms.settings.onePerMember')} checked={!!settings.onePerMember} onChange={(onePerMember) => setSettings({ onePerMember })} />
                        <SwitchRow label={t('forms.settings.allowGuests')} checked={value.allowGuests} onChange={(allowGuests) => onChange({ allowGuests })} />
                    </>
                )}
                <label className="form-builder__field form-builder__field--narrow">
                    <span>{t('forms.settings.language')}</span>
                    <Select value={value.language} onChange={(language) => onChange({ language: language as FormLanguage })}
                        options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} />
                </label>
            </section>

            <section className="form-settings__group">
                <h3>{t('forms.settings.after')}</h3>
                <label className="form-builder__field">
                    <span>{t('forms.settings.confirmationText')}</span>
                    <textarea className="form-builder__input form-builder__input--area" rows={3} maxLength={1000}
                        placeholder={t('forms.settings.confirmationPlaceholder')}
                        value={settings.confirmation?.text || ''}
                        onChange={(event) => setSettings({ confirmation: { ...settings.confirmation, text: event.target.value || undefined } })} />
                </label>
                <label className="form-builder__field">
                    <span>{t('forms.settings.redirectUrl')}</span>
                    <input className="form-builder__input" type="url" placeholder="https://" maxLength={500}
                        value={settings.confirmation?.redirectUrl || ''}
                        onChange={(event) => setSettings({ confirmation: { ...settings.confirmation, redirectUrl: event.target.value || undefined } })} />
                </label>
            </section>

            <section className="form-settings__group">
                <h3>{t('forms.settings.limits')}</h3>
                <div className="form-builder__grid">
                    <label className="form-builder__field">
                        <span>{t('forms.settings.closesAt')}</span>
                        <input className="form-builder__input" type="datetime-local" value={dateInput(settings.closesAt)}
                            onChange={(event) => setSettings({ closesAt: event.target.value ? new Date(event.target.value).getTime() : null })} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.settings.maxResponses')}</span>
                        <input className="form-builder__input" type="number" min={1} value={settings.maxResponses ?? ''}
                            onChange={(event) => setSettings({ maxResponses: event.target.value ? Math.max(1, Math.floor(Number(event.target.value))) : null })} />
                    </label>
                </div>
            </section>

            <section className="form-settings__group">
                <h3>{t('forms.settings.privacy')}</h3>
                <label className="form-builder__field form-builder__field--narrow">
                    <span>{t('forms.settings.retention')}</span>
                    <Select
                        value={settings.retentionMonths === null ? 'keep' : String(settings.retentionMonths ?? 12)}
                        onChange={(retention) => setSettings({ retentionMonths: retention === 'keep' ? null : Number(retention) })}
                        options={[
                            ...FORM_RETENTION_MONTHS.map((months) => ({ value: String(months), label: t('forms.settings.retentionMonths').replace('{n}', String(months)) })),
                            { value: 'keep', label: t('forms.settings.retentionKeep') }
                        ]}
                    />
                </label>
                <label className="form-builder__field">
                    <span>{t('forms.settings.privacyText')}</span>
                    <textarea className="form-builder__input form-builder__input--area" rows={2} maxLength={1000}
                        placeholder={t('forms.settings.privacyTextPlaceholder')}
                        value={settings.consent?.text || ''}
                        onChange={(event) => setSettings({ consent: event.target.value ? { text: event.target.value, url: settings.consent?.url } : null })} />
                </label>
                <p className="form-builder__muted">{t('forms.settings.privacyHint')}</p>
            </section>

            <section className="form-settings__group">
                <h3>{t('forms.settings.branding')}</h3>
                <SwitchRow label={t('forms.settings.hideBranding')} hint={quota?.removeBranding ? undefined : t('forms.plan.branding')}
                    checked={!!settings.hideBranding} disabled={!quota?.removeBranding}
                    onChange={(hideBranding) => setSettings({ hideBranding })} />
            </section>
        </div>
    );
};
