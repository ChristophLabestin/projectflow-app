import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import OpenAI from 'openai';

import { db } from '../init';
import { calculateScenarioSnapshotFromInput } from './calculations';
import {
    FINANCE_COLLECTIONS,
    REGION,
    assertPeriodWritable,
    buildIdempotencyKey,
    normalizeCurrencyCode,
    normalizeString,
    requireFinancePermission,
    serverTimestamp,
    tenantCollectionRef,
    toNonNegative,
    toNumber,
    toPeriodKey,
    writeFinanceAuditLog,
} from './shared';

type LooseObject = Record<string, unknown>;
type InvoiceDocumentType = 'pdf' | 'xml';
type InvoiceExtractionConfidence = 'low' | 'medium' | 'high';

interface InvoiceExtractionResult {
    documentType: InvoiceDocumentType;
    vendorName: string;
    vendorEmail: string;
    vendorVatId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currencyCode: string;
    lineDescription: string;
    quantity: number;
    unitCost: number;
    taxRatePercent: number;
    netAmount: number;
    taxAmount: number;
    grossAmount: number;
    confidence: InvoiceExtractionConfidence;
    isLikelyRecurring: boolean;
    recurringHint: string;
    notes: string;
}

interface JournalLineInput {
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
    taxCodeId?: string;
    projectId?: string;
    customerId?: string;
    vendorId?: string;
}

interface JournalPostInput {
    tenantId: string;
    postingDate: string;
    description: string;
    sourceType?: string;
    sourceId?: string;
    sourceRefNo?: string;
    projectId?: string;
    currencyCode?: string;
    idempotencyKey?: string;
    lines: JournalLineInput[];
}

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const INVOICE_EXTRACTION_MODEL = 'gpt-5-mini';
const MAX_INVOICE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_XML_TEXT_LENGTH = 180000;

const financeSettingsRef = (tenantId: string) =>
    tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.settings).doc('default');

const getOpenAiClient = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OPENAI_API_KEY is not configured.');
    }

    return new OpenAI({ apiKey });
};

const extractTextFromResponse = (response: any): string => {
    if (typeof response?.output_text === 'string' && response.output_text.length > 0) {
        return response.output_text;
    }

    const output = response?.output;
    if (!Array.isArray(output)) {
        return '';
    }

    const chunks: string[] = [];
    for (const item of output) {
        if (item?.type !== 'message' || !Array.isArray(item.content)) {
            continue;
        }
        for (const part of item.content) {
            if (part?.type === 'output_text' && typeof part.text === 'string') {
                chunks.push(part.text);
            }
        }
    }

    return chunks.join('\n').trim();
};

const parseJsonText = (text: string): Record<string, unknown> => {
    const trimmed = text.trim();
    if (!trimmed) {
        return {};
    }

    try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        // Continue to fallback parsing.
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        try {
            const parsed = JSON.parse(fenced[1].trim());
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            // Continue to fallback parsing.
        }
    }

    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
        try {
            const parsed = JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
            // Fall through.
        }
    }

    return {};
};

const normalizeIsoDate = (value: unknown): string => {
    const raw = normalizeString(value);
    if (!raw) return '';

    const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (directMatch) {
        return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    return parsed.toISOString().slice(0, 10);
};

const normalizeConfidence = (value: unknown): InvoiceExtractionConfidence => {
    const normalized = normalizeString(value).toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
        return normalized;
    }
    return 'medium';
};

const normalizeInvoiceExtractionResult = (
    raw: Record<string, unknown>,
    documentType: InvoiceDocumentType,
): InvoiceExtractionResult => {
    const quantityRaw = toNonNegative(raw.quantity);
    let quantity = quantityRaw > 0 ? quantityRaw : 1;
    quantity = round2(quantity);

    let unitCost = round2(toNonNegative(raw.unitCost));
    let netAmount = round2(toNonNegative(raw.netAmount));
    let taxAmount = round2(toNonNegative(raw.taxAmount));
    let grossAmount = round2(toNonNegative(raw.grossAmount));
    let taxRatePercent = round2(toNonNegative(raw.taxRatePercent));

    if (netAmount <= 0 && unitCost > 0) {
        netAmount = round2(quantity * unitCost);
    }
    if (unitCost <= 0 && netAmount > 0 && quantity > 0) {
        unitCost = round2(netAmount / quantity);
    }
    if (taxAmount <= 0 && grossAmount > netAmount) {
        taxAmount = round2(grossAmount - netAmount);
    }
    if (taxAmount <= 0 && netAmount > 0 && taxRatePercent > 0) {
        taxAmount = round2(netAmount * (taxRatePercent / 100));
    }
    if (taxRatePercent <= 0 && netAmount > 0 && taxAmount > 0) {
        taxRatePercent = round2((taxAmount / netAmount) * 100);
    }
    if (grossAmount <= 0) {
        grossAmount = round2(netAmount + taxAmount);
    }

    return {
        documentType,
        vendorName: normalizeString(raw.vendorName),
        vendorEmail: normalizeString(raw.vendorEmail),
        vendorVatId: normalizeString(raw.vendorVatId),
        invoiceNumber: normalizeString(raw.invoiceNumber),
        invoiceDate: normalizeIsoDate(raw.invoiceDate),
        dueDate: normalizeIsoDate(raw.dueDate),
        currencyCode: normalizeCurrencyCode(raw.currencyCode, 'EUR'),
        lineDescription: normalizeString(raw.lineDescription),
        quantity,
        unitCost,
        taxRatePercent,
        netAmount,
        taxAmount,
        grossAmount,
        confidence: normalizeConfidence(raw.confidence),
        isLikelyRecurring: Boolean(raw.isLikelyRecurring),
        recurringHint: normalizeString(raw.recurringHint),
        notes: normalizeString(raw.notes),
    };
};

const toDateFromInput = (value: unknown) => {
    const date = new Date(normalizeString(value));
    if (Number.isNaN(date.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid date value.');
    }
    return date;
};

const toJournalLineInput = (raw: unknown): JournalLineInput => {
    const source = (raw || {}) as LooseObject;
    const accountId = normalizeString(source.accountId);
    const debit = toNonNegative(source.debit);
    const credit = toNonNegative(source.credit);

    if (!accountId) {
        throw new functions.https.HttpsError('invalid-argument', 'Each journal line requires accountId.');
    }

    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'Each journal line must contain exactly one side (debit or credit).');
    }

    return {
        accountId,
        debit,
        credit,
        description: normalizeString(source.description) || undefined,
        taxCodeId: normalizeString(source.taxCodeId) || undefined,
        projectId: normalizeString(source.projectId) || undefined,
        customerId: normalizeString(source.customerId) || undefined,
        vendorId: normalizeString(source.vendorId) || undefined,
    };
};

const normalizeJournalInput = (rawData: unknown): JournalPostInput => {
    const data = (rawData || {}) as LooseObject;
    const tenantId = normalizeString(data.tenantId);
    const postingDate = normalizeString(data.postingDate);
    const description = normalizeString(data.description);
    const linesInput = Array.isArray(data.lines) ? data.lines.map(toJournalLineInput) : [];

    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    if (!postingDate) {
        throw new functions.https.HttpsError('invalid-argument', 'postingDate is required.');
    }
    if (!description) {
        throw new functions.https.HttpsError('invalid-argument', 'description is required.');
    }
    if (linesInput.length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'At least two journal lines are required.');
    }

    const totalDebit = round2(sum(linesInput.map((line) => line.debit)));
    const totalCredit = round2(sum(linesInput.map((line) => line.credit)));
    if (Math.abs(totalDebit - totalCredit) > 0.00001) {
        throw new functions.https.HttpsError('invalid-argument', 'Journal entry must be balanced (sum debit = sum credit).');
    }

    return {
        tenantId,
        postingDate,
        description,
        sourceType: normalizeString(data.sourceType) || 'manual',
        sourceId: normalizeString(data.sourceId) || undefined,
        sourceRefNo: normalizeString(data.sourceRefNo) || undefined,
        projectId: normalizeString(data.projectId) || undefined,
        currencyCode: normalizeCurrencyCode(data.currencyCode, 'EUR'),
        idempotencyKey: normalizeString(data.idempotencyKey) || undefined,
        lines: linesInput,
    };
};

