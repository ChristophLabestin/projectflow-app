import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../common/Button/Button';
import { Modal } from '../common/Modal/Modal';
import { TextInput } from '../common/Input/TextInput';
import { NumberInput } from '../common/Input/NumberInput';
import { TextArea } from '../common/Input/TextArea';
import { Checkbox } from '../common/Checkbox/Checkbox';
import { Select } from '../common/Select/Select';
import { DatePicker } from '../common/DateTime/DatePicker';
import { MediaLibrary } from '../MediaLibrary/MediaLibraryModal';
import { useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Invoice, InvoiceLineItem, InvoiceAppendixRow, InvoiceParty } from '../../types';
import { InvoicePreview } from './InvoicePreview';
import { EffortImportModal } from './EffortImportModal';
import { blankAppendixRow, blankLineItem } from './invoiceDefaults';
import { computeInvoiceTotals, formatCurrency, lineItemTotal } from '../../utils/invoiceCalc';
import { downloadInvoicePdf } from '../../utils/invoicePdf';
import { createInvoice, reserveNextInvoiceNumber, updateInvoice } from '../../services/domain/invoiceService';
import { updateProjectFields } from '../../services/domain/projectAdminService';
import { getActiveTenantId } from '../../services/domain/authService';

interface InvoiceBuilderProps {
    projectId: string;
    initialInvoice: Invoice;
    savedCustomer?: InvoiceParty | null;
    previewNumber?: string;
    onClose: () => void;
    onSaved?: (invoice: Invoice) => void;
    onCustomerSaved?: (customer: InvoiceParty) => void;
}

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.7;
const ZOOM_STEP = 0.1;

