import type { Invoice, InvoiceLineItem } from '../types';

export const lineItemTotal = (item: InvoiceLineItem): number => {
    if (item.useFixedPrice) return Number(item.fixedPrice) || 0;
    return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
};

export interface InvoiceTotals {
    net: number;
    vat: number;
    gross: number;
    vatRate: number;
    vatEnabled: boolean;
}

export const computeInvoiceTotals = (invoice: Pick<Invoice, 'items' | 'vatEnabled' | 'vatRate'>): InvoiceTotals => {
    const net = (invoice.items || []).reduce((sum, item) => sum + lineItemTotal(item), 0);
    const vatRate = invoice.vatEnabled ? (Number(invoice.vatRate) || 0) : 0;
    const vat = invoice.vatEnabled ? net * (vatRate / 100) : 0;
    return {
        net,
        vat,
        gross: net + vat,
        vatRate,
        vatEnabled: invoice.vatEnabled
    };
};

export const formatCurrency = (value: number, currency = 'EUR'): string => {
    try {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
    } catch {
        return `${(Number.isFinite(value) ? value : 0).toFixed(2)} ${currency}`;
    }
};

/**
 * Quantity formatting for the invoice "Menge" column: grouped thousands, but no
 * forced decimals — integers (incl. large token counts) show plain (1.500.000),
 * fractional amounts keep up to 4 significant decimals (13,75 / 1,5) instead of
 * always "xx,xx".
 */
export const formatQuantity = (value: number): string => {
    try {
        return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(Number.isFinite(value) ? value : 0);
    } catch {
        return String(Number.isFinite(value) ? value : 0);
    }
};

export const formatNumber = (value: number, fractionDigits = 2): string => {
    try {
        return new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        }).format(Number.isFinite(value) ? value : 0);
    } catch {
        return (Number.isFinite(value) ? value : 0).toFixed(fractionDigits);
    }
};

export const formatInvoiceDate = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
};