const postJournalEntryInternal = async (
    actorId: string,
    payload: JournalPostInput,
) => {
    const postingDateValue = toDateFromInput(payload.postingDate);
    const periodKey = toPeriodKey(postingDateValue);
    await assertPeriodWritable(payload.tenantId, periodKey);

    const idempotencyKey = payload.idempotencyKey || buildIdempotencyKey({
        tenantId: payload.tenantId,
        postingDate: payload.postingDate,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        sourceRefNo: payload.sourceRefNo,
        lines: payload.lines,
    });

    const existing = await tenantCollectionRef(payload.tenantId, FINANCE_COLLECTIONS.journalEntries)
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();

    if (!existing.empty) {
        return { entryId: existing.docs[0].id, idempotentReplay: true };
    }

    const entryRef = tenantCollectionRef(payload.tenantId, FINANCE_COLLECTIONS.journalEntries).doc();
    const lineCollection = tenantCollectionRef(payload.tenantId, FINANCE_COLLECTIONS.journalLines);

    const totalDebit = round2(sum(payload.lines.map((line) => line.debit)));
    const totalCredit = round2(sum(payload.lines.map((line) => line.credit)));

    const entryNumber = `JE-${periodKey}-${entryRef.id.slice(0, 8).toUpperCase()}`;

    const batch = db.batch();
    batch.set(entryRef, {
        tenantId: payload.tenantId,
        entryNumber,
        postingDate: admin.firestore.Timestamp.fromDate(postingDateValue),
        periodKey,
        description: payload.description,
        sourceType: payload.sourceType || 'manual',
        sourceId: payload.sourceId || null,
        sourceRefNo: payload.sourceRefNo || null,
        projectId: payload.projectId || null,
        currencyCode: payload.currencyCode || 'EUR',
        totalDebit,
        totalCredit,
        status: 'posted',
        idempotencyKey,
        postedBy: actorId,
        postedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    payload.lines.forEach((line, index) => {
        const lineRef = lineCollection.doc();
        batch.set(lineRef, {
            tenantId: payload.tenantId,
            entryId: entryRef.id,
            lineNo: index + 1,
            accountId: line.accountId,
            description: line.description || payload.description,
            debit: round2(line.debit),
            credit: round2(line.credit),
            taxCodeId: line.taxCodeId || null,
            projectId: line.projectId || payload.projectId || null,
            customerId: line.customerId || null,
            vendorId: line.vendorId || null,
            currencyCode: payload.currencyCode || 'EUR',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();

    await writeFinanceAuditLog(payload.tenantId, actorId, 'finance.journal.posted', {
        entryId: entryRef.id,
        entryNumber,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId || null,
        idempotencyKey,
        totalDebit,
        totalCredit,
    });

    return { entryId: entryRef.id, idempotentReplay: false };
};

const loadFinanceSettings = async (tenantId: string) => {
    const settingsSnap = await financeSettingsRef(tenantId).get();
    const data = settingsSnap.data() || {};

    return {
        defaultReceivableAccountId: normalizeString(data.defaultReceivableAccountId) || '1200',
        defaultPayableAccountId: normalizeString(data.defaultPayableAccountId) || '1600',
        defaultRevenueAccountId: normalizeString(data.defaultRevenueAccountId) || '8400',
        defaultExpenseAccountId: normalizeString(data.defaultExpenseAccountId) || '3400',
        defaultCashAccountId: normalizeString(data.defaultCashAccountId) || '1000',
        defaultOutputTaxAccountId: normalizeString(data.defaultOutputTaxAccountId) || '1776',
        defaultInputTaxAccountId: normalizeString(data.defaultInputTaxAccountId) || '1576',
        currencyCode: normalizeCurrencyCode(data.currencyCode, 'EUR'),
    };
};

const normalizeInvoiceLine = (line: unknown, index: number) => {
    const raw = (line || {}) as LooseObject;
    const description = normalizeString(raw.description) || `Position ${index + 1}`;
    const quantity = toNonNegative(raw.quantity);
    const unitPrice = toNonNegative(raw.unitPrice);
    const taxRatePercent = toNonNegative(raw.taxRatePercent);

    if (quantity <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Invoice line quantity must be greater than 0.');
    }

    const netAmount = round2(quantity * unitPrice);
    const taxAmount = round2(netAmount * (taxRatePercent / 100));

    return {
        id: normalizeString(raw.id) || `line-${index + 1}`,
        description,
        quantity,
        unitPrice,
        netAmount,
        taxCodeId: normalizeString(raw.taxCodeId) || null,
        taxRatePercent,
        taxAmount,
        accountId: normalizeString(raw.accountId) || null,
        projectId: normalizeString(raw.projectId) || null,
    };
};

const normalizeBillLine = (line: unknown, index: number) => {
    const raw = (line || {}) as LooseObject;
    const description = normalizeString(raw.description) || `Position ${index + 1}`;
    const quantity = toNonNegative(raw.quantity);
    const unitCost = toNonNegative(raw.unitCost);
    const taxRatePercent = toNonNegative(raw.taxRatePercent);

    if (quantity <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Bill line quantity must be greater than 0.');
    }

    const netAmount = round2(quantity * unitCost);
    const taxAmount = round2(netAmount * (taxRatePercent / 100));

    return {
        id: normalizeString(raw.id) || `line-${index + 1}`,
        description,
        quantity,
        unitCost,
        netAmount,
        taxCodeId: normalizeString(raw.taxCodeId) || null,
        taxRatePercent,
        taxAmount,
        accountId: normalizeString(raw.accountId) || null,
        projectId: normalizeString(raw.projectId) || null,
    };
};

const applyPaymentToTarget = async (
    tenantId: string,
    targetType: 'invoice' | 'bill',
    targetId: string,
    deltaPaid: number,
) => {
    const collectionName = targetType === 'invoice' ? FINANCE_COLLECTIONS.invoices : FINANCE_COLLECTIONS.bills;
    const targetRef = tenantCollectionRef(tenantId, collectionName).doc(targetId);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
        throw new functions.https.HttpsError('not-found', `${targetType} not found.`);
    }

    const targetData = targetSnap.data() || {};
    const grossAmount = toNonNegative(targetData.grossAmount);
    const currentPaid = toNonNegative(targetData.paidAmount);
    const nextPaid = round2(Math.max(0, currentPaid + deltaPaid));
    const nextOpen = round2(Math.max(0, grossAmount - nextPaid));

    let status = normalizeString(targetData.status) || 'issued';
    if (nextOpen <= 0) {
        status = 'paid';
    } else if (nextPaid > 0) {
        status = 'partially_paid';
    }

    await targetRef.update({
        paidAmount: nextPaid,
        openAmount: nextOpen,
        status,
        updatedAt: serverTimestamp(),
    });
};

export const postJournalEntry = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = normalizeJournalInput(data);
    const actorId = await requireFinancePermission(payload.tenantId, context, 'tenant.finance.ledger.post');
    return postJournalEntryInternal(actorId, payload);
});

export const upsertFinanceAccount = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.accounts.manage');

    const accountId = normalizeString(payload.accountId);
    const accountNo = normalizeString(payload.accountNo);
    const name = normalizeString(payload.name);
    const category = normalizeString(payload.category);
    const normalBalance = normalizeString(payload.normalBalance);

    if (!accountNo || !name || !category || !normalBalance) {
        throw new functions.https.HttpsError('invalid-argument', 'accountNo, name, category and normalBalance are required.');
    }

    const ref = accountId
        ? tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.accounts).doc(accountId)
        : tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.accounts).doc();

    await ref.set({
        tenantId,
        accountNo,
        name,
        category,
        normalBalance,
        datevAccountNo: normalizeString(payload.datevAccountNo) || null,
        taxCodeId: normalizeString(payload.taxCodeId) || null,
        isActive: payload.isActive === false ? false : true,
        allowManualPosting: payload.allowManualPosting === false ? false : true,
        notes: normalizeString(payload.notes) || null,
        updatedAt: serverTimestamp(),
        ...(accountId ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.account.upserted', {
        accountId: ref.id,
        accountNo,
        name,
    });

    return { accountId: ref.id };
});

export const upsertFinancePeriod = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.close');

    const periodKey = normalizeString(payload.periodKey);
    const fiscalYearId = normalizeString(payload.fiscalYearId);
    const status = normalizeString(payload.status) || 'open';

    if (!periodKey || !fiscalYearId) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey and fiscalYearId are required.');
    }

    const startDate = toDateFromInput(payload.startDate || `${periodKey}-01`);
    const endDate = payload.endDate
        ? toDateFromInput(payload.endDate)
        : new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0));

    await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.periods).doc(periodKey).set({
        tenantId,
        id: periodKey,
        periodKey,
        monthKey: periodKey,
        fiscalYearId,
        status,
        startDate: admin.firestore.Timestamp.fromDate(startDate),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        notes: normalizeString(payload.notes) || null,
        updatedAt: serverTimestamp(),
        ...(status === 'closed' ? { closedAt: serverTimestamp(), closedBy: actorId } : {}),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.period.upserted', { periodKey, status });

    return { periodKey, status };
});