const LINE_ITEM_UNITS = ['h', 'min', 'Tag', 'Stück', 'Pauschal', 'km', 'Monat', 'Mio. Tokens'];
const unitOptions = (current?: string) => {
    const base = [...LINE_ITEM_UNITS];
    if (current && !base.includes(current)) base.unshift(current);
    return base.map(u => ({ label: u, value: u }));
};

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ projectId, initialInvoice, savedCustomer, previewNumber, onClose, onSaved, onCustomerSaved }) => {
    const { t } = useLanguage();
    const { showError, showSuccess } = useToast();
    const [inv, setInv] = useState<Invoice>(initialInvoice);
    const [savedAddress, setSavedAddress] = useState<InvoiceParty | null>(savedCustomer || null);
    const [savingAddress, setSavingAddress] = useState(false);
    const [saving, setSaving] = useState(false);
    const [finalising, setFinalising] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [logoModalOpen, setLogoModalOpen] = useState(false);
    const [effortModalOpen, setEffortModalOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [confirmFinalise, setConfirmFinalise] = useState(false);
    const steps = [
        t('invoice.wizard.customer', 'Kunde & Daten'),
        t('invoice.wizard.items', 'Positionen'),
        t('invoice.wizard.details', 'Steuer & Layout')
    ];

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !logoModalOpen && !effortModalOpen) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    }, [onClose, logoModalOpen, effortModalOpen]);

    const totals = computeInvoiceTotals(inv);
    const isFinalised = inv.status !== 'draft' && Boolean(inv.number);
    const locked = isFinalised; // festgeschrieben: Inhalt unveränderbar (GoBD)

    const update = (patch: Partial<Invoice>) => setInv(prev => ({ ...prev, ...patch }));
    const setCustomer = (patch: Partial<Invoice['customer']>) => setInv(prev => ({ ...prev, customer: { ...prev.customer, ...patch } }));
    const updateItem = (id: string, patch: Partial<InvoiceLineItem>) =>
        setInv(prev => ({ ...prev, items: prev.items.map(it => it.id === id ? { ...it, ...patch } : it) }));
    const addItem = () => setInv(prev => ({ ...prev, items: [...prev.items, blankLineItem()] }));
    const addItems = (extra: InvoiceLineItem[], appendix?: InvoiceAppendixRow[], effortEntryIds?: string[]) => setInv(prev => {
        const existing = prev.items.filter(it => it.name.trim() || (it.description || '').trim() || it.unitPrice || it.fixedPrice);
        const next: Invoice = { ...prev, items: [...existing, ...extra] };
        if (appendix && appendix.length) {
            next.appendix = [...(prev.appendix || []), ...appendix];
            next.appendixTitle = prev.appendixTitle || t('invoice.appendix.defaultTitle', 'Leistungsnachweis');
        }
        if (effortEntryIds && effortEntryIds.length) {
            next.effortEntryIds = Array.from(new Set([...(prev.effortEntryIds || []), ...effortEntryIds]));
        }
        return next;
    });
    const removeItem = (id: string) => setInv(prev => ({ ...prev, items: prev.items.filter(it => it.id !== id) }));
    const moveItem = (id: string, dir: -1 | 1) => setInv(prev => {
        const idx = prev.items.findIndex(it => it.id === id);
        const ni = idx + dir;
        if (idx < 0 || ni < 0 || ni >= prev.items.length) return prev;
        const items = [...prev.items];
        [items[idx], items[ni]] = [items[ni], items[idx]];
        return { ...prev, items };
    });

    // Appendix (Einzelnachweis) — editable detail rows shown from page 2.
    const defaultAppendixTitle = () => t('invoice.appendix.defaultTitle', 'Leistungsnachweis');
    const addAppendix = () => setInv(prev => ({
        ...prev,
        appendix: prev.appendix?.length ? prev.appendix : [blankAppendixRow(prev.issueDate)],
        appendixTitle: prev.appendixTitle || defaultAppendixTitle()
    }));
    const addAppendixRow = () => setInv(prev => ({
        ...prev,
        appendix: [...(prev.appendix || []), blankAppendixRow(prev.issueDate)],
        appendixTitle: prev.appendixTitle || defaultAppendixTitle()
    }));
    const updateAppendixRow = (id: string, patch: Partial<InvoiceAppendixRow>) =>
        setInv(prev => ({ ...prev, appendix: (prev.appendix || []).map(r => r.id === id ? { ...r, ...patch } : r) }));
    const removeAppendixRow = (id: string) =>
        setInv(prev => ({ ...prev, appendix: (prev.appendix || []).filter(r => r.id !== id) }));
    const removeAppendix = () => setInv(prev => ({ ...prev, appendix: undefined, appendixTitle: undefined }));

    const zoomBy = (d: number) => setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + d) * 10) / 10)));

    const toDate = (s?: string) => (s ? new Date(`${s}T00:00:00`) : null);
    const toIso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');

    const persist = async (overrides?: Partial<Invoice>): Promise<Invoice> => {
        const next = { ...inv, ...overrides };
        if (next.id) {
            const { id, createdAt, updatedAt, ...rest } = next;
            await updateInvoice(projectId, id, rest);
            setInv(next);
            return next;
        }
        const { id, createdAt, updatedAt, ...rest } = next;
        const newId = await createInvoice(projectId, rest);
        const saved = { ...next, id: newId };
        setInv(saved);
        return saved;
    };

    const handleSave = async () => {
        if (locked) return; // festgeschrieben — keine Änderungen mehr
        setSaving(true);
        try {
            const saved = await persist();
            showSuccess(t('invoice.toast.saved', 'Rechnung gespeichert.'));
            onSaved?.(saved);
        } catch (e) {
            showError(t('invoice.toast.saveError', 'Speichern fehlgeschlagen.'));
        } finally {
            setSaving(false);
        }
    };

    // Persist the customer address on the client project so it pre-fills next time.
    const handleSaveAddress = async () => {
        const customer = inv.customer;
        if (!customer?.name?.trim()) {
            showError(t('invoice.error.customer', 'Bitte trage einen Kundennamen ein.'));
            return;
        }
        setSavingAddress(true);
        try {
            await updateProjectFields(projectId, { billingCustomer: customer });
            setSavedAddress(customer);
            onCustomerSaved?.(customer);
            showSuccess(t('invoice.toast.addressSaved', 'Adressdaten im Projekt gespeichert.'));
        } catch {
            showError(t('invoice.toast.addressSaveError', 'Adressdaten konnten nicht gespeichert werden.'));
        } finally {
            setSavingAddress(false);
        }
    };

    const handleLoadAddress = () => {
        if (!savedAddress?.name) return;
        setCustomer({ ...savedAddress });
        showSuccess(t('invoice.toast.addressLoaded', 'Gespeicherte Adresse eingefügt.'));
    };

    // Validate § 14 UStG mandatory data before allowing festschreibung.
    const requestFinalise = () => {
        if (!inv.customer?.name?.trim()) {
            showError(t('invoice.error.customer', 'Bitte trage einen Kundennamen ein.'));
            setStep(0);
            return;
        }
        if (!inv.items.length || inv.items.every(i => !i.name.trim())) {
            showError(t('invoice.error.items', 'Bitte füge mindestens eine Position hinzu.'));
            setStep(1);
            return;
        }
        if (!inv.issuer?.taxNumber?.trim() && !inv.issuer?.vatId?.trim()) {
            showError(t('invoice.error.issuerTax', 'Es fehlt deine Steuernummer oder USt-IdNr. (Rechnungs-Einstellungen).'));
            return;
        }
        setConfirmFinalise(true);
    };

    const doFinalise = async () => {
        setConfirmFinalise(false);
        setFinalising(true);
        try {
            const number = await reserveNextInvoiceNumber();
            // Leistungsdatum ist Pflicht (§ 14 UStG) — fehlt es, entspricht es dem Rechnungsdatum.
            const serviceDate = inv.serviceDate || inv.issueDate;
            const saved = await persist({ number, status: 'sent', serviceDate });
            showSuccess(t('invoice.toast.finalised', 'Rechnung finalisiert: {n}').replace('{n}', number));
            onSaved?.(saved);
        } catch (e) {
            showError(t('invoice.toast.finaliseError', 'Finalisieren fehlgeschlagen.'));
        } finally {
            setFinalising(false);
        }
    };

    const markStatus = async (status: Invoice['status']) => {
        try {
            const saved = await persist({ status });
            onSaved?.(saved);
        } catch {
            showError(t('invoice.toast.saveError', 'Speichern fehlgeschlagen.'));
        }
    };

    const handleDownload = async () => {
        setDownloading(true);
        try {
            // Drafts get the predicted (not yet reserved) number on the PDF for reference.
            await downloadInvoicePdf(inv.number ? inv : { ...inv, number: previewNumber || '' });
        } catch (e) {
            showError(t('invoice.toast.pdfError', 'PDF konnte nicht erstellt werden.'));
        } finally {
            setDownloading(false);
        }
    };

    return createPortal(
        <div className="inv-modal-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="inv-builder">
                <div className="inv-builder__bar">
                    <button type="button" className="inv-builder__back" onClick={onClose} aria-label={t('common.close', 'Schließen')}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <div className="inv-builder__bar-title">
                        {(inv.number || previewNumber)
                            ? `${t('invoice.title', 'Rechnung')} ${inv.number || previewNumber}`
                            : t('invoice.builder.newTitle', 'Neue Rechnung')}
                        {!isFinalised && <span className="inv-badge inv-badge--draft">{t('invoice.status.draft', 'Entwurf')}</span>}
                        {inv.status === 'sent' && <span className="inv-badge inv-badge--sent">{t('invoice.status.sent', 'Finalisiert')}</span>}
                        {inv.status === 'paid' && <span className="inv-badge inv-badge--paid">{t('invoice.status.paid', 'Bezahlt')}</span>}
                        {inv.status === 'canceled' && <span className="inv-badge inv-badge--canceled">{t('invoice.status.canceled', 'Storniert')}</span>}
                        {locked && <span className="inv-lock-hint"><span className="material-symbols-outlined">lock</span>{t('invoice.locked.badge', 'Festgeschrieben')}</span>}
                    </div>
                    <div className="inv-builder__bar-actions">
                        <Button variant="secondary" onClick={handleDownload} isLoading={downloading} icon={<span className="material-symbols-outlined">picture_as_pdf</span>}>
                            {t('invoice.builder.downloadPdf', 'PDF')}
                        </Button>
                        {!locked && (
                            <>
                                <Button variant="ghost" onClick={handleSave} isLoading={saving}>
                                    {t('common.save', 'Speichern')}
                                </Button>
                                <Button variant="primary" onClick={requestFinalise} isLoading={finalising}>
                                    {t('invoice.builder.finalise', 'Finalisieren')}
                                </Button>
                            </>
                        )}
                        {inv.status === 'sent' && (
                            <>
                                <Button variant="ghost" onClick={() => markStatus('canceled')}>{t('invoice.builder.cancelInvoice', 'Stornieren')}</Button>
                                <Button variant="primary" onClick={() => markStatus('paid')}>{t('invoice.builder.markPaid', 'Als bezahlt')}</Button>
                            </>
                        )}
                    </div>
                </div>

                {locked && (
                    <div className="inv-builder__lockbar">
                        <span className="material-symbols-outlined">lock</span>
                        {t('invoice.locked.notice', 'Diese Rechnung ist festgeschrieben und kann gemäß GoBD inhaltlich nicht mehr geändert werden. Korrekturen erfolgen über eine Storno-/Korrekturrechnung.')}
                    </div>
                )}

                <div className="inv-builder__split">
                    <div className="inv-builder__form">
                        <div className="inv-wizard__steps">
                            {steps.map((label, i) => (
                                <button
                                    type="button"
                                    key={label}
                                    className={`inv-wizard__step ${step === i ? 'is-active' : ''} ${step > i ? 'is-done' : ''}`}
                                    onClick={() => setStep(i)}
                                >
                                    <span className="inv-wizard__num">{step > i ? <span className="material-symbols-outlined">check</span> : i + 1}</span>
                                    <span className="inv-wizard__label">{label}</span>
                                </button>
                            ))}
                        </div>

                        <div className={`inv-wizard__body ${locked ? 'is-locked' : ''}`}>
                            {step === 0 && (
                                <>
                                    <section className="inv-step">
                                        <h3 className="inv-step__title">{t('invoice.section.customer', 'Kundenanschrift')}</h3>

                                        <div className={`inv-addr-bar ${savedAddress?.name ? 'is-saved' : ''}`}>
                                            <span className="inv-addr-bar__icon material-symbols-outlined">{savedAddress?.name ? 'contact_page' : 'bookmark_add'}</span>
                                            <div className="inv-addr-bar__text">
                                                {savedAddress?.name ? (
                                                    <>
                                                        <span className="inv-addr-bar__label">{t('invoice.address.savedLabel', 'Gespeicherte Anschrift')}</span>
                                                        <span className="inv-addr-bar__name">{savedAddress.name}</span>
                                                    </>
                                                ) : (
                                                    <span className="inv-addr-bar__hint">{t('invoice.address.noneHint', 'Anschrift am Projekt sichern, um sie nicht erneut einzugeben.')}</span>
                                                )}
                                            </div>
                                            <div className="inv-addr-bar__actions">
                                                {savedAddress?.name && (
                                                    <button type="button" className="inv-addr-bar__btn" onClick={handleLoadAddress}>
                                                        {t('invoice.address.load', 'Einfügen')}
                                                    </button>
                                                )}
                                                <button type="button" className="inv-addr-bar__btn inv-addr-bar__btn--primary" onClick={handleSaveAddress} disabled={savingAddress}>
                                                    {savingAddress
                                                        ? <span className="material-symbols-outlined inv-addr-bar__spin">progress_activity</span>
                                                        : <span className="material-symbols-outlined">bookmark</span>}
                                                    {t('invoice.address.save', 'Speichern')}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="inv-fields">
                                            <TextInput label={t('invoice.field.customerName', 'Name / Firma')} value={inv.customer.name} onChange={e => setCustomer({ name: e.target.value })} />
                                            <TextInput label={t('invoice.field.contactPerson', 'Ansprechpartner (optional)')} value={inv.customer.contactPerson || ''} onChange={e => setCustomer({ contactPerson: e.target.value })} />
                                            <TextInput label={t('invoice.field.street', 'Straße & Nr.')} value={inv.customer.addressLine1 || ''} onChange={e => setCustomer({ addressLine1: e.target.value })} />
                                            <TextInput label={t('invoice.field.addressLine2', 'Adresszusatz')} value={inv.customer.addressLine2 || ''} onChange={e => setCustomer({ addressLine2: e.target.value })} />
                                            <div className="inv-fields inv-fields--2">
                                                <TextInput label={t('invoice.field.zip', 'PLZ')} value={inv.customer.zip || ''} onChange={e => setCustomer({ zip: e.target.value })} />
                                                <TextInput label={t('invoice.field.city', 'Ort')} value={inv.customer.city || ''} onChange={e => setCustomer({ city: e.target.value })} />
                                            </div>
                                            <TextInput label={t('invoice.field.country', 'Land')} value={inv.customer.country || ''} onChange={e => setCustomer({ country: e.target.value })} />
                                            <div className="inv-fields inv-fields--2">
                                                <TextInput label={t('invoice.field.customerNumber', 'Kundennummer (optional)')} value={inv.customer.customerNumber || ''} onChange={e => setCustomer({ customerNumber: e.target.value })} />
                                                <TextInput label={t('invoice.field.customerVatId', 'USt-IdNr. (optional)')} value={inv.customer.vatId || ''} onChange={e => setCustomer({ vatId: e.target.value })} />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="inv-step">
                                        <h3 className="inv-step__title">{t('invoice.section.meta', 'Rechnungsdaten')}</h3>
                                        <div className="inv-fields">
                                            <div className="inv-fields inv-fields--2">
                                                <DatePicker label={t('invoice.field.issueDate', 'Rechnungsdatum')} value={toDate(inv.issueDate)} onChange={d => update({ issueDate: toIso(d) })} />
                                                <DatePicker label={t('invoice.field.dueDate', 'Fällig bis')} value={toDate(inv.dueDate)} onChange={d => update({ dueDate: toIso(d) })} />
                                            </div>
                                            <div className="inv-fields inv-fields--2">
                                                <DatePicker label={t('invoice.field.serviceDate', 'Leistung von')} value={toDate(inv.serviceDate)} onChange={d => update({ serviceDate: toIso(d) })} />
                                                <DatePicker label={t('invoice.field.serviceDateEnd', 'Leistung bis (optional)')} value={toDate(inv.serviceDateEnd)} onChange={d => update({ serviceDateEnd: toIso(d) })} />
                                            </div>
                                            <TextArea rows={2} label={t('invoice.field.introText', 'Einleitungstext')} value={inv.introText || ''} onChange={e => update({ introText: e.target.value })} placeholder={t('invoice.field.introPlaceholder', 'z. B. Vielen Dank für Ihren Auftrag …')} />
                                        </div>
                                    </section>
                                </>
                            )}

                            {step === 1 && (
                                <>
                                    <section className="inv-step">
                                        <div className="inv-step__header">
                                            <div className="inv-step__heading">
                                                <h3 className="inv-step__title">{t('invoice.section.items', 'Rechnungspositionen')}</h3>
                                                <p className="inv-step__sub">{t('invoice.items.hint', 'Diese Positionen erscheinen auf der Rechnung (Seite 1).')}</p>
                                            </div>
                                            <div className="inv-step__actions">
                                                <Button variant="ghost" size="sm" onClick={() => setEffortModalOpen(true)} icon={<span className="material-symbols-outlined">schedule</span>}>
                                                    {t('invoice.items.fromEffort', 'Aufwand übernehmen')}
                                                </Button>
                                                <Button variant="primary" size="sm" onClick={addItem} icon={<span className="material-symbols-outlined">add</span>}>
                                                    {t('invoice.items.add', 'Position')}
                                                </Button>
                                            </div>
                                        </div>

                                        {inv.items.length === 0 ? (
                                            <div className="inv-pos-empty">
                                                <span className="material-symbols-outlined">receipt_long</span>
                                                <p>{t('invoice.items.empty', 'Noch keine Positionen.')}</p>
                                                <div className="inv-pos-empty__actions">
                                                    <Button variant="secondary" size="sm" onClick={addItem} icon={<span className="material-symbols-outlined">add</span>}>{t('invoice.items.add', 'Position')}</Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setEffortModalOpen(true)} icon={<span className="material-symbols-outlined">schedule</span>}>{t('invoice.items.fromEffort', 'Aufwand übernehmen')}</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="inv-pos-list">
                                                {inv.items.map((item, idx) => (
                                                    <div className="inv-posx" key={item.id}>
                                                        <div className="inv-posx__head">
                                                            <span className="inv-posx__idx">{idx + 1}</span>
                                                            <input
                                                                className="inv-posx__name"
                                                                value={item.name}
                                                                placeholder={t('invoice.field.itemName', 'Bezeichnung')}
                                                                onChange={e => updateItem(item.id, { name: e.target.value })}
                                                            />
                                                            <span className="inv-posx__sum">{formatCurrency(lineItemTotal(item), inv.currency)}</span>
                                                            <div className="inv-posx__tools">
                                                                <button type="button" className="inv-posx__tool" disabled={idx === 0} onClick={() => moveItem(item.id, -1)} aria-label={t('common.moveUp', 'Nach oben')}>
                                                                    <span className="material-symbols-outlined">arrow_upward</span>
                                                                </button>
                                                                <button type="button" className="inv-posx__tool" disabled={idx === inv.items.length - 1} onClick={() => moveItem(item.id, 1)} aria-label={t('common.moveDown', 'Nach unten')}>
                                                                    <span className="material-symbols-outlined">arrow_downward</span>
                                                                </button>
                                                                <button type="button" className="inv-posx__tool inv-posx__tool--danger" onClick={() => removeItem(item.id)} aria-label={t('common.delete', 'Löschen')}>
                                                                    <span className="material-symbols-outlined">delete</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <TextArea rows={2} value={item.description || ''} placeholder={t('invoice.field.itemDescription', 'Beschreibung (optional)')} onChange={e => updateItem(item.id, { description: e.target.value })} />

                                                        <div className="inv-seg inv-seg--mini" role="tablist">
                                                            <button type="button" className={`inv-seg__btn ${!item.useFixedPrice ? 'is-active' : ''}`} onClick={() => updateItem(item.id, { useFixedPrice: false })}>
                                                                {t('invoice.priceMode.qty', 'Menge × Preis')}
                                                            </button>
                                                            <button type="button" className={`inv-seg__btn ${item.useFixedPrice ? 'is-active' : ''}`} onClick={() => updateItem(item.id, { useFixedPrice: true })}>
                                                                {t('invoice.priceMode.fixed', 'Pauschal')}
                                                            </button>
                                                        </div>

                                                        {item.useFixedPrice ? (
                                                            <div className="inv-fields inv-fields--2">
                                                                <NumberInput label={t('invoice.field.fixedPrice', 'Festpreis (netto)')} value={item.fixedPrice ?? 0} onValueChange={v => updateItem(item.id, { fixedPrice: v })} />
                                                            </div>
                                                        ) : (
                                                            <div className="inv-fields inv-fields--3">
                                                                <NumberInput label={t('invoice.field.quantity', 'Menge')} value={item.quantity} onValueChange={v => updateItem(item.id, { quantity: v })} />
                                                                <Select label={t('invoice.field.unit', 'Einheit')} value={item.unit} options={unitOptions(item.unit)} onChange={v => updateItem(item.id, { unit: String(v) })} />
                                                                <NumberInput label={t('invoice.field.unitPrice', 'Einzelpreis (netto)')} value={item.unitPrice} onValueChange={v => updateItem(item.id, { unitPrice: v })} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}

                                                <div className="inv-pos-foot">
                                                    <span>{t('invoice.items.countLabel', '{n} Positionen').replace('{n}', String(inv.items.length))}</span>
                                                    <span className="inv-pos-foot__sum">{t('invoice.totals.net', 'Netto')} {formatCurrency(totals.net, inv.currency)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    <section className="inv-step">
                                        <div className="inv-step__header">
                                            <div className="inv-step__heading">
                                                <h3 className="inv-step__title">{t('invoice.section.appendix', 'Einzelnachweis (Anlage)')}</h3>
                                                <p className="inv-step__sub">{t('invoice.appendix.hint', 'Detaillierte Einzelpositionen – erscheinen ab Seite 2.')}</p>
                                            </div>
                                            <div className="inv-step__actions">
                                                {inv.appendix && inv.appendix.length > 0
                                                    ? <Button variant="ghost" size="sm" onClick={addAppendixRow} icon={<span className="material-symbols-outlined">add</span>}>{t('invoice.appendix.addRow', 'Zeile')}</Button>
                                                    : <Button variant="secondary" size="sm" onClick={addAppendix} icon={<span className="material-symbols-outlined">playlist_add</span>}>{t('invoice.appendix.add', 'Einzelnachweis hinzufügen')}</Button>}
                                            </div>
                                        </div>

                                        {inv.appendix && inv.appendix.length > 0 && (
                                            <div className="inv-apx">
                                                <TextInput label={t('invoice.field.appendixTitle', 'Titel der Anlage')} value={inv.appendixTitle || ''} onChange={e => update({ appendixTitle: e.target.value })} />

                                                <div className="inv-apx__list">
                                                    {inv.appendix.map((r, idx) => (
                                                        <div className="inv-apx-card" key={r.id}>
                                                            <div className="inv-apx-card__head">
                                                                <span className="inv-posx__idx">{idx + 1}</span>
                                                                <span className="inv-apx-card__label">{r.description?.trim() || t('invoice.appendix.entry', 'Einzelposition')}</span>
                                                                <button type="button" className="inv-posx__tool inv-posx__tool--danger" onClick={() => removeAppendixRow(r.id)} aria-label={t('common.delete', 'Löschen')}>
                                                                    <span className="material-symbols-outlined">delete</span>
                                                                </button>
                                                            </div>
                                                            <div className="inv-fields inv-fields--date">
                                                                <DatePicker label={t('invoice.appendix.date', 'Datum')} value={toDate(r.date)} onChange={d => updateAppendixRow(r.id, { date: toIso(d) })} />
                                                                <TextInput label={t('invoice.appendix.desc', 'Leistung / Aufgabe')} value={r.description} onChange={e => updateAppendixRow(r.id, { description: e.target.value })} />
                                                            </div>
                                                            <div className="inv-fields inv-fields--3">
                                                                <NumberInput label={t('invoice.field.quantity', 'Menge')} value={r.quantity} onValueChange={v => updateAppendixRow(r.id, { quantity: v })} />
                                                                <Select label={t('invoice.field.unit', 'Einheit')} value={r.unit} options={unitOptions(r.unit)} onChange={v => updateAppendixRow(r.id, { unit: String(v) })} />
                                                                <NumberInput label={t('invoice.appendix.amount', 'Betrag (optional)')} value={r.amount ?? 0} onValueChange={v => updateAppendixRow(r.id, { amount: v || undefined })} />
                                                            </div>
                                                            <TextInput label={t('invoice.appendix.note', 'Notiz (optional)')} value={r.note || ''} onChange={e => updateAppendixRow(r.id, { note: e.target.value })} />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="inv-pos-foot">
                                                    <span>{t('invoice.appendix.countLabel', '{n} Einträge').replace('{n}', String(inv.appendix.length))}</span>
                                                    <span className="inv-pos-foot__sum">{t('invoice.appendix.sum', 'Summe')} {formatCurrency(inv.appendix.reduce((s, r) => s + (typeof r.amount === 'number' ? r.amount : 0), 0), inv.currency)}</span>
                                                    <Button variant="ghost" size="sm" onClick={removeAppendix} icon={<span className="material-symbols-outlined">delete_sweep</span>}>{t('invoice.appendix.removeAll', 'Entfernen')}</Button>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <section className="inv-step">
                                        <h3 className="inv-step__title">{t('invoice.section.tax', 'Steuer & Hinweise')}</h3>
                                        <div className="inv-fields">
                                            <Checkbox label={t('invoice.field.vatEnabled', 'Umsatzsteuer ausweisen')} checked={inv.vatEnabled} onChange={e => update({ vatEnabled: e.target.checked })} />
                                            {inv.vatEnabled ? (
                                                <div className="inv-fields inv-fields--2">
                                                    <NumberInput label={t('invoice.field.vatRate', 'USt-Satz %')} value={inv.vatRate} onValueChange={v => update({ vatRate: v })} />
                                                </div>
                                            ) : (
                                                <p className="inv-hint">{t('invoice.hint.smallBusiness', 'Kleinunternehmerregelung: Es wird gemäß § 19 UStG keine Umsatzsteuer ausgewiesen.')}</p>
                                            )}
                                            <TextArea rows={2} label={t('invoice.field.notes', 'Zahlungshinweise / Anmerkungen')} value={inv.notes || ''} onChange={e => update({ notes: e.target.value })} />
                                        </div>
                                        <div className="inv-summary">
                                            {inv.vatEnabled && (
                                                <>
                                                    <div><span>{t('invoice.totals.net', 'Netto')}</span><span>{formatCurrency(totals.net, inv.currency)}</span></div>
                                                    <div><span>{t('invoice.totals.vat', 'USt')}</span><span>{formatCurrency(totals.vat, inv.currency)}</span></div>
                                                </>
                                            )}
                                            <div className="inv-summary__grand"><span>{t('invoice.totals.gross', 'Gesamt')}</span><span>{formatCurrency(totals.gross, inv.currency)}</span></div>
                                        </div>
                                    </section>

                                    <section className="inv-step">
                                        <h3 className="inv-step__title">{t('invoice.section.logo', 'Logo')}</h3>
                                        <div className="inv-settings__logo-row">
                                            {inv.logoUrl
                                                ? <img className="inv-settings__logo" src={inv.logoUrl} alt="" />
                                                : <div className="inv-settings__logo inv-settings__logo--empty">Logo</div>}
                                            <div className="inv-settings__logo-actions">
                                                <Button variant="secondary" size="sm" onClick={() => setLogoModalOpen(true)}>
                                                    {t('invoice.settings.chooseLogo', 'Logo auswählen')}
                                                </Button>
                                                {inv.logoUrl && (
                                                    <Button variant="ghost" size="sm" onClick={() => update({ logoUrl: '' })}>
                                                        {t('common.remove', 'Entfernen')}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>

                        <div className="inv-wizard__nav">
                            <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} icon={<span className="material-symbols-outlined">arrow_back</span>}>
                                {t('invoice.wizard.back', 'Zurück')}
                            </Button>
                            {step < steps.length - 1
                                ? <Button variant="primary" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} icon={<span className="material-symbols-outlined">arrow_forward</span>} iconPosition="right">{t('invoice.wizard.next', 'Weiter')}</Button>
                                : <span className="inv-wizard__hint">{t('invoice.wizard.finishHint', 'Oben speichern oder finalisieren')}</span>}
                        </div>
                    </div>

                    <div className="inv-builder__preview">
                        <div className="inv-preview-toolbar">
                            <button type="button" className="inv-zoom-btn" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label={t('invoice.preview.zoomOut', 'Verkleinern')}>
                                <span className="material-symbols-outlined">remove</span>
                            </button>
                            <span className="inv-preview-toolbar__pct">{Math.round(zoom * 100)} %</span>
                            <button type="button" className="inv-zoom-btn" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label={t('invoice.preview.zoomIn', 'Vergrößern')}>
                                <span className="material-symbols-outlined">add</span>
                            </button>
                            <button type="button" className="inv-zoom-btn" onClick={() => setZoom(1)} aria-label={t('invoice.preview.zoomReset', 'Zurücksetzen')}>
                                <span className="material-symbols-outlined">fit_screen</span>
                            </button>
                        </div>
                        <div className="inv-preview-scroll">
                            <InvoicePreview invoice={inv} zoom={zoom} displayNumber={previewNumber} />
                        </div>
                    </div>
                </div>

                <MediaLibrary
                    isOpen={logoModalOpen}
                    onClose={() => setLogoModalOpen(false)}
                    onSelect={(asset) => { update({ logoUrl: asset.url }); setLogoModalOpen(false); }}
                    projectId={projectId}
                    storagePath={`tenants/${getActiveTenantId()}/invoices/logos`}
                />

                <EffortImportModal
                    isOpen={effortModalOpen}
                    onClose={() => setEffortModalOpen(false)}
                    projectId={projectId}
                    currency={inv.currency}
                    onApply={addItems}
                />

                <Modal
                    isOpen={confirmFinalise}
                    onClose={() => setConfirmFinalise(false)}
                    title={t('invoice.finalise.title', 'Rechnung festschreiben')}
                    size="sm"
                    footer={(
                        <div className="inv-modal-footer">
                            <Button variant="ghost" onClick={() => setConfirmFinalise(false)}>{t('common.cancel', 'Abbrechen')}</Button>
                            <Button variant="primary" onClick={doFinalise} isLoading={finalising}>{t('invoice.finalise.confirm', 'Festschreiben')}</Button>
                        </div>
                    )}
                >
                    <p>{t('invoice.finalise.body', 'Beim Festschreiben wird eine fortlaufende Rechnungsnummer vergeben. Danach kann die Rechnung gemäß GoBD inhaltlich nicht mehr geändert oder gelöscht werden. Fortfahren?')}</p>
                </Modal>
            </div>
        </div>,
        document.body
    );
};
