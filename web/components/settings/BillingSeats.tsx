import React, { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import {
    type BillingOverview, type SeatPreview, changeSeats, formatMoney, getBillingOverview, planErrorMessage, previewSeatChange,
} from '../../services/billingService';
import { Button } from '../ui/Button';

type BillingSeatsProps = {
    tenantId: string;
    personal: boolean;
};

/**
 * Billing tab, paid workspaces (owner): seats and AI seats with a stepper, a prorated price preview before every
 * change, then confirm. More seats are charged now; fewer seats apply at the end of the period (contract §9).
 */
export const BillingSeats: React.FC<BillingSeatsProps> = ({ tenantId, personal }) => {
    const { t, language } = useLanguage();
    const { showError, showSuccess } = useToast();
    const [overview, setOverview] = useState<BillingOverview | null>(null);
    const [seats, setSeats] = useState(0);
    const [aiSeats, setAiSeats] = useState(0);
    const [preview, setPreview] = useState<SeatPreview | null>(null);
    const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

    const load = useCallback(async () => {
        const data = await getBillingOverview(tenantId);
        setOverview(data);
        setSeats(data.seats);
        setAiSeats(data.aiAddonSeats);
        setPreview(null);
    }, [tenantId]);

    useEffect(() => {
        load().catch((error) => showError(planErrorMessage(error, t) || t('billing.errors.generic')));
    }, [load, showError, t]);

    const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, overview?.currency || 'eur', language);
    const day = (ms: number | null | undefined) =>
        ms ? new Date(ms).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const dirty = Boolean(overview && (seats !== overview.seats || aiSeats !== overview.aiAddonSeats));
    // Mixed changes (one up, one down) are confirmed one after another.
    const mixed = Boolean(overview && ((seats > overview.seats && aiSeats < overview.aiAddonSeats) || (seats < overview.seats && aiSeats > overview.aiAddonSeats)));

    useEffect(() => {
        if (!overview || !dirty || mixed) {
            setPreview(null);
            return undefined;
        }
        const handle = window.setTimeout(() => {
            setBusy('preview');
            previewSeatChange({ tenantId, ...(personal ? {} : { seats }), aiAddonSeats: aiSeats })
                .then(setPreview)
                .catch((error) => {
                    setPreview(null);
                    showError(planErrorMessage(error, t) || t('billing.errors.generic'));
                })
                .finally(() => setBusy(null));
        }, 350);
        return () => window.clearTimeout(handle);
    }, [overview, dirty, mixed, seats, aiSeats, tenantId, personal, showError, t]);

    const apply = async () => {
        setBusy('apply');
        setPaymentUrl(null);
        try {
            const result = await changeSeats({ tenantId, ...(personal ? {} : { seats }), aiAddonSeats: aiSeats });
            if (result.status === 'applied') showSuccess(t('billing.seats.applied').replace('{amount}', money(result.amountPaid)));
            else if (result.status === 'scheduled') showSuccess(t('billing.seats.scheduled').replace('{date}', day(result.effectiveAt)));
            else if (result.status === 'scheduled-change-cancelled') showSuccess(t('billing.seats.cancelled'));
            else if (result.status === 'payment-required') {
                setPaymentUrl(result.hostedInvoiceUrl);
                showError(t('billing.seats.paymentRequired'));
            }
            await load();
        } catch (error) {
            showError(planErrorMessage(error, t) || t('billing.errors.generic'));
        } finally {
            setBusy(null);
        }
    };

    if (!overview) return <p className="billing-settings__muted">{t('billing.loading')}</p>;

    const stepper = (label: string, value: number, setValue: (next: number) => void, min: number, max: number, hint: string) => (
        <div className="billing-seats__row">
            <div>
                <strong>{label}</strong>
                <span className="billing-settings__muted">{hint}</span>
            </div>
            <div className="billing-seats__stepper">
                <button type="button" aria-label={t('billing.seats.less')} disabled={value <= min || busy === 'apply'} onClick={() => setValue(value - 1)}>
                    <span className="material-symbols-outlined" aria-hidden="true">remove</span>
                </button>
                <output aria-live="polite">{value}</output>
                <button type="button" aria-label={t('billing.seats.more')} disabled={value >= max || busy === 'apply'} onClick={() => setValue(value + 1)}>
                    <span className="material-symbols-outlined" aria-hidden="true">add</span>
                </button>
            </div>
        </div>
    );

    return (
        <section className="billing-settings__card">
            <header className="billing-settings__head">
                <div>
                    <h3>{t(personal ? 'billing.seats.titlePersonal' : 'billing.seats.title')}</h3>
                    <p>{t('billing.seats.subtitle')}</p>
                </div>
            </header>

            {!personal && stepper(
                t('billing.seats.seats'), seats, setSeats, Math.max(1, overview.memberCount), 50,
                t('billing.seats.used').replace('{used}', String(overview.memberCount)).replace('{total}', String(overview.seats)),
            )}
            {stepper(
                t('billing.seats.aiSeats'), aiSeats, setAiSeats, overview.aiAssigned, personal ? 1 : seats,
                t('billing.seats.aiUsed').replace('{used}', String(overview.aiAssigned)).replace('{total}', String(overview.aiAddonSeats)),
            )}

            {overview.scheduledChange && (
                <p className="billing-settings__banner">
                    {t('billing.seats.pending')
                        .replace('{seats}', String(overview.scheduledChange.seats))
                        .replace('{ai}', String(overview.scheduledChange.aiAddonSeats))
                        .replace('{date}', day(overview.scheduledChange.effectiveAt))}
                </p>
            )}

            {mixed && <p className="billing-settings__muted">{t('billing.errors.billing-mixed-seat-change')}</p>}
            {dirty && preview && (
                <p className="billing-seats__preview" aria-live="polite">
                    {preview.kind === 'increase'
                        ? t('billing.seats.previewIncrease')
                            .replace('{today}', money(preview.amountToday))
                            .replace('{date}', day(preview.nextBillingDate))
                            .replace('{next}', money(preview.nextAmount))
                            .replace('{interval}', t(`billing.interval.${preview.interval}`))
                        : t('billing.seats.previewDecrease')
                            .replace('{date}', day(preview.effectiveAt))
                            .replace('{next}', money(preview.nextAmount))
                            .replace('{interval}', t(`billing.interval.${preview.interval}`))}
                </p>
            )}
            {paymentUrl && (
                <p className="billing-settings__banner billing-settings__banner--warning">
                    {t('billing.seats.paymentRequired')}{' '}
                    <a href={paymentUrl} target="_blank" rel="noreferrer">{t('billing.seats.payInvoice')}</a>
                </p>
            )}

            <div className="billing-settings__actions">
                {dirty && (
                    <>
                        <Button onClick={() => void apply()} disabled={!preview || mixed} isLoading={busy === 'apply' || busy === 'preview'}>
                            {preview?.kind === 'decrease' ? t('billing.seats.confirmDecrease') : t('billing.seats.confirmIncrease')}
                        </Button>
                        <Button variant="ghost" onClick={() => { setSeats(overview.seats); setAiSeats(overview.aiAddonSeats); }}>
                            {t('billing.seats.reset')}
                        </Button>
                    </>
                )}
                {!dirty && overview.scheduledChange && (
                    <Button variant="secondary" onClick={() => void apply()} isLoading={busy === 'apply'}>{t('billing.seats.keep')}</Button>
                )}
                {overview.nextBillingDate && (
                    <span className="billing-settings__muted">
                        {t('billing.seats.next').replace('{date}', day(overview.nextBillingDate)).replace('{amount}', money(overview.nextAmount))}
                    </span>
                )}
            </div>

            {overview.invoices.length > 0 && (
                <div className="billing-seats__invoices">
                    <h4>{t('billing.seats.invoices')}</h4>
                    <ul>
                        {overview.invoices.map((invoice) => (
                            <li key={invoice.id}>
                                <span>{day(invoice.created)}</span>
                                <span>{invoice.number || '—'}</span>
                                <span>{money(invoice.total)}</span>
                                <span className="billing-settings__muted">{t(`billing.invoiceStatus.${invoice.status || 'draft'}`)}</span>
                                {invoice.hostedInvoiceUrl && (
                                    <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">{t('billing.seats.view')}</a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
};