export const upsertFinanceSettings = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.manage');

    const settings = ((payload.settings || {}) as LooseObject);

    await financeSettingsRef(tenantId).set({
        tenantId,
        id: 'default',
        financeSchemaVersion: 2,
        countryCode: normalizeString(settings.countryCode || 'DE') || 'DE',
        currencyCode: normalizeCurrencyCode(settings.currencyCode, 'EUR'),
        fiscalYearStartMonth: Math.max(1, Math.min(12, Math.floor(toNumber(settings.fiscalYearStartMonth || 1)))),
        softCloseEnabled: settings.softCloseEnabled === false ? false : true,
        defaultUnitLabel: normalizeString(settings.defaultUnitLabel || 'User') || 'User',
        defaultScenarioPreset: normalizeString(settings.defaultScenarioPreset || 'software') || 'software',
        defaultRevenueAccountId: normalizeString(settings.defaultRevenueAccountId) || null,
        defaultExpenseAccountId: normalizeString(settings.defaultExpenseAccountId) || null,
        defaultReceivableAccountId: normalizeString(settings.defaultReceivableAccountId) || null,
        defaultPayableAccountId: normalizeString(settings.defaultPayableAccountId) || null,
        defaultCashAccountId: normalizeString(settings.defaultCashAccountId) || null,
        defaultOutputTaxAccountId: normalizeString(settings.defaultOutputTaxAccountId) || null,
        defaultInputTaxAccountId: normalizeString(settings.defaultInputTaxAccountId) || null,
        updatedAt: serverTimestamp(),
        updatedBy: actorId,
        createdAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.settings.upserted', {
        financeSchemaVersion: 2,
    });

    return { success: true };
});

export const upsertFinanceCustomer = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ar.manage');

    const customerId = normalizeString(payload.customerId);
    const name = normalizeString(payload.name);
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'name is required.');
    }

    const ref = customerId
        ? tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.customers).doc(customerId)
        : tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.customers).doc();

    await ref.set({
        tenantId,
        customerNo: normalizeString(payload.customerNo) || `CUS-${Date.now()}`,
        name,
        email: normalizeString(payload.email) || null,
        vatId: normalizeString(payload.vatId) || null,
        paymentTermsDays: Math.max(0, Math.floor(toNumber(payload.paymentTermsDays || 14))),
        defaultRevenueAccountId: normalizeString(payload.defaultRevenueAccountId) || null,
        isActive: payload.isActive === false ? false : true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.customer.upserted', {
        customerId: ref.id,
        name,
    });

    return { customerId: ref.id };
});

export const upsertFinanceVendor = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ap.manage');

    const vendorId = normalizeString(payload.vendorId);
    const name = normalizeString(payload.name);
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'name is required.');
    }

    const ref = vendorId
        ? tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.vendors).doc(vendorId)
        : tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.vendors).doc();

    await ref.set({
        tenantId,
        vendorNo: normalizeString(payload.vendorNo) || `VEN-${Date.now()}`,
        name,
        email: normalizeString(payload.email) || null,
        vatId: normalizeString(payload.vatId) || null,
        paymentTermsDays: Math.max(0, Math.floor(toNumber(payload.paymentTermsDays || 14))),
        defaultExpenseAccountId: normalizeString(payload.defaultExpenseAccountId) || null,
        isActive: payload.isActive === false ? false : true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.vendor.upserted', {
        vendorId: ref.id,
        name,
    });

    return { vendorId: ref.id };
});

export const extractInvoiceFromDocument = functions.region(REGION).runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ap.manage');

    const fileName = normalizeString(payload.fileName) || 'invoice';
    const rawMimeType = normalizeString(payload.mimeType).toLowerCase();
    const rawBase64 = normalizeString(payload.contentBase64);

    if (!rawBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'contentBase64 is required.');
    }

    const base64Payload = (() => {
        const rawCandidate = rawBase64.includes(',')
            ? rawBase64.split(',').pop() || ''
            : rawBase64;
        return rawCandidate.trim().replace(/\s+/g, '');
    })();

    let binaryContent: Buffer;
    try {
        binaryContent = Buffer.from(base64Payload, 'base64');
    } catch {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid base64 payload.');
    }

    if (binaryContent.length <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Uploaded document is empty.');
    }

    if (binaryContent.length > MAX_INVOICE_UPLOAD_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', 'Uploaded document exceeds the maximum size of 5MB.');
    }

    const normalizedFileName = fileName.toLowerCase();
    const isPdf = rawMimeType.includes('pdf') || normalizedFileName.endsWith('.pdf');
    const isXml = rawMimeType.includes('xml')
        || normalizedFileName.endsWith('.xml')
        || normalizedFileName.endsWith('.xrechnung');

    if (!isPdf && !isXml) {
        throw new functions.https.HttpsError('invalid-argument', 'Only PDF invoices and XML e-invoices are supported.');
    }

    const documentType: InvoiceDocumentType = isPdf ? 'pdf' : 'xml';
    const mimeType = isPdf ? 'application/pdf' : 'application/xml';
    const client = getOpenAiClient();

    const extractionPrompt = `Extract structured vendor invoice data from the provided document.

Return only JSON matching the schema. Use these rules:
- Convert monetary values to numbers (dot decimal separator).
- Dates must be in YYYY-MM-DD format if available, otherwise empty string.
- If an amount is missing, infer it from available values where possible.
- quantity must be > 0 (fallback 1).
- unitCost is net cost per unit.
- taxRatePercent is numeric (fallback 0).
- confidence must be one of: low, medium, high.
- isLikelyRecurring should be true when the document suggests repeated billing (subscription, monthly plan, recurring service, etc.).`;

    const responseSchema = {
        type: 'object',
        additionalProperties: false,
        properties: {
            vendorName: { type: 'string' },
            vendorEmail: { type: 'string' },
            vendorVatId: { type: 'string' },
            invoiceNumber: { type: 'string' },
            invoiceDate: { type: 'string' },
            dueDate: { type: 'string' },
            currencyCode: { type: 'string' },
            lineDescription: { type: 'string' },
            quantity: { type: 'number' },
            unitCost: { type: 'number' },
            taxRatePercent: { type: 'number' },
            netAmount: { type: 'number' },
            taxAmount: { type: 'number' },
            grossAmount: { type: 'number' },
            confidence: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
            },
            isLikelyRecurring: { type: 'boolean' },
            recurringHint: { type: 'string' },
            notes: { type: 'string' },
        },
        required: [
            'vendorName',
            'vendorEmail',
            'vendorVatId',
            'invoiceNumber',
            'invoiceDate',
            'dueDate',
            'currencyCode',
            'lineDescription',
            'quantity',
            'unitCost',
            'taxRatePercent',
            'netAmount',
            'taxAmount',
            'grossAmount',
            'confidence',
            'isLikelyRecurring',
            'recurringHint',
            'notes',
        ],
    };

    const request: any = {
        model: INVOICE_EXTRACTION_MODEL,
        text: {
            format: {
                type: 'json_schema',
                name: 'invoice_document_extract',
                schema: responseSchema,
                strict: true,
            },
        },
    };

    if (documentType === 'pdf') {
        request.input = [{
            role: 'user',
            content: [
                { type: 'input_text', text: extractionPrompt },
                {
                    type: 'input_file',
                    filename: fileName || 'invoice.pdf',
                    file_data: `data:${mimeType};base64,${base64Payload}`,
                },
            ],
        }];
    } else {
        const xmlText = binaryContent.toString('utf8').slice(0, MAX_XML_TEXT_LENGTH);
        request.input = [{
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: `${extractionPrompt}\n\nXML E-Invoice:\n${xmlText}`,
                },
            ],
        }];
    }

    try {
        const response: any = await client.responses.create(request);
        const parsed = parseJsonText(extractTextFromResponse(response));
        const normalized = normalizeInvoiceExtractionResult(parsed, documentType);

        await writeFinanceAuditLog(tenantId, actorId, 'finance.bill.document_extracted', {
            fileName,
            documentType,
            invoiceNumber: normalized.invoiceNumber || null,
            vendorName: normalized.vendorName || null,
            confidence: normalized.confidence,
            model: INVOICE_EXTRACTION_MODEL,
        });

        return {
            ...normalized,
            model: INVOICE_EXTRACTION_MODEL,
        };
    } catch (error: any) {
        console.error('Failed to extract invoice document', error);
        throw new functions.https.HttpsError('internal', error?.message || 'Invoice extraction failed.');
    }
});

export const upsertFinanceTaxCode = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.tax.manage');

    const taxCodeId = normalizeString(payload.taxCodeId);
    const code = normalizeString(payload.code);
    const label = normalizeString(payload.label);
    const kind = normalizeString(payload.kind);

    if (!code || !label || !kind) {
        throw new functions.https.HttpsError('invalid-argument', 'code, label and kind are required.');
    }

    const ref = taxCodeId
        ? tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.taxCodes).doc(taxCodeId)
        : tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.taxCodes).doc();

    await ref.set({
        tenantId,
        code,
        label,
        kind,
        ratePercent: toNonNegative(payload.ratePercent),
        datevKey: normalizeString(payload.datevKey) || null,
        isActive: payload.isActive === false ? false : true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.taxCode.upserted', {
        taxCodeId: ref.id,
        code,
    });

    return { taxCodeId: ref.id };
});

