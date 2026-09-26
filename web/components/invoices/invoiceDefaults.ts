import type { BillingSettings, Invoice, InvoiceAppendixRow, InvoiceIssuer, InvoiceLineItem, InvoiceParty } from '../../types';
import { COMPANY_CITY, COMPANY_EMAIL, COMPANY_NAME, COMPANY_STREET, COMPANY_ZIP } from '../../config/company';
import { parseDateValue, toIsoDate } from '../../utils/taskDates';

export const todayIso = (): string => toIsoDate(new Date());

/** Default intro sentence — always usable, still freely editable per invoice. */
export const DEFAULT_INTRO_TEXT =
    'vielen Dank für die gute Zusammenarbeit. Für die erbrachten Leistungen erlauben wir uns, Ihnen wie folgt in Rechnung zu stellen:';

export const addDaysIso = (iso: string, days: number): string => {
    const d = parseDateValue(iso);
    if (Number.isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + days);
    return toIsoDate(d);
};

export const newLineId = (): string => {
    try {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    } catch { /* ignore */ }
    return `li_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

export const blankLineItem = (): InvoiceLineItem => ({
    id: newLineId(),
    name: '',
    description: '',
    quantity: 1,
    unit: 'h',
    unitPrice: 0,
    useFixedPrice: false,
    fixedPrice: 0
});

export const blankAppendixRow = (date?: string): InvoiceAppendixRow => ({
    id: newLineId(),
    date: date || todayIso(),
    description: '',
    quantity: 1,
    unit: 'h',
    amount: undefined,
    note: ''
});

export const defaultIssuer = (settings?: BillingSettings | null): InvoiceIssuer => {
    if (settings?.issuer && settings.issuer.name) return { ...settings.issuer };
    return {
        name: COMPANY_NAME,
        addressLine1: COMPANY_STREET,
        zip: COMPANY_ZIP,
        city: COMPANY_CITY,
        country: 'Deutschland',
        email: COMPANY_EMAIL
    };
};

/** Builds a fresh draft invoice, pre-filled from the tenant billing settings. */
export const createDraftInvoice = (
    projectId: string,
    settings?: BillingSettings | null,
    savedCustomer?: InvoiceParty | null
): Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> => {
    const issue = todayIso();
    const paymentTerms = settings?.defaultPaymentTermsDays ?? 14;
    return {
        projectId,
        status: 'draft',
        issueDate: issue,
        serviceDate: issue,
        dueDate: addDaysIso(issue, paymentTerms),
        customer: savedCustomer?.name
            ? { ...savedCustomer }
            : { name: '', addressLine1: '', zip: '', city: '', country: 'Deutschland' },
        items: [blankLineItem()],
        vatEnabled: settings?.smallBusiness ? false : true,
        vatRate: settings?.defaultVatRate ?? 19,
        currency: settings?.currency || 'EUR',
        introText: DEFAULT_INTRO_TEXT,
        notes: settings?.defaultNotes || '',
        issuer: defaultIssuer(settings),
        bank: settings?.bank ? { ...settings.bank } : {},
        logoUrl: settings?.logoUrl || '',
        footerText: settings?.footerText || ''
    };
};

export const defaultBillingSettings = (): BillingSettings => ({
    issuer: defaultIssuer(null),
    bank: {},
    logoUrl: '',
    footerText: '',
    defaultVatRate: 19,
    smallBusiness: false,
    defaultPaymentTermsDays: 14,
    defaultNotes: '',
    invoiceNumberPrefix: 'RE-{YYYY}-',
    nextInvoiceNumber: 1,
    currency: 'EUR'
});
