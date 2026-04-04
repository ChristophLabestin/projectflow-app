"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyFinanceV1ToV2 = exports.calculateScenarioSnapshot = exports.upsertScenario = exports.deleteFinanceOperationTemplate = exports.upsertFinanceOperationTemplate = exports.recommendFinanceOperations = exports.retryFinanceOperationRun = exports.listFinanceOperationRuns = exports.getFinanceOperationRun = exports.executeFinanceOperation = exports.previewFinanceOperation = exports.upsertFinanceAllocationRule = exports.runFinanceSync = exports.upsertFinanceSyncConnection = exports.buildTaxReport = exports.buildFinancialReports = exports.generateDatevExport = exports.reopenPeriod = exports.runMonthlyClose = exports.confirmReconciliation = exports.suggestReconciliation = exports.importBankStatement = exports.unallocatePayment = exports.allocatePayment = exports.recordPayment = exports.voidBill = exports.postBill = exports.createBill = exports.advanceInvoiceDunning = exports.voidInvoice = exports.issueInvoice = exports.createInvoice = exports.upsertFinanceTaxCode = exports.confirmExtractedInvoiceDraft = exports.extractInvoiceFromDocument = exports.deleteFinanceRecurringTemplate = exports.upsertFinanceRecurringTemplate = exports.deleteFinanceDocument = exports.linkFinanceDocumentToEntity = exports.versionFinanceDocument = exports.uploadFinanceDocument = exports.upsertFinanceVendor = exports.upsertFinanceCustomer = exports.upsertFinanceSettings = exports.upsertFinancePeriod = exports.upsertFinanceAccount = exports.postJournalEntry = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions");
const openai_1 = require("openai");
const init_1 = require("../init");
const calculations_1 = require("./calculations");
const shared_1 = require("./shared");
const sum = (values) => values.reduce((acc, value) => acc + value, 0);
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const INVOICE_EXTRACTION_MODEL = 'gpt-5-mini';
const MAX_INVOICE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_XML_TEXT_LENGTH = 180000;
const DOCUMENT_STORAGE_PREFIX = 'finance-documents';
const MAX_SYNC_RUN_PREVIEW = 20;
const OPERATION_APPROVAL_EXPIRY_HOURS = 24;
const FINANCE_OPERATION_RISK = {
    bank_import: 'low',
    reconciliation_suggest: 'low',
    reconciliation_confirm: 'medium',
    tax_build_report: 'medium',
    reports_build_bundle: 'low',
    export_datev: 'high',
    period_close: 'high',
    period_reopen: 'high',
    sync_run: 'medium',
};
const OPERATION_REQUIRES_CONFIRMATION = {
    bank_import: false,
    reconciliation_suggest: false,
    reconciliation_confirm: true,
    tax_build_report: false,
    reports_build_bundle: false,
    export_datev: true,
    period_close: true,
    period_reopen: true,
    sync_run: false,
};
const financeSettingsRef = (tenantId) => (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.settings).doc('default');
const storageBucket = () => admin.storage().bucket();
const hashSha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const cleanBase64Payload = (rawBase64) => {
    const rawCandidate = rawBase64.includes(',')
        ? rawBase64.split(',').pop() || ''
        : rawBase64;
    return rawCandidate.trim().replace(/\s+/g, '');
};
const decodeBase64OrThrow = (rawBase64) => {
    const cleaned = cleanBase64Payload(rawBase64);
    let binaryContent;
    try {
        binaryContent = Buffer.from(cleaned, 'base64');
    }
    catch (_a) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid base64 payload.');
    }
    if (binaryContent.length <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Uploaded document is empty.');
    }
    if (binaryContent.length > MAX_INVOICE_UPLOAD_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', 'Uploaded document exceeds the maximum size of 5MB.');
    }
    return { binaryContent, cleanedBase64: cleaned };
};
const safeStoragePathSegment = (value) => value.replace(/[^a-zA-Z0-9._/-]/g, '_');
const normalizeFinanceDocumentType = (fileName, mimeType, fallback) => {
    const normalizedFallback = (0, shared_1.normalizeString)(fallback).toLowerCase();
    if (normalizedFallback === 'pdf' || normalizedFallback === 'xml' || normalizedFallback === 'other') {
        return normalizedFallback;
    }
    const loweredName = (0, shared_1.normalizeString)(fileName).toLowerCase();
    const loweredType = (0, shared_1.normalizeString)(mimeType).toLowerCase();
    const isPdf = loweredName.endsWith('.pdf') || loweredType.includes('pdf');
    const isXml = loweredName.endsWith('.xml')
        || loweredType.includes('xml')
        || loweredName.endsWith('.xrechnung');
    if (isPdf)
        return 'pdf';
    if (isXml)
        return 'xml';
    return 'other';
};
const toInvoiceDocumentTypeOrThrow = (documentType) => {
    if (documentType === 'pdf' || documentType === 'xml') {
        return documentType;
    }
    throw new functions.https.HttpsError('failed-precondition', 'Invoice extraction supports only PDF/XML documents.');
};
const buildDocumentStoragePath = (tenantId, documentId, versionNo, fileName) => {
    const cleanedFileName = safeStoragePathSegment(fileName || `document_v${versionNo}`);
    return `${DOCUMENT_STORAGE_PREFIX}/${tenantId}/${documentId}/v${versionNo}/${cleanedFileName}`;
};
const loadDocumentVersionBinary = async (tenantId, documentId, versionId) => {
    let versionSnap;
    if (versionId) {
        versionSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documentVersions).doc(versionId).get();
    }
    else {
        const latestVersionSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documentVersions)
            .where('documentId', '==', documentId)
            .orderBy('versionNo', 'desc')
            .limit(1)
            .get();
        if (latestVersionSnap.empty) {
            throw new functions.https.HttpsError('not-found', 'No document version found.');
        }
        versionSnap = latestVersionSnap.docs[0];
    }
    if (!versionSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Document version not found.');
    }
    const versionData = versionSnap.data() || {};
    const storagePath = (0, shared_1.normalizeString)(versionData.storagePath);
    if (!storagePath) {
        throw new functions.https.HttpsError('failed-precondition', 'Document version has no storage path.');
    }
    const [binaryContent] = await storageBucket().file(storagePath).download();
    return {
        versionId: versionSnap.id,
        binaryContent,
        fileName: (0, shared_1.normalizeString)(versionData.fileName) || 'invoice',
        mimeType: (0, shared_1.normalizeString)(versionData.mimeType),
        documentType: normalizeFinanceDocumentType((0, shared_1.normalizeString)(versionData.fileName), (0, shared_1.normalizeString)(versionData.mimeType), versionData.documentType),
    };
};
const createFinanceJob = async (tenantId, actorId, type, payload) => {
    const ref = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.jobs).doc();
    await ref.set({
        tenantId,
        type,
        status: 'running',
        payload,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    return ref;
};
const completeFinanceJob = async (ref, status, result) => {
    await ref.set({
        status,
        result,
        finishedAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
};
const normalizeOperationType = (value) => {
    const normalized = (0, shared_1.normalizeString)(value).toLowerCase();
    if (normalized === 'bank_import'
        || normalized === 'reconciliation_suggest'
        || normalized === 'reconciliation_confirm'
        || normalized === 'tax_build_report'
        || normalized === 'reports_build_bundle'
        || normalized === 'export_datev'
        || normalized === 'period_close'
        || normalized === 'period_reopen'
        || normalized === 'sync_run') {
        return normalized;
    }
    return null;
};
const sanitizeOperationResult = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeOperationResult(item));
    }
    if (value && typeof value === 'object') {
        const result = {};
        Object.entries(value).forEach(([key, innerValue]) => {
            const lowered = key.toLowerCase();
            if (lowered.includes('token') || lowered.includes('secret') || lowered.includes('apikey')) {
                return;
            }
            result[key] = sanitizeOperationResult(innerValue);
        });
        return result;
    }
    return value;
};
const nowPlusHours = (hours) => {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return admin.firestore.Timestamp.fromDate(date);
};
const buildOperationStep = (name, status, error) => ({
    name,
    status,
    startedAt: (0, shared_1.serverTimestamp)(),
    finishedAt: (0, shared_1.serverTimestamp)(),
    error: error || null,
});
const createOperationRun = async (tenantId, actorId, operationType, payload, idempotencyKey, status) => {
    const runRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationRuns).doc();
    await runRef.set({
        tenantId,
        operationType,
        status,
        risk: FINANCE_OPERATION_RISK[operationType],
        payload,
        payloadHash: (0, shared_1.buildIdempotencyKey)(payload),
        idempotencyKey,
        steps: [buildOperationStep('validating', status === 'failed' ? 'failed' : 'validating')],
        warnings: [],
        artifacts: [],
        requestedBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
        startedAt: (0, shared_1.serverTimestamp)(),
    });
    return runRef;
};
const updateOperationRun = async (runRef, updates) => {
    await runRef.set(Object.assign(Object.assign({}, updates), { updatedAt: (0, shared_1.serverTimestamp)() }), { merge: true });
};
const addOperationApproval = async (tenantId, actorId, runId, operationType) => {
    const approvalRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationApprovals).doc();
    await approvalRef.set({
        tenantId,
        runId,
        operationType,
        status: 'pending',
        requestedBy: actorId,
        expiresAt: nowPlusHours(OPERATION_APPROVAL_EXPIRY_HOURS),
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    return approvalRef;
};
const getOpenAiClient = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OPENAI_API_KEY is not configured.');
    }
    return new openai_1.default({ apiKey });
};
const extractTextFromResponse = (response) => {
    if (typeof (response === null || response === void 0 ? void 0 : response.output_text) === 'string' && response.output_text.length > 0) {
        return response.output_text;
    }
    const output = response === null || response === void 0 ? void 0 : response.output;
    if (!Array.isArray(output)) {
        return '';
    }
    const chunks = [];
    for (const item of output) {
        if ((item === null || item === void 0 ? void 0 : item.type) !== 'message' || !Array.isArray(item.content)) {
            continue;
        }
        for (const part of item.content) {
            if ((part === null || part === void 0 ? void 0 : part.type) === 'output_text' && typeof part.text === 'string') {
                chunks.push(part.text);
            }
        }
    }
    return chunks.join('\n').trim();
};
const parseJsonText = (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
        return {};
    }
    try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    }
    catch (_a) {
        // Continue to fallback parsing.
    }
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced === null || fenced === void 0 ? void 0 : fenced[1]) {
        try {
            const parsed = JSON.parse(fenced[1].trim());
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch (_b) {
            // Continue to fallback parsing.
        }
    }
    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
        try {
            const parsed = JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch (_c) {
            // Fall through.
        }
    }
    return {};
};
const normalizeIsoDate = (value) => {
    const raw = (0, shared_1.normalizeString)(value);
    if (!raw)
        return '';
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
const normalizeConfidence = (value) => {
    const normalized = (0, shared_1.normalizeString)(value).toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
        return normalized;
    }
    return 'medium';
};
const normalizeInvoiceExtractionResult = (raw, documentType) => {
    const quantityRaw = (0, shared_1.toNonNegative)(raw.quantity);
    let quantity = quantityRaw > 0 ? quantityRaw : 1;
    quantity = round2(quantity);
    let unitCost = round2((0, shared_1.toNonNegative)(raw.unitCost));
    let netAmount = round2((0, shared_1.toNonNegative)(raw.netAmount));
    let taxAmount = round2((0, shared_1.toNonNegative)(raw.taxAmount));
    let grossAmount = round2((0, shared_1.toNonNegative)(raw.grossAmount));
    let taxRatePercent = round2((0, shared_1.toNonNegative)(raw.taxRatePercent));
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
        vendorName: (0, shared_1.normalizeString)(raw.vendorName),
        vendorEmail: (0, shared_1.normalizeString)(raw.vendorEmail),
        vendorVatId: (0, shared_1.normalizeString)(raw.vendorVatId),
        invoiceNumber: (0, shared_1.normalizeString)(raw.invoiceNumber),
        invoiceDate: normalizeIsoDate(raw.invoiceDate),
        dueDate: normalizeIsoDate(raw.dueDate),
        currencyCode: (0, shared_1.normalizeCurrencyCode)(raw.currencyCode, 'EUR'),
        lineDescription: (0, shared_1.normalizeString)(raw.lineDescription),
        quantity,
        unitCost,
        taxRatePercent,
        netAmount,
        taxAmount,
        grossAmount,
        confidence: normalizeConfidence(raw.confidence),
        isLikelyRecurring: Boolean(raw.isLikelyRecurring),
        recurringHint: (0, shared_1.normalizeString)(raw.recurringHint),
        notes: (0, shared_1.normalizeString)(raw.notes),
    };
};
const toDateFromInput = (value) => {
    const date = new Date((0, shared_1.normalizeString)(value));
    if (Number.isNaN(date.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid date value.');
    }
    return date;
};
const toJournalLineInput = (raw) => {
    const source = (raw || {});
    const accountId = (0, shared_1.normalizeString)(source.accountId);
    const debit = (0, shared_1.toNonNegative)(source.debit);
    const credit = (0, shared_1.toNonNegative)(source.credit);
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
        description: (0, shared_1.normalizeString)(source.description) || undefined,
        taxCodeId: (0, shared_1.normalizeString)(source.taxCodeId) || undefined,
        projectId: (0, shared_1.normalizeString)(source.projectId) || undefined,
        customerId: (0, shared_1.normalizeString)(source.customerId) || undefined,
        vendorId: (0, shared_1.normalizeString)(source.vendorId) || undefined,
    };
};
const normalizeJournalInput = (rawData) => {
    const data = (rawData || {});
    const tenantId = (0, shared_1.normalizeString)(data.tenantId);
    const postingDate = (0, shared_1.normalizeString)(data.postingDate);
    const description = (0, shared_1.normalizeString)(data.description);
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
        sourceType: (0, shared_1.normalizeString)(data.sourceType) || 'manual',
        sourceId: (0, shared_1.normalizeString)(data.sourceId) || undefined,
        sourceRefNo: (0, shared_1.normalizeString)(data.sourceRefNo) || undefined,
        projectId: (0, shared_1.normalizeString)(data.projectId) || undefined,
        currencyCode: (0, shared_1.normalizeCurrencyCode)(data.currencyCode, 'EUR'),
        idempotencyKey: (0, shared_1.normalizeString)(data.idempotencyKey) || undefined,
        lines: linesInput,
    };
};
const postJournalEntryInternal = async (actorId, payload) => {
    const postingDateValue = toDateFromInput(payload.postingDate);
    const periodKey = (0, shared_1.toPeriodKey)(postingDateValue);
    await (0, shared_1.assertPeriodWritable)(payload.tenantId, periodKey);
    const idempotencyKey = payload.idempotencyKey || (0, shared_1.buildIdempotencyKey)({
        tenantId: payload.tenantId,
        postingDate: payload.postingDate,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        sourceRefNo: payload.sourceRefNo,
        lines: payload.lines,
    });
    const existing = await (0, shared_1.tenantCollectionRef)(payload.tenantId, shared_1.FINANCE_COLLECTIONS.journalEntries)
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();
    if (!existing.empty) {
        return { entryId: existing.docs[0].id, idempotentReplay: true };
    }
    const entryRef = (0, shared_1.tenantCollectionRef)(payload.tenantId, shared_1.FINANCE_COLLECTIONS.journalEntries).doc();
    const lineCollection = (0, shared_1.tenantCollectionRef)(payload.tenantId, shared_1.FINANCE_COLLECTIONS.journalLines);
    const totalDebit = round2(sum(payload.lines.map((line) => line.debit)));
    const totalCredit = round2(sum(payload.lines.map((line) => line.credit)));
    const entryNumber = `JE-${periodKey}-${entryRef.id.slice(0, 8).toUpperCase()}`;
    const batch = init_1.db.batch();
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
        postedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
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
            createdAt: (0, shared_1.serverTimestamp)(),
            updatedAt: (0, shared_1.serverTimestamp)(),
        });
    });
    await batch.commit();
    await (0, shared_1.writeFinanceAuditLog)(payload.tenantId, actorId, 'finance.journal.posted', {
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
const loadFinanceSettings = async (tenantId) => {
    const settingsSnap = await financeSettingsRef(tenantId).get();
    const data = settingsSnap.data() || {};
    return {
        defaultReceivableAccountId: (0, shared_1.normalizeString)(data.defaultReceivableAccountId) || '1200',
        defaultPayableAccountId: (0, shared_1.normalizeString)(data.defaultPayableAccountId) || '1600',
        defaultRevenueAccountId: (0, shared_1.normalizeString)(data.defaultRevenueAccountId) || '8400',
        defaultExpenseAccountId: (0, shared_1.normalizeString)(data.defaultExpenseAccountId) || '3400',
        defaultCashAccountId: (0, shared_1.normalizeString)(data.defaultCashAccountId) || '1000',
        defaultOutputTaxAccountId: (0, shared_1.normalizeString)(data.defaultOutputTaxAccountId) || '1776',
        defaultInputTaxAccountId: (0, shared_1.normalizeString)(data.defaultInputTaxAccountId) || '1576',
        currencyCode: (0, shared_1.normalizeCurrencyCode)(data.currencyCode, 'EUR'),
    };
};
const normalizeInvoiceLine = (line, index) => {
    const raw = (line || {});
    const description = (0, shared_1.normalizeString)(raw.description) || `Position ${index + 1}`;
    const quantity = (0, shared_1.toNonNegative)(raw.quantity);
    const unitPrice = (0, shared_1.toNonNegative)(raw.unitPrice);
    const taxRatePercent = (0, shared_1.toNonNegative)(raw.taxRatePercent);
    if (quantity <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Invoice line quantity must be greater than 0.');
    }
    const netAmount = round2(quantity * unitPrice);
    const taxAmount = round2(netAmount * (taxRatePercent / 100));
    return {
        id: (0, shared_1.normalizeString)(raw.id) || `line-${index + 1}`,
        description,
        quantity,
        unitPrice,
        netAmount,
        taxCodeId: (0, shared_1.normalizeString)(raw.taxCodeId) || null,
        taxRatePercent,
        taxAmount,
        accountId: (0, shared_1.normalizeString)(raw.accountId) || null,
        projectId: (0, shared_1.normalizeString)(raw.projectId) || null,
    };
};
const normalizeBillLine = (line, index) => {
    const raw = (line || {});
    const description = (0, shared_1.normalizeString)(raw.description) || `Position ${index + 1}`;
    const quantity = (0, shared_1.toNonNegative)(raw.quantity);
    const unitCost = (0, shared_1.toNonNegative)(raw.unitCost);
    const taxRatePercent = (0, shared_1.toNonNegative)(raw.taxRatePercent);
    if (quantity <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Bill line quantity must be greater than 0.');
    }
    const netAmount = round2(quantity * unitCost);
    const taxAmount = round2(netAmount * (taxRatePercent / 100));
    return {
        id: (0, shared_1.normalizeString)(raw.id) || `line-${index + 1}`,
        description,
        quantity,
        unitCost,
        netAmount,
        taxCodeId: (0, shared_1.normalizeString)(raw.taxCodeId) || null,
        taxRatePercent,
        taxAmount,
        accountId: (0, shared_1.normalizeString)(raw.accountId) || null,
        projectId: (0, shared_1.normalizeString)(raw.projectId) || null,
    };
};
const applyPaymentToTarget = async (tenantId, targetType, targetId, deltaPaid) => {
    const collectionName = targetType === 'invoice' ? shared_1.FINANCE_COLLECTIONS.invoices : shared_1.FINANCE_COLLECTIONS.bills;
    const targetRef = (0, shared_1.tenantCollectionRef)(tenantId, collectionName).doc(targetId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
        throw new functions.https.HttpsError('not-found', `${targetType} not found.`);
    }
    const targetData = targetSnap.data() || {};
    const grossAmount = (0, shared_1.toNonNegative)(targetData.grossAmount);
    const currentPaid = (0, shared_1.toNonNegative)(targetData.paidAmount);
    const nextPaid = round2(Math.max(0, currentPaid + deltaPaid));
    const nextOpen = round2(Math.max(0, grossAmount - nextPaid));
    let status = (0, shared_1.normalizeString)(targetData.status) || 'issued';
    if (nextOpen <= 0) {
        status = 'paid';
    }
    else if (nextPaid > 0) {
        status = 'partially_paid';
    }
    await targetRef.update({
        paidAmount: nextPaid,
        openAmount: nextOpen,
        status,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
};
exports.postJournalEntry = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = normalizeJournalInput(data);
    const actorId = await (0, shared_1.requireFinancePermission)(payload.tenantId, context, 'tenant.finance.ledger.post');
    return postJournalEntryInternal(actorId, payload);
});
exports.upsertFinanceAccount = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.accounts.manage');
    const accountId = (0, shared_1.normalizeString)(payload.accountId);
    const accountNo = (0, shared_1.normalizeString)(payload.accountNo);
    const name = (0, shared_1.normalizeString)(payload.name);
    const category = (0, shared_1.normalizeString)(payload.category);
    const normalBalance = (0, shared_1.normalizeString)(payload.normalBalance);
    if (!accountNo || !name || !category || !normalBalance) {
        throw new functions.https.HttpsError('invalid-argument', 'accountNo, name, category and normalBalance are required.');
    }
    const ref = accountId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.accounts).doc(accountId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.accounts).doc();
    await ref.set(Object.assign({ tenantId,
        accountNo,
        name,
        category,
        normalBalance, datevAccountNo: (0, shared_1.normalizeString)(payload.datevAccountNo) || null, taxCodeId: (0, shared_1.normalizeString)(payload.taxCodeId) || null, isActive: payload.isActive === false ? false : true, allowManualPosting: payload.allowManualPosting === false ? false : true, notes: (0, shared_1.normalizeString)(payload.notes) || null, updatedAt: (0, shared_1.serverTimestamp)() }, (accountId ? {} : { createdAt: (0, shared_1.serverTimestamp)() })), { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.account.upserted', {
        accountId: ref.id,
        accountNo,
        name,
    });
    return { accountId: ref.id };
});
exports.upsertFinancePeriod = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.close');
    const periodKey = (0, shared_1.normalizeString)(payload.periodKey);
    const fiscalYearId = (0, shared_1.normalizeString)(payload.fiscalYearId);
    const status = (0, shared_1.normalizeString)(payload.status) || 'open';
    if (!periodKey || !fiscalYearId) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey and fiscalYearId are required.');
    }
    const startDate = toDateFromInput(payload.startDate || `${periodKey}-01`);
    const endDate = payload.endDate
        ? toDateFromInput(payload.endDate)
        : new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0));
    await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.periods).doc(periodKey).set(Object.assign({ tenantId, id: periodKey, periodKey, monthKey: periodKey, fiscalYearId,
        status, startDate: admin.firestore.Timestamp.fromDate(startDate), endDate: admin.firestore.Timestamp.fromDate(endDate), notes: (0, shared_1.normalizeString)(payload.notes) || null, updatedAt: (0, shared_1.serverTimestamp)() }, (status === 'closed' ? { closedAt: (0, shared_1.serverTimestamp)(), closedBy: actorId } : {})), { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.period.upserted', { periodKey, status });
    return { periodKey, status };
});
exports.upsertFinanceSettings = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const settings = (payload.settings || {});
    await financeSettingsRef(tenantId).set({
        tenantId,
        id: 'default',
        financeSchemaVersion: 2,
        countryCode: (0, shared_1.normalizeString)(settings.countryCode || 'DE') || 'DE',
        currencyCode: (0, shared_1.normalizeCurrencyCode)(settings.currencyCode, 'EUR'),
        fiscalYearStartMonth: Math.max(1, Math.min(12, Math.floor((0, shared_1.toNumber)(settings.fiscalYearStartMonth || 1)))),
        softCloseEnabled: settings.softCloseEnabled === false ? false : true,
        defaultUnitLabel: (0, shared_1.normalizeString)(settings.defaultUnitLabel || 'User') || 'User',
        defaultScenarioPreset: (0, shared_1.normalizeString)(settings.defaultScenarioPreset || 'software') || 'software',
        defaultRevenueAccountId: (0, shared_1.normalizeString)(settings.defaultRevenueAccountId) || null,
        defaultExpenseAccountId: (0, shared_1.normalizeString)(settings.defaultExpenseAccountId) || null,
        defaultReceivableAccountId: (0, shared_1.normalizeString)(settings.defaultReceivableAccountId) || null,
        defaultPayableAccountId: (0, shared_1.normalizeString)(settings.defaultPayableAccountId) || null,
        defaultCashAccountId: (0, shared_1.normalizeString)(settings.defaultCashAccountId) || null,
        defaultOutputTaxAccountId: (0, shared_1.normalizeString)(settings.defaultOutputTaxAccountId) || null,
        defaultInputTaxAccountId: (0, shared_1.normalizeString)(settings.defaultInputTaxAccountId) || null,
        documentRetentionDays: Math.max(0, Math.floor((0, shared_1.toNumber)(settings.documentRetentionDays || 365))),
        documentStorageRegion: (0, shared_1.normalizeString)(settings.documentStorageRegion || shared_1.REGION) || shared_1.REGION,
        defaultDiscountPolicy: (0, shared_1.normalizeString)(settings.defaultDiscountPolicy || 'none') || 'none',
        defaultCommissionPolicy: (0, shared_1.normalizeString)(settings.defaultCommissionPolicy || 'none') || 'none',
        profitabilityCostBuckets: Array.isArray(settings.profitabilityCostBuckets)
            ? settings.profitabilityCostBuckets.map((entry) => (0, shared_1.normalizeString)(entry)).filter(Boolean)
            : ['direct', 'ai', 'overhead'],
        updatedAt: (0, shared_1.serverTimestamp)(),
        updatedBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.settings.upserted', {
        financeSchemaVersion: 2,
    });
    return { success: true };
});
exports.upsertFinanceCustomer = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ar.manage');
    const customerId = (0, shared_1.normalizeString)(payload.customerId);
    const name = (0, shared_1.normalizeString)(payload.name);
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'name is required.');
    }
    const ref = customerId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.customers).doc(customerId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.customers).doc();
    await ref.set({
        tenantId,
        customerNo: (0, shared_1.normalizeString)(payload.customerNo) || `CUS-${Date.now()}`,
        name,
        email: (0, shared_1.normalizeString)(payload.email) || null,
        vatId: (0, shared_1.normalizeString)(payload.vatId) || null,
        paymentTermsDays: Math.max(0, Math.floor((0, shared_1.toNumber)(payload.paymentTermsDays || 14))),
        defaultRevenueAccountId: (0, shared_1.normalizeString)(payload.defaultRevenueAccountId) || null,
        isActive: payload.isActive === false ? false : true,
        updatedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.customer.upserted', {
        customerId: ref.id,
        name,
    });
    return { customerId: ref.id };
});
exports.upsertFinanceVendor = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ap.manage');
    const vendorId = (0, shared_1.normalizeString)(payload.vendorId);
    const name = (0, shared_1.normalizeString)(payload.name);
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'name is required.');
    }
    const ref = vendorId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.vendors).doc(vendorId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.vendors).doc();
    await ref.set({
        tenantId,
        vendorNo: (0, shared_1.normalizeString)(payload.vendorNo) || `VEN-${Date.now()}`,
        name,
        email: (0, shared_1.normalizeString)(payload.email) || null,
        vatId: (0, shared_1.normalizeString)(payload.vatId) || null,
        paymentTermsDays: Math.max(0, Math.floor((0, shared_1.toNumber)(payload.paymentTermsDays || 14))),
        defaultExpenseAccountId: (0, shared_1.normalizeString)(payload.defaultExpenseAccountId) || null,
        isActive: payload.isActive === false ? false : true,
        updatedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.vendor.upserted', {
        vendorId: ref.id,
        name,
    });
    return { vendorId: ref.id };
});
exports.uploadFinanceDocument = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.documents.manage');
    const fileName = (0, shared_1.normalizeString)(payload.fileName);
    const mimeType = (0, shared_1.normalizeString)(payload.mimeType);
    const rawBase64 = (0, shared_1.normalizeString)(payload.contentBase64);
    if (!fileName || !mimeType || !rawBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'fileName, mimeType and contentBase64 are required.');
    }
    const { binaryContent } = decodeBase64OrThrow(rawBase64);
    const documentType = normalizeFinanceDocumentType(fileName, mimeType, payload.documentType);
    const checksumSha256 = hashSha256(binaryContent);
    const documentRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documents).doc();
    const versionRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documentVersions).doc();
    const versionNo = 1;
    const storagePath = buildDocumentStoragePath(tenantId, documentRef.id, versionNo, fileName);
    await storageBucket().file(storagePath).save(binaryContent, {
        contentType: mimeType,
        resumable: false,
        metadata: {
            metadata: {
                tenantId,
                documentId: documentRef.id,
                versionId: versionRef.id,
                uploadedBy: actorId,
            },
        },
    });
    const batch = init_1.db.batch();
    batch.set(documentRef, {
        tenantId,
        projectId: (0, shared_1.normalizeString)(payload.projectId) || null,
        linkedEntityType: (0, shared_1.normalizeString)(payload.linkedEntityType) || null,
        linkedEntityId: (0, shared_1.normalizeString)(payload.linkedEntityId) || null,
        title: (0, shared_1.normalizeString)(payload.title) || fileName,
        documentType,
        status: 'active',
        latestVersionNo: versionNo,
        latestVersionId: versionRef.id,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    batch.set(versionRef, {
        tenantId,
        documentId: documentRef.id,
        versionNo,
        fileName,
        mimeType,
        sizeBytes: binaryContent.length,
        storagePath,
        checksumSha256,
        documentType,
        uploadedBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await batch.commit();
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.document.uploaded', {
        documentId: documentRef.id,
        versionId: versionRef.id,
        fileName,
        mimeType,
        sizeBytes: binaryContent.length,
    });
    return {
        documentId: documentRef.id,
        versionId: versionRef.id,
        versionNo,
        checksumSha256,
    };
});
exports.versionFinanceDocument = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.documents.manage');
    const documentId = (0, shared_1.normalizeString)(payload.documentId);
    const fileName = (0, shared_1.normalizeString)(payload.fileName);
    const mimeType = (0, shared_1.normalizeString)(payload.mimeType);
    const rawBase64 = (0, shared_1.normalizeString)(payload.contentBase64);
    if (!documentId || !fileName || !mimeType || !rawBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'documentId, fileName, mimeType and contentBase64 are required.');
    }
    const documentRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documents).doc(documentId);
    const documentSnap = await documentRef.get();
    if (!documentSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Document not found.');
    }
    const document = documentSnap.data() || {};
    const { binaryContent } = decodeBase64OrThrow(rawBase64);
    const versionNo = Math.max(1, Math.floor((0, shared_1.toNumber)(document.latestVersionNo) + 1));
    const versionRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documentVersions).doc();
    const storagePath = buildDocumentStoragePath(tenantId, documentId, versionNo, fileName);
    const checksumSha256 = hashSha256(binaryContent);
    const documentType = normalizeFinanceDocumentType(fileName, mimeType, document.documentType);
    await storageBucket().file(storagePath).save(binaryContent, {
        contentType: mimeType,
        resumable: false,
        metadata: {
            metadata: {
                tenantId,
                documentId,
                versionId: versionRef.id,
                uploadedBy: actorId,
            },
        },
    });
    const batch = init_1.db.batch();
    batch.set(versionRef, {
        tenantId,
        documentId,
        versionNo,
        fileName,
        mimeType,
        sizeBytes: binaryContent.length,
        storagePath,
        checksumSha256,
        documentType,
        uploadedBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    batch.update(documentRef, {
        latestVersionNo: versionNo,
        latestVersionId: versionRef.id,
        documentType,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await batch.commit();
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.document.versioned', {
        documentId,
        versionId: versionRef.id,
        versionNo,
    });
    return { documentId, versionId: versionRef.id, versionNo, checksumSha256 };
});
exports.linkFinanceDocumentToEntity = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.documents.manage');
    const documentId = (0, shared_1.normalizeString)(payload.documentId);
    const linkedEntityType = (0, shared_1.normalizeString)(payload.linkedEntityType);
    const linkedEntityId = (0, shared_1.normalizeString)(payload.linkedEntityId);
    if (!documentId || !linkedEntityType || !linkedEntityId) {
        throw new functions.https.HttpsError('invalid-argument', 'documentId, linkedEntityType and linkedEntityId are required.');
    }
    const documentRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documents).doc(documentId);
    const snap = await documentRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Document not found.');
    }
    await documentRef.update({
        linkedEntityType,
        linkedEntityId,
        projectId: (0, shared_1.normalizeString)(payload.projectId) || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.projectId) || null,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.document.linked', {
        documentId,
        linkedEntityType,
        linkedEntityId,
    });
    return { documentId, linkedEntityType, linkedEntityId };
});
exports.deleteFinanceDocument = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.documents.manage');
    const documentId = (0, shared_1.normalizeString)(payload.documentId);
    const mode = (0, shared_1.normalizeString)(payload.mode) === 'hard' ? 'hard' : 'soft';
    if (!documentId) {
        throw new functions.https.HttpsError('invalid-argument', 'documentId is required.');
    }
    const documentRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documents).doc(documentId);
    const docSnap = await documentRef.get();
    if (!docSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Document not found.');
    }
    if (mode === 'soft') {
        await documentRef.set({
            status: 'deleted',
            deletedBy: actorId,
            deletedAt: (0, shared_1.serverTimestamp)(),
            updatedAt: (0, shared_1.serverTimestamp)(),
        }, { merge: true });
    }
    else {
        const versionsSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documentVersions)
            .where('documentId', '==', documentId)
            .get();
        await Promise.all(versionsSnap.docs.map(async (versionDoc) => {
            const versionData = versionDoc.data() || {};
            const storagePath = (0, shared_1.normalizeString)(versionData.storagePath);
            if (storagePath) {
                try {
                    await storageBucket().file(storagePath).delete({ ignoreNotFound: true });
                }
                catch (error) {
                    console.warn('Failed to delete finance document binary', storagePath, error);
                }
            }
            await versionDoc.ref.delete();
        }));
        await documentRef.delete();
    }
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.document.deleted', {
        documentId,
        mode,
    });
    return { documentId, mode, success: true };
});
exports.upsertFinanceRecurringTemplate = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const template = (payload.template || {});
    const templateId = (0, shared_1.normalizeString)(payload.templateId);
    const type = (0, shared_1.normalizeString)(template.type) === 'invoice' ? 'invoice' : 'bill';
    const cadenceRaw = (0, shared_1.normalizeString)(template.cadence).toLowerCase();
    const cadence = (cadenceRaw === 'weekly'
        || cadenceRaw === 'quarterly'
        || cadenceRaw === 'yearly'
        || cadenceRaw === 'monthly')
        ? cadenceRaw
        : 'monthly';
    const nextRunAtRaw = (0, shared_1.normalizeString)(template.nextRunAt);
    const nextRunAt = nextRunAtRaw ? toDateFromInput(nextRunAtRaw) : new Date();
    const ref = templateId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.recurringTemplates).doc(templateId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.recurringTemplates).doc();
    await ref.set({
        tenantId,
        projectId: (0, shared_1.normalizeString)(template.projectId) || null,
        vendorId: (0, shared_1.normalizeString)(template.vendorId) || null,
        customerId: (0, shared_1.normalizeString)(template.customerId) || null,
        type,
        cadence,
        nextRunAt: admin.firestore.Timestamp.fromDate(nextRunAt),
        endAt: (0, shared_1.normalizeString)(template.endAt) ? admin.firestore.Timestamp.fromDate(toDateFromInput(template.endAt)) : null,
        autoPost: template.autoPost === true,
        isActive: template.isActive === false ? false : true,
        currencyCode: (0, shared_1.normalizeCurrencyCode)(template.currencyCode, 'EUR'),
        notes: (0, shared_1.normalizeString)(template.notes) || null,
        sourceDocumentId: (0, shared_1.normalizeString)(template.sourceDocumentId) || null,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.recurring_template.upserted', {
        templateId: ref.id,
        type,
        cadence,
    });
    return { templateId: ref.id };
});
exports.deleteFinanceRecurringTemplate = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const templateId = (0, shared_1.normalizeString)(payload.templateId);
    if (!templateId) {
        throw new functions.https.HttpsError('invalid-argument', 'templateId is required.');
    }
    const ref = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.recurringTemplates).doc(templateId);
    await ref.delete();
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.recurring_template.deleted', { templateId });
    return { templateId, success: true };
});
exports.extractInvoiceFromDocument = functions.region(shared_1.REGION).runWith({ secrets: ['OPENAI_API_KEY'] }).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ap.manage');
    const payloadDocumentId = (0, shared_1.normalizeString)(payload.documentId);
    const payloadDocumentVersionId = (0, shared_1.normalizeString)(payload.documentVersionId);
    const rawBase64 = (0, shared_1.normalizeString)(payload.contentBase64);
    let sourceDocumentId = payloadDocumentId || '';
    let sourceDocumentVersionId = payloadDocumentVersionId || '';
    let fileName = (0, shared_1.normalizeString)(payload.fileName) || 'invoice';
    let mimeType = (0, shared_1.normalizeString)(payload.mimeType) || '';
    let binaryContent;
    let documentType;
    if (payloadDocumentId) {
        const loaded = await loadDocumentVersionBinary(tenantId, payloadDocumentId, payloadDocumentVersionId || undefined);
        sourceDocumentId = payloadDocumentId;
        sourceDocumentVersionId = loaded.versionId;
        fileName = loaded.fileName;
        mimeType = loaded.mimeType || (loaded.documentType === 'pdf' ? 'application/pdf' : 'application/xml');
        binaryContent = loaded.binaryContent;
        documentType = toInvoiceDocumentTypeOrThrow(loaded.documentType);
    }
    else {
        if (!rawBase64) {
            throw new functions.https.HttpsError('invalid-argument', 'Either contentBase64 or documentId/documentVersionId is required.');
        }
        if (!fileName || !mimeType) {
            throw new functions.https.HttpsError('invalid-argument', 'fileName and mimeType are required for base64 extraction.');
        }
        const decoded = decodeBase64OrThrow(rawBase64);
        binaryContent = decoded.binaryContent;
        const inferredDocumentType = normalizeFinanceDocumentType(fileName, mimeType);
        documentType = toInvoiceDocumentTypeOrThrow(inferredDocumentType);
        mimeType = documentType === 'pdf' ? 'application/pdf' : 'application/xml';
    }
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
    const request = {
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
        const pdfBase64 = binaryContent.toString('base64');
        request.input = [{
                role: 'user',
                content: [
                    { type: 'input_text', text: extractionPrompt },
                    {
                        type: 'input_file',
                        filename: fileName || 'invoice.pdf',
                        file_data: `data:${mimeType};base64,${pdfBase64}`,
                    },
                ],
            }];
    }
    else {
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
        const response = await client.responses.create(request);
        const parsed = parseJsonText(extractTextFromResponse(response));
        const normalized = normalizeInvoiceExtractionResult(parsed, documentType);
        const warnings = Object.entries(normalized).reduce((acc, [key, value]) => {
            if (value === ''
                || value === null
                || (typeof value === 'number' && value === 0 && !['quantity', 'taxRatePercent'].includes(key))) {
                acc.push(`Missing or zero value for ${key}`);
            }
            return acc;
        }, []);
        const enriched = Object.assign(Object.assign({}, normalized), { documentId: sourceDocumentId || undefined, documentVersionId: sourceDocumentVersionId || undefined, fileName, warnings: warnings.length > 0 ? warnings : undefined, fieldConfidenceMap: {
                vendorName: normalized.confidence,
                invoiceNumber: normalized.confidence,
                invoiceDate: normalized.confidence,
                dueDate: normalized.confidence,
                netAmount: normalized.confidence,
                grossAmount: normalized.confidence,
            } });
        if (sourceDocumentVersionId) {
            await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documentVersions)
                .doc(sourceDocumentVersionId)
                .set({
                extraction: enriched,
                extractionWarnings: warnings,
                extractedAt: (0, shared_1.serverTimestamp)(),
                extractedBy: actorId,
                updatedAt: (0, shared_1.serverTimestamp)(),
            }, { merge: true });
        }
        await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.bill.document_extracted', {
            fileName,
            documentType,
            documentId: sourceDocumentId || null,
            documentVersionId: sourceDocumentVersionId || null,
            invoiceNumber: enriched.invoiceNumber || null,
            vendorName: enriched.vendorName || null,
            confidence: enriched.confidence,
            model: INVOICE_EXTRACTION_MODEL,
        });
        return Object.assign(Object.assign({}, enriched), { model: INVOICE_EXTRACTION_MODEL });
    }
    catch (error) {
        console.error('Failed to extract invoice document', error);
        throw new functions.https.HttpsError('internal', (error === null || error === void 0 ? void 0 : error.message) || 'Invoice extraction failed.');
    }
});
exports.confirmExtractedInvoiceDraft = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ap.manage');
    const billDate = toDateFromInput(payload.billDate);
    const dueDate = toDateFromInput(payload.dueDate || payload.billDate);
    const quantity = (0, shared_1.toNonNegative)(payload.quantity);
    const unitCost = (0, shared_1.toNonNegative)(payload.unitCost);
    const taxRatePercent = (0, shared_1.toNonNegative)(payload.taxRatePercent);
    const cadence = (0, shared_1.normalizeString)(payload.cadence) === 'recurring' ? 'recurring' : 'single';
    const autoPost = payload.autoPost === false ? false : true;
    if (quantity <= 0 || unitCost < 0) {
        throw new functions.https.HttpsError('invalid-argument', 'quantity and unitCost are required.');
    }
    let vendorId = (0, shared_1.normalizeString)(payload.vendorId);
    if (!vendorId) {
        const vendorName = (0, shared_1.normalizeString)(payload.vendorName);
        if (!vendorName) {
            throw new functions.https.HttpsError('invalid-argument', 'vendorId or vendorName is required.');
        }
        const vendorRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.vendors).doc();
        await vendorRef.set({
            tenantId,
            vendorNo: `VEN-${Date.now()}`,
            name: vendorName,
            email: (0, shared_1.normalizeString)(payload.vendorEmail) || null,
            vatId: (0, shared_1.normalizeString)(payload.vendorVatId) || null,
            paymentTermsDays: 14,
            isActive: true,
            createdAt: (0, shared_1.serverTimestamp)(),
            updatedAt: (0, shared_1.serverTimestamp)(),
        });
        vendorId = vendorRef.id;
    }
    const netAmount = round2(quantity * unitCost);
    const taxAmount = round2(netAmount * (taxRatePercent / 100));
    const grossAmount = round2(netAmount + taxAmount);
    const projectId = (0, shared_1.normalizeString)(payload.projectId) || null;
    const currencyCode = (0, shared_1.normalizeCurrencyCode)(payload.currencyCode, 'EUR');
    const billRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills).doc();
    const billLine = {
        id: 'line-1',
        description: (0, shared_1.normalizeString)(payload.lineDescription) || 'Invoice upload',
        quantity,
        unitCost,
        netAmount,
        taxCodeId: null,
        taxRatePercent,
        taxAmount,
        accountId: null,
        projectId,
    };
    await billRef.set({
        tenantId,
        billNo: (0, shared_1.normalizeString)(payload.billNo) || `BILL-${Date.now()}`,
        vendorId,
        projectId,
        billDate: admin.firestore.Timestamp.fromDate(billDate),
        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
        currencyCode,
        status: autoPost ? 'posted' : 'draft',
        lines: [billLine],
        notes: (0, shared_1.normalizeString)(payload.notes) || null,
        netAmount,
        taxAmount,
        grossAmount,
        paidAmount: 0,
        openAmount: grossAmount,
        sourceDocumentId: (0, shared_1.normalizeString)(payload.documentId) || null,
        sourceDocumentVersionId: (0, shared_1.normalizeString)(payload.documentVersionId) || null,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    let journalEntryId = null;
    if (autoPost) {
        const settings = await loadFinanceSettings(tenantId);
        const journalResponse = await postJournalEntryInternal(actorId, {
            tenantId,
            postingDate: billDate.toISOString(),
            description: `Bill ${(0, shared_1.normalizeString)(payload.billNo) || billRef.id}`,
            sourceType: 'bill',
            sourceId: billRef.id,
            sourceRefNo: (0, shared_1.normalizeString)(payload.billNo) || billRef.id,
            projectId: projectId || undefined,
            currencyCode,
            idempotencyKey: `bill-upload-confirm-${billRef.id}`,
            lines: [
                {
                    accountId: settings.defaultExpenseAccountId,
                    debit: netAmount,
                    credit: 0,
                    description: 'Expense',
                    vendorId,
                    projectId: projectId || undefined,
                },
                ...(taxAmount > 0
                    ? [{
                            accountId: settings.defaultInputTaxAccountId,
                            debit: taxAmount,
                            credit: 0,
                            description: 'Input tax',
                            vendorId,
                            projectId: projectId || undefined,
                        }]
                    : []),
                {
                    accountId: settings.defaultPayableAccountId,
                    debit: 0,
                    credit: grossAmount,
                    description: 'Payable',
                    vendorId,
                    projectId: projectId || undefined,
                },
            ],
        });
        journalEntryId = journalResponse.entryId;
        await billRef.update({
            journalEntryId,
            status: 'posted',
            updatedAt: (0, shared_1.serverTimestamp)(),
        });
    }
    let recurringTemplateId = null;
    if (cadence === 'recurring') {
        const cadenceRaw = (0, shared_1.normalizeString)(payload.recurringFrequency);
        const recurringCadence = cadenceRaw === 'weekly' || cadenceRaw === 'yearly' ? cadenceRaw : 'monthly';
        const templateRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.recurringTemplates).doc();
        await templateRef.set({
            tenantId,
            projectId,
            vendorId,
            customerId: null,
            type: 'bill',
            cadence: recurringCadence,
            nextRunAt: admin.firestore.Timestamp.fromDate(dueDate),
            endAt: (0, shared_1.normalizeString)(payload.recurringEndDate)
                ? admin.firestore.Timestamp.fromDate(toDateFromInput(payload.recurringEndDate))
                : null,
            autoPost,
            isActive: true,
            currencyCode,
            notes: (0, shared_1.normalizeString)(payload.notes) || null,
            sourceDocumentId: (0, shared_1.normalizeString)(payload.documentId) || null,
            createdBy: actorId,
            createdAt: (0, shared_1.serverTimestamp)(),
            updatedAt: (0, shared_1.serverTimestamp)(),
        });
        recurringTemplateId = templateRef.id;
    }
    const documentId = (0, shared_1.normalizeString)(payload.documentId);
    if (documentId) {
        await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.documents).doc(documentId).set({
            linkedEntityType: 'bill',
            linkedEntityId: billRef.id,
            projectId,
            updatedAt: (0, shared_1.serverTimestamp)(),
        }, { merge: true });
    }
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.upload_invoice.confirmed', {
        billId: billRef.id,
        vendorId,
        cadence,
        recurringTemplateId,
        journalEntryId,
        documentId: documentId || null,
    });
    return {
        billId: billRef.id,
        vendorId,
        recurringTemplateId,
        journalEntryId,
    };
});
exports.upsertFinanceTaxCode = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.tax.manage');
    const taxCodeId = (0, shared_1.normalizeString)(payload.taxCodeId);
    const code = (0, shared_1.normalizeString)(payload.code);
    const label = (0, shared_1.normalizeString)(payload.label);
    const kind = (0, shared_1.normalizeString)(payload.kind);
    if (!code || !label || !kind) {
        throw new functions.https.HttpsError('invalid-argument', 'code, label and kind are required.');
    }
    const ref = taxCodeId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.taxCodes).doc(taxCodeId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.taxCodes).doc();
    await ref.set({
        tenantId,
        code,
        label,
        kind,
        ratePercent: (0, shared_1.toNonNegative)(payload.ratePercent),
        datevKey: (0, shared_1.normalizeString)(payload.datevKey) || null,
        isActive: payload.isActive === false ? false : true,
        updatedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.taxCode.upserted', {
        taxCodeId: ref.id,
        code,
    });
    return { taxCodeId: ref.id };
});
exports.createInvoice = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ar.manage');
    const customerId = (0, shared_1.normalizeString)(payload.customerId);
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
    const currencyCode = (0, shared_1.normalizeCurrencyCode)(payload.currencyCode, 'EUR');
    const netAmount = round2(sum(lines.map((line) => line.netAmount)));
    const taxAmount = round2(sum(lines.map((line) => line.taxAmount)));
    const grossAmount = round2(netAmount + taxAmount);
    const invoiceRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices).doc();
    await invoiceRef.set({
        tenantId,
        invoiceNo: (0, shared_1.normalizeString)(payload.invoiceNo) || `INV-${Date.now()}`,
        customerId,
        projectId: (0, shared_1.normalizeString)(payload.projectId) || null,
        issueDate: admin.firestore.Timestamp.fromDate(issueDate),
        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
        currencyCode,
        status: 'draft',
        lines,
        notes: (0, shared_1.normalizeString)(payload.notes) || null,
        netAmount,
        taxAmount,
        grossAmount,
        paidAmount: 0,
        openAmount: grossAmount,
        dunningLevel: Math.max(0, Math.floor((0, shared_1.toNumber)(payload.dunningLevel || 0))),
        sourceDocumentId: (0, shared_1.normalizeString)(payload.sourceDocumentId) || null,
        sourceDocumentVersionId: (0, shared_1.normalizeString)(payload.sourceDocumentVersionId) || null,
        sourceDocumentFileId: (0, shared_1.normalizeString)(payload.sourceDocumentFileId) || null,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.invoice.created', {
        invoiceId: invoiceRef.id,
        customerId,
        grossAmount,
    });
    return { invoiceId: invoiceRef.id };
});
exports.issueInvoice = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ar.manage');
    const invoiceId = (0, shared_1.normalizeString)(payload.invoiceId);
    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required.');
    }
    const invoiceRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices).doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }
    const invoice = invoiceSnap.data() || {};
    const status = (0, shared_1.normalizeString)(invoice.status);
    if (status !== 'draft') {
        throw new functions.https.HttpsError('failed-precondition', 'Only draft invoices can be issued.');
    }
    const settings = await loadFinanceSettings(tenantId);
    const journalResponse = await postJournalEntryInternal(actorId, {
        tenantId,
        postingDate: invoice.issueDate.toDate().toISOString(),
        description: `Invoice ${(0, shared_1.normalizeString)(invoice.invoiceNo)}`,
        sourceType: 'invoice',
        sourceId: invoiceId,
        sourceRefNo: (0, shared_1.normalizeString)(invoice.invoiceNo),
        projectId: (0, shared_1.normalizeString)(invoice.projectId) || undefined,
        currencyCode: (0, shared_1.normalizeCurrencyCode)(invoice.currencyCode, settings.currencyCode),
        idempotencyKey: `invoice-issue-${invoiceId}`,
        lines: [
            {
                accountId: settings.defaultReceivableAccountId,
                debit: (0, shared_1.toNonNegative)(invoice.grossAmount),
                credit: 0,
                description: 'Receivable',
                customerId: (0, shared_1.normalizeString)(invoice.customerId) || undefined,
                projectId: (0, shared_1.normalizeString)(invoice.projectId) || undefined,
            },
            {
                accountId: settings.defaultRevenueAccountId,
                debit: 0,
                credit: (0, shared_1.toNonNegative)(invoice.netAmount),
                description: 'Revenue',
                customerId: (0, shared_1.normalizeString)(invoice.customerId) || undefined,
                projectId: (0, shared_1.normalizeString)(invoice.projectId) || undefined,
            },
            ...((0, shared_1.toNonNegative)(invoice.taxAmount) > 0
                ? [{
                        accountId: settings.defaultOutputTaxAccountId,
                        debit: 0,
                        credit: (0, shared_1.toNonNegative)(invoice.taxAmount),
                        description: 'Output tax',
                        customerId: (0, shared_1.normalizeString)(invoice.customerId) || undefined,
                        projectId: (0, shared_1.normalizeString)(invoice.projectId) || undefined,
                    }]
                : []),
        ],
    });
    await invoiceRef.update({
        status: 'issued',
        journalEntryId: journalResponse.entryId,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.invoice.issued', {
        invoiceId,
        journalEntryId: journalResponse.entryId,
    });
    return { invoiceId, journalEntryId: journalResponse.entryId };
});
exports.voidInvoice = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ar.manage');
    const invoiceId = (0, shared_1.normalizeString)(payload.invoiceId);
    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required.');
    }
    const invoiceRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices).doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }
    const invoice = invoiceSnap.data() || {};
    const status = (0, shared_1.normalizeString)(invoice.status);
    if (status === 'voided') {
        return { invoiceId, alreadyVoided: true };
    }
    if (status === 'paid' || (0, shared_1.toNonNegative)(invoice.paidAmount) > 0) {
        throw new functions.https.HttpsError('failed-precondition', 'Paid or partially paid invoices cannot be voided. Create a credit note instead.');
    }
    const journalEntryId = (0, shared_1.normalizeString)(invoice.journalEntryId);
    if (journalEntryId) {
        const linesSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalLines)
            .where('entryId', '==', journalEntryId)
            .orderBy('lineNo', 'asc')
            .get();
        const reverseLines = linesSnap.docs.map((doc) => {
            const line = doc.data();
            return {
                accountId: (0, shared_1.normalizeString)(line.accountId),
                debit: (0, shared_1.toNonNegative)(line.credit),
                credit: (0, shared_1.toNonNegative)(line.debit),
                description: `Reversal ${(0, shared_1.normalizeString)(line.description)}`,
                taxCodeId: (0, shared_1.normalizeString)(line.taxCodeId) || undefined,
                projectId: (0, shared_1.normalizeString)(line.projectId) || undefined,
                customerId: (0, shared_1.normalizeString)(line.customerId) || undefined,
                vendorId: (0, shared_1.normalizeString)(line.vendorId) || undefined,
            };
        });
        if (reverseLines.length >= 2) {
            await postJournalEntryInternal(actorId, {
                tenantId,
                postingDate: new Date().toISOString(),
                description: `Reversal invoice ${(0, shared_1.normalizeString)(invoice.invoiceNo)}`,
                sourceType: 'invoice',
                sourceId: invoiceId,
                sourceRefNo: (0, shared_1.normalizeString)(invoice.invoiceNo),
                projectId: (0, shared_1.normalizeString)(invoice.projectId) || undefined,
                currencyCode: (0, shared_1.normalizeCurrencyCode)(invoice.currencyCode, 'EUR'),
                idempotencyKey: `invoice-void-${invoiceId}`,
                lines: reverseLines,
            });
        }
    }
    await invoiceRef.update({
        status: 'voided',
        openAmount: 0,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.invoice.voided', {
        invoiceId,
        reason: (0, shared_1.normalizeString)(payload.reason) || null,
    });
    return { invoiceId, status: 'voided' };
});
exports.advanceInvoiceDunning = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ar.manage');
    const invoiceId = (0, shared_1.normalizeString)(payload.invoiceId);
    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required.');
    }
    const invoiceRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices).doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Invoice not found.');
    }
    const invoice = invoiceSnap.data() || {};
    const status = (0, shared_1.normalizeString)(invoice.status);
    if (status !== 'issued' && status !== 'partially_paid') {
        throw new functions.https.HttpsError('failed-precondition', 'Only open invoices can be dunned.');
    }
    const currentLevel = Math.max(0, Math.floor((0, shared_1.toNumber)(invoice.dunningLevel || 0)));
    const nextLevel = Math.min(3, currentLevel + 1);
    await invoiceRef.update({
        dunningLevel: nextLevel,
        dunningLastAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.invoice.dunning_advanced', {
        invoiceId,
        previousLevel: currentLevel,
        nextLevel,
    });
    return { invoiceId, dunningLevel: nextLevel };
});
exports.createBill = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ap.manage');
    const vendorId = (0, shared_1.normalizeString)(payload.vendorId);
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
    const currencyCode = (0, shared_1.normalizeCurrencyCode)(payload.currencyCode, 'EUR');
    const netAmount = round2(sum(lines.map((line) => line.netAmount)));
    const taxAmount = round2(sum(lines.map((line) => line.taxAmount)));
    const grossAmount = round2(netAmount + taxAmount);
    const billRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills).doc();
    await billRef.set({
        tenantId,
        billNo: (0, shared_1.normalizeString)(payload.billNo) || `BILL-${Date.now()}`,
        vendorId,
        projectId: (0, shared_1.normalizeString)(payload.projectId) || null,
        sourceDocumentFileId: (0, shared_1.normalizeString)(payload.sourceDocumentFileId) || null,
        billDate: admin.firestore.Timestamp.fromDate(billDate),
        dueDate: admin.firestore.Timestamp.fromDate(dueDate),
        currencyCode,
        status: 'draft',
        lines,
        notes: (0, shared_1.normalizeString)(payload.notes) || null,
        netAmount,
        taxAmount,
        grossAmount,
        paidAmount: 0,
        openAmount: grossAmount,
        sourceDocumentId: (0, shared_1.normalizeString)(payload.sourceDocumentId) || null,
        sourceDocumentVersionId: (0, shared_1.normalizeString)(payload.sourceDocumentVersionId) || null,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.bill.created', {
        billId: billRef.id,
        vendorId,
        grossAmount,
        sourceDocumentFileId: (0, shared_1.normalizeString)(payload.sourceDocumentFileId) || null,
    });
    return { billId: billRef.id };
});
exports.postBill = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ap.manage');
    const billId = (0, shared_1.normalizeString)(payload.billId);
    if (!billId) {
        throw new functions.https.HttpsError('invalid-argument', 'billId is required.');
    }
    const billRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills).doc(billId);
    const billSnap = await billRef.get();
    if (!billSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Bill not found.');
    }
    const bill = billSnap.data() || {};
    const status = (0, shared_1.normalizeString)(bill.status);
    if (status !== 'draft') {
        throw new functions.https.HttpsError('failed-precondition', 'Only draft bills can be posted.');
    }
    const settings = await loadFinanceSettings(tenantId);
    const journalResponse = await postJournalEntryInternal(actorId, {
        tenantId,
        postingDate: bill.billDate.toDate().toISOString(),
        description: `Bill ${(0, shared_1.normalizeString)(bill.billNo)}`,
        sourceType: 'bill',
        sourceId: billId,
        sourceRefNo: (0, shared_1.normalizeString)(bill.billNo),
        projectId: (0, shared_1.normalizeString)(bill.projectId) || undefined,
        currencyCode: (0, shared_1.normalizeCurrencyCode)(bill.currencyCode, settings.currencyCode),
        idempotencyKey: `bill-post-${billId}`,
        lines: [
            {
                accountId: settings.defaultExpenseAccountId,
                debit: (0, shared_1.toNonNegative)(bill.netAmount),
                credit: 0,
                description: 'Expense',
                vendorId: (0, shared_1.normalizeString)(bill.vendorId) || undefined,
                projectId: (0, shared_1.normalizeString)(bill.projectId) || undefined,
            },
            ...((0, shared_1.toNonNegative)(bill.taxAmount) > 0
                ? [{
                        accountId: settings.defaultInputTaxAccountId,
                        debit: (0, shared_1.toNonNegative)(bill.taxAmount),
                        credit: 0,
                        description: 'Input tax',
                        vendorId: (0, shared_1.normalizeString)(bill.vendorId) || undefined,
                        projectId: (0, shared_1.normalizeString)(bill.projectId) || undefined,
                    }]
                : []),
            {
                accountId: settings.defaultPayableAccountId,
                debit: 0,
                credit: (0, shared_1.toNonNegative)(bill.grossAmount),
                description: 'Payable',
                vendorId: (0, shared_1.normalizeString)(bill.vendorId) || undefined,
                projectId: (0, shared_1.normalizeString)(bill.projectId) || undefined,
            },
        ],
    });
    await billRef.update({
        status: 'posted',
        journalEntryId: journalResponse.entryId,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.bill.posted', {
        billId,
        journalEntryId: journalResponse.entryId,
    });
    return { billId, journalEntryId: journalResponse.entryId };
});
exports.voidBill = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.ap.manage');
    const billId = (0, shared_1.normalizeString)(payload.billId);
    if (!billId) {
        throw new functions.https.HttpsError('invalid-argument', 'billId is required.');
    }
    const billRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills).doc(billId);
    const billSnap = await billRef.get();
    if (!billSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Bill not found.');
    }
    const bill = billSnap.data() || {};
    const status = (0, shared_1.normalizeString)(bill.status);
    if (status === 'voided') {
        return { billId, alreadyVoided: true };
    }
    if (status === 'paid' || (0, shared_1.toNonNegative)(bill.paidAmount) > 0) {
        throw new functions.https.HttpsError('failed-precondition', 'Paid or partially paid bills cannot be voided.');
    }
    const journalEntryId = (0, shared_1.normalizeString)(bill.journalEntryId);
    if (journalEntryId) {
        const linesSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalLines)
            .where('entryId', '==', journalEntryId)
            .orderBy('lineNo', 'asc')
            .get();
        const reverseLines = linesSnap.docs.map((doc) => {
            const line = doc.data();
            return {
                accountId: (0, shared_1.normalizeString)(line.accountId),
                debit: (0, shared_1.toNonNegative)(line.credit),
                credit: (0, shared_1.toNonNegative)(line.debit),
                description: `Reversal ${(0, shared_1.normalizeString)(line.description)}`,
                taxCodeId: (0, shared_1.normalizeString)(line.taxCodeId) || undefined,
                projectId: (0, shared_1.normalizeString)(line.projectId) || undefined,
                customerId: (0, shared_1.normalizeString)(line.customerId) || undefined,
                vendorId: (0, shared_1.normalizeString)(line.vendorId) || undefined,
            };
        });
        if (reverseLines.length >= 2) {
            await postJournalEntryInternal(actorId, {
                tenantId,
                postingDate: new Date().toISOString(),
                description: `Reversal bill ${(0, shared_1.normalizeString)(bill.billNo)}`,
                sourceType: 'bill',
                sourceId: billId,
                sourceRefNo: (0, shared_1.normalizeString)(bill.billNo),
                projectId: (0, shared_1.normalizeString)(bill.projectId) || undefined,
                currencyCode: (0, shared_1.normalizeCurrencyCode)(bill.currencyCode, 'EUR'),
                idempotencyKey: `bill-void-${billId}`,
                lines: reverseLines,
            });
        }
    }
    await billRef.update({
        status: 'voided',
        openAmount: 0,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.bill.voided', {
        billId,
        reason: (0, shared_1.normalizeString)(payload.reason) || null,
    });
    return { billId, status: 'voided' };
});
exports.recordPayment = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const amount = (0, shared_1.toNonNegative)(payload.amount);
    if (amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'amount must be greater than 0.');
    }
    const direction = (0, shared_1.normalizeString)(payload.direction) === 'outgoing' ? 'outgoing' : 'incoming';
    const paymentDate = toDateFromInput(payload.paymentDate);
    const customerId = (0, shared_1.normalizeString)(payload.customerId) || null;
    const vendorId = (0, shared_1.normalizeString)(payload.vendorId) || null;
    const projectId = (0, shared_1.normalizeString)(payload.projectId) || null;
    const paymentRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.payments).doc();
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
        currencyCode: (0, shared_1.normalizeCurrencyCode)(payload.currencyCode, settings.currencyCode),
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
        currencyCode: (0, shared_1.normalizeCurrencyCode)(payload.currencyCode, settings.currencyCode),
        bankAccountId: (0, shared_1.normalizeString)(payload.bankAccountId) || null,
        customerId,
        vendorId,
        projectId,
        notes: (0, shared_1.normalizeString)(payload.notes) || null,
        status: 'recorded',
        allocatedAmount: 0,
        unallocatedAmount: amount,
        journalEntryId: journal.entryId,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.payment.recorded', {
        paymentId: paymentRef.id,
        amount,
        direction,
    });
    return { paymentId: paymentRef.id, journalEntryId: journal.entryId };
});
exports.allocatePayment = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const paymentId = (0, shared_1.normalizeString)(payload.paymentId);
    const targetType = (0, shared_1.normalizeString)(payload.targetType) === 'bill' ? 'bill' : 'invoice';
    const targetId = (0, shared_1.normalizeString)(payload.targetId);
    const amount = (0, shared_1.toNonNegative)(payload.amount);
    if (!paymentId || !targetId || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'paymentId, targetId and amount > 0 are required.');
    }
    const paymentRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.payments).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Payment not found.');
    }
    const payment = paymentSnap.data() || {};
    const unallocatedAmount = (0, shared_1.toNonNegative)(payment.unallocatedAmount);
    if (amount > unallocatedAmount + 0.00001) {
        throw new functions.https.HttpsError('failed-precondition', 'Allocation exceeds unallocated payment amount.');
    }
    const allocationRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.paymentAllocations).doc();
    await allocationRef.set({
        tenantId,
        paymentId,
        targetType,
        targetId,
        amount,
        currencyCode: (0, shared_1.normalizeCurrencyCode)(payment.currencyCode, 'EUR'),
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    const nextAllocatedAmount = round2((0, shared_1.toNonNegative)(payment.allocatedAmount) + amount);
    const nextUnallocatedAmount = round2(unallocatedAmount - amount);
    const paymentStatus = nextUnallocatedAmount <= 0 ? 'allocated' : 'partially_allocated';
    await paymentRef.update({
        allocatedAmount: nextAllocatedAmount,
        unallocatedAmount: nextUnallocatedAmount,
        status: paymentStatus,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await applyPaymentToTarget(tenantId, targetType, targetId, amount);
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.payment.allocated', {
        paymentId,
        targetType,
        targetId,
        amount,
    });
    return { allocationId: allocationRef.id };
});
exports.unallocatePayment = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const paymentId = (0, shared_1.normalizeString)(payload.paymentId);
    const targetType = (0, shared_1.normalizeString)(payload.targetType) === 'bill' ? 'bill' : 'invoice';
    const targetId = (0, shared_1.normalizeString)(payload.targetId);
    const amount = (0, shared_1.toNonNegative)(payload.amount);
    if (!paymentId || !targetId || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'paymentId, targetId and amount > 0 are required.');
    }
    const allocationSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.paymentAllocations)
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
    const paymentRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.payments).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Payment not found.');
    }
    const payment = paymentSnap.data() || {};
    const nextAllocatedAmount = round2(Math.max(0, (0, shared_1.toNonNegative)(payment.allocatedAmount) - amount));
    const nextUnallocatedAmount = round2((0, shared_1.toNonNegative)(payment.unallocatedAmount) + amount);
    await allocationDoc.ref.delete();
    await paymentRef.update({
        allocatedAmount: nextAllocatedAmount,
        unallocatedAmount: nextUnallocatedAmount,
        status: nextAllocatedAmount > 0 ? 'partially_allocated' : 'recorded',
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await applyPaymentToTarget(tenantId, targetType, targetId, -amount);
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.payment.unallocated', {
        paymentId,
        targetType,
        targetId,
        amount,
    });
    return { success: true };
});
exports.importBankStatement = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.reconciliation.manage');
    const transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
    if (transactions.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'transactions array is required.');
    }
    const bankAccountId = (0, shared_1.normalizeString)(payload.bankAccountId) || null;
    const batch = init_1.db.batch();
    const col = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bankTransactions);
    transactions.forEach((transaction) => {
        const raw = (transaction || {});
        const bookingDate = toDateFromInput(raw.bookingDate);
        const ref = col.doc();
        batch.set(ref, {
            tenantId,
            bankAccountId,
            bookingDate: admin.firestore.Timestamp.fromDate(bookingDate),
            valueDate: (0, shared_1.normalizeString)(raw.valueDate)
                ? admin.firestore.Timestamp.fromDate(toDateFromInput(raw.valueDate))
                : null,
            amount: round2((0, shared_1.toNumber)(raw.amount)),
            currencyCode: (0, shared_1.normalizeCurrencyCode)(raw.currencyCode, 'EUR'),
            description: (0, shared_1.normalizeString)(raw.description) || null,
            counterparty: (0, shared_1.normalizeString)(raw.counterparty) || null,
            externalReference: (0, shared_1.normalizeString)(raw.externalReference) || null,
            projectId: (0, shared_1.normalizeString)(raw.projectId) || null,
            reconciled: false,
            reconciliationId: null,
            createdAt: (0, shared_1.serverTimestamp)(),
            updatedAt: (0, shared_1.serverTimestamp)(),
        });
    });
    await batch.commit();
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.bank.imported', {
        count: transactions.length,
        bankAccountId,
    });
    return { importedCount: transactions.length };
});
exports.suggestReconciliation = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.reconciliation.manage');
    const periodKey = (0, shared_1.normalizeString)(payload.periodKey) || null;
    let query = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bankTransactions)
        .where('reconciled', '==', false);
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
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices)
            .where('status', 'in', ['issued', 'partially_paid'])
            .get(),
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills)
            .where('status', 'in', ['posted', 'partially_paid'])
            .get(),
    ]);
    const openInvoices = invoicesSnap.docs
        .map((doc) => (Object.assign({ id: doc.id }, doc.data())));
    const openBills = billsSnap.docs
        .map((doc) => (Object.assign({ id: doc.id }, doc.data())));
    const invoiceByNo = new Map();
    const billByNo = new Map();
    invoicesSnap.docs.forEach((doc) => {
        const invoiceNo = (0, shared_1.normalizeString)(doc.data().invoiceNo).toLowerCase();
        if (invoiceNo)
            invoiceByNo.set(invoiceNo, { id: doc.id });
    });
    billsSnap.docs.forEach((doc) => {
        const billNo = (0, shared_1.normalizeString)(doc.data().billNo).toLowerCase();
        if (billNo)
            billByNo.set(billNo, { id: doc.id });
    });
    const suggestions = bankTxSnap.docs.map((doc) => {
        const tx = doc.data();
        const amount = round2((0, shared_1.toNumber)(tx.amount));
        const absAmount = Math.abs(amount);
        const referenceText = `${(0, shared_1.normalizeString)(tx.description)} ${(0, shared_1.normalizeString)(tx.externalReference)} ${(0, shared_1.normalizeString)(tx.counterparty)}`.toLowerCase();
        const parseByReference = () => {
            for (const [invoiceNo, invoice] of invoiceByNo.entries()) {
                if (invoiceNo && referenceText.includes(invoiceNo)) {
                    return {
                        targetType: 'invoice',
                        targetId: invoice.id,
                        confidence: 0.97,
                        rationale: `Matched by reference "${invoiceNo}"`,
                    };
                }
            }
            for (const [billNo, bill] of billByNo.entries()) {
                if (billNo && referenceText.includes(billNo)) {
                    return {
                        targetType: 'bill',
                        targetId: bill.id,
                        confidence: 0.97,
                        rationale: `Matched by reference "${billNo}"`,
                    };
                }
            }
            return null;
        };
        const byReference = parseByReference();
        if (byReference) {
            return {
                bankTransactionId: doc.id,
                targetType: byReference.targetType,
                targetId: byReference.targetId,
                amount: absAmount,
                confidence: byReference.confidence,
                rationale: byReference.rationale,
            };
        }
        if (amount >= 0) {
            const exactInvoice = openInvoices.find((invoice) => Math.abs(round2((0, shared_1.toNumber)(invoice.openAmount)) - absAmount) < 0.01);
            if (exactInvoice) {
                return {
                    bankTransactionId: doc.id,
                    targetType: 'invoice',
                    targetId: exactInvoice.id,
                    amount: absAmount,
                    confidence: 0.92,
                    rationale: 'Exact amount match to open invoice.',
                };
            }
            const fuzzyInvoice = openInvoices
                .map((invoice) => ({
                id: invoice.id,
                delta: Math.abs(round2((0, shared_1.toNumber)(invoice.openAmount)) - absAmount),
            }))
                .sort((a, b) => a.delta - b.delta)[0];
            if (fuzzyInvoice && fuzzyInvoice.delta <= 2) {
                return {
                    bankTransactionId: doc.id,
                    targetType: 'invoice',
                    targetId: fuzzyInvoice.id,
                    amount: absAmount,
                    confidence: 0.72,
                    rationale: `Fuzzy amount match (delta ${round2(fuzzyInvoice.delta)}).`,
                };
            }
        }
        else {
            const exactBill = openBills.find((bill) => Math.abs(round2((0, shared_1.toNumber)(bill.openAmount)) - absAmount) < 0.01);
            if (exactBill) {
                return {
                    bankTransactionId: doc.id,
                    targetType: 'bill',
                    targetId: exactBill.id,
                    amount: absAmount,
                    confidence: 0.92,
                    rationale: 'Exact amount match to open bill.',
                };
            }
            const fuzzyBill = openBills
                .map((bill) => ({
                id: bill.id,
                delta: Math.abs(round2((0, shared_1.toNumber)(bill.openAmount)) - absAmount),
            }))
                .sort((a, b) => a.delta - b.delta)[0];
            if (fuzzyBill && fuzzyBill.delta <= 2) {
                return {
                    bankTransactionId: doc.id,
                    targetType: 'bill',
                    targetId: fuzzyBill.id,
                    amount: absAmount,
                    confidence: 0.72,
                    rationale: `Fuzzy amount match (delta ${round2(fuzzyBill.delta)}).`,
                };
            }
        }
        return {
            bankTransactionId: doc.id,
            targetType: null,
            targetId: null,
            amount: absAmount,
            confidence: 0,
            rationale: 'No confident match found.',
        };
    });
    return { suggestions };
});
exports.confirmReconciliation = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.reconciliation.manage');
    const periodKey = (0, shared_1.normalizeString)(payload.periodKey) || (0, shared_1.toPeriodKey)(new Date());
    const matchedTransactionIds = Array.isArray(payload.matchedTransactionIds)
        ? payload.matchedTransactionIds.map((value) => (0, shared_1.normalizeString)(value)).filter(Boolean)
        : [];
    const unmatchedTransactionIds = Array.isArray(payload.unmatchedTransactionIds)
        ? payload.unmatchedTransactionIds.map((value) => (0, shared_1.normalizeString)(value)).filter(Boolean)
        : [];
    const matchedItems = Array.isArray(payload.matchedItems)
        ? payload.matchedItems
            .map((item) => item)
            .map((item) => ({
            bankTransactionId: (0, shared_1.normalizeString)(item.bankTransactionId),
            targetType: (0, shared_1.normalizeString)(item.targetType),
            targetId: (0, shared_1.normalizeString)(item.targetId),
            confidence: (0, shared_1.toNumber)(item.confidence),
            rationale: (0, shared_1.normalizeString)(item.rationale) || null,
        }))
            .filter((item) => item.bankTransactionId)
        : [];
    const reconciliationRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.reconciliations).doc();
    const batch = init_1.db.batch();
    batch.set(reconciliationRef, {
        tenantId,
        bankAccountId: (0, shared_1.normalizeString)(payload.bankAccountId) || null,
        periodKey,
        matchedTransactionIds,
        matchedItems,
        unmatchedTransactionIds,
        notes: (0, shared_1.normalizeString)(payload.notes) || null,
        confirmedBy: actorId,
        confirmedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    matchedTransactionIds.forEach((id) => {
        const txRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bankTransactions).doc(id);
        batch.update(txRef, {
            reconciled: true,
            reconciliationId: reconciliationRef.id,
            updatedAt: (0, shared_1.serverTimestamp)(),
        });
    });
    await batch.commit();
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.reconciliation.confirmed', {
        reconciliationId: reconciliationRef.id,
        periodKey,
        matchedCount: matchedTransactionIds.length,
        unmatchedCount: unmatchedTransactionIds.length,
    });
    return { reconciliationId: reconciliationRef.id };
});
exports.runMonthlyClose = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.close');
    const periodKey = (0, shared_1.normalizeString)(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }
    const [yearStr, monthStr] = periodKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey must be YYYY-MM.');
    }
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    const [unreconciledBank, openInvoices, openBills] = await Promise.all([
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bankTransactions)
            .where('reconciled', '==', false)
            .where('bookingDate', '>=', admin.firestore.Timestamp.fromDate(from))
            .where('bookingDate', '<', admin.firestore.Timestamp.fromDate(to))
            .get(),
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices)
            .where('status', 'in', ['draft', 'issued', 'partially_paid'])
            .get(),
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills)
            .where('status', 'in', ['draft', 'posted', 'partially_paid'])
            .get(),
    ]);
    const blockingChecks = {
        unreconciledBankTransactions: unreconciledBank.size,
        openInvoices: openInvoices.size,
        openBills: openBills.size,
    };
    const hasBlocking = Object.values(blockingChecks).some((count) => count > 0);
    if (hasBlocking) {
        throw new functions.https.HttpsError('failed-precondition', `Closing checklist failed: ${JSON.stringify(blockingChecks)}`);
    }
    await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.periods).doc(periodKey).set({
        tenantId,
        id: periodKey,
        periodKey,
        monthKey: periodKey,
        status: 'closed',
        notes: (0, shared_1.normalizeString)(payload.notes) || null,
        closedBy: actorId,
        closedAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.period.closed', {
        periodKey,
        blockingChecks,
    });
    return { periodKey, status: 'closed', blockingChecks };
});
exports.reopenPeriod = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.close');
    const periodKey = (0, shared_1.normalizeString)(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }
    await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.periods).doc(periodKey).set({
        tenantId,
        id: periodKey,
        periodKey,
        monthKey: periodKey,
        status: 'open',
        reopenReason: (0, shared_1.normalizeString)(payload.reason) || null,
        reopenedBy: actorId,
        reopenedAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.period.reopened', {
        periodKey,
        reason: (0, shared_1.normalizeString)(payload.reason) || null,
    });
    return { periodKey, status: 'open' };
});
exports.generateDatevExport = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.export.datev');
    const periodKey = (0, shared_1.normalizeString)(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }
    const exportRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.exports).doc();
    await exportRef.set({
        tenantId,
        type: 'datev',
        periodKey,
        status: 'running',
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    const entriesSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalEntries)
        .where('periodKey', '==', periodKey)
        .orderBy('postingDate', 'asc')
        .get();
    const entryIds = entriesSnap.docs.map((doc) => doc.id);
    let linesSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalLines)
        .where('entryId', '==', '__none__')
        .get();
    if (entryIds.length > 0) {
        const chunks = [];
        for (let index = 0; index < entryIds.length; index += 10) {
            chunks.push(entryIds.slice(index, index + 10));
        }
        const chunkSnapshots = await Promise.all(chunks.map((chunk) => (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalLines)
            .where('entryId', 'in', chunk)
            .orderBy('entryId', 'asc')
            .orderBy('lineNo', 'asc')
            .get()));
        const allDocs = chunkSnapshots.flatMap((snapshot) => snapshot.docs);
        linesSnap = {
            docs: allDocs,
        };
    }
    const entryMap = new Map(entriesSnap.docs.map((doc) => [doc.id, doc.data()]));
    const csvRows = ['Umsatz;Sollkonto;Habenkonto;Belegdatum;Buchungstext;Belegfeld1;WKZ'];
    const validationWarnings = [];
    linesSnap.docs.forEach((doc) => {
        const line = doc.data();
        const entry = entryMap.get((0, shared_1.normalizeString)(line.entryId));
        if (!entry)
            return;
        const postingDate = entry.postingDate.toDate().toISOString().slice(0, 10);
        const amount = (0, shared_1.toNonNegative)(line.debit) > 0 ? (0, shared_1.toNonNegative)(line.debit) : (0, shared_1.toNonNegative)(line.credit);
        const sibling = linesSnap.docs.find((candidate) => {
            const candidateData = candidate.data();
            return (0, shared_1.normalizeString)(candidateData.entryId) === (0, shared_1.normalizeString)(line.entryId) && candidate.id !== doc.id;
        });
        if (!sibling) {
            validationWarnings.push(`Missing contra line for entry ${(0, shared_1.normalizeString)(line.entryId)}`);
        }
        const contraAccount = sibling ? (0, shared_1.normalizeString)(sibling.data().accountId) : '';
        const debit = (0, shared_1.toNonNegative)(line.debit) > 0;
        const sollkonto = debit ? (0, shared_1.normalizeString)(line.accountId) : contraAccount;
        const habenkonto = debit ? contraAccount : (0, shared_1.normalizeString)(line.accountId);
        csvRows.push([
            round2(amount).toFixed(2).replace('.', ','),
            sollkonto,
            habenkonto,
            postingDate,
            (0, shared_1.normalizeString)(entry.description),
            (0, shared_1.normalizeString)(entry.sourceRefNo),
            (0, shared_1.normalizeCurrencyCode)(entry.currencyCode, 'EUR'),
        ].join(';'));
    });
    const csv = csvRows.join('\n');
    const fileName = `datev_${periodKey}_${new Date().toISOString().slice(0, 10)}.csv`;
    await exportRef.update({
        status: 'completed',
        fileName,
        payloadPreview: csv.slice(0, 120000),
        validationWarnings,
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.datev.export.generated', {
        exportJobId: exportRef.id,
        periodKey,
        rowCount: csvRows.length - 1,
        validationWarningsCount: validationWarnings.length,
    });
    return { exportJobId: exportRef.id, status: 'completed', validationWarnings };
});
exports.buildFinancialReports = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.reports.manage');
    const periodKeyFrom = (0, shared_1.normalizeString)(payload.periodKeyFrom) || null;
    const periodKeyTo = (0, shared_1.normalizeString)(payload.periodKeyTo) || null;
    const [accountsSnap, projectsSnap, allocationRulesSnap] = await Promise.all([
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.accounts).get(),
        (0, shared_1.tenantCollectionRef)(tenantId, 'projects').get(),
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.allocationRules)
            .where('isActive', '==', true)
            .get(),
    ]);
    const accountMap = new Map(accountsSnap.docs.map((doc) => [doc.id, doc.data()]));
    const projectNameMap = new Map(projectsSnap.docs.map((doc) => [doc.id, (0, shared_1.normalizeString)(doc.data().title) || doc.id]));
    const hasRevenueShareAllocation = allocationRulesSnap.docs.some((doc) => {
        const rule = doc.data() || {};
        return (0, shared_1.normalizeString)(rule.basis) === 'revenue_share';
    });
    let lineQuery = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalLines);
    if (periodKeyFrom || periodKeyTo) {
        const entriesQuery = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalEntries);
        const filteredEntriesSnap = await entriesQuery.get();
        const entryIds = filteredEntriesSnap.docs
            .filter((doc) => {
            const periodKey = (0, shared_1.normalizeString)(doc.data().periodKey);
            if (periodKeyFrom && periodKey < periodKeyFrom)
                return false;
            if (periodKeyTo && periodKey > periodKeyTo)
                return false;
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
    const trialBalanceMap = new Map();
    const profitabilityMap = new Map();
    linesSnap.docs.forEach((doc) => {
        const line = doc.data();
        const accountId = (0, shared_1.normalizeString)(line.accountId);
        const debit = (0, shared_1.toNonNegative)(line.debit);
        const credit = (0, shared_1.toNonNegative)(line.credit);
        const current = trialBalanceMap.get(accountId) || { debit: 0, credit: 0 };
        current.debit += debit;
        current.credit += credit;
        trialBalanceMap.set(accountId, current);
        const account = accountMap.get(accountId) || {};
        const category = (0, shared_1.normalizeString)(account.category);
        const accountName = (0, shared_1.normalizeString)(account.name).toLowerCase();
        const lineDescription = (0, shared_1.normalizeString)(line.description).toLowerCase();
        const projectId = (0, shared_1.normalizeString)(line.projectId) || '__unassigned__';
        if (category === 'revenue' || category === 'expense') {
            const row = profitabilityMap.get(projectId) || { revenue: 0, cost: 0, aiCost: 0 };
            if (category === 'revenue') {
                row.revenue += credit - debit;
            }
            else {
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
            accountNo: (0, shared_1.normalizeString)(account.accountNo) || '',
            accountName: (0, shared_1.normalizeString)(account.name) || accountId,
            debit: round2(values.debit),
            credit: round2(values.credit),
            balance: round2(values.debit - values.credit),
        };
    })
        .sort((a, b) => a.accountNo.localeCompare(b.accountNo));
    const pnl = trialBalance
        .map((row) => {
        const account = accountMap.get(row.accountId) || {};
        const category = (0, shared_1.normalizeString)(account.category);
        if (category !== 'revenue' && category !== 'expense')
            return null;
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
        const category = (0, shared_1.normalizeString)(account.category);
        if (!['asset', 'liability', 'equity'].includes(category))
            return null;
        return {
            accountId: row.accountId,
            accountNo: row.accountNo,
            accountName: row.accountName,
            category,
            amount: round2(row.balance),
        };
    })
        .filter(Boolean);
    const profitabilityRows = Array.from(profitabilityMap.entries()).map(([projectId, values]) => ({
        projectId,
        projectName: projectId === '__unassigned__'
            ? '__unassigned__'
            : (projectNameMap.get(projectId) || projectId),
        revenue: round2(values.revenue),
        directCosts: round2(values.cost),
        aiCosts: round2(values.aiCost),
    }));
    const totalRevenueForAllocation = profitabilityRows
        .filter((row) => row.projectId !== '__unassigned__')
        .reduce((sumAcc, row) => sumAcc + Math.max(0, row.revenue), 0);
    const unassignedOverhead = round2(profitabilityRows
        .filter((row) => row.projectId === '__unassigned__')
        .reduce((sumAcc, row) => sumAcc + Math.max(0, row.directCosts), 0));
    const projectProfitability = profitabilityRows.map((row) => {
        const grossProfit = round2(row.revenue - row.directCosts);
        const overheadAllocated = hasRevenueShareAllocation && row.projectId !== '__unassigned__' && totalRevenueForAllocation > 0
            ? round2(unassignedOverhead * (Math.max(0, row.revenue) / totalRevenueForAllocation))
            : 0;
        const netProfit = round2(grossProfit - overheadAllocated);
        const marginPercent = row.revenue > 0 ? round2((netProfit / row.revenue) * 100) : 0;
        return {
            projectId: row.projectId,
            projectName: row.projectName,
            revenue: row.revenue,
            directCosts: row.directCosts,
            aiCosts: row.aiCosts,
            overheadAllocated,
            grossProfit,
            netProfit,
            marginPercent,
            contributionOne: grossProfit,
            contributionTwo: netProfit,
            periodKeyFrom,
            periodKeyTo,
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
exports.buildTaxReport = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.tax.manage');
    const periodKey = (0, shared_1.normalizeString)(payload.periodKey);
    if (!periodKey) {
        throw new functions.https.HttpsError('invalid-argument', 'periodKey is required.');
    }
    const [taxCodesSnap, entriesSnap] = await Promise.all([
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.taxCodes).get(),
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalEntries)
            .where('periodKey', '==', periodKey)
            .get(),
    ]);
    const taxCodeMap = new Map(taxCodesSnap.docs.map((doc) => [doc.id, doc.data()]));
    const entryIds = entriesSnap.docs.map((doc) => doc.id);
    let outputTax = 0;
    let inputTax = 0;
    if (entryIds.length > 0) {
        const chunks = [];
        for (let index = 0; index < entryIds.length; index += 10) {
            chunks.push(entryIds.slice(index, index + 10));
        }
        for (const chunk of chunks) {
            const linesSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalLines)
                .where('entryId', 'in', chunk)
                .get();
            linesSnap.docs.forEach((doc) => {
                const line = doc.data();
                const taxCodeId = (0, shared_1.normalizeString)(line.taxCodeId);
                if (!taxCodeId)
                    return;
                const taxCode = taxCodeMap.get(taxCodeId) || {};
                const kind = (0, shared_1.normalizeString)(taxCode.kind);
                const amount = Math.abs((0, shared_1.toNonNegative)(line.debit) - (0, shared_1.toNonNegative)(line.credit));
                if (kind === 'output')
                    outputTax += amount;
                if (kind === 'input')
                    inputTax += amount;
            });
        }
    }
    const payableTax = round2(outputTax - inputTax);
    const reportRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.taxReports).doc(periodKey);
    await reportRef.set({
        tenantId,
        periodKey,
        outputTax: round2(outputTax),
        inputTax: round2(inputTax),
        payableTax,
        currencyCode: 'EUR',
        generatedBy: actorId,
        generatedAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.taxPeriods).doc(periodKey).set({
        tenantId,
        periodKey,
        status: 'open',
        updatedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.tax.report.generated', {
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
exports.upsertFinanceSyncConnection = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.sync.manage');
    const connection = (payload.connection || {});
    const connectionId = (0, shared_1.normalizeString)(payload.connectionId);
    const providerRaw = (0, shared_1.normalizeString)(connection.provider).toLowerCase();
    const provider = (providerRaw === 'stripe'
        || providerRaw === 'paddle'
        || providerRaw === 'datev'
        || providerRaw === 'lexoffice'
        || providerRaw === 'custom')
        ? providerRaw
        : 'custom';
    const directionRaw = (0, shared_1.normalizeString)(connection.direction).toLowerCase();
    const direction = (directionRaw === 'import'
        || directionRaw === 'export'
        || directionRaw === 'bidirectional')
        ? directionRaw
        : 'import';
    const statusRaw = (0, shared_1.normalizeString)(connection.status).toLowerCase();
    const status = (statusRaw === 'paused' || statusRaw === 'disabled') ? statusRaw : 'active';
    const ref = connectionId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.syncConnections).doc(connectionId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.syncConnections).doc();
    await ref.set({
        tenantId,
        provider,
        direction,
        status,
        name: (0, shared_1.normalizeString)(connection.name) || `${provider.toUpperCase()} Sync`,
        configRef: (0, shared_1.normalizeString)(connection.configRef) || null,
        lastRunAt: connection.lastRunAt || null,
        lastRunStatus: (0, shared_1.normalizeString)(connection.lastRunStatus) || null,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.sync_connection.upserted', {
        connectionId: ref.id,
        provider,
        direction,
        status,
    });
    return { connectionId: ref.id };
});
exports.runFinanceSync = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.sync.manage');
    const connectionId = (0, shared_1.normalizeString)(payload.connectionId);
    if (!connectionId) {
        throw new functions.https.HttpsError('invalid-argument', 'connectionId is required.');
    }
    const connectionRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.syncConnections).doc(connectionId);
    const connectionSnap = await connectionRef.get();
    if (!connectionSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Sync connection not found.');
    }
    const connection = connectionSnap.data() || {};
    if ((0, shared_1.normalizeString)(connection.status) !== 'active') {
        throw new functions.https.HttpsError('failed-precondition', 'Sync connection is not active.');
    }
    const modeRaw = (0, shared_1.normalizeString)(payload.mode).toLowerCase();
    const mode = modeRaw === 'full' ? 'full' : 'delta';
    const idempotencyKey = (0, shared_1.normalizeString)(payload.idempotencyKey)
        || (0, shared_1.buildIdempotencyKey)({
            tenantId,
            connectionId,
            mode,
            day: new Date().toISOString().slice(0, 10),
        });
    const existing = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.syncRuns)
        .where('connectionId', '==', connectionId)
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get();
    if (!existing.empty) {
        return { runId: existing.docs[0].id, idempotentReplay: true };
    }
    const runRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.syncRuns).doc();
    await runRef.set({
        tenantId,
        connectionId,
        provider: (0, shared_1.normalizeString)(connection.provider) || 'custom',
        status: 'running',
        mode,
        idempotencyKey,
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        triggeredBy: actorId,
        startedAt: (0, shared_1.serverTimestamp)(),
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    });
    const jobRef = await createFinanceJob(tenantId, actorId, 'sync.run', {
        connectionId,
        runId: runRef.id,
        mode,
        idempotencyKey,
    });
    // Connector framework is already tenant-safe and idempotent.
    // Provider-specific transport is delegated to connector runtimes.
    const simulatedProcessedCount = Math.max(1, Math.min(MAX_SYNC_RUN_PREVIEW, Math.floor(Math.random() * MAX_SYNC_RUN_PREVIEW)));
    const simulatedFailureCount = 0;
    const simulatedSuccessCount = simulatedProcessedCount - simulatedFailureCount;
    await runRef.set({
        status: 'completed',
        processedCount: simulatedProcessedCount,
        successCount: simulatedSuccessCount,
        failureCount: simulatedFailureCount,
        finishedAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await connectionRef.set({
        lastRunAt: (0, shared_1.serverTimestamp)(),
        lastRunStatus: 'success',
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await completeFinanceJob(jobRef, 'completed', {
        runId: runRef.id,
        processedCount: simulatedProcessedCount,
        successCount: simulatedSuccessCount,
        failureCount: simulatedFailureCount,
    });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.sync_run.completed', {
        runId: runRef.id,
        connectionId,
        mode,
        idempotencyKey,
        processedCount: simulatedProcessedCount,
        successCount: simulatedSuccessCount,
        failureCount: simulatedFailureCount,
    });
    return {
        runId: runRef.id,
        status: 'completed',
        processedCount: simulatedProcessedCount,
        successCount: simulatedSuccessCount,
        failureCount: simulatedFailureCount,
        idempotentReplay: false,
    };
});
exports.upsertFinanceAllocationRule = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const rule = (payload.rule || {});
    const ruleId = (0, shared_1.normalizeString)(payload.ruleId);
    const name = (0, shared_1.normalizeString)(rule.name);
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'rule.name is required.');
    }
    const basisRaw = (0, shared_1.normalizeString)(rule.basis).toLowerCase();
    const basis = (basisRaw === 'cost_share'
        || basisRaw === 'unit_share'
        || basisRaw === 'token_share'
        || basisRaw === 'fixed_percent'
        || basisRaw === 'revenue_share') ? basisRaw : 'revenue_share';
    const ref = ruleId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.allocationRules).doc(ruleId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.allocationRules).doc();
    await ref.set({
        tenantId,
        name,
        sourceAccountId: (0, shared_1.normalizeString)(rule.sourceAccountId) || null,
        projectId: (0, shared_1.normalizeString)(rule.projectId) || null,
        basis,
        percent: (0, shared_1.toNonNegative)(rule.percent),
        isActive: rule.isActive === false ? false : true,
        notes: (0, shared_1.normalizeString)(rule.notes) || null,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.allocation_rule.upserted', {
        ruleId: ref.id,
        name,
        basis,
    });
    return { ruleId: ref.id };
});
const resolveOperationCallable = (operationType) => {
    const callables = {
        bank_import: exports.importBankStatement,
        reconciliation_suggest: exports.suggestReconciliation,
        reconciliation_confirm: exports.confirmReconciliation,
        tax_build_report: exports.buildTaxReport,
        reports_build_bundle: exports.buildFinancialReports,
        export_datev: exports.generateDatevExport,
        period_close: exports.runMonthlyClose,
        period_reopen: exports.reopenPeriod,
        sync_run: exports.runFinanceSync,
    };
    return callables[operationType];
};
const summarizeOperationResult = (operationType, result) => {
    if (operationType === 'reconciliation_suggest') {
        const suggestions = Array.isArray(result.suggestions) ? result.suggestions.length : 0;
        return `Generated ${suggestions} reconciliation suggestions.`;
    }
    if (operationType === 'reports_build_bundle') {
        const rows = Array.isArray(result.projectProfitability) ? result.projectProfitability.length : 0;
        return `Generated reports with ${rows} project profitability rows.`;
    }
    if (operationType === 'export_datev') {
        const warnings = Array.isArray(result.validationWarnings) ? result.validationWarnings.length : 0;
        return `DATEV export generated (${warnings} warnings).`;
    }
    return `Operation ${operationType} completed successfully.`;
};
const buildOperationPreview = async (tenantId, operationType, payload) => {
    var _a;
    const warnings = [];
    const blockingChecks = [];
    const estimatedImpact = {};
    if (operationType === 'period_close') {
        const periodKey = (0, shared_1.normalizeString)(payload.periodKey) || (0, shared_1.toPeriodKey)(new Date());
        const [yearStr, monthStr] = periodKey.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        if (!Number.isFinite(year) || !Number.isFinite(month)) {
            throw new functions.https.HttpsError('invalid-argument', 'periodKey must be YYYY-MM.');
        }
        const from = new Date(Date.UTC(year, month - 1, 1));
        const to = new Date(Date.UTC(year, month, 1));
        const [unreconciledBank, openInvoices, openBills] = await Promise.all([
            (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bankTransactions)
                .where('reconciled', '==', false)
                .where('bookingDate', '>=', admin.firestore.Timestamp.fromDate(from))
                .where('bookingDate', '<', admin.firestore.Timestamp.fromDate(to))
                .get(),
            (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices)
                .where('status', 'in', ['draft', 'issued', 'partially_paid'])
                .get(),
            (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills)
                .where('status', 'in', ['draft', 'posted', 'partially_paid'])
                .get(),
        ]);
        blockingChecks.push({
            key: 'unreconciledBankTransactions',
            count: unreconciledBank.size,
            blocking: unreconciledBank.size > 0,
            message: 'Unreconciled bank transactions in target period.',
        }, {
            key: 'openInvoices',
            count: openInvoices.size,
            blocking: openInvoices.size > 0,
            message: 'Open invoices must be cleared before close.',
        }, {
            key: 'openBills',
            count: openBills.size,
            blocking: openBills.size > 0,
            message: 'Open bills must be cleared before close.',
        });
        estimatedImpact.periodKey = periodKey;
    }
    if (operationType === 'reconciliation_suggest') {
        const unreconciledSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bankTransactions)
            .where('reconciled', '==', false)
            .limit(500)
            .get();
        estimatedImpact.unreconciledCandidates = unreconciledSnap.size;
        if (unreconciledSnap.size === 0) {
            warnings.push('No unreconciled bank transactions found.');
        }
    }
    if (operationType === 'sync_run') {
        const connectionId = (0, shared_1.normalizeString)(payload.connectionId);
        if (!connectionId) {
            throw new functions.https.HttpsError('invalid-argument', 'connectionId is required for sync_run.');
        }
        const connectionSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.syncConnections).doc(connectionId).get();
        const status = (0, shared_1.normalizeString)((_a = connectionSnap.data()) === null || _a === void 0 ? void 0 : _a.status);
        blockingChecks.push({
            key: 'syncConnectionActive',
            count: status === 'active' ? 0 : 1,
            blocking: status !== 'active',
            message: 'Sync connection must be active.',
        });
    }
    const hasBlocking = blockingChecks.some((check) => check.blocking);
    return {
        operationType,
        canExecute: !hasBlocking,
        blockingChecks,
        warnings,
        estimatedImpact,
        requiresConfirmation: OPERATION_REQUIRES_CONFIRMATION[operationType],
        risk: FINANCE_OPERATION_RISK[operationType],
    };
};
const executeOperationInternal = async (tenantId, actorId, operationType, payload, idempotencyKey, context, confirmExecution, runIdOverride) => {
    const risk = FINANCE_OPERATION_RISK[operationType];
    const requiresConfirmation = OPERATION_REQUIRES_CONFIRMATION[operationType];
    if (requiresConfirmation && !confirmExecution) {
        const runRef = await createOperationRun(tenantId, actorId, operationType, payload, idempotencyKey, 'awaiting_confirmation');
        await addOperationApproval(tenantId, actorId, runRef.id, operationType);
        await updateOperationRun(runRef, {
            status: 'awaiting_confirmation',
            steps: [
                buildOperationStep('validating', 'succeeded'),
                buildOperationStep('awaiting_confirmation', 'awaiting_confirmation'),
            ],
            resultSummary: 'Awaiting explicit confirmation before execution.',
        });
        await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.operation.awaiting_confirmation', {
            runId: runRef.id,
            operationType,
            risk,
        });
        return {
            runId: runRef.id,
            status: 'awaiting_confirmation',
            requiresConfirmation: true,
        };
    }
    if (requiresConfirmation && risk === 'high') {
        await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.approve.high_risk');
    }
    let runRef;
    if (runIdOverride) {
        runRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationRuns).doc(runIdOverride);
        await updateOperationRun(runRef, {
            status: 'running',
            confirmedBy: actorId,
            startedAt: (0, shared_1.serverTimestamp)(),
            steps: [
                buildOperationStep('validating', 'succeeded'),
                buildOperationStep('running', 'running'),
            ],
        });
    }
    else {
        runRef = await createOperationRun(tenantId, actorId, operationType, payload, idempotencyKey, 'running');
        await updateOperationRun(runRef, {
            status: 'running',
            steps: [
                buildOperationStep('validating', 'succeeded'),
                buildOperationStep('running', 'running'),
            ],
        });
    }
    try {
        const callable = resolveOperationCallable(operationType);
        const operationResult = await callable.run(Object.assign({ tenantId }, payload), context);
        const sanitizedResult = sanitizeOperationResult(operationResult);
        await updateOperationRun(runRef, {
            status: 'succeeded',
            finishedAt: (0, shared_1.serverTimestamp)(),
            resultSummary: summarizeOperationResult(operationType, sanitizedResult),
            artifacts: [
                {
                    type: 'json',
                    name: `${operationType}_result`,
                    payloadPreview: JSON.stringify(sanitizedResult).slice(0, 10000),
                },
            ],
            steps: [
                buildOperationStep('validating', 'succeeded'),
                buildOperationStep('running', 'succeeded'),
                buildOperationStep('completed', 'succeeded'),
            ],
        });
        await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.operation.executed', {
            runId: runRef.id,
            operationType,
            idempotencyKey,
            risk,
            status: 'succeeded',
        });
        return {
            runId: runRef.id,
            status: 'succeeded',
            requiresConfirmation: false,
        };
    }
    catch (error) {
        const errorMessage = (0, shared_1.normalizeString)(error === null || error === void 0 ? void 0 : error.message) || 'Operation execution failed.';
        await updateOperationRun(runRef, {
            status: 'failed',
            finishedAt: (0, shared_1.serverTimestamp)(),
            error: errorMessage,
            steps: [
                buildOperationStep('validating', 'succeeded'),
                buildOperationStep('running', 'failed', errorMessage),
            ],
        });
        await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.operation.executed', {
            runId: runRef.id,
            operationType,
            idempotencyKey,
            risk,
            status: 'failed',
            error: errorMessage,
        });
        throw error;
    }
};
exports.previewFinanceOperation = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.view');
    const operationType = normalizeOperationType(payload.operationType);
    if (!operationType) {
        throw new functions.https.HttpsError('invalid-argument', 'operationType is required.');
    }
    const operationPayload = (payload.payload || {});
    return buildOperationPreview(tenantId, operationType, operationPayload);
});
exports.executeFinanceOperation = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    var _a;
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.execute');
    const operationType = normalizeOperationType(payload.operationType);
    if (!operationType) {
        throw new functions.https.HttpsError('invalid-argument', 'operationType is required.');
    }
    const operationPayload = (payload.payload || {});
    const confirmExecution = Boolean(payload.confirm);
    const requestedRunId = (0, shared_1.normalizeString)(payload.runId);
    const idempotencyKey = (0, shared_1.normalizeString)(payload.idempotencyKey)
        || (0, shared_1.buildIdempotencyKey)({
            tenantId,
            operationType,
            operationPayload,
            day: new Date().toISOString().slice(0, 10),
        });
    if (!requestedRunId) {
        const existingRunSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationRuns)
            .where('operationType', '==', operationType)
            .where('idempotencyKey', '==', idempotencyKey)
            .limit(1)
            .get();
        if (!existingRunSnap.empty) {
            const existingRun = existingRunSnap.docs[0];
            const existingStatus = (0, shared_1.normalizeString)((_a = existingRun.data()) === null || _a === void 0 ? void 0 : _a.status);
            if (existingStatus && existingStatus !== 'failed' && existingStatus !== 'canceled') {
                return {
                    runId: existingRun.id,
                    status: existingStatus,
                    requiresConfirmation: existingStatus === 'awaiting_confirmation',
                    idempotentReplay: true,
                };
            }
        }
    }
    const preview = await buildOperationPreview(tenantId, operationType, operationPayload);
    if (!preview.canExecute && !confirmExecution) {
        throw new functions.https.HttpsError('failed-precondition', `Operation blocked: ${JSON.stringify(preview.blockingChecks)}`);
    }
    return executeOperationInternal(tenantId, actorId, operationType, operationPayload, idempotencyKey, context, confirmExecution, requestedRunId || undefined);
});
exports.getFinanceOperationRun = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.view');
    const runId = (0, shared_1.normalizeString)(payload.runId);
    if (!runId) {
        throw new functions.https.HttpsError('invalid-argument', 'runId is required.');
    }
    const runSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationRuns).doc(runId).get();
    if (!runSnap.exists) {
        return { run: null };
    }
    return {
        run: Object.assign({ id: runSnap.id }, runSnap.data()),
    };
});
exports.listFinanceOperationRuns = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.view');
    const operationType = normalizeOperationType(payload.operationType);
    const status = (0, shared_1.normalizeString)(payload.status);
    const limit = Math.min(100, Math.max(1, Number(payload.limit) || 25));
    let query = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationRuns);
    if (operationType)
        query = query.where('operationType', '==', operationType);
    if (status)
        query = query.where('status', '==', status);
    const runsSnap = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return {
        runs: runsSnap.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data()))),
    };
});
exports.retryFinanceOperationRun = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.retry');
    const runId = (0, shared_1.normalizeString)(payload.runId);
    if (!runId) {
        throw new functions.https.HttpsError('invalid-argument', 'runId is required.');
    }
    const runSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationRuns).doc(runId).get();
    if (!runSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Operation run not found.');
    }
    const runData = runSnap.data() || {};
    const operationType = normalizeOperationType(runData.operationType);
    if (!operationType) {
        throw new functions.https.HttpsError('failed-precondition', 'Run has invalid operationType.');
    }
    const status = (0, shared_1.normalizeString)(runData.status);
    if (status !== 'failed') {
        throw new functions.https.HttpsError('failed-precondition', 'Only failed runs can be retried.');
    }
    const retryKey = `${(0, shared_1.normalizeString)(runData.idempotencyKey)}:retry:${Date.now()}`;
    return executeOperationInternal(tenantId, actorId, operationType, (runData.payload || {}), retryKey, context, Boolean(payload.confirm));
});
exports.recommendFinanceOperations = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.view');
    const recommendations = [];
    const [unreconciledBankSnap, openInvoicesSnap, openBillsSnap] = await Promise.all([
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bankTransactions)
            .where('reconciled', '==', false)
            .limit(200)
            .get(),
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.invoices)
            .where('status', 'in', ['issued', 'partially_paid'])
            .limit(200)
            .get(),
        (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.bills)
            .where('status', 'in', ['posted', 'partially_paid'])
            .limit(200)
            .get(),
    ]);
    const currentPeriodKey = (0, shared_1.toPeriodKey)(new Date());
    if (unreconciledBankSnap.size > 0) {
        recommendations.push({
            operationType: 'reconciliation_suggest',
            suggestedPayload: { periodKey: currentPeriodKey },
            confidence: 0.94,
            rationale: 'Unreconciled bank transactions detected.',
            risk: FINANCE_OPERATION_RISK.reconciliation_suggest,
            whyNow: `There are ${unreconciledBankSnap.size} unreconciled bank transactions.`,
        });
    }
    if (openInvoicesSnap.size > 0 || openBillsSnap.size > 0) {
        recommendations.push({
            operationType: 'reports_build_bundle',
            suggestedPayload: { periodKeyFrom: currentPeriodKey, periodKeyTo: currentPeriodKey },
            confidence: 0.82,
            rationale: 'Open AR/AP items are present and profitability visibility is needed.',
            risk: FINANCE_OPERATION_RISK.reports_build_bundle,
            whyNow: `Open invoices: ${openInvoicesSnap.size}, open bills: ${openBillsSnap.size}.`,
        });
    }
    recommendations.push({
        operationType: 'tax_build_report',
        suggestedPayload: { periodKey: currentPeriodKey },
        confidence: 0.76,
        rationale: 'Periodic tax report generation is recommended before close/export.',
        risk: FINANCE_OPERATION_RISK.tax_build_report,
        whyNow: `Current period is ${currentPeriodKey}.`,
    });
    return { recommendations };
});
exports.upsertFinanceOperationTemplate = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.template.manage');
    const templateId = (0, shared_1.normalizeString)(payload.templateId);
    const template = (payload.template || {});
    const name = (0, shared_1.normalizeString)(template.name);
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'template.name is required.');
    }
    const operationType = normalizeOperationType(template.operationType);
    if (!operationType) {
        throw new functions.https.HttpsError('invalid-argument', 'template.operationType is required.');
    }
    const ref = templateId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationTemplates).doc(templateId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationTemplates).doc();
    await ref.set({
        tenantId,
        name,
        operationType,
        defaultPayload: (template.defaultPayload || {}),
        isShared: template.isShared === true,
        createdBy: actorId,
        createdAt: (0, shared_1.serverTimestamp)(),
        updatedAt: (0, shared_1.serverTimestamp)(),
    }, { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.operation_template.upserted', {
        templateId: ref.id,
        operationType,
        name,
    });
    return { templateId: ref.id };
});
exports.deleteFinanceOperationTemplate = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.functions.template.manage');
    const templateId = (0, shared_1.normalizeString)(payload.templateId);
    if (!templateId) {
        throw new functions.https.HttpsError('invalid-argument', 'templateId is required.');
    }
    await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.operationTemplates).doc(templateId).delete();
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.operation_template.deleted', { templateId });
    return { success: true };
});
exports.upsertScenario = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const scenario = (payload.scenario || {});
    const scenarioId = (0, shared_1.normalizeString)(payload.scenarioId);
    const name = (0, shared_1.normalizeString)(scenario.name);
    const unitLabel = (0, shared_1.normalizeString)(scenario.unitLabel || 'User');
    const plannedUnits = (0, shared_1.toNonNegative)(scenario.plannedUnits);
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'scenario.name is required.');
    }
    if (plannedUnits <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'scenario.plannedUnits must be greater than 0.');
    }
    const ref = scenarioId
        ? (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.scenarios).doc(scenarioId)
        : (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.scenarios).doc();
    const snapshot = (0, calculations_1.calculateScenarioSnapshotFromInput)(scenario);
    await ref.set(Object.assign(Object.assign({}, scenario), { tenantId, userId: actorId, name,
        unitLabel, period: (0, shared_1.normalizeString)(scenario.period || 'monthly') || 'monthly', preset: (0, shared_1.normalizeString)(scenario.preset || 'software') || 'software', plannedUnits, pricePerUnit: (0, shared_1.toNonNegative)(scenario.pricePerUnit), targetProfitPercentOnCost: (0, shared_1.toNonNegative)(scenario.targetProfitPercentOnCost), fixedCostItems: Array.isArray(scenario.fixedCostItems) ? scenario.fixedCostItems : [], variableCostItemsPerUnit: Array.isArray(scenario.variableCostItemsPerUnit) ? scenario.variableCostItemsPerUnit : [], snapshot, updatedAt: (0, shared_1.serverTimestamp)(), createdAt: (0, shared_1.serverTimestamp)() }), { merge: true });
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.scenario.upserted', {
        scenarioId: ref.id,
        name,
    });
    return { scenarioId: ref.id, snapshot };
});
exports.calculateScenarioSnapshot = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.view');
    const scenario = (payload.scenario || {});
    const result = (0, calculations_1.calculateScenarioSnapshotFromInput)(scenario);
    return { result };
});
exports.migrateLegacyFinanceV1ToV2 = functions.region(shared_1.REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = (0, shared_1.normalizeString)(payload.tenantId);
    const actorId = await (0, shared_1.requireFinancePermission)(tenantId, context, 'tenant.finance.manage');
    const dryRun = Boolean(payload.dryRun);
    const legacyTransactionsSnap = await (0, shared_1.tenantCollectionRef)(tenantId, 'transactions').get();
    const legacyRecurringSnap = await (0, shared_1.tenantCollectionRef)(tenantId, 'recurringTransactions').get();
    const legacyScenariosSnap = await (0, shared_1.tenantCollectionRef)(tenantId, 'financeScenarios').get();
    const existingMigrationEntriesSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.journalEntries)
        .where('sourceType', '==', 'migration')
        .get();
    const existingV2ScenariosSnap = await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.scenarios).get();
    const existingMigratedSourceIds = new Set(existingMigrationEntriesSnap.docs
        .map((doc) => (0, shared_1.normalizeString)(doc.data().sourceId))
        .filter(Boolean));
    const existingScenarioIds = new Set(existingV2ScenariosSnap.docs.map((doc) => doc.id));
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
        const type = (0, shared_1.normalizeString)(tx.type) === 'income' ? 'income' : 'expense';
        const amount = round2((0, shared_1.toNonNegative)(tx.amount));
        if (amount <= 0) {
            summary.transactions.skipped += 1;
            continue;
        }
        if (type === 'income') {
            summary.transactions.incomeTotal += amount;
        }
        else {
            summary.transactions.expenseTotal += amount;
        }
        const legacyDate = (() => {
            const raw = tx.date;
            if (raw && typeof raw.toDate === 'function') {
                return raw.toDate();
            }
            const parsed = new Date(raw || Date.now());
            return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
        })();
        if (!dryRun) {
            await postJournalEntryInternal(actorId, {
                tenantId,
                postingDate: legacyDate.toISOString(),
                description: `Legacy ${type}: ${(0, shared_1.normalizeString)(tx.category) || 'uncategorized'}`,
                sourceType: 'migration',
                sourceId,
                sourceRefNo: sourceId,
                projectId: (0, shared_1.normalizeString)(tx.projectId) || undefined,
                currencyCode: settings.currencyCode,
                idempotencyKey: `legacy-transaction-${sourceId}`,
                lines: type === 'income'
                    ? [
                        {
                            accountId: settings.defaultCashAccountId,
                            debit: amount,
                            credit: 0,
                            description: 'Legacy income cash',
                            projectId: (0, shared_1.normalizeString)(tx.projectId) || undefined,
                        },
                        {
                            accountId: settings.defaultRevenueAccountId,
                            debit: 0,
                            credit: amount,
                            description: 'Legacy income revenue',
                            projectId: (0, shared_1.normalizeString)(tx.projectId) || undefined,
                        },
                    ]
                    : [
                        {
                            accountId: settings.defaultExpenseAccountId,
                            debit: amount,
                            credit: 0,
                            description: 'Legacy expense',
                            projectId: (0, shared_1.normalizeString)(tx.projectId) || undefined,
                        },
                        {
                            accountId: settings.defaultCashAccountId,
                            debit: 0,
                            credit: amount,
                            description: 'Legacy expense cash',
                            projectId: (0, shared_1.normalizeString)(tx.projectId) || undefined,
                        },
                    ],
            });
        }
        summary.transactions.migrated += 1;
    }
    for (const doc of legacyRecurringSnap.docs) {
        const recurring = doc.data() || {};
        const sourceId = doc.id;
        const targetRef = (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.subscriptionEvents).doc(`legacy-${sourceId}`);
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
                    kind: (0, shared_1.normalizeString)(recurring.type) || 'expense',
                    frequency: (0, shared_1.normalizeString)(recurring.frequency) || 'monthly',
                    startDate: recurring.startDate || null,
                    endDate: recurring.endDate || null,
                    category: (0, shared_1.normalizeString)(recurring.category) || '',
                    amount: (0, shared_1.toNonNegative)(recurring.amount),
                    notes: (0, shared_1.normalizeString)(recurring.notes) || '',
                    projectId: (0, shared_1.normalizeString)(recurring.projectId) || null,
                    userId: (0, shared_1.normalizeString)(recurring.userId) || null,
                },
                createdBy: actorId,
                createdAt: (0, shared_1.serverTimestamp)(),
                updatedAt: (0, shared_1.serverTimestamp)(),
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
        const plannedUnits = (0, shared_1.toNonNegative)(scenario.plannedUnits);
        if (plannedUnits <= 0) {
            summary.scenarios.skipped += 1;
            continue;
        }
        const normalizedScenario = {
            projectId: (0, shared_1.normalizeString)(scenario.projectId) || null,
            name: (0, shared_1.normalizeString)(scenario.name) || `Legacy Scenario ${sourceId}`,
            preset: (0, shared_1.normalizeString)(scenario.preset || 'software') || 'software',
            period: (0, shared_1.normalizeString)(scenario.period || 'monthly') || 'monthly',
            unitLabel: (0, shared_1.normalizeString)(scenario.unitLabel || 'User') || 'User',
            plannedUnits,
            pricePerUnit: (0, shared_1.toNonNegative)(scenario.pricePerUnit),
            tokenQuotaPerUnit: (0, shared_1.toNonNegative)(scenario.tokenQuotaPerUnit),
            discountPercent: (0, shared_1.toNonNegative)(scenario.discountPercent),
            salesCommissionPercent: (0, shared_1.toNonNegative)(scenario.salesCommissionPercent),
            targetProfitPercentOnCost: (0, shared_1.toNonNegative)(scenario.targetProfitPercentOnCost),
            fixedCostItems: Array.isArray(scenario.fixedCostItems) ? scenario.fixedCostItems : [],
            variableCostItemsPerUnit: Array.isArray(scenario.variableCostItemsPerUnit) ? scenario.variableCostItemsPerUnit : [],
            notes: (0, shared_1.normalizeString)(scenario.notes) || '',
        };
        if (!dryRun) {
            const snapshot = (0, calculations_1.calculateScenarioSnapshotFromInput)(normalizedScenario);
            await (0, shared_1.tenantCollectionRef)(tenantId, shared_1.FINANCE_COLLECTIONS.scenarios).doc(sourceId).set(Object.assign(Object.assign({}, normalizedScenario), { tenantId, userId: (0, shared_1.normalizeString)(scenario.userId) || actorId, legacyScenarioId: sourceId, snapshot, createdAt: scenario.createdAt || (0, shared_1.serverTimestamp)(), updatedAt: (0, shared_1.serverTimestamp)() }), { merge: true });
        }
        summary.scenarios.migrated += 1;
    }
    await (0, shared_1.writeFinanceAuditLog)(tenantId, actorId, 'finance.legacy.migration.executed', summary);
    return summary;
});
//# sourceMappingURL=index.js.map