export const createInvoice = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ar.manage');

    const customerId = normalizeString(payload.customerId);
    if (!customerId) {
        throw new functions.https.HttpsError('invalid-argument', 'customerId is required.');
    }

    const lines = Array.isArray(payload.lines)
        ? payload.lines.map((line, index) => normalizeInvoiceLine(line, index))
        : [];

    if (lines.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one invoice line is required.');
    }

    const issueDate = toDateFromInput(payload.issueDate);
    const dueDate = toDateFromInput(payload.dueDate || payload.issueDate);
    const currencyCode = normalizeCurrencyCode(payload.currencyCode, 'EUR');

    const netAmount = round2(sum(lines.map((line) => line.netAmount)));
    const taxAmount = round2(sum(lines.map((line) => line.taxAmount)));
    const grossAmount = round2(netAmount + taxAmount);

    const invoiceRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.invoices).doc();

    await invoiceRef.set({
        tenantId,
        invoiceNo: normalizeString(payload.invoiceNo) || `INV-${Date.now()}`,
        customerId,
        projectId: normalizeString(payload.projectId) || null,
        issueDate: admin.firestore.Timestamp.fromDate(issueDate),
        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
        currencyCode,
        status: 'draft',
        lines,
        notes: normalizeString(payload.notes) || null,
        netAmount,
        taxAmount,
        grossAmount,
        paidAmount: 0,
        openAmount: grossAmount,
        createdBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.invoice.created', {
        invoiceId: invoiceRef.id,
        customerId,
        grossAmount,
    });

    return { invoiceId: invoiceRef.id };
});

export const issueInvoice = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ar.manage');

    const invoiceId = normalizeString(payload.invoiceId);
    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required.');
    }

    const invoiceRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.invoices).doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }

    const invoice = invoiceSnap.data() || {};
    const status = normalizeString(invoice.status);
    if (status !== 'draft') {
        throw new functions.https.HttpsError('failed-precondition', 'Only draft invoices can be issued.');
    }

    const settings = await loadFinanceSettings(tenantId);

    const journalResponse = await postJournalEntryInternal(actorId, {
        tenantId,
        postingDate: (invoice.issueDate as admin.firestore.Timestamp).toDate().toISOString(),
        description: `Invoice ${normalizeString(invoice.invoiceNo)}`,
        sourceType: 'invoice',
        sourceId: invoiceId,
        sourceRefNo: normalizeString(invoice.invoiceNo),
        projectId: normalizeString(invoice.projectId) || undefined,
        currencyCode: normalizeCurrencyCode(invoice.currencyCode, settings.currencyCode),
        idempotencyKey: `invoice-issue-${invoiceId}`,
        lines: [
            {
                accountId: settings.defaultReceivableAccountId,
                debit: toNonNegative(invoice.grossAmount),
                credit: 0,
                description: 'Receivable',
                customerId: normalizeString(invoice.customerId) || undefined,
                projectId: normalizeString(invoice.projectId) || undefined,
            },
            {
                accountId: settings.defaultRevenueAccountId,
                debit: 0,
                credit: toNonNegative(invoice.netAmount),
                description: 'Revenue',
                customerId: normalizeString(invoice.customerId) || undefined,
                projectId: normalizeString(invoice.projectId) || undefined,
            },
            ...(toNonNegative(invoice.taxAmount) > 0
                ? [{
                    accountId: settings.defaultOutputTaxAccountId,
                    debit: 0,
                    credit: toNonNegative(invoice.taxAmount),
                    description: 'Output tax',
                    customerId: normalizeString(invoice.customerId) || undefined,
                    projectId: normalizeString(invoice.projectId) || undefined,
                }]
                : []),
        ],
    });

    await invoiceRef.update({
        status: 'issued',
        journalEntryId: journalResponse.entryId,
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.invoice.issued', {
        invoiceId,
        journalEntryId: journalResponse.entryId,
    });

    return { invoiceId, journalEntryId: journalResponse.entryId };
});

export const voidInvoice = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ar.manage');

    const invoiceId = normalizeString(payload.invoiceId);
    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required.');
    }

    const invoiceRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.invoices).doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }

    const invoice = invoiceSnap.data() || {};
    const status = normalizeString(invoice.status);
    if (status === 'voided') {
        return { invoiceId, alreadyVoided: true };
    }

    const journalEntryId = normalizeString(invoice.journalEntryId);
    if (journalEntryId) {
        const linesSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalLines)
            .where('entryId', '==', journalEntryId)
            .orderBy('lineNo', 'asc')
            .get();

        const reverseLines = linesSnap.docs.map((doc) => {
            const line = doc.data();
            return {
                accountId: normalizeString(line.accountId),
                debit: toNonNegative(line.credit),
                credit: toNonNegative(line.debit),
                description: `Reversal ${normalizeString(line.description)}`,
                taxCodeId: normalizeString(line.taxCodeId) || undefined,
                projectId: normalizeString(line.projectId) || undefined,
                customerId: normalizeString(line.customerId) || undefined,
                vendorId: normalizeString(line.vendorId) || undefined,
            };
        });

        if (reverseLines.length >= 2) {
            await postJournalEntryInternal(actorId, {
                tenantId,
                postingDate: new Date().toISOString(),
                description: `Reversal invoice ${normalizeString(invoice.invoiceNo)}`,
                sourceType: 'invoice',
                sourceId: invoiceId,
                sourceRefNo: normalizeString(invoice.invoiceNo),
                projectId: normalizeString(invoice.projectId) || undefined,
                currencyCode: normalizeCurrencyCode(invoice.currencyCode, 'EUR'),
                idempotencyKey: `invoice-void-${invoiceId}`,
                lines: reverseLines,
            });
        }
    }

    await invoiceRef.update({
        status: 'voided',
        openAmount: 0,
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.invoice.voided', {
        invoiceId,
        reason: normalizeString(payload.reason) || null,
    });

    return { invoiceId, status: 'voided' };
});

export const createBill = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ap.manage');

    const vendorId = normalizeString(payload.vendorId);
    if (!vendorId) {
        throw new functions.https.HttpsError('invalid-argument', 'vendorId is required.');
    }

    const lines = Array.isArray(payload.lines)
        ? payload.lines.map((line, index) => normalizeBillLine(line, index))
        : [];

    if (lines.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'At least one bill line is required.');
    }

    const billDate = toDateFromInput(payload.billDate);
    const dueDate = toDateFromInput(payload.dueDate || payload.billDate);
    const currencyCode = normalizeCurrencyCode(payload.currencyCode, 'EUR');

    const netAmount = round2(sum(lines.map((line) => line.netAmount)));
    const taxAmount = round2(sum(lines.map((line) => line.taxAmount)));
    const grossAmount = round2(netAmount + taxAmount);

    const billRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.bills).doc();

    await billRef.set({
        tenantId,
        billNo: normalizeString(payload.billNo) || `BILL-${Date.now()}`,
        vendorId,
        projectId: normalizeString(payload.projectId) || null,
        billDate: admin.firestore.Timestamp.fromDate(billDate),
        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
        currencyCode,
        status: 'draft',
        lines,
        notes: normalizeString(payload.notes) || null,
        netAmount,
        taxAmount,
        grossAmount,
        paidAmount: 0,
        openAmount: grossAmount,
        createdBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.bill.created', {
        billId: billRef.id,
        vendorId,
        grossAmount,
    });

    return { billId: billRef.id };
});

