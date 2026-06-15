import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { BareNumberInput } from '../common/Input/NumberInput';
import { MediaLibrary } from '../MediaLibrary/MediaLibraryModal';
import { useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { getBillingSettings, saveBillingSettings } from '../../services/domain/invoiceService';
import { defaultBillingSettings } from './invoiceDefaults';
import type { BillingSettings } from '../../types';

interface BillingSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    onSaved?: (settings: BillingSettings) => void;
}

export const BillingSettingsModal: React.FC<BillingSettingsModalProps> = ({ isOpen, onClose, projectId, onSaved }) => {
    const { t } = useLanguage();
    const { showError, showSuccess } = useToast();
    const [settings, setSettings] = useState<BillingSettings>(defaultBillingSettings());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [logoModalOpen, setLogoModalOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        getBillingSettings()
            .then(loaded => {
                const base = defaultBillingSettings();
                setSettings(loaded ? { ...base, ...loaded, issuer: { ...base.issuer, ...loaded.issuer }, bank: { ...base.bank, ...loaded.bank } } : base);
            })
            .catch(() => setSettings(defaultBillingSettings()))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const setIssuer = (patch: Partial<NonNullable<BillingSettings['issuer']>>) =>
        setSettings(s => ({ ...s, issuer: { ...(s.issuer || { name: '' }), ...patch } }));
    const setBank = (patch: Partial<NonNullable<BillingSettings['bank']>>) =>
        setSettings(s => ({ ...s, bank: { ...(s.bank || {}), ...patch } }));

    const handleSave = async () => {
        if (!settings.issuer?.name?.trim()) {
            showError(t('invoice.settings.error.name', 'Bitte gib einen Absendernamen an.'));
            return;
        }
        setSaving(true);
        try {
            await saveBillingSettings(settings);
            showSuccess(t('invoice.settings.saved', 'Rechnungs-Einstellungen gespeichert.'));
            onSaved?.(settings);
            onClose();
        } catch (e) {
            showError(t('invoice.settings.error.save', 'Speichern fehlgeschlagen.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={t('invoice.settings.title', 'Rechnungs-Einstellungen')}
                size="lg"
                footer={(
                    <div className="inv-modal-footer">
                        <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Abbrechen')}</Button>
                        <Button variant="primary" onClick={handleSave} isLoading={saving}>{t('common.save', 'Speichern')}</Button>
                    </div>
                )}
            >
                {loading ? (
                    <div className="inv-settings__loading">{t('common.loading', 'Wird geladen…')}</div>
                ) : (
                    <div className="inv-settings">
                        <section className="inv-settings__section">
                            <h4>{t('invoice.settings.logo', 'Logo')}</h4>
                            <div className="inv-settings__logo-row">
                                {settings.logoUrl
                                    ? <img className="inv-settings__logo" src={settings.logoUrl} alt="" />
                                    : <div className="inv-settings__logo inv-settings__logo--empty">Logo</div>}
                                <div className="inv-settings__logo-actions">
                                    <Button variant="secondary" size="sm" onClick={() => setLogoModalOpen(true)}>
                                        {t('invoice.settings.chooseLogo', 'Logo auswählen')}
                                    </Button>
                                    {settings.logoUrl && (
                                        <Button variant="ghost" size="sm" onClick={() => setSettings(s => ({ ...s, logoUrl: '', logoFileId: '' }))}>
                                            {t('common.remove', 'Entfernen')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="inv-settings__section">
                            <h4>{t('invoice.settings.issuer', 'Absender')}</h4>
                            <div className="inv-grid">
                                <label className="inv-field inv-field--wide">
                                    <span>{t('invoice.field.name', 'Name / Firma')}</span>
                                    <input value={settings.issuer?.name || ''} onChange={e => setIssuer({ name: e.target.value })} />
                                </label>
                                <label className="inv-field inv-field--wide">
                                    <span>{t('invoice.field.street', 'Straße & Nr.')}</span>
                                    <input value={settings.issuer?.addressLine1 || ''} onChange={e => setIssuer({ addressLine1: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.zip', 'PLZ')}</span>
                                    <input value={settings.issuer?.zip || ''} onChange={e => setIssuer({ zip: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.city', 'Ort')}</span>
                                    <input value={settings.issuer?.city || ''} onChange={e => setIssuer({ city: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.country', 'Land')}</span>
                                    <input value={settings.issuer?.country || ''} onChange={e => setIssuer({ country: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.email', 'E-Mail')}</span>
                                    <input value={settings.issuer?.email || ''} onChange={e => setIssuer({ email: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.phone', 'Telefon')}</span>
                                    <input value={settings.issuer?.phone || ''} onChange={e => setIssuer({ phone: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.website', 'Website')}</span>
                                    <input value={settings.issuer?.website || ''} onChange={e => setIssuer({ website: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.taxNumber', 'Steuernummer')}</span>
                                    <input value={settings.issuer?.taxNumber || ''} onChange={e => setIssuer({ taxNumber: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.vatId', 'USt-IdNr.')}</span>
                                    <input value={settings.issuer?.vatId || ''} onChange={e => setIssuer({ vatId: e.target.value })} />
                                </label>
                            </div>
                        </section>

                        <section className="inv-settings__section">
                            <h4>{t('invoice.settings.bank', 'Bankverbindung')}</h4>
                            <div className="inv-grid">
                                <label className="inv-field inv-field--wide">
                                    <span>{t('invoice.field.accountHolder', 'Kontoinhaber')}</span>
                                    <input value={settings.bank?.accountHolder || ''} onChange={e => setBank({ accountHolder: e.target.value })} />
                                </label>
                                <label className="inv-field inv-field--wide">
                                    <span>{t('invoice.field.bankName', 'Bank')}</span>
                                    <input value={settings.bank?.bankName || ''} onChange={e => setBank({ bankName: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>IBAN</span>
                                    <input value={settings.bank?.iban || ''} onChange={e => setBank({ iban: e.target.value })} />
                                </label>
                                <label className="inv-field">
                                    <span>BIC</span>
                                    <input value={settings.bank?.bic || ''} onChange={e => setBank({ bic: e.target.value })} />
                                </label>
                            </div>
                        </section>

                        <section className="inv-settings__section">
                            <h4>{t('invoice.settings.defaults', 'Standardwerte')}</h4>
                            <div className="inv-grid">
                                <label className="inv-field">
                                    <span>{t('invoice.field.numberPrefix', 'Rechnungsnr.-Präfix')}</span>
                                    <input value={settings.invoiceNumberPrefix || ''} onChange={e => setSettings(s => ({ ...s, invoiceNumberPrefix: e.target.value }))} placeholder="RE-{YYYY}-" />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.nextNumber', 'Nächste Nummer')}</span>
                                    <BareNumberInput emptyValue={1} value={settings.nextInvoiceNumber ?? 1} onValueChange={v => setSettings(s => ({ ...s, nextInvoiceNumber: v }))} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.defaultVat', 'Standard-USt %')}</span>
                                    <BareNumberInput value={settings.defaultVatRate ?? 19} onValueChange={v => setSettings(s => ({ ...s, defaultVatRate: v }))} />
                                </label>
                                <label className="inv-field">
                                    <span>{t('invoice.field.paymentTerms', 'Zahlungsziel (Tage)')}</span>
                                    <BareNumberInput value={settings.defaultPaymentTermsDays ?? 14} onValueChange={v => setSettings(s => ({ ...s, defaultPaymentTermsDays: v }))} />
                                </label>
                                <label className="inv-field inv-field--check inv-field--wide">
                                    <input type="checkbox" checked={!!settings.smallBusiness} onChange={e => setSettings(s => ({ ...s, smallBusiness: e.target.checked }))} />
                                    <span>{t('invoice.field.smallBusiness', 'Kleinunternehmer (§ 19 UStG – keine USt ausweisen)')}</span>
                                </label>
                                <label className="inv-field inv-field--wide">
                                    <span>{t('invoice.field.defaultNotes', 'Standard-Zahlungshinweis')}</span>
                                    <textarea rows={2} value={settings.defaultNotes || ''} onChange={e => setSettings(s => ({ ...s, defaultNotes: e.target.value }))} />
                                </label>
                            </div>
                        </section>

                        <section className="inv-settings__section">
                            <h4>{t('invoice.settings.footer', 'Footer')}</h4>
                            <label className="inv-field inv-field--wide">
                                <span>{t('invoice.field.footerText', 'Footer-Text (z. B. Hinweise, Gerichtsstand)')}</span>
                                <textarea rows={3} value={settings.footerText || ''} onChange={e => setSettings(s => ({ ...s, footerText: e.target.value }))} />
                            </label>
                        </section>
                    </div>
                )}
            </Modal>

            <MediaLibrary
                isOpen={logoModalOpen}
                onClose={() => setLogoModalOpen(false)}
                onSelect={(asset) => {
                    setSettings(s => ({ ...s, logoUrl: asset.url, logoFileId: asset.managedFileId || asset.id }));
                    setLogoModalOpen(false);
                }}
                projectId={projectId}
                storagePath="invoices/logos"
            />
        </>
    );
};
