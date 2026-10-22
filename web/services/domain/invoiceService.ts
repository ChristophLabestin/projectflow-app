import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore';

import { db } from '../firebase';
import { projectSubCollection, resolveTenantId } from '../dataService';
import type { BillingSettings, Invoice } from '../../types';

const INVOICES = 'invoices';
const BILLING_SETTINGS = 'billing_settings';
const BILLING_SETTINGS_DOC = 'default';

type Listener<T> = (data: T) => void;

const invoicesCollection = (tenantId: string, projectId: string) =>
    projectSubCollection(tenantId, projectId, INVOICES);

const billingSettingsRef = (tenantId: string) =>
    doc(collection(db, 'tenants', tenantId, BILLING_SETTINGS), BILLING_SETTINGS_DOC);

// ---------------------------------------------------------------------------
// Invoices (per project subcollection)
// ---------------------------------------------------------------------------

export const subscribeProjectInvoices = (
    projectId: string,
    onUpdate: Listener<Invoice[]>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(invoicesCollection(resolvedTenant, projectId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const invoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
        onUpdate(invoices);
    });
};

export const getProjectInvoices = async (projectId: string, tenantId?: string): Promise<Invoice[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(invoicesCollection(resolvedTenant, projectId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
};

export const createInvoice = async (
    projectId: string,
    invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
    tenantId?: string
): Promise<string> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = await addDoc(invoicesCollection(resolvedTenant, projectId), {
        ...invoice,
        projectId,
        tenantId: resolvedTenant,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return ref.id;
};

export const updateInvoice = async (
    projectId: string,
    invoiceId: string,
    updates: Partial<Invoice>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(invoicesCollection(resolvedTenant, projectId), invoiceId);
    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
};

export const deleteInvoice = async (projectId: string, invoiceId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(invoicesCollection(resolvedTenant, projectId), invoiceId));
};

// ---------------------------------------------------------------------------
// Billing settings (tenant-wide)
// ---------------------------------------------------------------------------

export const getBillingSettings = async (tenantId?: string): Promise<BillingSettings | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snap = await getDoc(billingSettingsRef(resolvedTenant));
    return snap.exists() ? (snap.data() as BillingSettings) : null;
};

export const saveBillingSettings = async (settings: BillingSettings, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await setDoc(billingSettingsRef(resolvedTenant), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
};

// ---------------------------------------------------------------------------
// Sequential invoice number (fortlaufend, einmalig) — assigned on finalisation
// ---------------------------------------------------------------------------

const formatInvoiceNumber = (prefix: string | undefined, seq: number): string => {
    const year = new Date().getFullYear();
    const base = (prefix && prefix.length > 0 ? prefix : 'RE-{YYYY}-').replace(/\{YYYY\}/g, String(year));
    return `${base}${String(seq).padStart(4, '0')}`;
};

/**
 * Formats the next sequential invoice number WITHOUT reserving it — for showing
 * a predicted number on drafts. The real, gap-free number is only burned by
 * reserveNextInvoiceNumber on finalisation.
 */
export const peekNextInvoiceNumber = (settings?: BillingSettings | null): string => {
    const seq = settings && typeof settings.nextInvoiceNumber === 'number' && settings.nextInvoiceNumber > 0
        ? settings.nextInvoiceNumber
        : 1;
    return formatInvoiceNumber(settings?.invoiceNumberPrefix, seq);
};

/**
 * Atomically reserves the next sequential invoice number for the tenant and
 * returns the formatted string. Burns a number only when actually called
 * (i.e. on finalising an invoice), so deleted drafts never create gaps.
 */
export const reserveNextInvoiceNumber = async (tenantId?: string): Promise<string> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = billingSettingsRef(resolvedTenant);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = (snap.exists() ? snap.data() : {}) as BillingSettings;
        const seq = typeof data.nextInvoiceNumber === 'number' && data.nextInvoiceNumber > 0
            ? data.nextInvoiceNumber
            : 1;
        const number = formatInvoiceNumber(data.invoiceNumberPrefix, seq);
        tx.set(ref, { ...data, nextInvoiceNumber: seq + 1, updatedAt: serverTimestamp() }, { merge: true });
        return number;
    });
};