export const postBill = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ap.manage');

    const billId = normalizeString(payload.billId);
    if (!billId) {
        throw new functions.https.HttpsError('invalid-argument', 'billId is required.');
    }

    const billRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.bills).doc(billId);
    const billSnap = await billRef.get();
    if (!billSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Bill not found.');
    }

    const bill = billSnap.data() || {};
    const status = normalizeString(bill.status);
    if (status !== 'draft') {
        throw new functions.https.HttpsError('failed-precondition', 'Only draft bills can be posted.');
    }

    const settings = await loadFinanceSettings(tenantId);

    const journalResponse = await postJournalEntryInternal(actorId, {
        tenantId,
        postingDate: (bill.billDate as admin.firestore.Timestamp).toDate().toISOString(),
        description: `Bill ${normalizeString(bill.billNo)}`,
        sourceType: 'bill',
        sourceId: billId,
        sourceRefNo: normalizeString(bill.billNo),
        projectId: normalizeString(bill.projectId) || undefined,
        currencyCode: normalizeCurrencyCode(bill.currencyCode, settings.currencyCode),
        idempotencyKey: `bill-post-${billId}`,
        lines: [
            {
                accountId: settings.defaultExpenseAccountId,
                debit: toNonNegative(bill.netAmount),
                credit: 0,
                description: 'Expense',
                vendorId: normalizeString(bill.vendorId) || undefined,
                projectId: normalizeString(bill.projectId) || undefined,
            },
            ...(toNonNegative(bill.taxAmount) > 0
                ? [{
                    accountId: settings.defaultInputTaxAccountId,
                    debit: toNonNegative(bill.taxAmount),
                    credit: 0,
                    description: 'Input tax',
                    vendorId: normalizeString(bill.vendorId) || undefined,
                    projectId: normalizeString(bill.projectId) || undefined,
                }]
                : []),
            {
                accountId: settings.defaultPayableAccountId,
                debit: 0,
                credit: toNonNegative(bill.grossAmount),
                description: 'Payable',
                vendorId: normalizeString(bill.vendorId) || undefined,
                projectId: normalizeString(bill.projectId) || undefined,
            },
        ],
    });

    await billRef.update({
        status: 'posted',
        journalEntryId: journalResponse.entryId,
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.bill.posted', {
        billId,
        journalEntryId: journalResponse.entryId,
    });

    return { billId, journalEntryId: journalResponse.entryId };
});

export const voidBill = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.ap.manage');

    const billId = normalizeString(payload.billId);
    if (!billId) {
        throw new functions.https.HttpsError('invalid-argument', 'billId is required.');
    }

    const billRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.bills).doc(billId);
    const billSnap = await billRef.get();
    if (!billSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Bill not found.');
    }

    const bill = billSnap.data() || {};
    const status = normalizeString(bill.status);
    if (status === 'voided') {
        return { billId, alreadyVoided: true };
    }

    const journalEntryId = normalizeString(bill.journalEntryId);
    if (journalEntryId) {
        const linesSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalLines)
            .where('entryId', '==', journalEntryId)
            .orderBy('lineNo', 'asc')
            .get();

        const reverseLines = linesSnap.docs.map((doc) => {
            const line = doc.data();
            return {
                accountId: normalizeString(line.accountId),
                debit: toNonNegative(line.credit),
                credit: toNonNegative(line.debit),
                description: `Reversal ${normalizeString(line.description)}`,
                taxCodeId: normalizeString(line.taxCodeId) || undefined,
                projectId: normalizeString(line.projectId) || undefined,
                customerId: normalizeString(line.customerId) || undefined,
                vendorId: normalizeString(line.vendorId) || undefined,
            };
        });

        if (reverseLines.length >= 2) {
            await postJournalEntryInternal(actorId, {
                tenantId,
                postingDate: new Date().toISOString(),
                description: `Reversal bill ${normalizeString(bill.billNo)}`,
                sourceType: 'bill',
                sourceId: billId,
                sourceRefNo: normalizeString(bill.billNo),
                projectId: normalizeString(bill.projectId) || undefined,
                currencyCode: normalizeCurrencyCode(bill.currencyCode, 'EUR'),
                idempotencyKey: `bill-void-${billId}`,
                lines: reverseLines,
            });
        }
    }

    await billRef.update({
        status: 'voided',
        openAmount: 0,
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.bill.voided', {
        billId,
        reason: normalizeString(payload.reason) || null,
    });

    return { billId, status: 'voided' };
});

export const recordPayment = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.manage');

    const amount = toNonNegative(payload.amount);
    if (amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'amount must be greater than 0.');
    }

    const direction = normalizeString(payload.direction) === 'outgoing' ? 'outgoing' : 'incoming';
    const paymentDate = toDateFromInput(payload.paymentDate);
    const customerId = normalizeString(payload.customerId) || null;
    const vendorId = normalizeString(payload.vendorId) || null;
    const projectId = normalizeString(payload.projectId) || null;

    const paymentRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.payments).doc();
    const settings = await loadFinanceSettings(tenantId);

    const journalLines = direction === 'incoming'
        ? [
            {
                accountId: settings.defaultCashAccountId,
                debit: amount,
                credit: 0,
                description: 'Cash in',
                customerId: customerId || undefined,
                projectId: projectId || undefined,
            },
            {
                accountId: customerId ? settings.defaultReceivableAccountId : settings.defaultRevenueAccountId,
                debit: 0,
                credit: amount,
                description: customerId ? 'Receivable settlement' : 'Income settlement',
                customerId: customerId || undefined,
                projectId: projectId || undefined,
            },
        ]
        : [
            {
                accountId: vendorId ? settings.defaultPayableAccountId : settings.defaultExpenseAccountId,
                debit: amount,
                credit: 0,
                description: vendorId ? 'Payable settlement' : 'Expense settlement',
                vendorId: vendorId || undefined,
                projectId: projectId || undefined,
            },
            {
                accountId: settings.defaultCashAccountId,
                debit: 0,
                credit: amount,
                description: 'Cash out',
                vendorId: vendorId || undefined,
                projectId: projectId || undefined,
            },
        ];

    const journal = await postJournalEntryInternal(actorId, {
        tenantId,
        postingDate: paymentDate.toISOString(),
        description: `Payment ${paymentRef.id}`,
        sourceType: 'payment',
        sourceId: paymentRef.id,
        currencyCode: normalizeCurrencyCode(payload.currencyCode, settings.currencyCode),
        idempotencyKey: `payment-record-${paymentRef.id}`,
        projectId: projectId || undefined,
        lines: journalLines,
    });

    await paymentRef.set({
        tenantId,
        paymentNo: `PAY-${Date.now()}`,
        direction,
        paymentDate: admin.firestore.Timestamp.fromDate(paymentDate),
        amount,
        currencyCode: normalizeCurrencyCode(payload.currencyCode, settings.currencyCode),
        bankAccountId: normalizeString(payload.bankAccountId) || null,
        customerId,
        vendorId,
        projectId,
        notes: normalizeString(payload.notes) || null,
        status: 'recorded',
        allocatedAmount: 0,
        unallocatedAmount: amount,
        journalEntryId: journal.entryId,
        createdBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.payment.recorded', {
        paymentId: paymentRef.id,
        amount,
        direction,
    });

    return { paymentId: paymentRef.id, journalEntryId: journal.entryId };
});

export const allocatePayment = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.manage');

    const paymentId = normalizeString(payload.paymentId);
    const targetType = normalizeString(payload.targetType) === 'bill' ? 'bill' : 'invoice';
    const targetId = normalizeString(payload.targetId);
    const amount = toNonNegative(payload.amount);

    if (!paymentId || !targetId || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'paymentId, targetId and amount > 0 are required.');
    }

    const paymentRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.payments).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Payment not found.');
    }

    const payment = paymentSnap.data() || {};
    const unallocatedAmount = toNonNegative(payment.unallocatedAmount);
    if (amount > unallocatedAmount + 0.00001) {
        throw new functions.https.HttpsError('failed-precondition', 'Allocation exceeds unallocated payment amount.');
    }

    const allocationRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.paymentAllocations).doc();
    await allocationRef.set({
        tenantId,
        paymentId,
        targetType,
        targetId,
        amount,
        currencyCode: normalizeCurrencyCode(payment.currencyCode, 'EUR'),
        createdBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    const nextAllocatedAmount = round2(toNonNegative(payment.allocatedAmount) + amount);
    const nextUnallocatedAmount = round2(unallocatedAmount - amount);
    const paymentStatus = nextUnallocatedAmount <= 0 ? 'allocated' : 'partially_allocated';

    await paymentRef.update({
        allocatedAmount: nextAllocatedAmount,
        unallocatedAmount: nextUnallocatedAmount,
        status: paymentStatus,
        updatedAt: serverTimestamp(),
    });

    await applyPaymentToTarget(tenantId, targetType, targetId, amount);

    await writeFinanceAuditLog(tenantId, actorId, 'finance.payment.allocated', {
        paymentId,
        targetType,
        targetId,
        amount,
    });

    return { allocationId: allocationRef.id };
});

