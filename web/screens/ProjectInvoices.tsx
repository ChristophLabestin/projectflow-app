import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import { Button } from '../components/common/Button/Button';
import { Modal } from '../components/common/Modal/Modal';
import { InvoiceBuilder } from '../components/invoices/InvoiceBuilder';
import { BillingSettingsModal } from '../components/invoices/BillingSettingsModal';
import { createDraftInvoice } from '../components/invoices/invoiceDefaults';
import { computeInvoiceTotals, formatCurrency, formatInvoiceDate } from '../utils/invoiceCalc';
import { downloadInvoicePdf } from '../utils/invoicePdf';
import { deleteInvoice, getBillingSettings, peekNextInvoiceNumber, subscribeProjectInvoices } from '../services/domain/invoiceService';
import { getProjectById } from '../services/domain/projectsService';
import type { BillingSettings, Invoice, InvoiceParty, InvoiceStatus } from '../types';

const statusLabelKey: Record<InvoiceStatus, string> = {
    draft: 'invoice.status.draft',
    sent: 'invoice.status.sent',
    paid: 'invoice.status.paid',
    canceled: 'invoice.status.canceled'
};

export const ProjectInvoices: React.FC = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const { showError, showSuccess } = useToast();

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<BillingSettings | null>(null);
    const [savedCustomer, setSavedCustomer] = useState<InvoiceParty | null>(null);
    const [builderInvoice, setBuilderInvoice] = useState<Invoice | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeProjectInvoices(projectId, (list) => { setInvoices(list); setLoading(false); });
        return () => unsub();
    }, [projectId]);

    useEffect(() => {
        getBillingSettings().then(setSettings).catch(() => setSettings(null));
    }, [settingsOpen]);

    useEffect(() => {
        if (!projectId) return;
        getProjectById(projectId).then(p => setSavedCustomer(p?.billingCustomer || null)).catch(() => setSavedCustomer(null));
    }, [projectId]);

    const handleNew = () => {
        if (!projectId) return;
        setBuilderInvoice({ id: '', ...createDraftInvoice(projectId, settings, savedCustomer) });
    };

    const handleDownload = async (invoice: Invoice) => {
        setBusyId(invoice.id);
        try {
            await downloadInvoicePdf(invoice.number ? invoice : { ...invoice, number: previewNumber });
        } catch {
            showError(t('invoice.toast.pdfError', 'PDF konnte nicht erstellt werden.'));
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async () => {
        if (!projectId || !deleteTarget) return;
        if (deleteTarget.status !== 'draft') { // festgeschrieben — nicht löschbar (GoBD)
            showError(t('invoice.locked.noDelete', 'Festgeschriebene Rechnungen können nicht gelöscht werden.'));
            setDeleteTarget(null);
            return;
        }
        try {
            await deleteInvoice(projectId, deleteTarget.id);
            showSuccess(t('invoice.toast.deleted', 'Rechnung gelöscht.'));
        } catch {
            showError(t('invoice.toast.deleteError', 'Löschen fehlgeschlagen.'));
        } finally {
            setDeleteTarget(null);
        }
    };

    const totalSum = useMemo(
        () => invoices.reduce((sum, inv) => sum + computeInvoiceTotals(inv).gross, 0),
        [invoices]
    );

    const previewNumber = useMemo(() => peekNextInvoiceNumber(settings), [settings]);

    if (!projectId) return null;

    if (builderInvoice) {
        return (
            <InvoiceBuilder
                projectId={projectId}
                initialInvoice={builderInvoice}
                savedCustomer={savedCustomer}
                previewNumber={previewNumber}
                onClose={() => setBuilderInvoice(null)}
                onSaved={(saved) => setBuilderInvoice(saved)}
                onCustomerSaved={(c) => setSavedCustomer(c)}
            />
        );
    }

    return (
        <div className="inv-screen">
            <header className="inv-screen__header">
                <div>
                    <h1 className="inv-screen__title">{t('invoice.list.title', 'Rechnungen')}</h1>
                    <p className="inv-screen__subtitle">{t('invoice.list.subtitle', 'Erstelle und verwalte Rechnungen für dieses Kundenprojekt.')}</p>
                </div>
                <div className="inv-screen__actions">
                    <Button variant="secondary" onClick={() => setSettingsOpen(true)} icon={<span className="material-symbols-outlined">settings</span>}>
                        {t('invoice.list.settings', 'Einstellungen')}
                    </Button>
                    <Button variant="primary" onClick={handleNew} icon={<span className="material-symbols-outlined">add</span>}>
                        {t('invoice.list.new', 'Neue Rechnung')}
                    </Button>
                </div>
            </header>

            {!loading && invoices.length > 0 && (
                <div className="inv-screen__summary">
                    <div className="inv-stat">
                        <span className="inv-stat__label">{t('invoice.list.count', 'Rechnungen')}</span>
                        <span className="inv-stat__value">{invoices.length}</span>
                    </div>
                    <div className="inv-stat">
                        <span className="inv-stat__label">{t('invoice.list.totalVolume', 'Gesamtvolumen (brutto)')}</span>
                        <span className="inv-stat__value">{formatCurrency(totalSum)}</span>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="inv-screen__empty">{t('common.loading', 'Wird geladen…')}</div>
            ) : invoices.length === 0 ? (
                <div className="inv-screen__empty">
                    <span className="material-symbols-outlined">request_quote</span>
                    <h3>{t('invoice.list.emptyTitle', 'Noch keine Rechnungen')}</h3>
                    <p>{t('invoice.list.emptyHint', 'Lege deine erste Rechnung für diesen Kunden an.')}</p>
                    <Button variant="primary" onClick={handleNew} icon={<span className="material-symbols-outlined">add</span>}>
                        {t('invoice.list.new', 'Neue Rechnung')}
                    </Button>
                </div>
            ) : (
                <div className="inv-table">
                    <div className="inv-table__head">
                        <span>{t('invoice.col.number', 'Nummer')}</span>
                        <span>{t('invoice.col.customer', 'Kunde')}</span>
                        <span>{t('invoice.col.date', 'Datum')}</span>
                        <span>{t('invoice.col.status', 'Status')}</span>
                        <span className="is-num">{t('invoice.col.total', 'Betrag')}</span>
                        <span className="is-actions" />
                    </div>
                    {invoices.map(inv => (
                        <div className="inv-table__row" key={inv.id} onClick={() => setBuilderInvoice(inv)} role="button" tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') setBuilderInvoice(inv); }}>
                            <span className="inv-table__number">{inv.number || t('invoice.status.draft', 'Entwurf')}</span>
                            <span>{inv.customer?.name || '—'}</span>
                            <span>{formatInvoiceDate(inv.issueDate)}</span>
                            <span>
                                <span className={`inv-badge inv-badge--${inv.status}`}>{t(statusLabelKey[inv.status], inv.status)}</span>
                            </span>
                            <span className="is-num">{formatCurrency(computeInvoiceTotals(inv).gross, inv.currency)}</span>
                            <span className="is-actions" onClick={(e) => e.stopPropagation()}>
                                <button aria-label={t('invoice.builder.downloadPdf', 'PDF')} type="button" className="inv-icon-btn" title={t('invoice.builder.downloadPdf', 'PDF')} disabled={busyId === inv.id} onClick={() => handleDownload(inv)}>
                                    <span className="material-symbols-outlined">picture_as_pdf</span>
                                </button>
                                {inv.status === 'draft'
                                    ? (
                                        <button aria-label={t('common.delete', 'Löschen')} type="button" className="inv-icon-btn inv-icon-btn--danger" title={t('common.delete', 'Löschen')} onClick={() => setDeleteTarget(inv)}>
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    )
                                    : (
                                        <span className="inv-icon-btn inv-icon-btn--locked" title={t('invoice.locked.badge', 'Festgeschrieben')}>
                                            <span className="material-symbols-outlined">lock</span>
                                        </span>
                                    )}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <BillingSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                projectId={projectId}
                onSaved={(s) => setSettings(s)}
            />

            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title={t('invoice.delete.title', 'Rechnung löschen')}
                size="sm"
                footer={(
                    <div className="inv-modal-footer">
                        <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel', 'Abbrechen')}</Button>
                        <Button variant="danger" onClick={handleDelete}>{t('common.delete', 'Löschen')}</Button>
                    </div>
                )}
            >
                <p>{t('invoice.delete.confirm', 'Diese Rechnung wirklich löschen? Das kann nicht rückgängig gemacht werden.')}</p>
            </Modal>
        </div>
    );
};

export default ProjectInvoices;