export const unallocatePayment = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.manage');

    const paymentId = normalizeString(payload.paymentId);
    const targetType = normalizeString(payload.targetType) === 'bill' ? 'bill' : 'invoice';
    const targetId = normalizeString(payload.targetId);
    const amount = toNonNegative(payload.amount);

    if (!paymentId || !targetId || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'paymentId, targetId and amount > 0 are required.');
    }

    const allocationSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.paymentAllocations)
        .where('paymentId', '==', paymentId)
        .where('targetType', '==', targetType)
        .where('targetId', '==', targetId)
        .where('amount', '==', amount)
        .limit(1)
        .get();

    if (allocationSnap.empty) {
        throw new functions.https.HttpsError('not-found', 'Matching payment allocation not found.');
    }

    const allocationDoc = allocationSnap.docs[0];

    const paymentRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.payments).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Payment not found.');
    }

    const payment = paymentSnap.data() || {};
    const nextAllocatedAmount = round2(Math.max(0, toNonNegative(payment.allocatedAmount) - amount));
    const nextUnallocatedAmount = round2(toNonNegative(payment.unallocatedAmount) + amount);

    await allocationDoc.ref.delete();
    await paymentRef.update({
        allocatedAmount: nextAllocatedAmount,
        unallocatedAmount: nextUnallocatedAmount,
        status: nextAllocatedAmount > 0 ? 'partially_allocated' : 'recorded',
        updatedAt: serverTimestamp(),
    });

    await applyPaymentToTarget(tenantId, targetType, targetId, -amount);

    await writeFinanceAuditLog(tenantId, actorId, 'finance.payment.unallocated', {
        paymentId,
        targetType,
        targetId,
        amount,
    });

    return { success: true };
});

export const importBankStatement = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.reconciliation.manage');

    const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
    if (transactions.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'transactions array is required.');
    }

    const bankAccountId = normalizeString(payload.bankAccountId) || null;
    const batch = db.batch();
    const col = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.bankTransactions);

    transactions.forEach((transaction) => {
        const raw = (transaction || {}) as LooseObject;
        const bookingDate = toDateFromInput(raw.bookingDate);
        const ref = col.doc();
        batch.set(ref, {
            tenantId,
            bankAccountId,
            bookingDate: admin.firestore.Timestamp.fromDate(bookingDate),
            valueDate: normalizeString(raw.valueDate)
                ? admin.firestore.Timestamp.fromDate(toDateFromInput(raw.valueDate))
                : null,
            amount: round2(toNumber(raw.amount)),
            currencyCode: normalizeCurrencyCode(raw.currencyCode, 'EUR'),
            description: normalizeString(raw.description) || null,
            counterparty: normalizeString(raw.counterparty) || null,
            externalReference: normalizeString(raw.externalReference) || null,
            projectId: normalizeString(raw.projectId) || null,
            reconciled: false,
            reconciliationId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();

    await writeFinanceAuditLog(tenantId, actorId, 'finance.bank.imported', {
        count: transactions.length,
        bankAccountId,
    });

    return { importedCount: transactions.length };
});

export const suggestReconciliation = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    await requireFinancePermission(tenantId, context, 'tenant.finance.reconciliation.manage');

    const periodKey = normalizeString(payload.periodKey) || null;

    let query = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.bankTransactions)
        .where('reconciled', '==', false) as admin.firestore.Query;

    if (periodKey) {
        const [yearStr, monthStr] = periodKey.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        if (Number.isFinite(year) && Number.isFinite(month)) {
            const from = new Date(Date.UTC(year, month - 1, 1));
            const to = new Date(Date.UTC(year, month, 1));
            query = query.where('bookingDate', '>=', admin.firestore.Timestamp.fromDate(from))
                .where('bookingDate', '<', admin.firestore.Timestamp.fromDate(to));
        }
    }

    const [bankTxSnap, invoicesSnap, billsSnap] = await Promise.all([
        query.get(),
        tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.invoices)
            .where('status', 'in', ['issued', 'partially_paid'])
            .get(),
        tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.bills)
            .where('status', 'in', ['posted', 'partially_paid'])
            .get(),
    ]);

    const openInvoices: Array<{ id: string; openAmount?: unknown }> = invoicesSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }));
    const openBills: Array<{ id: string; openAmount?: unknown }> = billsSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }));

    const suggestions = bankTxSnap.docs.map((doc) => {
        const tx = doc.data();
        const amount = round2(toNumber(tx.amount));

        if (amount >= 0) {
            const invoiceMatch = openInvoices.find((invoice) => Math.abs(round2(toNumber(invoice.openAmount)) - amount) < 0.01);
            if (invoiceMatch) {
                return {
                    bankTransactionId: doc.id,
                    targetType: 'invoice',
                    targetId: invoiceMatch.id,
                    amount,
                    confidence: 0.92,
                };
            }
        } else {
            const absAmount = Math.abs(amount);
            const billMatch = openBills.find((bill) => Math.abs(round2(toNumber(bill.openAmount)) - absAmount) < 0.01);
            if (billMatch) {
                return {
                    bankTransactionId: doc.id,
                    targetType: 'bill',
                    targetId: billMatch.id,
                    amount: absAmount,
                    confidence: 0.92,
                };
            }
        }

        return {
            bankTransactionId: doc.id,
            targetType: null,
            targetId: null,
            amount: Math.abs(amount),
            confidence: 0,
        };
    });

    return { suggestions };
});

export const confirmReconciliation = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.reconciliation.manage');

    const periodKey = normalizeString(payload.periodKey) || toPeriodKey(new Date());
    const matchedTransactionIds = Array.isArray(payload.matchedTransactionIds)
        ? payload.matchedTransactionIds.map((value) => normalizeString(value)).filter(Boolean)
        : [];
    const unmatchedTransactionIds = Array.isArray(payload.unmatchedTransactionIds)
        ? payload.unmatchedTransactionIds.map((value) => normalizeString(value)).filter(Boolean)
        : [];

    const reconciliationRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.reconciliations).doc();
    const batch = db.batch();

    batch.set(reconciliationRef, {
        tenantId,
        bankAccountId: normalizeString(payload.bankAccountId) || null,
        periodKey,
        matchedTransactionIds,
        unmatchedTransactionIds,
        notes: normalizeString(payload.notes) || null,
        confirmedBy: actorId,
        confirmedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    matchedTransactionIds.forEach((id) => {
        const txRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.bankTransactions).doc(id);
        batch.update(txRef, {
            reconciled: true,
            reconciliationId: reconciliationRef.id,
            updatedAt: serverTimestamp(),
        });
    });

    await batch.commit();

    await writeFinanceAuditLog(tenantId, actorId, 'finance.reconciliation.confirmed', {
        reconciliationId: reconciliationRef.id,
        periodKey,
        matchedCount: matchedTransactionIds.length,
        unmatchedCount: unmatchedTransactionIds.length,
    });

    return { reconciliationId: reconciliationRef.id };
});

export const runMonthlyClose = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.close');

    const periodKey = normalizeString(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }

    await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.periods).doc(periodKey).set({
        tenantId,
        id: periodKey,
        periodKey,
        monthKey: periodKey,
        status: 'closed',
        notes: normalizeString(payload.notes) || null,
        closedBy: actorId,
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.period.closed', {
        periodKey,
    });

    return { periodKey, status: 'closed' };
});

export const reopenPeriod = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.close');

    const periodKey = normalizeString(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }

    await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.periods).doc(periodKey).set({
        tenantId,
        id: periodKey,
        periodKey,
        monthKey: periodKey,
        status: 'open',
        reopenReason: normalizeString(payload.reason) || null,
        reopenedBy: actorId,
        reopenedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.period.reopened', {
        periodKey,
        reason: normalizeString(payload.reason) || null,
    });

    return { periodKey, status: 'open' };
});

export const generateDatevExport = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.export.datev');

    const periodKey = normalizeString(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }

    const exportRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.exports).doc();
    await exportRef.set({
        tenantId,
        type: 'datev',
        periodKey,
        status: 'running',
        createdBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    const entriesSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalEntries)
        .where('periodKey', '==', periodKey)
        .orderBy('postingDate', 'asc')
        .get();

    const entryIds = entriesSnap.docs.map((doc) => doc.id);
    let linesSnap: admin.firestore.QuerySnapshot = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalLines)
        .where('entryId', '==', '__none__')
        .get();

    if (entryIds.length > 0) {
        const chunks: string[][] = [];
        for (let index = 0; index < entryIds.length; index += 10) {
            chunks.push(entryIds.slice(index, index + 10));
        }

        const chunkSnapshots = await Promise.all(chunks.map((chunk) =>
            tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalLines)
                .where('entryId', 'in', chunk)
                .orderBy('entryId', 'asc')
                .orderBy('lineNo', 'asc')
                .get()
        ));

        const allDocs = chunkSnapshots.flatMap((snapshot) => snapshot.docs);
        linesSnap = {
            docs: allDocs,
        } as admin.firestore.QuerySnapshot;
    }

    const entryMap = new Map(entriesSnap.docs.map((doc) => [doc.id, doc.data()]));

    const csvRows = ['Umsatz;Sollkonto;Habenkonto;Belegdatum;Buchungstext;Belegfeld1;WKZ'];

    linesSnap.docs.forEach((doc) => {
        const line = doc.data();
        const entry = entryMap.get(normalizeString(line.entryId));
        if (!entry) return;

        const postingDate = (entry.postingDate as admin.firestore.Timestamp).toDate().toISOString().slice(0, 10);
        const amount = toNonNegative(line.debit) > 0 ? toNonNegative(line.debit) : toNonNegative(line.credit);

        const sibling = linesSnap.docs.find((candidate) => {
            const candidateData = candidate.data();
            return normalizeString(candidateData.entryId) === normalizeString(line.entryId) && candidate.id !== doc.id;
        });

        const contraAccount = sibling ? normalizeString(sibling.data().accountId) : '';
        const debit = toNonNegative(line.debit) > 0;
        const sollkonto = debit ? normalizeString(line.accountId) : contraAccount;
        const habenkonto = debit ? contraAccount : normalizeString(line.accountId);

        csvRows.push([
            round2(amount).toFixed(2).replace('.', ','),
            sollkonto,
            habenkonto,
            postingDate,
            normalizeString(entry.description),
            normalizeString(entry.sourceRefNo),
            normalizeCurrencyCode(entry.currencyCode, 'EUR'),
        ].join(';'));
    });

    const csv = csvRows.join('\n');
    const fileName = `datev_${periodKey}_${new Date().toISOString().slice(0, 10)}.csv`;

    await exportRef.update({
        status: 'completed',
        fileName,
        payloadPreview: csv.slice(0, 120000),
        updatedAt: serverTimestamp(),
    });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.datev.export.generated', {
        exportJobId: exportRef.id,
        periodKey,
        rowCount: csvRows.length - 1,
    });

    return { exportJobId: exportRef.id, status: 'completed' };
});

export const buildFinancialReports = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    await requireFinancePermission(tenantId, context, 'tenant.finance.view');

    const periodKeyFrom = normalizeString(payload.periodKeyFrom) || null;
    const periodKeyTo = normalizeString(payload.periodKeyTo) || null;

    const accountsSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.accounts).get();
    const accountMap = new Map(accountsSnap.docs.map((doc) => [doc.id, doc.data()]));

    let lineQuery = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalLines) as admin.firestore.Query;

    if (periodKeyFrom || periodKeyTo) {
        const entriesQuery = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalEntries) as admin.firestore.Query;
        const filteredEntriesSnap = await entriesQuery.get();
        const entryIds = filteredEntriesSnap.docs
            .filter((doc) => {
                const periodKey = normalizeString(doc.data().periodKey);
                if (periodKeyFrom && periodKey < periodKeyFrom) return false;
                if (periodKeyTo && periodKey > periodKeyTo) return false;
                return true;
            })
            .map((doc) => doc.id);

        if (entryIds.length === 0) {
            return {
                generatedAt: new Date().toISOString(),
                trialBalance: [],
                pnl: [],
                balanceSheet: [],
                projectProfitability: [],
            };
        }

        if (entryIds.length <= 10) {
            lineQuery = lineQuery.where('entryId', 'in', entryIds);
        }
    }

    const linesSnap = await lineQuery.get();

    const trialBalanceMap = new Map<string, { debit: number; credit: number }>();
    const profitabilityMap = new Map<string, { revenue: number; cost: number; aiCost: number }>();

    linesSnap.docs.forEach((doc) => {
        const line = doc.data();
        const accountId = normalizeString(line.accountId);
        const debit = toNonNegative(line.debit);
        const credit = toNonNegative(line.credit);

        const current = trialBalanceMap.get(accountId) || { debit: 0, credit: 0 };
        current.debit += debit;
        current.credit += credit;
        trialBalanceMap.set(accountId, current);

        const account = accountMap.get(accountId) || {};
        const category = normalizeString(account.category);
        const accountName = normalizeString(account.name).toLowerCase();
        const lineDescription = normalizeString(line.description).toLowerCase();
        const projectId = normalizeString(line.projectId) || '__unassigned__';

        if (category === 'revenue' || category === 'expense') {
            const row = profitabilityMap.get(projectId) || { revenue: 0, cost: 0, aiCost: 0 };
            if (category === 'revenue') {
                row.revenue += credit - debit;
            } else {
                row.cost += debit - credit;
                if (accountName.includes('ai') || accountName.includes('token') || lineDescription.includes('ai') || lineDescription.includes('token')) {
                    row.aiCost += Math.max(0, debit - credit);
                }
            }
            profitabilityMap.set(projectId, row);
        }
    });

    const trialBalance = Array.from(trialBalanceMap.entries())
        .map(([accountId, values]) => {
            const account = accountMap.get(accountId) || {};
            return {
                accountId,
                accountNo: normalizeString(account.accountNo) || '',
                accountName: normalizeString(account.name) || accountId,
                debit: round2(values.debit),
                credit: round2(values.credit),
                balance: round2(values.debit - values.credit),
            };
        })
        .sort((a, b) => a.accountNo.localeCompare(b.accountNo));

    const pnl = trialBalance
        .map((row) => {
            const account = accountMap.get(row.accountId) || {};
            const category = normalizeString(account.category);
            if (category !== 'revenue' && category !== 'expense') return null;
            return {
                accountId: row.accountId,
                accountNo: row.accountNo,
                accountName: row.accountName,
                category,
                amount: round2(category === 'revenue' ? row.credit - row.debit : row.debit - row.credit),
            };
        })
        .filter(Boolean);

    const balanceSheet = trialBalance
        .map((row) => {
            const account = accountMap.get(row.accountId) || {};
            const category = normalizeString(account.category);
            if (!['asset', 'liability', 'equity'].includes(category)) return null;
            return {
                accountId: row.accountId,
                accountNo: row.accountNo,
                accountName: row.accountName,
                category,
                amount: round2(row.balance),
            };
        })
        .filter(Boolean);

    const projectProfitability = Array.from(profitabilityMap.entries()).map(([projectId, values]) => {
        const directCosts = round2(values.cost);
        const aiCosts = round2(values.aiCost);
        const revenue = round2(values.revenue);
        const grossProfit = round2(revenue - directCosts);
        const netProfit = grossProfit;
        const marginPercent = revenue > 0 ? round2((netProfit / revenue) * 100) : 0;

        return {
            projectId,
            projectName: projectId === '__unassigned__' ? '__unassigned__' : projectId,
            revenue,
            directCosts,
            aiCosts,
            overheadAllocated: 0,
            grossProfit,
            netProfit,
            marginPercent,
        };
    }).sort((a, b) => b.netProfit - a.netProfit);

    return {
        generatedAt: new Date().toISOString(),
        trialBalance,
        pnl,
        balanceSheet,
        projectProfitability,
    };
});

export const buildTaxReport = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.tax.manage');

    const periodKey = normalizeString(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }

    const [taxCodesSnap, entriesSnap] = await Promise.all([
        tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.taxCodes).get(),
        tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalEntries)
            .where('periodKey', '==', periodKey)
            .get(),
    ]);

    const taxCodeMap = new Map(taxCodesSnap.docs.map((doc) => [doc.id, doc.data()]));
    const entryIds = entriesSnap.docs.map((doc) => doc.id);

    let outputTax = 0;
    let inputTax = 0;

    if (entryIds.length > 0) {
        const chunks: string[][] = [];
        for (let index = 0; index < entryIds.length; index += 10) {
            chunks.push(entryIds.slice(index, index + 10));
        }

        for (const chunk of chunks) {
            const linesSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalLines)
                .where('entryId', 'in', chunk)
                .get();

            linesSnap.docs.forEach((doc) => {
                const line = doc.data();
                const taxCodeId = normalizeString(line.taxCodeId);
                if (!taxCodeId) return;
                const taxCode = taxCodeMap.get(taxCodeId) || {};
                const kind = normalizeString(taxCode.kind);
                const amount = Math.abs(toNonNegative(line.debit) - toNonNegative(line.credit));

                if (kind === 'output') outputTax += amount;
                if (kind === 'input') inputTax += amount;
            });
        }
    }

    const payableTax = round2(outputTax - inputTax);

    const reportRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.taxReports).doc(periodKey);
    await reportRef.set({
        tenantId,
        periodKey,
        outputTax: round2(outputTax),
        inputTax: round2(inputTax),
        payableTax,
        currencyCode: 'EUR',
        generatedBy: actorId,
        generatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.taxPeriods).doc(periodKey).set({
        tenantId,
        periodKey,
        status: 'open',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.tax.report.generated', {
        periodKey,
        outputTax: round2(outputTax),
        inputTax: round2(inputTax),
        payableTax,
    });

    return {
        periodKey,
        outputTax: round2(outputTax),
        inputTax: round2(inputTax),
        payableTax,
    };
});

export const upsertScenario = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.manage');

    const scenario = ((payload.scenario || {}) as LooseObject);
    const scenarioId = normalizeString(payload.scenarioId);
    const name = normalizeString(scenario.name);
    const unitLabel = normalizeString(scenario.unitLabel || 'User');
    const plannedUnits = toNonNegative(scenario.plannedUnits);

    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'scenario.name is required.');
    }
    if (plannedUnits <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'scenario.plannedUnits must be greater than 0.');
    }

    const ref = scenarioId
        ? tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.scenarios).doc(scenarioId)
        : tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.scenarios).doc();

    const snapshot = calculateScenarioSnapshotFromInput(scenario);

    await ref.set({
        ...scenario,
        tenantId,
        userId: actorId,
        name,
        unitLabel,
        period: normalizeString(scenario.period || 'monthly') || 'monthly',
        preset: normalizeString(scenario.preset || 'software') || 'software',
        plannedUnits,
        pricePerUnit: toNonNegative(scenario.pricePerUnit),
        targetProfitPercentOnCost: toNonNegative(scenario.targetProfitPercentOnCost),
        fixedCostItems: Array.isArray(scenario.fixedCostItems) ? scenario.fixedCostItems : [],
        variableCostItemsPerUnit: Array.isArray(scenario.variableCostItemsPerUnit) ? scenario.variableCostItemsPerUnit : [],
        snapshot,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
    }, { merge: true });

    await writeFinanceAuditLog(tenantId, actorId, 'finance.scenario.upserted', {
        scenarioId: ref.id,
        name,
    });

    return { scenarioId: ref.id, snapshot };
});

export const calculateScenarioSnapshot = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    await requireFinancePermission(tenantId, context, 'tenant.finance.view');

    const scenario = ((payload.scenario || {}) as LooseObject);
    const result = calculateScenarioSnapshotFromInput(scenario);

    return { result };
});

export const migrateLegacyFinanceV1ToV2 = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as LooseObject;
    const tenantId = normalizeString(payload.tenantId);
    const actorId = await requireFinancePermission(tenantId, context, 'tenant.finance.manage');
    const dryRun = Boolean(payload.dryRun);

    const legacyTransactionsSnap = await tenantCollectionRef(tenantId, 'transactions').get();
    const legacyRecurringSnap = await tenantCollectionRef(tenantId, 'recurringTransactions').get();
    const legacyScenariosSnap = await tenantCollectionRef(tenantId, 'financeScenarios').get();
    const existingMigrationEntriesSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.journalEntries)
        .where('sourceType', '==', 'migration')
        .get();
    const existingV2ScenariosSnap = await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.scenarios).get();

    const existingMigratedSourceIds = new Set<string>(
        existingMigrationEntriesSnap.docs
            .map((doc) => normalizeString(doc.data().sourceId))
            .filter(Boolean),
    );

    const existingScenarioIds = new Set<string>(existingV2ScenariosSnap.docs.map((doc) => doc.id));
    const settings = await loadFinanceSettings(tenantId);

    const summary = {
        dryRun,
        transactions: {
            total: legacyTransactionsSnap.size,
            migrated: 0,
            skipped: 0,
            incomeTotal: 0,
            expenseTotal: 0,
        },
        recurring: {
            total: legacyRecurringSnap.size,
            migrated: 0,
            skipped: 0,
        },
        scenarios: {
            total: legacyScenariosSnap.size,
            migrated: 0,
            skipped: 0,
        },
    };

    for (const doc of legacyTransactionsSnap.docs) {
        const tx = doc.data() || {};
        const sourceId = doc.id;

        if (existingMigratedSourceIds.has(sourceId)) {
            summary.transactions.skipped += 1;
            continue;
        }

        const type = normalizeString(tx.type) === 'income' ? 'income' : 'expense';
        const amount = round2(toNonNegative(tx.amount));
        if (amount <= 0) {
            summary.transactions.skipped += 1;
            continue;
        }

        if (type === 'income') {
            summary.transactions.incomeTotal += amount;
        } else {
            summary.transactions.expenseTotal += amount;
        }

        const legacyDate = (() => {
            const raw = tx.date as any;
            if (raw && typeof raw.toDate === 'function') {
                return raw.toDate() as Date;
            }
            const parsed = new Date(raw || Date.now());
            return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        })();

        if (!dryRun) {
            await postJournalEntryInternal(actorId, {
                tenantId,
                postingDate: legacyDate.toISOString(),
                description: `Legacy ${type}: ${normalizeString(tx.category) || 'uncategorized'}`,
                sourceType: 'migration',
                sourceId,
                sourceRefNo: sourceId,
                projectId: normalizeString(tx.projectId) || undefined,
                currencyCode: settings.currencyCode,
                idempotencyKey: `legacy-transaction-${sourceId}`,
                lines: type === 'income'
                    ? [
                        {
                            accountId: settings.defaultCashAccountId,
                            debit: amount,
                            credit: 0,
                            description: 'Legacy income cash',
                            projectId: normalizeString(tx.projectId) || undefined,
                        },
                        {
                            accountId: settings.defaultRevenueAccountId,
                            debit: 0,
                            credit: amount,
                            description: 'Legacy income revenue',
                            projectId: normalizeString(tx.projectId) || undefined,
                        },
                    ]
                    : [
                        {
                            accountId: settings.defaultExpenseAccountId,
                            debit: amount,
                            credit: 0,
                            description: 'Legacy expense',
                            projectId: normalizeString(tx.projectId) || undefined,
                        },
                        {
                            accountId: settings.defaultCashAccountId,
                            debit: 0,
                            credit: amount,
                            description: 'Legacy expense cash',
                            projectId: normalizeString(tx.projectId) || undefined,
                        },
                    ],
            });
        }

        summary.transactions.migrated += 1;
    }

    for (const doc of legacyRecurringSnap.docs) {
        const recurring = doc.data() || {};
        const sourceId = doc.id;
        const targetRef = tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.subscriptionEvents).doc(`legacy-${sourceId}`);
        const targetSnap = await targetRef.get();
        if (targetSnap.exists) {
            summary.recurring.skipped += 1;
            continue;
        }

        if (!dryRun) {
            await targetRef.set({
                tenantId,
                subscriptionId: null,
                type: 'migrated_recurring',
                payload: {
                    legacyRecurringId: sourceId,
                    kind: normalizeString(recurring.type) || 'expense',
                    frequency: normalizeString(recurring.frequency) || 'monthly',
                    startDate: recurring.startDate || null,
                    endDate: recurring.endDate || null,
                    category: normalizeString(recurring.category) || '',
                    amount: toNonNegative(recurring.amount),
                    notes: normalizeString(recurring.notes) || '',
                    projectId: normalizeString(recurring.projectId) || null,
                    userId: normalizeString(recurring.userId) || null,
                },
                createdBy: actorId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }

        summary.recurring.migrated += 1;
    }

    for (const doc of legacyScenariosSnap.docs) {
        const scenario = doc.data() || {};
        const sourceId = doc.id;
        if (existingScenarioIds.has(sourceId)) {
            summary.scenarios.skipped += 1;
            continue;
        }

        const plannedUnits = toNonNegative(scenario.plannedUnits);
        if (plannedUnits <= 0) {
            summary.scenarios.skipped += 1;
            continue;
        }

        const normalizedScenario = {
            projectId: normalizeString(scenario.projectId) || null,
            name: normalizeString(scenario.name) || `Legacy Scenario ${sourceId}`,
            preset: normalizeString(scenario.preset || 'software') || 'software',
            period: normalizeString(scenario.period || 'monthly') || 'monthly',
            unitLabel: normalizeString(scenario.unitLabel || 'User') || 'User',
            plannedUnits,
            pricePerUnit: toNonNegative(scenario.pricePerUnit),
            tokenQuotaPerUnit: toNonNegative(scenario.tokenQuotaPerUnit),
            discountPercent: toNonNegative(scenario.discountPercent),
            salesCommissionPercent: toNonNegative(scenario.salesCommissionPercent),
            targetProfitPercentOnCost: toNonNegative(scenario.targetProfitPercentOnCost),
            fixedCostItems: Array.isArray(scenario.fixedCostItems) ? scenario.fixedCostItems : [],
            variableCostItemsPerUnit: Array.isArray(scenario.variableCostItemsPerUnit) ? scenario.variableCostItemsPerUnit : [],
            notes: normalizeString(scenario.notes) || '',
        };

        if (!dryRun) {
            const snapshot = calculateScenarioSnapshotFromInput(normalizedScenario);
            await tenantCollectionRef(tenantId, FINANCE_COLLECTIONS.scenarios).doc(sourceId).set({
                ...normalizedScenario,
                tenantId,
                userId: normalizeString(scenario.userId) || actorId,
                legacyScenarioId: sourceId,
                snapshot,
                createdAt: scenario.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });
        }

        summary.scenarios.migrated += 1;
    }

    await writeFinanceAuditLog(tenantId, actorId, 'finance.legacy.migration.executed', summary as Record<string, unknown>);

    return summary;
});
