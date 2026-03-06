import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfDay, startOfDay, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { useParams } from 'react-router-dom';
import '../src/styles/components/_finance-tracking.scss';
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { usePermissions } from '../context/PermissionContext';
import { useConfirm, useToast } from '../context/UIContext';
import { Card } from '../components/common/Card/Card';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { TextArea } from '../components/common/Input/TextArea';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { Checkbox } from '../components/common/Checkbox/Checkbox';
import { Modal } from '../components/common/Modal/Modal';
import { StatusCard } from '../components/common/StatusCard/StatusCard';
import { FinanceCalculationsPanel } from '../components/finance/FinanceCalculationsPanel';
import { auth } from '../services/firebase';
import { getActiveTenantId } from '../services/domain/authService';
import { subscribeTenantProjects } from '../services/domain/projectsService';
import {
    fetchWorkspaceFinancialUsage,
    getWorkspaceFinancialConfig,
    saveWorkspaceFinancialConfig,
    type WorkspaceFinancialUsage,
} from '../services/domain/adminSettingsService';
import {
    createRecurringTransaction,
    createTransaction,
    deleteRecurringTransaction,
    deleteTransaction,
    generateMissingRecurringTransactions,
    subscribeRecurringTransactions,
    subscribeTransactions,
    updateRecurringTransaction,
    updateTransaction,
} from '../services/financeService';
import { subscribeJournalEntries } from '../services/finance-v2/ledgerService';
import {
    createInvoice,
    issueInvoice,
    subscribeFinanceCustomers,
    subscribeFinanceInvoices,
    upsertFinanceCustomer,
    voidInvoice,
} from '../services/finance-v2/arService';
import {
    createBill,
    extractInvoiceFromDocument,
    postBill,
    subscribeFinanceBills,
    subscribeFinanceVendors,
    upsertFinanceVendor,
    voidBill,
} from '../services/finance-v2/apService';
import { subscribeFinancePayments } from '../services/finance-v2/billingService';
import { subscribeFinanceBankTransactions, subscribeFinanceReconciliations } from '../services/finance-v2/reconciliationService';
import { subscribeFinanceTaxReports } from '../services/finance-v2/taxService';
import { subscribeFinanceExportJobs } from '../services/finance-v2/exportService';
import { migrateLegacyFinanceV1ToV2, type RunLegacyFinanceMigrationSummary } from '../services/finance-v2/migrationService';
import type {
    FinanceBankTransaction,
    FinanceBill,
    FinanceCustomer,
    FinanceExtractedInvoiceDraft,
    FinanceExportJob,
    FinanceInvoice,
    FinanceInvoiceExtractionConfidence,
    FinanceJournalEntry,
    FinancePayment,
    FinanceReconciliation,
    FinanceTaxReport,
    FinanceVendor,
    Project,
    RecurringFrequency,
    RecurringTransaction,
    Transaction,
    TransactionType
} from '../types';
import {
    buildMonthlySeries,
    calculateFinanceTotals,
    filterTransactions,
    sortTransactionsByDate,
} from '../utils/finance';
import { toDate } from '../utils/time';

interface TransactionFormState {
    projectId: string;
    type: TransactionType;
    date: Date | null;
    category: string;
    amount: string;
    notes: string;
    isRecurring: boolean;
    frequency: RecurringFrequency;
    endDate: Date | null;
}

interface RecurringFormState {
    projectId: string;
    type: TransactionType;
    frequency: RecurringFrequency;
    startDate: Date | null;
    endDate: Date | null;
    category: string;
    amount: string;
    notes: string;
}

type ChartPeriod = 'today' | '3d' | '7d' | '30d' | '90d' | '3m' | '6m' | '12m' | 'ytd' | 'all' | 'custom';
type FinanceView = 'tracking' | 'calculations';
type FinanceWorkspaceSection = 'cockpit' | 'bookings' | 'receivables' | 'payables' | 'bank' | 'tax' | 'reports' | 'exports' | 'settings';
type FinanceRouteSection = FinanceWorkspaceSection | 'calculations' | 'planning';
const DEFAULT_FINANCIAL_ENDPOINT = 'https://europe-west3-quivena.cloudfunctions.net/projectflowFinancialLogs';

interface FinancialConnectionFormState {
    endpoint: string;
    token: string;
    months: string;
    linkedProjectId: string;
    hasToken: boolean;
}

interface CustomerFormState {
    name: string;
    email: string;
}

interface VendorFormState {
    name: string;
    email: string;
}

interface InvoiceFormState {
    customerId: string;
    issueDate: Date | null;
    dueDate: Date | null;
    description: string;
    quantity: string;
    unitPrice: string;
    taxRatePercent: string;
    projectId: string;
}

interface BillFormState {
    vendorId: string;
    billDate: Date | null;
    dueDate: Date | null;
    description: string;
    quantity: string;
    unitCost: string;
    taxRatePercent: string;
    projectId: string;
}

type InvoiceUploadCadence = 'single' | 'recurring';

interface InvoiceUploadReviewState {
    fileName: string;
    documentType: 'pdf' | 'xml';
    vendorId: string;
    vendorName: string;
    vendorEmail: string;
    vendorVatId: string;
    invoiceNumber: string;
    billDate: Date | null;
    dueDate: Date | null;
    currencyCode: string;
    description: string;
    quantity: string;
    unitCost: string;
    taxRatePercent: string;
    netAmount: number;
    taxAmount: number;
    grossAmount: number;
    confidence: FinanceInvoiceExtractionConfidence;
    notes: string;
    recurringHint: string;
    cadence: InvoiceUploadCadence;
    recurringFrequency: RecurringFrequency;
    recurringEndDate: Date | null;
    projectId: string;
}

const buildEmptyTransactionForm = (): TransactionFormState => ({
    projectId: '',
    type: 'expense',
    date: new Date(),
    category: '',
    amount: '',
    notes: '',
    isRecurring: false,
    frequency: 'monthly',
    endDate: null,
});

const buildEmptyRecurringForm = (): RecurringFormState => ({
    projectId: '',
    type: 'expense',
    frequency: 'monthly',
    startDate: new Date(),
    endDate: null,
    category: '',
    amount: '',
    notes: '',
});

const buildEmptyFinancialConnectionForm = (): FinancialConnectionFormState => ({
    endpoint: DEFAULT_FINANCIAL_ENDPOINT,
    token: '',
    months: '6',
    linkedProjectId: '',
    hasToken: false,
});

const buildEmptyCustomerForm = (): CustomerFormState => ({
    name: '',
    email: '',
});

const buildEmptyVendorForm = (): VendorFormState => ({
    name: '',
    email: '',
});

const buildEmptyInvoiceForm = (): InvoiceFormState => ({
    customerId: '',
    issueDate: new Date(),
    dueDate: new Date(),
    description: '',
    quantity: '1',
    unitPrice: '',
    taxRatePercent: '19',
    projectId: '',
});

const buildEmptyBillForm = (): BillFormState => ({
    vendorId: '',
    billDate: new Date(),
    dueDate: new Date(),
    description: '',
    quantity: '1',
    unitCost: '',
    taxRatePercent: '19',
    projectId: '',
});

const MAX_INVOICE_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;

const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Failed to read file.'));
                return;
            }

            const base64Payload = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64Payload || '');
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
    });

const toIsoDateOrNull = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const buildInvoiceUploadReviewState = (
    extracted: FinanceExtractedInvoiceDraft,
    fallbackProjectId: string,
    matchedVendorId?: string
): InvoiceUploadReviewState => ({
    fileName: '',
    documentType: extracted.documentType,
    vendorId: matchedVendorId || '',
    vendorName: extracted.vendorName || '',
    vendorEmail: extracted.vendorEmail || '',
    vendorVatId: extracted.vendorVatId || '',
    invoiceNumber: extracted.invoiceNumber || '',
    billDate: toIsoDateOrNull(extracted.invoiceDate) || new Date(),
    dueDate: toIsoDateOrNull(extracted.dueDate) || toIsoDateOrNull(extracted.invoiceDate) || new Date(),
    currencyCode: extracted.currencyCode || 'EUR',
    description: extracted.lineDescription || '',
    quantity: String(extracted.quantity > 0 ? extracted.quantity : 1),
    unitCost: String(extracted.unitCost >= 0 ? extracted.unitCost : 0),
    taxRatePercent: String(extracted.taxRatePercent >= 0 ? extracted.taxRatePercent : 0),
    netAmount: Number.isFinite(extracted.netAmount) ? extracted.netAmount : 0,
    taxAmount: Number.isFinite(extracted.taxAmount) ? extracted.taxAmount : 0,
    grossAmount: Number.isFinite(extracted.grossAmount) ? extracted.grossAmount : 0,
    confidence: extracted.confidence || 'medium',
    notes: extracted.notes || '',
    recurringHint: extracted.recurringHint || '',
    cadence: extracted.isLikelyRecurring ? 'recurring' : 'single',
    recurringFrequency: 'monthly',
    recurringEndDate: null,
    projectId: fallbackProjectId,
});

const toFiniteNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const buildTopAiBreakdown = (
    months: WorkspaceFinancialUsage['months'],
    source: 'byModel' | 'byFunction',
    labelKey: 'model' | 'function',
    unknownLabel: string
) => {
    const totals = new Map<string, { aiUsd: number; totalTokens: number }>();

    months.forEach((month) => {
        const items = month[source] || [];
        items.forEach((item) => {
            const rawLabel = String((item as any)[labelKey] || '').trim();
            const label = rawLabel && rawLabel !== 'Unknown' ? rawLabel : unknownLabel;
            const previous = totals.get(label) || { aiUsd: 0, totalTokens: 0 };
            totals.set(label, {
                aiUsd: previous.aiUsd + toFiniteNumber(item.aiUsd),
                totalTokens: previous.totalTokens + toFiniteNumber(item.totalTokens),
            });
        });
    });

    return Array.from(totals.entries())
        .map(([name, values]) => ({
            name,
            aiUsd: values.aiUsd,
            totalTokens: values.totalTokens,
        }))
        .sort((a, b) => b.aiUsd - a.aiUsd)
        .slice(0, 5);
};

type SectionState = 'loading' | 'error' | 'empty' | 'ready';

export const FinanceTracking = () => {
    const { t, language, dateLocale, financeTranslationsReady, loadFinanceTranslations } = useLanguage();
    const { hasPermission, loading: permissionLoading } = usePermissions();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const { financeSection } = useParams<{ financeSection?: string }>();

    const tenantId = getActiveTenantId() || auth?.currentUser?.uid || null;
    const canView = hasPermission('tenant.finance.view');
    const canManage = hasPermission('tenant.finance.manage');

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [transactionsLoaded, setTransactionsLoaded] = useState(false);
    const [recurringLoaded, setRecurringLoaded] = useState(false);

    const [filters, setFilters] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
        type: 'all' as TransactionType | 'all',
        projectId: 'all',
        categories: [] as string[],
        search: '',
    });
    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('6m');

    const [transactionModalOpen, setTransactionModalOpen] = useState(false);
    const [transactionForm, setTransactionForm] = useState<TransactionFormState>(buildEmptyTransactionForm);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [savingTransaction, setSavingTransaction] = useState(false);

    const [recurringModalOpen, setRecurringModalOpen] = useState(false);
    const [recurringForm, setRecurringForm] = useState<RecurringFormState>(buildEmptyRecurringForm);
    const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
    const [savingRecurring, setSavingRecurring] = useState(false);
    const [activeView, setActiveView] = useState<FinanceView>('tracking');
    const [activeWorkspaceSection, setActiveWorkspaceSection] = useState<FinanceWorkspaceSection>('cockpit');
    const [financialUsage, setFinancialUsage] = useState<WorkspaceFinancialUsage | null>(null);
    const [financialUsageLoading, setFinancialUsageLoading] = useState(false);
    const [financialUsageError, setFinancialUsageError] = useState<string | null>(null);
    const [financialConfigLoading, setFinancialConfigLoading] = useState(false);
    const [financialConfigPermissionDenied, setFinancialConfigPermissionDenied] = useState(false);
    const [savingFinancialConfig, setSavingFinancialConfig] = useState(false);
    const [financialConnectionForm, setFinancialConnectionForm] = useState<FinancialConnectionFormState>(buildEmptyFinancialConnectionForm);
    const [customersV2, setCustomersV2] = useState<FinanceCustomer[]>([]);
    const [vendorsV2, setVendorsV2] = useState<FinanceVendor[]>([]);
    const [journalEntries, setJournalEntries] = useState<FinanceJournalEntry[]>([]);
    const [invoicesV2, setInvoicesV2] = useState<FinanceInvoice[]>([]);
    const [billsV2, setBillsV2] = useState<FinanceBill[]>([]);
    const [paymentsV2, setPaymentsV2] = useState<FinancePayment[]>([]);
    const [bankTransactionsV2, setBankTransactionsV2] = useState<FinanceBankTransaction[]>([]);
    const [reconciliationsV2, setReconciliationsV2] = useState<FinanceReconciliation[]>([]);
    const [taxReportsV2, setTaxReportsV2] = useState<FinanceTaxReport[]>([]);
    const [exportJobsV2, setExportJobsV2] = useState<FinanceExportJob[]>([]);
    const [customerForm, setCustomerForm] = useState<CustomerFormState>(buildEmptyCustomerForm);
    const [vendorForm, setVendorForm] = useState<VendorFormState>(buildEmptyVendorForm);
    const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(buildEmptyInvoiceForm);
    const [billForm, setBillForm] = useState<BillFormState>(buildEmptyBillForm);
    const [invoiceUploadFile, setInvoiceUploadFile] = useState<File | null>(null);
    const [invoiceUploadReview, setInvoiceUploadReview] = useState<InvoiceUploadReviewState | null>(null);
    const [invoiceUploadInputKey, setInvoiceUploadInputKey] = useState(0);
    const [analyzingInvoiceUpload, setAnalyzingInvoiceUpload] = useState(false);
    const [savingInvoiceUpload, setSavingInvoiceUpload] = useState(false);
    const [savingReceivableAction, setSavingReceivableAction] = useState(false);
    const [savingPayableAction, setSavingPayableAction] = useState(false);
    const [runningMigration, setRunningMigration] = useState(false);
    const [migrationSummary, setMigrationSummary] = useState<RunLegacyFinanceMigrationSummary | null>(null);

    useEffect(() => {
        const normalizedSection = (financeSection || '').trim().toLowerCase() as FinanceRouteSection | '';
        if (!normalizedSection || normalizedSection === 'cockpit') {
            setActiveView('tracking');
            setActiveWorkspaceSection('cockpit');
            return;
        }

        if (normalizedSection === 'calculations' || normalizedSection === 'planning') {
            setActiveView('calculations');
            return;
        }

        if (
            normalizedSection === 'bookings'
            || normalizedSection === 'receivables'
            || normalizedSection === 'payables'
            || normalizedSection === 'bank'
            || normalizedSection === 'tax'
            || normalizedSection === 'reports'
            || normalizedSection === 'exports'
            || normalizedSection === 'settings'
        ) {
            setActiveView('tracking');
            setActiveWorkspaceSection(normalizedSection);
            return;
        }

        setActiveView('tracking');
        setActiveWorkspaceSection('cockpit');
    }, [financeSection]);

    const locale = language === 'de' ? 'de-DE' : 'en-US';
    const currencyCode = useMemo(() => {
        const raw = String(t('finance.currencyCode') || '').trim().toUpperCase();
        return /^[A-Z]{3}$/.test(raw) ? raw : 'EUR';
    }, [language, t]);

    useEffect(() => {
        void loadFinanceTranslations();
    }, [loadFinanceTranslations]);

    const formatCurrency = (value: number) => {
        const safeValue = Number.isFinite(value) ? value : 0;
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode,
                maximumFractionDigits: 2,
            }).format(safeValue);
        } catch {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 2,
            }).format(safeValue);
        }
    };

    const formatInteger = (value: number) => {
        return new Intl.NumberFormat(locale, {
            maximumFractionDigits: 0,
        }).format(value);
    };

    const loadFinancialUsage = useCallback(async (monthsOverride?: number) => {
        if (!tenantId || !canView) return;
        setFinancialUsageLoading(true);
        setFinancialUsageError(null);

        try {
            const usage = await fetchWorkspaceFinancialUsage(tenantId, monthsOverride ? { months: monthsOverride } : undefined);
            setFinancialUsage(usage);
        } catch (error: any) {
            setFinancialUsage(null);
            const message = String(error?.message || '');
            const normalizedMessage = message.toLowerCase();
            if (normalizedMessage.includes('not configured') || normalizedMessage.includes('token is missing')) {
                setFinancialUsageError(t('finance.ai.error.notConfigured'));
                console.info('Workspace financial endpoint is not configured yet.');
            } else {
                console.error('Failed to fetch workspace financial usage', error);
                setFinancialUsageError(message || t('finance.ai.error.generic'));
            }
        } finally {
            setFinancialUsageLoading(false);
        }
    }, [tenantId, canView, t]);

    useEffect(() => {
        if (!tenantId || !canView) return;

        const unsubscribeTransactions = subscribeTransactions((data) => {
            setTransactions(data);
            setTransactionsLoaded(true);
        }, tenantId);

        const unsubscribeRecurring = subscribeRecurringTransactions((data) => {
            setRecurringTransactions(data);
            setRecurringLoaded(true);
        }, tenantId);

        return () => {
            unsubscribeTransactions();
            unsubscribeRecurring();
        };
    }, [tenantId, canView]);

    useEffect(() => {
        if (!tenantId || !canView) return;
        void loadFinancialUsage();
    }, [tenantId, canView, loadFinancialUsage]);

    useEffect(() => {
        if (!tenantId || !canView) {
            setCustomersV2([]);
            setVendorsV2([]);
            setJournalEntries([]);
            setInvoicesV2([]);
            setBillsV2([]);
            setPaymentsV2([]);
            setBankTransactionsV2([]);
            setReconciliationsV2([]);
            setTaxReportsV2([]);
            setExportJobsV2([]);
            return;
        }

        const unsubscribeCustomers = subscribeFinanceCustomers(setCustomersV2, tenantId);
        const unsubscribeVendors = subscribeFinanceVendors(setVendorsV2, tenantId);
        const unsubscribeJournal = subscribeJournalEntries(setJournalEntries, tenantId);
        const unsubscribeInvoices = subscribeFinanceInvoices(setInvoicesV2, tenantId);
        const unsubscribeBills = subscribeFinanceBills(setBillsV2, tenantId);
        const unsubscribePayments = subscribeFinancePayments(setPaymentsV2, tenantId);
        const unsubscribeBankTransactions = subscribeFinanceBankTransactions(setBankTransactionsV2, tenantId);
        const unsubscribeReconciliations = subscribeFinanceReconciliations(setReconciliationsV2, tenantId);
        const unsubscribeTaxReports = subscribeFinanceTaxReports(setTaxReportsV2, tenantId);
        const unsubscribeExportJobs = subscribeFinanceExportJobs(setExportJobsV2, tenantId);

        return () => {
            unsubscribeCustomers();
            unsubscribeVendors();
            unsubscribeJournal();
            unsubscribeInvoices();
            unsubscribeBills();
            unsubscribePayments();
            unsubscribeBankTransactions();
            unsubscribeReconciliations();
            unsubscribeTaxReports();
            unsubscribeExportJobs();
        };
    }, [tenantId, canView]);

    useEffect(() => {
        if (!tenantId || !canView) return;

        const unsubscribe = subscribeTenantProjects((nextProjects) => {
            setProjects(nextProjects.filter((project) => !project.isPersonal));
        }, tenantId);

        return () => unsubscribe();
    }, [tenantId, canView]);

    useEffect(() => {
        if (!tenantId || !canManage) return;
        if (!transactionsLoaded || !recurringLoaded) return;

        generateMissingRecurringTransactions(recurringTransactions, transactions, tenantId).catch((error) => {
            console.error('Failed to generate recurring transactions', error);
        });
    }, [tenantId, canManage, transactionsLoaded, recurringLoaded, recurringTransactions, transactions]);

    useEffect(() => {
        if (!tenantId || !canManage) return;

        setFinancialConfigLoading(true);
        setFinancialConfigPermissionDenied(false);

        getWorkspaceFinancialConfig(tenantId)
            .then((config) => {
                if (!config) {
                    setFinancialConnectionForm(buildEmptyFinancialConnectionForm());
                    return;
                }

                setFinancialConnectionForm((prev) => ({
                    ...prev,
                    endpoint: config.endpoint || DEFAULT_FINANCIAL_ENDPOINT,
                    token: '',
                    months: String(config.months || 6),
                    linkedProjectId: config.linkedProjectId || '',
                    hasToken: Boolean(config.hasToken),
                }));
            })
            .catch((error: any) => {
                console.error('Failed to load workspace financial config', error);
                const code = String(error?.code || '');
                if (code.includes('permission-denied')) {
                    setFinancialConfigPermissionDenied(true);
                } else {
                    showError(t('finance.ai.config.toastError'), error?.message);
                }
            })
            .finally(() => {
                setFinancialConfigLoading(false);
            });
    }, [tenantId, canManage, showError, t]);

    const categoryOptions = useMemo(() => {
        const defaults = [
            t('finance.categories.rent'),
            t('finance.categories.utilities'),
            t('finance.categories.payroll'),
            t('finance.categories.marketing'),
            t('finance.categories.software'),
            t('finance.categories.supplies'),
            t('finance.categories.sales'),
            t('finance.categories.other'),
        ];

        const unique = new Set<string>(defaults);
        transactions.forEach((transaction) => {
            if (transaction.category) unique.add(transaction.category);
        });
        recurringTransactions.forEach((transaction) => {
            if (transaction.category) unique.add(transaction.category);
        });

        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [t, transactions, recurringTransactions]);

    const projectLookup = useMemo(() => {
        const map = new Map<string, string>();
        projects.forEach((project) => {
            map.set(project.id, project.title);
        });
        return map;
    }, [projects]);

    const applySearchFilter = (items: Transaction[]) => {
        if (!filters.search) return items;
        const searchLower = filters.search.toLowerCase();
        return items.filter((item) =>
            (item.category?.toLowerCase() || '').includes(searchLower) ||
            (item.notes?.toLowerCase() || '').includes(searchLower) ||
            String(item.amount).includes(searchLower)
        );
    };

    const filteredTransactions = useMemo(() => {
        const filtered = applySearchFilter(filterTransactions(transactions, filters));
        return sortTransactionsByDate(filtered, 'desc');
    }, [transactions, filters]);

    const chartSourceTransactions = useMemo(() => {
        const chartFilters = { ...filters, startDate: null, endDate: null };
        return applySearchFilter(filterTransactions(transactions, chartFilters));
    }, [transactions, filters]);

    const totals = useMemo(() => calculateFinanceTotals(filteredTransactions), [filteredTransactions]);
    const chartData = useMemo(() => {
        const series = buildMonthlySeries(chartSourceTransactions, dateLocale);
        if (!filters.startDate && !filters.endDate) return series;

        const rangeStart = filters.startDate ? startOfDay(filters.startDate) : null;
        const rangeEnd = filters.endDate ? endOfDay(filters.endDate) : null;

        const inRange = series.filter((point) => {
            if (rangeStart && rangeEnd) {
                return point.date >= rangeStart && point.date <= rangeEnd;
            }
            if (rangeStart && point.date < rangeStart) return false;
            if (rangeEnd && point.date > rangeEnd) return false;
            return true;
        });

        if (inRange.length === 0) return inRange;
        if (!rangeStart) return inRange;

        const firstIndex = series.findIndex((point) => point.key === inRange[0].key);
        if (firstIndex > 0) {
            return [series[firstIndex - 1], ...inRange];
        }

        return inRange;
    }, [chartSourceTransactions, dateLocale, filters.endDate, filters.startDate]);

    const categoryDistribution = useMemo(() => {
        const dist: Record<string, number> = {};
        filteredTransactions.forEach((transaction) => {
            if (transaction.type === 'expense') {
                const cat = transaction.category || t('finance.categories.other');
                dist[cat] = (dist[cat] || 0) + Math.abs(transaction.amount);
            }
        });
        return Object.entries(dist)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTransactions, t]);

    const projectProfitability = useMemo(() => {
        const profitabilitySource = applySearchFilter(filterTransactions(transactions, {
            ...filters,
            type: 'all',
        }));

        const rows = new Map<string, { projectId: string; projectName: string; income: number; expenses: number }>();

        profitabilitySource.forEach((transaction) => {
            const projectId = transaction.projectId || '__unassigned__';
            const projectName = transaction.projectId
                ? (projectLookup.get(transaction.projectId) || t('finance.project.unknown'))
                : t('finance.project.unassigned');

            if (!rows.has(projectId)) {
                rows.set(projectId, { projectId, projectName, income: 0, expenses: 0 });
            }

            const row = rows.get(projectId);
            if (!row) return;

            if (transaction.type === 'income') {
                row.income += Number(transaction.amount) || 0;
            } else {
                row.expenses += Number(transaction.amount) || 0;
            }
        });

        return Array.from(rows.values())
            .map((row) => {
                const net = row.income - row.expenses;
                return {
                    ...row,
                    net,
                    marginPercent: row.income > 0 ? (net / row.income) * 100 : 0,
                };
            })
            .sort((a, b) => b.net - a.net);
    }, [applySearchFilter, filters, projectLookup, t, transactions]);

    const v2ReceivablesOpenAmount = useMemo(() => (
        invoicesV2
            .filter((invoice) => ['issued', 'partially_paid'].includes(invoice.status))
            .reduce((sum, invoice) => sum + (Number(invoice.openAmount) || 0), 0)
    ), [invoicesV2]);

    const v2PayablesOpenAmount = useMemo(() => (
        billsV2
            .filter((bill) => ['posted', 'partially_paid'].includes(bill.status))
            .reduce((sum, bill) => sum + (Number(bill.openAmount) || 0), 0)
    ), [billsV2]);

    const invoiceUploadComputedTotals = useMemo(() => {
        if (!invoiceUploadReview) {
            return { netAmount: 0, taxAmount: 0, grossAmount: 0 };
        }

        const quantity = Number(invoiceUploadReview.quantity);
        const unitCost = Number(invoiceUploadReview.unitCost);
        const taxRate = Number(invoiceUploadReview.taxRatePercent);
        const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
        const safeUnitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
        const safeTaxRate = Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : 0;

        const netAmount = Math.round((safeQuantity * safeUnitCost + Number.EPSILON) * 100) / 100;
        const taxAmount = Math.round((netAmount * (safeTaxRate / 100) + Number.EPSILON) * 100) / 100;
        const grossAmount = Math.round((netAmount + taxAmount + Number.EPSILON) * 100) / 100;

        return { netAmount, taxAmount, grossAmount };
    }, [invoiceUploadReview]);

    const v2UnallocatedPayments = useMemo(() => (
        paymentsV2.reduce((sum, payment) => sum + (Number(payment.unallocatedAmount) || 0), 0)
    ), [paymentsV2]);

    const v2UnreconciledBankCount = useMemo(() => (
        bankTransactionsV2.filter((transaction) => !transaction.reconciled).length
    ), [bankTransactionsV2]);

    const COLORS = [
        'var(--color-primary)',
        'var(--color-primary-light)',
        'var(--color-text-muted)',
        'var(--color-text-subtle)',
        'var(--color-surface-border)',
        'var(--color-primary-dark)',
        'var(--color-text-main)',
    ];

    const typeOptions: SelectOption[] = [
        { label: t('finance.type.all'), value: 'all' },
        { label: t('finance.type.income'), value: 'income' },
        { label: t('finance.type.expense'), value: 'expense' },
    ];

    const projectFilterOptions: SelectOption[] = [
        { label: t('finance.project.all'), value: 'all' },
        { label: t('finance.project.unassigned'), value: '__unassigned__' },
        ...projects
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((project) => ({
                label: project.title,
                value: project.id,
            })),
    ];

    const projectFormOptions: SelectOption[] = [
        { label: t('finance.project.unassigned'), value: '' },
        ...projects
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((project) => ({
                label: project.title,
                value: project.id,
            })),
    ];

    const frequencyOptions: SelectOption[] = [
        { label: t('finance.frequency.daily'), value: 'daily' },
        { label: t('finance.frequency.weekly'), value: 'weekly' },
        { label: t('finance.frequency.monthly'), value: 'monthly' },
        { label: t('finance.frequency.yearly'), value: 'yearly' },
    ];

    const invoiceUploadCadenceOptions: SelectOption[] = [
        { label: t('finance.v2.payables.upload.cadence.single'), value: 'single' },
        { label: t('finance.v2.payables.upload.cadence.recurring'), value: 'recurring' },
    ];

    const invoiceUploadConfidenceLabel = (confidence: FinanceInvoiceExtractionConfidence) => {
        if (confidence === 'high') return t('finance.v2.payables.upload.confidence.high');
        if (confidence === 'low') return t('finance.v2.payables.upload.confidence.low');
        return t('finance.v2.payables.upload.confidence.medium');
    };

    const periodOptions: SelectOption[] = [
        { value: 'today', label: t('finance.period.today') },
        { value: '3d', label: t('finance.period.3d') },
        { value: '7d', label: t('finance.period.7d') },
        { value: '30d', label: t('finance.period.30d') },
        { value: '90d', label: t('finance.period.90d') },
        { value: '3m', label: t('finance.period.3m') },
        { value: '6m', label: t('finance.period.6m') },
        { value: '12m', label: t('finance.period.12m') },
        { value: 'ytd', label: t('finance.period.ytd') },
        { value: 'all', label: t('finance.period.allTime') },
        { value: 'custom', label: t('finance.period.custom') },
    ];

    const aiSectionState: SectionState = financialUsageLoading
        ? 'loading'
        : financialUsageError
            ? 'error'
            : financialUsage && financialUsage.isConfigured !== false
                ? 'ready'
                : 'empty';

    const projectProfitabilityState: SectionState = projectProfitability.length > 0 ? 'ready' : 'empty';
    const transactionsState: SectionState = filteredTransactions.length > 0 ? 'ready' : 'empty';
    const recurringState: SectionState = recurringTransactions.length > 0 ? 'ready' : 'empty';

    const renderStateChip = (state: SectionState, count?: number) => {
        const keyMap: Record<SectionState, string> = {
            loading: 'finance.state.loading',
            error: 'finance.state.error',
            empty: 'finance.state.empty',
            ready: 'finance.state.ready',
        };

        return (
            <span className={`finance-state-chip finance-state-chip--${state}`}>
                {t(keyMap[state])}
                {typeof count === 'number' && (
                    <span className="finance-state-chip__count">{count} {t('finance.state.rows')}</span>
                )}
            </span>
        );
    };

    const projectLinkOptions: SelectOption[] = [
        { label: t('finance.ai.linkedProject.none'), value: '' },
        ...projects
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((project) => ({
                label: project.title,
                value: project.id,
            })),
    ];

    const customerOptions: SelectOption[] = [
        { label: t('finance.v2.receivables.selectCustomer'), value: '' },
        ...customersV2
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((customer) => ({
                label: customer.name,
                value: customer.id,
            })),
    ];

    const vendorOptions: SelectOption[] = [
        { label: t('finance.v2.payables.selectVendor'), value: '' },
        ...vendorsV2
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((vendor) => ({
                label: vendor.name,
                value: vendor.id,
            })),
    ];

    const aiTopModels = useMemo(() => {
        if (!financialUsage?.months) return [];
        return buildTopAiBreakdown(financialUsage.months, 'byModel', 'model', t('finance.ai.breakdown.unknown'));
    }, [financialUsage, t]);

    const aiTopFunctions = useMemo(() => {
        if (!financialUsage?.months) return [];
        return buildTopAiBreakdown(financialUsage.months, 'byFunction', 'function', t('finance.ai.breakdown.unknown'));
    }, [financialUsage, t]);

    const linkedFinancialProjectName = useMemo(() => {
        const linkedProjectId = financialUsage?.linkedProjectId;
        if (!linkedProjectId) {
            return t('finance.ai.linkedProject.none');
        }
        return projectLookup.get(linkedProjectId) || t('finance.project.unknown');
    }, [financialUsage, projectLookup, t]);

    const handleSaveFinancialConnection = async () => {
        if (!tenantId || !canManage) return;

        const endpoint = financialConnectionForm.endpoint.trim();
        if (!endpoint) {
            showError(t('finance.ai.config.validation.endpointRequired'));
            return;
        }

        const monthsValue = Number(financialConnectionForm.months);
        if (!Number.isInteger(monthsValue) || monthsValue < 1 || monthsValue > 24) {
            showError(t('finance.ai.config.validation.monthsRange'));
            return;
        }

        if (!financialConnectionForm.hasToken && !financialConnectionForm.token.trim()) {
            showError(t('finance.ai.config.validation.tokenRequired'));
            return;
        }

        setSavingFinancialConfig(true);
        try {
            const savedConfig = await saveWorkspaceFinancialConfig(tenantId, {
                endpoint,
                token: financialConnectionForm.token.trim(),
                months: monthsValue,
                linkedProjectId: financialConnectionForm.linkedProjectId || null,
            });

            setFinancialConnectionForm((prev) => ({
                ...prev,
                endpoint: savedConfig.endpoint || endpoint,
                token: '',
                months: String(savedConfig.months || monthsValue),
                linkedProjectId: savedConfig.linkedProjectId || '',
                hasToken: Boolean(savedConfig.hasToken),
            }));

            showSuccess(t('finance.ai.config.toastSaved'));
            await loadFinancialUsage(savedConfig.months || monthsValue);
        } catch (error: any) {
            console.error('Failed to save workspace financial config', error);
            showError(t('finance.ai.config.toastError'), error?.message);
        } finally {
            setSavingFinancialConfig(false);
        }
    };

    const handleRunLegacyMigration = async (dryRun: boolean) => {
        if (!tenantId || !canManage) return;

        setRunningMigration(true);
        try {
            const summary = await migrateLegacyFinanceV1ToV2({ tenantId, dryRun });
            setMigrationSummary(summary);
            showSuccess(dryRun
                ? t('finance.v2.migration.dryRunDone')
                : t('finance.v2.migration.executeDone'));
        } catch (error: any) {
            console.error('Failed to run legacy finance migration', error);
            showError(t('finance.v2.migration.error'), error?.message);
        } finally {
            setRunningMigration(false);
        }
    };

    const handleCreateCustomer = async () => {
        if (!tenantId || !canManage) return;
        if (!customerForm.name.trim()) {
            showError(t('finance.v2.receivables.customerNameRequired'));
            return;
        }

        setSavingReceivableAction(true);
        try {
            await upsertFinanceCustomer({
                tenantId,
                name: customerForm.name.trim(),
                email: customerForm.email.trim() || undefined,
            });
            showSuccess(t('finance.v2.receivables.customerSaved'));
            setCustomerForm(buildEmptyCustomerForm());
        } catch (error: any) {
            console.error('Failed to save customer', error);
            showError(t('finance.v2.receivables.error'), error?.message);
        } finally {
            setSavingReceivableAction(false);
        }
    };

    const handleCreateInvoice = async () => {
        if (!tenantId || !canManage) return;
        if (!invoiceForm.customerId) {
            showError(t('finance.v2.receivables.customerRequired'));
            return;
        }
        if (!invoiceForm.issueDate || !invoiceForm.dueDate) {
            showError(t('finance.v2.receivables.dateRequired'));
            return;
        }

        const quantity = Number(invoiceForm.quantity);
        const unitPrice = Number(invoiceForm.unitPrice);
        const taxRatePercent = Number(invoiceForm.taxRatePercent);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
            showError(t('finance.v2.receivables.amountRequired'));
            return;
        }

        setSavingReceivableAction(true);
        try {
            await createInvoice({
                tenantId,
                customerId: invoiceForm.customerId,
                issueDate: invoiceForm.issueDate.toISOString(),
                dueDate: invoiceForm.dueDate.toISOString(),
                projectId: invoiceForm.projectId || undefined,
                lines: [
                    {
                        description: invoiceForm.description.trim() || t('finance.v2.receivables.defaultLineDescription'),
                        quantity,
                        unitPrice,
                        taxRatePercent: Number.isFinite(taxRatePercent) ? Math.max(0, taxRatePercent) : 0,
                    },
                ],
            });
            showSuccess(t('finance.v2.receivables.invoiceCreated'));
            setInvoiceForm(buildEmptyInvoiceForm());
        } catch (error: any) {
            console.error('Failed to create invoice', error);
            showError(t('finance.v2.receivables.error'), error?.message);
        } finally {
            setSavingReceivableAction(false);
        }
    };

    const handleIssueInvoice = async (invoiceId: string) => {
        if (!tenantId || !canManage) return;
        setSavingReceivableAction(true);
        try {
            await issueInvoice({ tenantId, invoiceId });
            showSuccess(t('finance.v2.receivables.invoiceIssued'));
        } catch (error: any) {
            console.error('Failed to issue invoice', error);
            showError(t('finance.v2.receivables.error'), error?.message);
        } finally {
            setSavingReceivableAction(false);
        }
    };

    const handleVoidInvoice = async (invoiceId: string) => {
        if (!tenantId || !canManage) return;
        const confirmed = await confirm(
            t('finance.v2.receivables.voidTitle'),
            t('finance.v2.receivables.voidMessage'),
        );
        if (!confirmed) return;

        setSavingReceivableAction(true);
        try {
            await voidInvoice({ tenantId, invoiceId });
            showSuccess(t('finance.v2.receivables.invoiceVoided'));
        } catch (error: any) {
            console.error('Failed to void invoice', error);
            showError(t('finance.v2.receivables.error'), error?.message);
        } finally {
            setSavingReceivableAction(false);
        }
    };

    const handleCreateVendor = async () => {
        if (!tenantId || !canManage) return;
        if (!vendorForm.name.trim()) {
            showError(t('finance.v2.payables.vendorNameRequired'));
            return;
        }

        setSavingPayableAction(true);
        try {
            await upsertFinanceVendor({
                tenantId,
                name: vendorForm.name.trim(),
                email: vendorForm.email.trim() || undefined,
            });
            showSuccess(t('finance.v2.payables.vendorSaved'));
            setVendorForm(buildEmptyVendorForm());
        } catch (error: any) {
            console.error('Failed to save vendor', error);
            showError(t('finance.v2.payables.error'), error?.message);
        } finally {
            setSavingPayableAction(false);
        }
    };

    const resetInvoiceUploadFlow = () => {
        setInvoiceUploadFile(null);
        setInvoiceUploadReview(null);
        setInvoiceUploadInputKey((prev) => prev + 1);
    };

    const handleInvoiceUploadFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setInvoiceUploadFile(file);
        setInvoiceUploadReview(null);
    };

    const handleAnalyzeInvoiceUpload = async () => {
        if (!tenantId || !canManage) return;
        if (!invoiceUploadFile) {
            showError(t('finance.v2.payables.upload.fileRequired'));
            return;
        }

        const isPdf = invoiceUploadFile.name.toLowerCase().endsWith('.pdf')
            || invoiceUploadFile.type.toLowerCase().includes('pdf');
        const isXml = invoiceUploadFile.name.toLowerCase().endsWith('.xml')
            || invoiceUploadFile.type.toLowerCase().includes('xml');
        if (!isPdf && !isXml) {
            showError(t('finance.v2.payables.upload.unsupportedType'));
            return;
        }

        if (invoiceUploadFile.size > MAX_INVOICE_UPLOAD_FILE_BYTES) {
            showError(t('finance.v2.payables.upload.maxSize'));
            return;
        }

        setAnalyzingInvoiceUpload(true);
        try {
            const contentBase64 = await fileToBase64(invoiceUploadFile);
            const extracted = await extractInvoiceFromDocument({
                tenantId,
                fileName: invoiceUploadFile.name,
                mimeType: invoiceUploadFile.type || (isPdf ? 'application/pdf' : 'application/xml'),
                contentBase64,
            });

            const matchedVendor = vendorsV2.find(
                (vendor) => vendor.name.trim().toLowerCase() === extracted.vendorName.trim().toLowerCase()
            );

            const reviewState = buildInvoiceUploadReviewState(extracted, billForm.projectId || '', matchedVendor?.id);
            reviewState.fileName = invoiceUploadFile.name;
            reviewState.description = reviewState.description || t('finance.v2.payables.defaultLineDescription');
            setInvoiceUploadReview(reviewState);

            showSuccess(t('finance.v2.payables.upload.analysisDone'));
        } catch (error: any) {
            console.error('Failed to analyze uploaded invoice', error);
            showError(t('finance.v2.payables.upload.analysisError'), error?.message);
        } finally {
            setAnalyzingInvoiceUpload(false);
        }
    };

    const handleConfirmInvoiceUpload = async () => {
        if (!tenantId || !canManage || !invoiceUploadReview) return;
        if (!invoiceUploadReview.billDate || !invoiceUploadReview.dueDate) {
            showError(t('finance.v2.payables.dateRequired'));
            return;
        }

        const quantity = Number(invoiceUploadReview.quantity);
        const unitCost = Number(invoiceUploadReview.unitCost);
        const taxRatePercent = Number(invoiceUploadReview.taxRatePercent);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
            showError(t('finance.v2.payables.amountRequired'));
            return;
        }

        let vendorId = invoiceUploadReview.vendorId;
        if (!vendorId) {
            if (!invoiceUploadReview.vendorName.trim()) {
                showError(t('finance.v2.payables.vendorRequired'));
                return;
            }

            try {
                const vendorResponse = await upsertFinanceVendor({
                    tenantId,
                    name: invoiceUploadReview.vendorName.trim(),
                    email: invoiceUploadReview.vendorEmail.trim() || undefined,
                });
                vendorId = vendorResponse.vendorId;
            } catch (error: any) {
                console.error('Failed to auto-create vendor from uploaded invoice', error);
                showError(t('finance.v2.payables.error'), error?.message);
                return;
            }
        }

        const roundedNetAmount = Math.round((quantity * unitCost + Number.EPSILON) * 100) / 100;
        const safeTaxRate = Number.isFinite(taxRatePercent) ? Math.max(0, taxRatePercent) : 0;
        const roundedGrossAmount = Math.round((roundedNetAmount * (1 + (safeTaxRate / 100)) + Number.EPSILON) * 100) / 100;
        const selectedVendorName = vendorsV2.find((vendor) => vendor.id === vendorId)?.name?.trim()
            || invoiceUploadReview.vendorName.trim();
        const transactionCategory = selectedVendorName
            ? `${t('finance.v2.payables.upload.transactionCategory')} ${selectedVendorName}`
            : t('finance.v2.payables.upload.transactionCategoryFallback');
        const transactionNotes = [
            invoiceUploadReview.notes.trim(),
            invoiceUploadReview.recurringHint ? `Recurring hint: ${invoiceUploadReview.recurringHint}` : '',
            invoiceUploadReview.invoiceNumber ? `Invoice: ${invoiceUploadReview.invoiceNumber}` : '',
            invoiceUploadReview.fileName ? `File: ${invoiceUploadReview.fileName}` : '',
        ].filter(Boolean).join('\n');

        setSavingInvoiceUpload(true);
        try {
            await createBill({
                tenantId,
                vendorId,
                billNo: invoiceUploadReview.invoiceNumber.trim() || undefined,
                billDate: invoiceUploadReview.billDate.toISOString(),
                dueDate: invoiceUploadReview.dueDate.toISOString(),
                projectId: invoiceUploadReview.projectId || undefined,
                currencyCode: invoiceUploadReview.currencyCode || currencyCode,
                notes: transactionNotes || undefined,
                lines: [
                    {
                        description: invoiceUploadReview.description.trim() || t('finance.v2.payables.defaultLineDescription'),
                        quantity,
                        unitCost,
                        taxRatePercent: safeTaxRate,
                    },
                ],
            });

            if (invoiceUploadReview.cadence === 'recurring') {
                const recurringId = await createRecurringTransaction({
                    projectId: invoiceUploadReview.projectId || undefined,
                    type: 'expense',
                    frequency: invoiceUploadReview.recurringFrequency,
                    startDate: invoiceUploadReview.billDate,
                    endDate: invoiceUploadReview.recurringEndDate || undefined,
                    category: transactionCategory,
                    amount: roundedGrossAmount,
                    notes: transactionNotes,
                }, tenantId);

                await createTransaction({
                    projectId: invoiceUploadReview.projectId || undefined,
                    type: 'expense',
                    date: invoiceUploadReview.billDate,
                    category: transactionCategory,
                    amount: roundedGrossAmount,
                    notes: transactionNotes,
                    isRecurring: true,
                    recurringId,
                }, tenantId);

                showSuccess(t('finance.v2.payables.upload.confirmSuccessRecurring'));
            } else {
                await createTransaction({
                    projectId: invoiceUploadReview.projectId || undefined,
                    type: 'expense',
                    date: invoiceUploadReview.billDate,
                    category: transactionCategory,
                    amount: roundedGrossAmount,
                    notes: transactionNotes,
                    isRecurring: false,
                }, tenantId);

                showSuccess(t('finance.v2.payables.upload.confirmSuccessSingle'));
            }

            resetInvoiceUploadFlow();
        } catch (error: any) {
            console.error('Failed to confirm uploaded invoice', error);
            showError(t('finance.v2.payables.upload.confirmError'), error?.message);
        } finally {
            setSavingInvoiceUpload(false);
        }
    };

    const handleCreateBill = async () => {
        if (!tenantId || !canManage) return;
        if (!billForm.vendorId) {
            showError(t('finance.v2.payables.vendorRequired'));
            return;
        }
        if (!billForm.billDate || !billForm.dueDate) {
            showError(t('finance.v2.payables.dateRequired'));
            return;
        }

        const quantity = Number(billForm.quantity);
        const unitCost = Number(billForm.unitCost);
        const taxRatePercent = Number(billForm.taxRatePercent);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
            showError(t('finance.v2.payables.amountRequired'));
            return;
        }

        setSavingPayableAction(true);
        try {
            await createBill({
                tenantId,
                vendorId: billForm.vendorId,
                billDate: billForm.billDate.toISOString(),
                dueDate: billForm.dueDate.toISOString(),
                projectId: billForm.projectId || undefined,
                lines: [
                    {
                        description: billForm.description.trim() || t('finance.v2.payables.defaultLineDescription'),
                        quantity,
                        unitCost,
                        taxRatePercent: Number.isFinite(taxRatePercent) ? Math.max(0, taxRatePercent) : 0,
                    },
                ],
            });
            showSuccess(t('finance.v2.payables.billCreated'));
            setBillForm(buildEmptyBillForm());
        } catch (error: any) {
            console.error('Failed to create bill', error);
            showError(t('finance.v2.payables.error'), error?.message);
        } finally {
            setSavingPayableAction(false);
        }
    };

    const handlePostBill = async (billId: string) => {
        if (!tenantId || !canManage) return;
        setSavingPayableAction(true);
        try {
            await postBill({ tenantId, billId });
            showSuccess(t('finance.v2.payables.billPosted'));
        } catch (error: any) {
            console.error('Failed to post bill', error);
            showError(t('finance.v2.payables.error'), error?.message);
        } finally {
            setSavingPayableAction(false);
        }
    };

    const handleVoidBill = async (billId: string) => {
        if (!tenantId || !canManage) return;
        const confirmed = await confirm(
            t('finance.v2.payables.voidTitle'),
            t('finance.v2.payables.voidMessage'),
        );
        if (!confirmed) return;

        setSavingPayableAction(true);
        try {
            await voidBill({ tenantId, billId });
            showSuccess(t('finance.v2.payables.billVoided'));
        } catch (error: any) {
            console.error('Failed to void bill', error);
            showError(t('finance.v2.payables.error'), error?.message);
        } finally {
            setSavingPayableAction(false);
        }
    };

    const LineChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
        if (!active || !payload || payload.length === 0) return null;

        const incomeValue = payload.find((item) => item.dataKey === 'income')?.value ?? 0;
        const expenseValue = payload.find((item) => item.dataKey === 'expenses')?.value ?? 0;
        const netValue = incomeValue - expenseValue;

        return (
            <div className="finance-chart-tooltip">
                <div className="finance-chart-tooltip__title">{label}</div>
                <div className="finance-chart-tooltip__row">
                    <span className="finance-chart-tooltip__dot finance-chart-tooltip__dot--income" />
                    <span className="finance-chart-tooltip__label">{t('finance.chart.income')}</span>
                    <span className="finance-chart-tooltip__value finance-chart-tooltip__value--income">
                        {formatCurrency(Number(incomeValue))}
                    </span>
                </div>
                <div className="finance-chart-tooltip__row">
                    <span className="finance-chart-tooltip__dot finance-chart-tooltip__dot--expense" />
                    <span className="finance-chart-tooltip__label">{t('finance.chart.expense')}</span>
                    <span className="finance-chart-tooltip__value finance-chart-tooltip__value--expense">
                        {formatCurrency(Number(expenseValue))}
                    </span>
                </div>
                <div className="finance-chart-tooltip__row finance-chart-tooltip__row--net">
                    <span className="finance-chart-tooltip__label">{t('finance.chart.net')}</span>
                    <span className={`finance-chart-tooltip__value ${netValue >= 0 ? 'finance-chart-tooltip__value--positive' : 'finance-chart-tooltip__value--negative'}`}>
                        {formatCurrency(Number(netValue))}
                    </span>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (chartPeriod === 'custom') return;
        const endDate = endOfDay(new Date());
        let startDate: Date | null = null;

        switch (chartPeriod) {
            case 'today':
                startDate = startOfDay(endDate);
                break;
            case '3d':
                startDate = startOfDay(subDays(endDate, 2));
                break;
            case '7d':
                startDate = startOfDay(subDays(endDate, 6));
                break;
            case '30d':
                startDate = startOfDay(subDays(endDate, 29));
                break;
            case '90d':
                startDate = startOfDay(subDays(endDate, 89));
                break;
            case '3m':
                startDate = startOfMonth(subMonths(endDate, 2));
                break;
            case '6m':
                startDate = startOfMonth(subMonths(endDate, 5));
                break;
            case '12m':
                startDate = startOfMonth(subMonths(endDate, 11));
                break;
            case 'ytd':
                startDate = startOfYear(endDate);
                break;
            case 'all':
            default:
                startDate = null;
                break;
        }

        setFilters((prev) => ({
            ...prev,
            startDate,
            endDate: startDate ? endDate : null,
        }));
    }, [chartPeriod]);

    const openNewTransactionModal = () => {
        setEditingTransaction(null);
        setTransactionForm(buildEmptyTransactionForm());
        setTransactionModalOpen(true);
    };

    const openEditTransactionModal = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setTransactionForm({
            projectId: transaction.projectId || '',
            type: transaction.type,
            date: toDate(transaction.date),
            category: transaction.category || '',
            amount: String(transaction.amount ?? ''),
            notes: transaction.notes || '',
            isRecurring: false,
            frequency: 'monthly',
            endDate: null,
        });
        setTransactionModalOpen(true);
    };

    const openNewRecurringModal = () => {
        setEditingRecurring(null);
        setRecurringForm(buildEmptyRecurringForm());
        setRecurringModalOpen(true);
    };

    const openEditRecurringModal = (transaction: RecurringTransaction) => {
        setEditingRecurring(transaction);
        setRecurringForm({
            projectId: transaction.projectId || '',
            type: transaction.type,
            frequency: transaction.frequency,
            startDate: toDate(transaction.startDate),
            endDate: toDate(transaction.endDate),
            category: transaction.category || '',
            amount: String(transaction.amount ?? ''),
            notes: transaction.notes || '',
        });
        setRecurringModalOpen(true);
    };

    const validateTransactionForm = (form: TransactionFormState) => {
        if (!form.date) {
            showError(t('finance.validation.dateRequired'));
            return false;
        }
        if (!form.category.trim()) {
            showError(t('finance.validation.categoryRequired'));
            return false;
        }
        const amountValue = Number(form.amount);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            showError(t('finance.validation.amountRequired'));
            return false;
        }
        return true;
    };

    const validateRecurringForm = (form: RecurringFormState) => {
        if (!form.startDate) {
            showError(t('finance.validation.startDateRequired'));
            return false;
        }
        if (!form.category.trim()) {
            showError(t('finance.validation.categoryRequired'));
            return false;
        }
        const amountValue = Number(form.amount);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            showError(t('finance.validation.amountRequired'));
            return false;
        }
        return true;
    };

    const handleSaveTransaction = async () => {
        if (!canManage) return;
        if (!validateTransactionForm(transactionForm)) return;

        const amountValue = Number(transactionForm.amount);
        setSavingTransaction(true);

        try {
            if (editingTransaction) {
                await updateTransaction(editingTransaction.id, {
                    projectId: transactionForm.projectId || undefined,
                    type: transactionForm.type,
                    date: transactionForm.date,
                    category: transactionForm.category.trim(),
                    amount: amountValue,
                    notes: transactionForm.notes.trim(),
                }, tenantId || undefined);
                showSuccess(t('finance.toast.updated'));
            } else if (transactionForm.isRecurring) {
                const recurringId = await createRecurringTransaction({
                    projectId: transactionForm.projectId || undefined,
                    type: transactionForm.type,
                    frequency: transactionForm.frequency,
                    startDate: transactionForm.date,
                    endDate: transactionForm.endDate,
                    category: transactionForm.category.trim(),
                    amount: amountValue,
                    notes: transactionForm.notes.trim(),
                }, tenantId || undefined);

                await createTransaction({
                    projectId: transactionForm.projectId || undefined,
                    type: transactionForm.type,
                    date: transactionForm.date,
                    category: transactionForm.category.trim(),
                    amount: amountValue,
                    notes: transactionForm.notes.trim(),
                    isRecurring: true,
                    recurringId,
                }, tenantId || undefined);
                showSuccess(t('finance.toast.createdRecurring'));
            } else {
                await createTransaction({
                    projectId: transactionForm.projectId || undefined,
                    type: transactionForm.type,
                    date: transactionForm.date,
                    category: transactionForm.category.trim(),
                    amount: amountValue,
                    notes: transactionForm.notes.trim(),
                    isRecurring: false,
                }, tenantId || undefined);
                showSuccess(t('finance.toast.created'));
            }

            setTransactionModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save transaction', error);
            showError(t('finance.toast.error'), error?.message);
        } finally {
            setSavingTransaction(false);
        }
    };

    const handleDeleteTransaction = async (transaction: Transaction) => {
        if (!canManage) return;
        const confirmed = await confirm(t('finance.delete.title'), t('finance.delete.message'));
        if (!confirmed) return;

        try {
            await deleteTransaction(transaction.id, tenantId || undefined);
            showSuccess(t('finance.toast.deleted'));
        } catch (error: any) {
            console.error('Failed to delete transaction', error);
            showError(t('finance.toast.error'), error?.message);
        }
    };

    const handleSaveRecurring = async () => {
        if (!canManage) return;
        if (!validateRecurringForm(recurringForm)) return;

        const amountValue = Number(recurringForm.amount);
        setSavingRecurring(true);

        try {
            if (editingRecurring) {
                await updateRecurringTransaction(editingRecurring.id, {
                    projectId: recurringForm.projectId || undefined,
                    type: recurringForm.type,
                    frequency: recurringForm.frequency,
                    startDate: recurringForm.startDate,
                    endDate: recurringForm.endDate,
                    category: recurringForm.category.trim(),
                    amount: amountValue,
                    notes: recurringForm.notes.trim(),
                }, tenantId || undefined);
                showSuccess(t('finance.toast.updatedRecurring'));
            } else {
                await createRecurringTransaction({
                    projectId: recurringForm.projectId || undefined,
                    type: recurringForm.type,
                    frequency: recurringForm.frequency,
                    startDate: recurringForm.startDate,
                    endDate: recurringForm.endDate,
                    category: recurringForm.category.trim(),
                    amount: amountValue,
                    notes: recurringForm.notes.trim(),
                }, tenantId || undefined);
                showSuccess(t('finance.toast.createdRecurring'));
            }

            setRecurringModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save recurring transaction', error);
            showError(t('finance.toast.error'), error?.message);
        } finally {
            setSavingRecurring(false);
        }
    };

    const handleDeleteRecurring = async (transaction: RecurringTransaction) => {
        if (!canManage) return;
        const confirmed = await confirm(t('finance.deleteRecurring.title'), t('finance.deleteRecurring.message'));
        if (!confirmed) return;

        try {
            await deleteRecurringTransaction(transaction.id, tenantId || undefined);
            showSuccess(t('finance.toast.deletedRecurring'));
        } catch (error: any) {
            console.error('Failed to delete recurring transaction', error);
            showError(t('finance.toast.error'), error?.message);
        }
    };

    const handleExportCSV = () => {
        if (filteredTransactions.length === 0) return;

        const headers = [
            t('finance.table.date'),
            t('finance.project.label'),
            t('finance.table.category'),
            t('finance.table.amount'),
            t('finance.table.type'),
            t('finance.table.notes')
        ];

        const rows = filteredTransactions.map((transaction) => [
            toDate(transaction.date)?.toLocaleDateString(locale) || '',
            transaction.projectId ? (projectLookup.get(transaction.projectId) || t('finance.project.unknown')) : t('finance.project.unassigned'),
            transaction.category || '',
            transaction.amount,
            t(`finance.type.${transaction.type}`),
            (transaction.notes || '').replace(/,/g, ';')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `finance_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderWorkspaceSection = () => {
        if (activeWorkspaceSection === 'bookings') {
            return (
                <Card className="finance-panel finance-panel--expanded">
                    <div className="finance-panel__header">
                        <div>
                            <h3 className="h3">{t('finance.v2.bookings.title')}</h3>
                            <p className="text-muted">{t('finance.v2.bookings.subtitle')}</p>
                        </div>
                    </div>
                    <div className="finance-ai-metrics">
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bookings.v1Transactions')}</span>
                            <strong>{formatInteger(filteredTransactions.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bookings.recurring')}</span>
                            <strong>{formatInteger(recurringTransactions.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bookings.v2JournalEntries')}</span>
                            <strong>{formatInteger(journalEntries.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bookings.v2Payments')}</span>
                            <strong>{formatInteger(paymentsV2.length)}</strong>
                        </div>
                    </div>
                </Card>
            );
        }

        if (activeWorkspaceSection === 'receivables') {
            const openInvoices = invoicesV2.filter((invoice) => ['issued', 'partially_paid'].includes(invoice.status)).length;
            return (
                <div className="finance-v2-workspace">
                    <Card className="finance-panel finance-panel--expanded">
                        <div className="finance-panel__header">
                            <div>
                                <h3 className="h3">{t('finance.v2.receivables.title')}</h3>
                                <p className="text-muted">{t('finance.v2.receivables.subtitle')}</p>
                            </div>
                        </div>
                        <div className="finance-ai-metrics">
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.receivables.openInvoices')}</span>
                                <strong>{formatInteger(openInvoices)}</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.receivables.openAmount')}</span>
                                <strong>{formatCurrency(v2ReceivablesOpenAmount)}</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.receivables.totalInvoices')}</span>
                                <strong>{formatInteger(invoicesV2.length)}</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.receivables.unallocatedPayments')}</span>
                                <strong>{formatCurrency(v2UnallocatedPayments)}</strong>
                            </div>
                        </div>
                    </Card>

                    <div className="finance-v2-forms">
                        <Card className="finance-panel">
                            <div className="finance-panel__header">
                                <h3 className="h4">{t('finance.v2.receivables.newCustomer')}</h3>
                            </div>
                            <div className="finance-v2-form-grid">
                                <TextInput
                                    label={t('finance.v2.receivables.customerName')}
                                    value={customerForm.name}
                                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, name: event.target.value }))}
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.receivables.customerEmail')}
                                    value={customerForm.email}
                                    onChange={(event) => setCustomerForm((prev) => ({ ...prev, email: event.target.value }))}
                                    disabled={!canManage}
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => void handleCreateCustomer()}
                                    isLoading={savingReceivableAction}
                                    disabled={!canManage}
                                >
                                    {t('finance.v2.receivables.saveCustomer')}
                                </Button>
                            </div>
                        </Card>

                        <Card className="finance-panel">
                            <div className="finance-panel__header">
                                <h3 className="h4">{t('finance.v2.receivables.newInvoice')}</h3>
                            </div>
                            <div className="finance-v2-form-grid">
                                <Select
                                    label={t('finance.v2.receivables.customer')}
                                    value={invoiceForm.customerId}
                                    options={customerOptions}
                                    onChange={(value) => setInvoiceForm((prev) => ({ ...prev, customerId: String(value) }))}
                                />
                                <Select
                                    label={t('finance.project.field')}
                                    value={invoiceForm.projectId}
                                    options={projectFormOptions}
                                    onChange={(value) => setInvoiceForm((prev) => ({ ...prev, projectId: String(value) }))}
                                />
                                <DatePicker
                                    label={t('finance.v2.receivables.issueDate')}
                                    value={invoiceForm.issueDate}
                                    onChange={(value) => setInvoiceForm((prev) => ({ ...prev, issueDate: value }))}
                                />
                                <DatePicker
                                    label={t('finance.v2.receivables.dueDate')}
                                    value={invoiceForm.dueDate}
                                    onChange={(value) => setInvoiceForm((prev) => ({ ...prev, dueDate: value }))}
                                />
                                <TextInput
                                    label={t('finance.v2.receivables.lineDescription')}
                                    value={invoiceForm.description}
                                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, description: event.target.value }))}
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.receivables.quantity')}
                                    value={invoiceForm.quantity}
                                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, quantity: event.target.value }))}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.receivables.unitPrice')}
                                    value={invoiceForm.unitPrice}
                                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, unitPrice: event.target.value }))}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.receivables.taxRate')}
                                    value={invoiceForm.taxRatePercent}
                                    onChange={(event) => setInvoiceForm((prev) => ({ ...prev, taxRatePercent: event.target.value }))}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!canManage}
                                />
                                <Button
                                    variant="primary"
                                    onClick={() => void handleCreateInvoice()}
                                    isLoading={savingReceivableAction}
                                    disabled={!canManage}
                                >
                                    {t('finance.v2.receivables.saveInvoice')}
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <Card className="finance-panel finance-panel--expanded">
                        <div className="finance-panel__header">
                            <h3 className="h4">{t('finance.v2.receivables.invoiceList')}</h3>
                        </div>
                        <div className="finance-table">
                            <div className="finance-table__header finance-table__header--profitability">
                                <span>{t('finance.v2.receivables.invoiceNo')}</span>
                                <span>{t('finance.project.label')}</span>
                                <span>{t('finance.v2.receivables.status')}</span>
                                <span>{t('finance.v2.receivables.grossAmount')}</span>
                                <span>{t('finance.v2.receivables.openAmount')}</span>
                                <span>{t('finance.table.actions')}</span>
                            </div>
                            {invoicesV2.length === 0 ? (
                                <div className="finance-empty">{t('finance.v2.receivables.emptyInvoices')}</div>
                            ) : (
                                invoicesV2.slice(0, 20).map((invoice) => (
                                    <div className="finance-table__row finance-table__row--profitability" key={invoice.id}>
                                        <span>{invoice.invoiceNo || invoice.id}</span>
                                        <span>{invoice.projectId ? (projectLookup.get(invoice.projectId) || t('finance.project.unknown')) : t('finance.project.unassigned')}</span>
                                        <span className="finance-pill">{invoice.status}</span>
                                        <span>{formatCurrency(Number(invoice.grossAmount) || 0)}</span>
                                        <span>{formatCurrency(Number(invoice.openAmount) || 0)}</span>
                                        <div className="finance-table__actions">
                                            {invoice.status === 'draft' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => void handleIssueInvoice(invoice.id)}
                                                    disabled={!canManage || savingReceivableAction}
                                                >
                                                    {t('finance.v2.receivables.issue')}
                                                </Button>
                                            )}
                                            {!['voided', 'paid'].includes(invoice.status) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => void handleVoidInvoice(invoice.id)}
                                                    disabled={!canManage || savingReceivableAction}
                                                >
                                                    {t('finance.v2.receivables.void')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            );
        }

        if (activeWorkspaceSection === 'payables') {
            const openBills = billsV2.filter((bill) => ['posted', 'partially_paid'].includes(bill.status)).length;
            return (
                <div className="finance-v2-workspace">
                    <Card className="finance-panel finance-panel--expanded">
                        <div className="finance-panel__header">
                            <div>
                                <h3 className="h3">{t('finance.v2.payables.title')}</h3>
                                <p className="text-muted">{t('finance.v2.payables.subtitle')}</p>
                            </div>
                        </div>
                        <div className="finance-ai-metrics">
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.payables.openBills')}</span>
                                <strong>{formatInteger(openBills)}</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.payables.openAmount')}</span>
                                <strong>{formatCurrency(v2PayablesOpenAmount)}</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.payables.totalBills')}</span>
                                <strong>{formatInteger(billsV2.length)}</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.payables.totalPayments')}</span>
                                <strong>{formatInteger(paymentsV2.length)}</strong>
                            </div>
                        </div>
                    </Card>

                    <Card className="finance-panel finance-panel--expanded finance-v2-upload">
                        <div className="finance-panel__header">
                            <div>
                                <h3 className="h4">{t('finance.v2.payables.upload.title')}</h3>
                                <p className="text-muted">{t('finance.v2.payables.upload.subtitle')}</p>
                            </div>
                        </div>
                        <div className="finance-v2-upload__actions">
                            <input
                                key={invoiceUploadInputKey}
                                type="file"
                                className="finance-v2-upload__input"
                                accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                                onChange={handleInvoiceUploadFileChange}
                                disabled={!canManage || analyzingInvoiceUpload || savingInvoiceUpload}
                            />
                            <Button
                                variant="secondary"
                                onClick={() => void handleAnalyzeInvoiceUpload()}
                                isLoading={analyzingInvoiceUpload}
                                disabled={!canManage || !invoiceUploadFile || savingInvoiceUpload}
                            >
                                {t('finance.v2.payables.upload.analyze')}
                            </Button>
                        </div>
                        {invoiceUploadReview && (
                            <div className="finance-v2-upload__review">
                                <div className="finance-v2-upload__meta">
                                    <span>{`${t('finance.v2.payables.upload.file')}: ${invoiceUploadReview.fileName}`}</span>
                                    <span>{`${t('finance.v2.payables.upload.documentType')}: ${invoiceUploadReview.documentType.toUpperCase()}`}</span>
                                    <span>{`${t('finance.v2.payables.upload.confidence')}: ${invoiceUploadConfidenceLabel(invoiceUploadReview.confidence)}`}</span>
                                </div>
                                <div className="finance-v2-form-grid">
                                    <Select
                                        label={t('finance.v2.payables.vendor')}
                                        value={invoiceUploadReview.vendorId}
                                        options={vendorOptions}
                                        onChange={(value) => setInvoiceUploadReview((prev) => (prev ? { ...prev, vendorId: String(value) } : prev))}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.vendorName')}
                                        value={invoiceUploadReview.vendorName}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, vendorName: event.target.value } : prev))}
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.vendorEmail')}
                                        value={invoiceUploadReview.vendorEmail}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, vendorEmail: event.target.value } : prev))}
                                        disabled={!canManage}
                                    />
                                    <Select
                                        label={t('finance.project.field')}
                                        value={invoiceUploadReview.projectId}
                                        options={projectFormOptions}
                                        onChange={(value) => setInvoiceUploadReview((prev) => (prev ? { ...prev, projectId: String(value) } : prev))}
                                    />
                                    <DatePicker
                                        label={t('finance.v2.payables.billDate')}
                                        value={invoiceUploadReview.billDate}
                                        onChange={(value) => setInvoiceUploadReview((prev) => (prev ? { ...prev, billDate: value } : prev))}
                                    />
                                    <DatePicker
                                        label={t('finance.v2.payables.dueDate')}
                                        value={invoiceUploadReview.dueDate}
                                        onChange={(value) => setInvoiceUploadReview((prev) => (prev ? { ...prev, dueDate: value } : prev))}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.upload.invoiceNumber')}
                                        value={invoiceUploadReview.invoiceNumber}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, invoiceNumber: event.target.value } : prev))}
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.upload.currency')}
                                        value={invoiceUploadReview.currencyCode}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, currencyCode: event.target.value.toUpperCase() } : prev))}
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.lineDescription')}
                                        value={invoiceUploadReview.description}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.quantity')}
                                        value={invoiceUploadReview.quantity}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, quantity: event.target.value } : prev))}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.unitCost')}
                                        value={invoiceUploadReview.unitCost}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, unitCost: event.target.value } : prev))}
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        disabled={!canManage}
                                    />
                                    <TextInput
                                        label={t('finance.v2.payables.taxRate')}
                                        value={invoiceUploadReview.taxRatePercent}
                                        onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, taxRatePercent: event.target.value } : prev))}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        disabled={!canManage}
                                    />
                                    <Select
                                        label={t('finance.v2.payables.upload.cadence.label')}
                                        value={invoiceUploadReview.cadence}
                                        options={invoiceUploadCadenceOptions}
                                        onChange={(value) => setInvoiceUploadReview((prev) => (prev ? { ...prev, cadence: value as InvoiceUploadCadence } : prev))}
                                    />
                                    {invoiceUploadReview.cadence === 'recurring' && (
                                        <>
                                            <Select
                                                label={t('finance.recurring.frequency')}
                                                value={invoiceUploadReview.recurringFrequency}
                                                options={frequencyOptions}
                                                onChange={(value) => setInvoiceUploadReview((prev) => (prev ? { ...prev, recurringFrequency: value as RecurringFrequency } : prev))}
                                            />
                                            <DatePicker
                                                label={t('finance.form.endDate')}
                                                value={invoiceUploadReview.recurringEndDate}
                                                onChange={(value) => setInvoiceUploadReview((prev) => (prev ? { ...prev, recurringEndDate: value } : prev))}
                                            />
                                        </>
                                    )}
                                </div>
                                <TextArea
                                    label={t('finance.form.notes')}
                                    value={invoiceUploadReview.notes}
                                    onChange={(event) => setInvoiceUploadReview((prev) => (prev ? { ...prev, notes: event.target.value } : prev))}
                                    disabled={!canManage}
                                />
                                {invoiceUploadReview.recurringHint && (
                                    <p className="finance-v2-upload__hint text-muted">
                                        {`${t('finance.v2.payables.upload.recurringHint')}: ${invoiceUploadReview.recurringHint}`}
                                    </p>
                                )}
                                <div className="finance-v2-upload__metrics">
                                    <div className="finance-v2-upload__metric">
                                        <span>{t('finance.v2.payables.upload.netAmount')}</span>
                                        <strong>{formatCurrency(invoiceUploadComputedTotals.netAmount)}</strong>
                                    </div>
                                    <div className="finance-v2-upload__metric">
                                        <span>{t('finance.v2.payables.upload.taxAmount')}</span>
                                        <strong>{formatCurrency(invoiceUploadComputedTotals.taxAmount)}</strong>
                                    </div>
                                    <div className="finance-v2-upload__metric">
                                        <span>{t('finance.v2.payables.upload.grossAmount')}</span>
                                        <strong>{formatCurrency(invoiceUploadComputedTotals.grossAmount)}</strong>
                                    </div>
                                </div>
                                <div className="finance-v2-upload__actions">
                                    <Button
                                        variant="primary"
                                        onClick={() => void handleConfirmInvoiceUpload()}
                                        isLoading={savingInvoiceUpload}
                                        disabled={!canManage || analyzingInvoiceUpload}
                                    >
                                        {t('finance.v2.payables.upload.confirm')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={resetInvoiceUploadFlow}
                                        disabled={!canManage || analyzingInvoiceUpload || savingInvoiceUpload}
                                    >
                                        {t('finance.v2.payables.upload.reset')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>

                    <div className="finance-v2-forms">
                        <Card className="finance-panel">
                            <div className="finance-panel__header">
                                <h3 className="h4">{t('finance.v2.payables.newVendor')}</h3>
                            </div>
                            <div className="finance-v2-form-grid">
                                <TextInput
                                    label={t('finance.v2.payables.vendorName')}
                                    value={vendorForm.name}
                                    onChange={(event) => setVendorForm((prev) => ({ ...prev, name: event.target.value }))}
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.payables.vendorEmail')}
                                    value={vendorForm.email}
                                    onChange={(event) => setVendorForm((prev) => ({ ...prev, email: event.target.value }))}
                                    disabled={!canManage}
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => void handleCreateVendor()}
                                    isLoading={savingPayableAction}
                                    disabled={!canManage}
                                >
                                    {t('finance.v2.payables.saveVendor')}
                                </Button>
                            </div>
                        </Card>

                        <Card className="finance-panel">
                            <div className="finance-panel__header">
                                <h3 className="h4">{t('finance.v2.payables.newBill')}</h3>
                            </div>
                            <div className="finance-v2-form-grid">
                                <Select
                                    label={t('finance.v2.payables.vendor')}
                                    value={billForm.vendorId}
                                    options={vendorOptions}
                                    onChange={(value) => setBillForm((prev) => ({ ...prev, vendorId: String(value) }))}
                                />
                                <Select
                                    label={t('finance.project.field')}
                                    value={billForm.projectId}
                                    options={projectFormOptions}
                                    onChange={(value) => setBillForm((prev) => ({ ...prev, projectId: String(value) }))}
                                />
                                <DatePicker
                                    label={t('finance.v2.payables.billDate')}
                                    value={billForm.billDate}
                                    onChange={(value) => setBillForm((prev) => ({ ...prev, billDate: value }))}
                                />
                                <DatePicker
                                    label={t('finance.v2.payables.dueDate')}
                                    value={billForm.dueDate}
                                    onChange={(value) => setBillForm((prev) => ({ ...prev, dueDate: value }))}
                                />
                                <TextInput
                                    label={t('finance.v2.payables.lineDescription')}
                                    value={billForm.description}
                                    onChange={(event) => setBillForm((prev) => ({ ...prev, description: event.target.value }))}
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.payables.quantity')}
                                    value={billForm.quantity}
                                    onChange={(event) => setBillForm((prev) => ({ ...prev, quantity: event.target.value }))}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.payables.unitCost')}
                                    value={billForm.unitCost}
                                    onChange={(event) => setBillForm((prev) => ({ ...prev, unitCost: event.target.value }))}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!canManage}
                                />
                                <TextInput
                                    label={t('finance.v2.payables.taxRate')}
                                    value={billForm.taxRatePercent}
                                    onChange={(event) => setBillForm((prev) => ({ ...prev, taxRatePercent: event.target.value }))}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!canManage}
                                />
                                <Button
                                    variant="primary"
                                    onClick={() => void handleCreateBill()}
                                    isLoading={savingPayableAction}
                                    disabled={!canManage}
                                >
                                    {t('finance.v2.payables.saveBill')}
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <Card className="finance-panel finance-panel--expanded">
                        <div className="finance-panel__header">
                            <h3 className="h4">{t('finance.v2.payables.billList')}</h3>
                        </div>
                        <div className="finance-table">
                            <div className="finance-table__header finance-table__header--profitability">
                                <span>{t('finance.v2.payables.billNo')}</span>
                                <span>{t('finance.project.label')}</span>
                                <span>{t('finance.v2.payables.status')}</span>
                                <span>{t('finance.v2.payables.grossAmount')}</span>
                                <span>{t('finance.v2.payables.openAmount')}</span>
                                <span>{t('finance.table.actions')}</span>
                            </div>
                            {billsV2.length === 0 ? (
                                <div className="finance-empty">{t('finance.v2.payables.emptyBills')}</div>
                            ) : (
                                billsV2.slice(0, 20).map((bill) => (
                                    <div className="finance-table__row finance-table__row--profitability" key={bill.id}>
                                        <span>{bill.billNo || bill.id}</span>
                                        <span>{bill.projectId ? (projectLookup.get(bill.projectId) || t('finance.project.unknown')) : t('finance.project.unassigned')}</span>
                                        <span className="finance-pill">{bill.status}</span>
                                        <span>{formatCurrency(Number(bill.grossAmount) || 0)}</span>
                                        <span>{formatCurrency(Number(bill.openAmount) || 0)}</span>
                                        <div className="finance-table__actions">
                                            {bill.status === 'draft' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => void handlePostBill(bill.id)}
                                                    disabled={!canManage || savingPayableAction}
                                                >
                                                    {t('finance.v2.payables.post')}
                                                </Button>
                                            )}
                                            {!['voided', 'paid'].includes(bill.status) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => void handleVoidBill(bill.id)}
                                                    disabled={!canManage || savingPayableAction}
                                                >
                                                    {t('finance.v2.payables.void')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            );
        }

        if (activeWorkspaceSection === 'bank') {
            return (
                <Card className="finance-panel finance-panel--expanded">
                    <div className="finance-panel__header">
                        <div>
                            <h3 className="h3">{t('finance.v2.bank.title')}</h3>
                            <p className="text-muted">{t('finance.v2.bank.subtitle')}</p>
                        </div>
                    </div>
                    <div className="finance-ai-metrics">
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bank.transactions')}</span>
                            <strong>{formatInteger(bankTransactionsV2.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bank.unreconciled')}</span>
                            <strong>{formatInteger(v2UnreconciledBankCount)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bank.reconciliations')}</span>
                            <strong>{formatInteger(reconciliationsV2.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.bank.journalLinks')}</span>
                            <strong>{formatInteger(journalEntries.length)}</strong>
                        </div>
                    </div>
                </Card>
            );
        }

        if (activeWorkspaceSection === 'tax') {
            return (
                <Card className="finance-panel finance-panel--expanded">
                    <div className="finance-panel__header">
                        <div>
                            <h3 className="h3">{t('finance.v2.tax.title')}</h3>
                            <p className="text-muted">{t('finance.v2.tax.subtitle')}</p>
                        </div>
                    </div>
                    <div className="finance-ai-metrics">
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.tax.reports')}</span>
                            <strong>{formatInteger(taxReportsV2.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.tax.latestPeriod')}</span>
                            <strong>{taxReportsV2[0]?.periodKey || '-'}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.tax.latestPayable')}</span>
                            <strong>{formatCurrency(Number(taxReportsV2[0]?.payableTax) || 0)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.tax.mode')}</span>
                            <strong>DE / GoBD + DATEV</strong>
                        </div>
                    </div>
                </Card>
            );
        }

        if (activeWorkspaceSection === 'reports') {
            return (
                <Card className="finance-panel finance-panel--expanded">
                    <div className="finance-panel__header">
                        <div>
                            <h3 className="h3">{t('finance.v2.reports.title')}</h3>
                            <p className="text-muted">{t('finance.v2.reports.subtitle')}</p>
                        </div>
                    </div>
                    <div className="finance-ai-metrics">
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.reports.trialBalance')}</span>
                            <strong>{formatInteger(journalEntries.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.reports.projectProfitability')}</span>
                            <strong>{formatInteger(projectProfitability.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.reports.aiCostVisibility')}</span>
                            <strong>{formatCurrency(toFiniteNumber(financialUsage?.totals?.aiUsd))}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.reports.periodControl')}</span>
                            <strong>{t('finance.v2.reports.monthly')}</strong>
                        </div>
                    </div>
                </Card>
            );
        }

        if (activeWorkspaceSection === 'exports') {
            return (
                <Card className="finance-panel finance-panel--expanded">
                    <div className="finance-panel__header">
                        <div>
                            <h3 className="h3">{t('finance.v2.exports.title')}</h3>
                            <p className="text-muted">{t('finance.v2.exports.subtitle')}</p>
                        </div>
                    </div>
                    <div className="finance-ai-metrics">
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.exports.jobs')}</span>
                            <strong>{formatInteger(exportJobsV2.length)}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.exports.latestStatus')}</span>
                            <strong>{exportJobsV2[0]?.status || '-'}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.exports.latestPeriod')}</span>
                            <strong>{exportJobsV2[0]?.periodKey || '-'}</strong>
                        </div>
                        <div className="finance-ai-metric">
                            <span>{t('finance.v2.exports.closeState')}</span>
                            <strong>{t('finance.v2.reports.monthly')}</strong>
                        </div>
                    </div>
                </Card>
            );
        }

        if (activeWorkspaceSection === 'settings') {
            return (
                <div className="finance-v2-workspace">
                    <Card className="finance-panel finance-panel--expanded">
                        <div className="finance-panel__header">
                            <div>
                                <h3 className="h3">{t('finance.v2.settings.title')}</h3>
                                <p className="text-muted">{t('finance.v2.settings.subtitle')}</p>
                            </div>
                        </div>
                        <div className="finance-ai-metrics">
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.settings.schemaVersion')}</span>
                                <strong>2</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.settings.currency')}</span>
                                <strong>{currencyCode}</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.settings.country')}</span>
                                <strong>DE</strong>
                            </div>
                            <div className="finance-ai-metric">
                                <span>{t('finance.v2.settings.writePath')}</span>
                                <strong>Cloud Functions</strong>
                            </div>
                        </div>
                    </Card>

                    <Card className="finance-panel finance-panel--expanded">
                        <div className="finance-panel__header">
                            <div>
                                <h3 className="h4">{t('finance.v2.migration.title')}</h3>
                                <p className="text-muted">{t('finance.v2.migration.subtitle')}</p>
                            </div>
                            <div className="finance-panel__header-actions">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void handleRunLegacyMigration(true)}
                                    isLoading={runningMigration}
                                    disabled={!canManage}
                                >
                                    {t('finance.v2.migration.dryRun')}
                                </Button>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => void handleRunLegacyMigration(false)}
                                    isLoading={runningMigration}
                                    disabled={!canManage}
                                >
                                    {t('finance.v2.migration.execute')}
                                </Button>
                            </div>
                        </div>
                        {migrationSummary ? (
                            <div className="finance-v2-migration-summary">
                                <div className="finance-v2-migration-summary__row">
                                    <span>{t('finance.v2.migration.mode')}</span>
                                    <strong>{migrationSummary.dryRun ? t('finance.v2.migration.modeDryRun') : t('finance.v2.migration.modeExecute')}</strong>
                                </div>
                                <div className="finance-v2-migration-summary__row">
                                    <span>{t('finance.v2.migration.transactions')}</span>
                                    <strong>{`${migrationSummary.transactions.migrated}/${migrationSummary.transactions.total}`}</strong>
                                </div>
                                <div className="finance-v2-migration-summary__row">
                                    <span>{t('finance.v2.migration.recurring')}</span>
                                    <strong>{`${migrationSummary.recurring.migrated}/${migrationSummary.recurring.total}`}</strong>
                                </div>
                                <div className="finance-v2-migration-summary__row">
                                    <span>{t('finance.v2.migration.scenarios')}</span>
                                    <strong>{`${migrationSummary.scenarios.migrated}/${migrationSummary.scenarios.total}`}</strong>
                                </div>
                                <div className="finance-v2-migration-summary__row">
                                    <span>{t('finance.v2.migration.incomeVsExpense')}</span>
                                    <strong>{`${formatCurrency(migrationSummary.transactions.incomeTotal)} / ${formatCurrency(migrationSummary.transactions.expenseTotal)}`}</strong>
                                </div>
                            </div>
                        ) : (
                            <div className="finance-empty">{t('finance.v2.migration.empty')}</div>
                        )}
                    </Card>
                </div>
            );
        }

        return null;
    };

    if (permissionLoading || !financeTranslationsReady) {
        return (
            <div className="finance-tracker">
                <div className="finance-loading">{financeTranslationsReady ? t('finance.loading') : 'Loading finance...'}</div>
            </div>
        );
    }

    if (!canView) {
        return (
            <div className="finance-tracker">
                <StatusCard
                    title={t('finance.accessDenied.title')}
                    message={t('finance.accessDenied.message')}
                    tone="error"
                    icon={<span className="material-symbols-outlined">lock</span>}
                />
            </div>
        );
    }

    return (
        <div className="finance-tracker">
            <div className="finance-header">
                <div>
                    <h1 className="h2">{t('finance.title')}</h1>
                    <p className="text-muted finance-subtitle">{t('finance.subtitle')}</p>
                </div>
                <div className="finance-header__actions">
                    {activeView === 'tracking' && (activeWorkspaceSection === 'bookings' || activeWorkspaceSection === 'cockpit') && (
                        <>
                            <Button variant="secondary" onClick={openNewRecurringModal} disabled={!canManage}>
                                {t('finance.actions.addRecurring')}
                            </Button>
                            <Button variant="primary" onClick={openNewTransactionModal} disabled={!canManage}>
                                {t('finance.actions.addTransaction')}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {activeView === 'calculations' ? (
                <FinanceCalculationsPanel
                    tenantId={tenantId}
                    canManage={canManage}
                    projects={projects}
                    formatCurrency={formatCurrency}
                    t={t}
                    showError={showError}
                    showSuccess={showSuccess}
                    confirm={confirm}
                    locale={locale}
                />
            ) : (
                activeWorkspaceSection !== 'cockpit' ? (
                    renderWorkspaceSection()
                ) : (
                    <>
                        <div className="finance-cockpit">
                            <div className="finance-cockpit__hero">
                                <Card
                                    className="finance-summary-card finance-summary-card--income"
                                    onClick={() => {
                                        setFilters((prev) => ({ ...prev, type: 'income' }));
                                        document.getElementById('finance-transactions-table')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setFilters((prev) => ({ ...prev, type: 'income' }));
                                            document.getElementById('finance-transactions-table')?.scrollIntoView({ behavior: 'smooth' });
                                        }
                                    }}
                                >
                                    <div className="finance-summary-card__header">
                                        <div className="finance-summary-card__label">{t('finance.summary.income')}</div>
                                        <div className="finance-summary-card__icon">
                                            <span className="material-symbols-outlined">trending_up</span>
                                        </div>
                                    </div>
                                    <div className="finance-summary-card__value">{formatCurrency(totals.income)}</div>
                                </Card>
                                <Card
                                    className="finance-summary-card finance-summary-card--expense"
                                    onClick={() => {
                                        setFilters((prev) => ({ ...prev, type: 'expense' }));
                                        document.getElementById('finance-transactions-table')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setFilters((prev) => ({ ...prev, type: 'expense' }));
                                            document.getElementById('finance-transactions-table')?.scrollIntoView({ behavior: 'smooth' });
                                        }
                                    }}
                                >
                                    <div className="finance-summary-card__header">
                                        <div className="finance-summary-card__label">{t('finance.summary.expenses')}</div>
                                        <div className="finance-summary-card__icon">
                                            <span className="material-symbols-outlined">trending_down</span>
                                        </div>
                                    </div>
                                    <div className="finance-summary-card__value">{formatCurrency(totals.expenses)}</div>
                                </Card>
                                <Card
                                    className={`finance-summary-card finance-summary-card--net ${totals.net >= 0 ? 'finance-summary-card--net-positive' : 'finance-summary-card--net-negative'}`}
                                >
                                    <div className="finance-summary-card__header">
                                        <div className="finance-summary-card__label">{t('finance.summary.net')}</div>
                                        <div className="finance-summary-card__icon">
                                            <span className="material-symbols-outlined">account_balance_wallet</span>
                                        </div>
                                    </div>
                                    <div className={`finance-summary-card__value ${totals.net >= 0 ? 'finance-summary-card__value--positive' : 'finance-summary-card__value--negative'}`}>
                                        {formatCurrency(totals.net)}
                                    </div>
                                </Card>
                            </div>

                            <div className="finance-cockpit__grid">
                                <Card className="finance-panel">
                                    <div className="finance-panel__header">
                                        <div>
                                            <h3 className="h3">{t('finance.chart.title')}</h3>
                                            <p className="text-muted">{t('finance.chart.subtitle')}</p>
                                        </div>
                                    </div>
                                    <div className="finance-chart">
                                        {chartData.length === 0 ? (
                                            <div className="finance-empty">{t('finance.chart.empty')}</div>
                                        ) : (
                                            <ResponsiveContainer width="100%" height={260}>
                                                <LineChart data={chartData}>
                                                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                                                    <YAxis tickLine={false} axisLine={false} />
                                                    <Tooltip
                                                        cursor={{ stroke: 'transparent' }}
                                                        content={<LineChartTooltip />}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="income"
                                                        stroke="var(--color-success)"
                                                        strokeWidth={2.5}
                                                        dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--color-surface-card)', stroke: 'var(--color-success)' }}
                                                        activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-success)' }}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="expenses"
                                                        stroke="var(--color-error)"
                                                        strokeWidth={2.5}
                                                        dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--color-surface-card)', stroke: 'var(--color-error)' }}
                                                        activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-error)' }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </Card>

                                <Card className="finance-panel finance-ai-panel">
                                    <div className="finance-panel__header">
                                        <div>
                                            <h3 className="h3">{t('finance.ai.title')}</h3>
                                            <p className="text-muted">{t('finance.ai.subtitle')}</p>
                                        </div>
                                        <div className="finance-panel__header-actions">
                                            {renderStateChip(aiSectionState, financialUsage?.isConfigured === false ? 0 : financialUsage?.months?.length)}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void loadFinancialUsage()}
                                                isLoading={financialUsageLoading}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="finance-panel__content finance-panel__content--ai">
                                        {financialUsageLoading ? (
                                            <div className="finance-loading">{t('finance.ai.loading')}</div>
                                        ) : financialUsageError ? (
                                            <div className="finance-empty">{financialUsageError}</div>
                                        ) : !financialUsage || financialUsage.isConfigured === false ? (
                                            <div className="finance-empty">
                                                <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>smart_toy</span>
                                                {financialUsage?.isConfigured === false ? t('finance.ai.error.notConfigured') : t('finance.ai.empty')}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="finance-ai-meta">
                                                    <span className="text-muted">{t('finance.ai.linkedProject.label')}:</span>
                                                    <strong>{linkedFinancialProjectName}</strong>
                                                </div>
                                                <div className="finance-ai-metrics">
                                                    <div className="finance-ai-metric">
                                                        <span>{t('finance.ai.metrics.aiUsd')}</span>
                                                        <strong>{formatCurrency(toFiniteNumber(financialUsage.totals.aiUsd))}</strong>
                                                    </div>
                                                    <div className="finance-ai-metric">
                                                        <span>{t('finance.ai.metrics.inputTokens')}</span>
                                                        <strong>{formatInteger(toFiniteNumber(financialUsage.totals.inputTokens))}</strong>
                                                    </div>
                                                    <div className="finance-ai-metric">
                                                        <span>{t('finance.ai.metrics.outputTokens')}</span>
                                                        <strong>{formatInteger(toFiniteNumber(financialUsage.totals.outputTokens))}</strong>
                                                    </div>
                                                </div>

                                                <div className="finance-ai-breakdowns">
                                                    <div className="finance-ai-breakdown">
                                                        <div className="finance-ai-breakdown__header">
                                                            <span>{t('finance.ai.breakdown.topModels')}</span>
                                                            <span>{t('finance.ai.breakdown.aiUsd')}</span>
                                                        </div>
                                                        {aiTopModels.length === 0 ? (
                                                            <div className="finance-empty">{t('finance.ai.breakdown.empty')}</div>
                                                        ) : (
                                                            aiTopModels.slice(0, 3).map((entry) => (
                                                                <div key={entry.name} className="finance-ai-breakdown__row">
                                                                    <span>{entry.name}</span>
                                                                    <span>{formatCurrency(entry.aiUsd)}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>

                                                    <div className="finance-ai-breakdown">
                                                        <div className="finance-ai-breakdown__header">
                                                            <span>{t('finance.ai.breakdown.topFunctions')}</span>
                                                            <span>{t('finance.ai.breakdown.aiUsd')}</span>
                                                        </div>
                                                        {aiTopFunctions.length === 0 ? (
                                                            <div className="finance-empty">{t('finance.ai.breakdown.empty')}</div>
                                                        ) : (
                                                            aiTopFunctions.slice(0, 3).map((entry) => (
                                                                <div key={entry.name} className="finance-ai-breakdown__row">
                                                                    <span>{entry.name}</span>
                                                                    <span>{formatCurrency(entry.aiUsd)}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </Card>

                                <Card className="finance-panel">
                                    <div className="finance-panel__header">
                                        <div>
                                            <h3 className="h3">{t('finance.analytics.distribution')}</h3>
                                            <p className="text-muted">{t('finance.chart.subtitle')}</p>
                                        </div>
                                    </div>
                                    <div className="finance-distribution">
                                        <div className="finance-chart">
                                            {categoryDistribution.length === 0 ? (
                                                <div className="finance-empty">{t('finance.analytics.empty')}</div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <PieChart>
                                                        <Pie
                                                            data={categoryDistribution}
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={60}
                                                            outerRadius={80}
                                                            paddingAngle={4}
                                                            dataKey="value"
                                                        >
                                                            {categoryDistribution.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                        <div className="finance-distribution__list">
                                            <div className="finance-distribution__header">
                                                <span>{t('finance.analytics.listTitle')}</span>
                                                <span>{t('finance.analytics.amount')}</span>
                                            </div>
                                            {categoryDistribution.length === 0 ? (
                                                <div className="finance-empty">{t('finance.analytics.empty')}</div>
                                            ) : (
                                                categoryDistribution.map((item, index) => {
                                                    const total = categoryDistribution.reduce((acc, entry) => acc + entry.value, 0) || 1;
                                                    const percent = Math.round((item.value / total) * 100);
                                                    return (
                                                        <div key={item.name} className="finance-distribution__row">
                                                            <div className="finance-distribution__label">
                                                                <span
                                                                    className="finance-distribution__swatch"
                                                                    style={{ background: COLORS[index % COLORS.length] }}
                                                                />
                                                                <span>{item.name}</span>
                                                            </div>
                                                            <div className="finance-distribution__value">
                                                                <span>{formatCurrency(item.value)}</span>
                                                                <span className="finance-distribution__percent">{percent}%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                <Card className="finance-panel finance-panel--expanded">
                                    <div className="finance-panel__header">
                                        <div>
                                            <h3 className="h3">{t('finance.project.profitabilityTitle')}</h3>
                                            <p className="text-muted">{t('finance.project.profitabilitySubtitle')}</p>
                                        </div>
                                        {renderStateChip(projectProfitabilityState, projectProfitability.length)}
                                    </div>
                                    <div className="finance-panel__content finance-panel__content--table">
                                        <div className="finance-table">
                                            <div className="finance-table__header finance-table__header--profitability">
                                                <span>{t('finance.project.label')}</span>
                                                <span>{t('finance.summary.income')}</span>
                                                <span>{t('finance.summary.expenses')}</span>
                                                <span>{t('finance.project.net')}</span>
                                                <span>{t('finance.project.margin')}</span>
                                            </div>
                                            {projectProfitability.length === 0 ? (
                                                <div className="finance-empty">{t('finance.project.empty')}</div>
                                            ) : (
                                                projectProfitability.map((row) => (
                                                    <div key={row.projectId} className="finance-table__row finance-table__row--profitability">
                                                        <span>{row.projectName}</span>
                                                        <span className="finance-amount finance-amount--income">{formatCurrency(row.income)}</span>
                                                        <span className="finance-amount finance-amount--expense">{formatCurrency(row.expenses)}</span>
                                                        <span className={row.net >= 0 ? 'finance-summary-card__value--positive' : 'finance-summary-card__value--negative'}>
                                                            {formatCurrency(row.net)}
                                                        </span>
                                                        <span>{row.marginPercent.toFixed(2)}%</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            <div id="finance-transactions-table">
                                <Card className="finance-panel finance-panel--filters">
                                    <div className="finance-panel__header">
                                        <h3 className="h3">{t('finance.filters.title')}</h3>
                                        <div className="finance-header__actions">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleExportCSV}
                                                disabled={filteredTransactions.length === 0}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>download</span>
                                                {t('finance.export.csv')}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setChartPeriod('all');
                                                    setFilters({ startDate: null, endDate: null, type: 'all', projectId: 'all', categories: [], search: '' });
                                                }}
                                            >
                                                {t('finance.filters.clear')}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="finance-filters">
                                        <TextInput
                                            placeholder={t('finance.search.placeholder')}
                                            value={filters.search}
                                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                            leftElement={<span className="material-symbols-outlined">search</span>}
                                        />
                                        <Select
                                            label={t('finance.filters.period')}
                                            value={chartPeriod}
                                            onChange={(value) => setChartPeriod(value as ChartPeriod)}
                                            options={periodOptions}
                                        />
                                        <div className="finance-filters__row">
                                            <DatePicker
                                                label={t('finance.filters.startDate')}
                                                value={filters.startDate}
                                                onChange={(value) => {
                                                    setChartPeriod('custom');
                                                    setFilters((prev) => ({ ...prev, startDate: value }));
                                                }}
                                            />
                                            <DatePicker
                                                label={t('finance.filters.endDate')}
                                                value={filters.endDate}
                                                onChange={(value) => {
                                                    setChartPeriod('custom');
                                                    setFilters((prev) => ({ ...prev, endDate: value }));
                                                }}
                                            />
                                        </div>
                                        <Select
                                            label={t('finance.filters.type')}
                                            value={filters.type}
                                            onChange={(value) => setFilters((prev) => ({ ...prev, type: value as TransactionType | 'all' }))}
                                            options={typeOptions}
                                        />
                                        <Select
                                            label={t('finance.project.filter')}
                                            value={filters.projectId}
                                            onChange={(value) => setFilters((prev) => ({ ...prev, projectId: value }))}
                                            options={projectFilterOptions}
                                        />
                                        <div className="finance-filters__categories">
                                            <span className="finance-filters__label">{t('finance.filters.categories')}</span>
                                            <div className="finance-category-list">
                                                {categoryOptions.map((category) => {
                                                    const isSelected = filters.categories.includes(category);
                                                    return (
                                                        <button
                                                            key={category}
                                                            type="button"
                                                            className={`finance-category-pill ${isSelected ? 'finance-category-pill--active' : ''}`}
                                                            onClick={() =>
                                                                setFilters((prev) => ({
                                                                    ...prev,
                                                                    categories: isSelected
                                                                        ? prev.categories.filter((item) => item !== category)
                                                                        : [...prev.categories, category],
                                                                }))
                                                            }
                                                            aria-pressed={isSelected}
                                                        >
                                                            {category}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="finance-panel finance-panel--expanded" style={{ marginTop: '16px' }}>
                                    <div className="finance-panel__header">
                                        <h3 className="h3">{t('finance.table.title')}</h3>
                                        <div className="finance-panel__header-actions">
                                            {renderStateChip(transactionsState, filteredTransactions.length)}
                                            <span className="text-muted">{t('finance.table.subtitle')}</span>
                                        </div>
                                    </div>
                                    <div className="finance-panel__content finance-panel__content--table">
                                        <div className="finance-table">
                                            <div className="finance-table__header finance-table__header--transactions">
                                                <span>{t('finance.table.date')}</span>
                                                <span>{t('finance.project.label')}</span>
                                                <span>{t('finance.table.category')}</span>
                                                <span>{t('finance.table.amount')}</span>
                                                <span>{t('finance.table.notes')}</span>
                                                <span>{t('finance.table.actions')}</span>
                                            </div>

                                            {filteredTransactions.length === 0 ? (
                                                <div className="finance-empty">{t('finance.table.empty')}</div>
                                            ) : (
                                                filteredTransactions.map((transaction) => {
                                                    const transactionDate = toDate(transaction.date);
                                                    const amountValue = Number(transaction.amount) || 0;
                                                    return (
                                                        <motion.div
                                                            key={transaction.id}
                                                            className="finance-table__row finance-table__row--transactions"
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <span>{transactionDate ? transactionDate.toLocaleDateString(locale) : '-'}</span>
                                                            <span>{transaction.projectId ? (projectLookup.get(transaction.projectId) || t('finance.project.unknown')) : t('finance.project.unassigned')}</span>
                                                            <span>{transaction.category}</span>
                                                            <span className={`finance-amount finance-amount--${transaction.type}`}>
                                                                {transaction.type === 'expense' ? '-' : '+'}
                                                                {formatCurrency(Math.abs(amountValue))}
                                                            </span>
                                                            <span className="finance-table__notes">{transaction.notes || t('finance.table.notesEmpty')}</span>
                                                            <div className="finance-table__actions">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => openEditTransactionModal(transaction)}
                                                                    disabled={!canManage}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteTransaction(transaction)}
                                                                    disabled={!canManage}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-error)' }}>delete</span>
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                <Card className="finance-panel finance-panel--expanded">
                                    <div className="finance-panel__header">
                                        <h3 className="h3">{t('finance.recurring.title')}</h3>
                                        <div className="finance-panel__header-actions">
                                            {renderStateChip(recurringState, recurringTransactions.length)}
                                            <span className="text-muted">{t('finance.recurring.subtitle')}</span>
                                        </div>
                                    </div>
                                    <div className="finance-panel__content finance-panel__content--table">
                                        <div className="finance-table">
                                            <div className="finance-table__header finance-table__header--recurring">
                                                <span>{t('finance.project.label')}</span>
                                                <span>{t('finance.recurring.category')}</span>
                                                <span>{t('finance.recurring.frequency')}</span>
                                                <span>{t('finance.recurring.amount')}</span>
                                                <span>{t('finance.recurring.range')}</span>
                                                <span>{t('finance.table.actions')}</span>
                                            </div>

                                            {recurringTransactions.length === 0 ? (
                                                <div className="finance-empty">{t('finance.recurring.empty')}</div>
                                            ) : (
                                                recurringTransactions.map((transaction) => {
                                                    const startDate = toDate(transaction.startDate);
                                                    const endDate = toDate(transaction.endDate);
                                                    const amountValue = Number(transaction.amount) || 0;
                                                    return (
                                                        <motion.div
                                                            key={transaction.id}
                                                            className="finance-table__row finance-table__row--recurring"
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <span>{transaction.projectId ? (projectLookup.get(transaction.projectId) || t('finance.project.unknown')) : t('finance.project.unassigned')}</span>
                                                            <span>{transaction.category}</span>
                                                            <span className="finance-pill">{t(`finance.frequency.${transaction.frequency}`)}</span>
                                                            <span className={`finance-amount finance-amount--${transaction.type}`}>
                                                                {transaction.type === 'expense' ? '-' : '+'}
                                                                {formatCurrency(Math.abs(amountValue))}
                                                            </span>
                                                            <span className="finance-table__notes">
                                                                {startDate ? startDate.toLocaleDateString(locale) : '-'}
                                                                {endDate ? ` -> ${endDate.toLocaleDateString(locale)}` : ''}
                                                            </span>
                                                            <div className="finance-table__actions">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => openEditRecurringModal(transaction)}
                                                                    disabled={!canManage}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteRecurring(transaction)}
                                                                    disabled={!canManage}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-error)' }}>delete</span>
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </>
                )
            )}

            <Modal
                isOpen={transactionModalOpen}
                onClose={() => setTransactionModalOpen(false)}
                title={editingTransaction ? t('finance.modal.editTitle') : t('finance.modal.createTitle')}
                size="md"
            >
                <div className="finance-modal">
                    <div className="finance-modal__toggle">
                        <span className="finance-modal__label">{t('finance.form.type')}</span>
                        <div className="finance-toggle">
                            {(['income', 'expense'] as TransactionType[]).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={`finance-toggle__option ${transactionForm.type === type ? 'finance-toggle__option--active' : ''}`}
                                    onClick={() => setTransactionForm((prev) => ({ ...prev, type }))}
                                >
                                    {t(`finance.type.${type}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="finance-modal__grid">
                        <Select
                            label={t('finance.project.field')}
                            value={transactionForm.projectId}
                            onChange={(value) => setTransactionForm((prev) => ({ ...prev, projectId: String(value) }))}
                            options={projectFormOptions}
                        />
                        <DatePicker
                            label={t('finance.form.date')}
                            value={transactionForm.date}
                            onChange={(value) => setTransactionForm((prev) => ({ ...prev, date: value }))}
                        />
                        <TextInput
                            label={t('finance.form.category')}
                            value={transactionForm.category}
                            onChange={(event) => setTransactionForm((prev) => ({ ...prev, category: event.target.value }))}
                            placeholder={t('finance.form.categoryPlaceholder')}
                            list="finance-category-list"
                        />
                        <TextInput
                            label={t('finance.form.amount')}
                            value={transactionForm.amount}
                            onChange={(event) => setTransactionForm((prev) => ({ ...prev, amount: event.target.value }))}
                            placeholder={t('finance.form.amountPlaceholder')}
                            type="number"
                            min="0"
                            step="0.01"
                        />
                        <TextArea
                            label={t('finance.form.notes')}
                            value={transactionForm.notes}
                            onChange={(event) => setTransactionForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder={t('finance.form.notesPlaceholder')}
                            rows={3}
                        />
                    </div>

                    {!editingTransaction && (
                        <div className="finance-modal__recurring">
                            <Checkbox
                                label={t('finance.form.isRecurring')}
                                checked={transactionForm.isRecurring}
                                onChange={(event) => setTransactionForm((prev) => ({ ...prev, isRecurring: event.target.checked }))}
                            />
                            {transactionForm.isRecurring && (
                                <div className="finance-modal__grid">
                                    <Select
                                        label={t('finance.form.frequency')}
                                        value={transactionForm.frequency}
                                        onChange={(value) =>
                                            setTransactionForm((prev) => ({ ...prev, frequency: value as RecurringFrequency }))
                                        }
                                        options={frequencyOptions}
                                    />
                                    <DatePicker
                                        label={t('finance.form.endDate')}
                                        value={transactionForm.endDate}
                                        onChange={(value) => setTransactionForm((prev) => ({ ...prev, endDate: value }))}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="finance-modal__actions">
                        <Button variant="ghost" onClick={() => setTransactionModalOpen(false)} disabled={savingTransaction}>
                            {t('finance.actions.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSaveTransaction} isLoading={savingTransaction}>
                            {t('finance.actions.save')}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={recurringModalOpen}
                onClose={() => setRecurringModalOpen(false)}
                title={editingRecurring ? t('finance.recurring.editTitle') : t('finance.recurring.createTitle')}
                size="md"
            >
                <div className="finance-modal">
                    <div className="finance-modal__toggle">
                        <span className="finance-modal__label">{t('finance.form.type')}</span>
                        <div className="finance-toggle">
                            {(['income', 'expense'] as TransactionType[]).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={`finance-toggle__option ${recurringForm.type === type ? 'finance-toggle__option--active' : ''}`}
                                    onClick={() => setRecurringForm((prev) => ({ ...prev, type }))}
                                >
                                    {t(`finance.type.${type}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="finance-modal__grid">
                        <Select
                            label={t('finance.project.field')}
                            value={recurringForm.projectId}
                            onChange={(value) => setRecurringForm((prev) => ({ ...prev, projectId: String(value) }))}
                            options={projectFormOptions}
                        />
                        <DatePicker
                            label={t('finance.form.startDate')}
                            value={recurringForm.startDate}
                            onChange={(value) => setRecurringForm((prev) => ({ ...prev, startDate: value }))}
                        />
                        <DatePicker
                            label={t('finance.form.endDate')}
                            value={recurringForm.endDate}
                            onChange={(value) => setRecurringForm((prev) => ({ ...prev, endDate: value }))}
                        />
                        <Select
                            label={t('finance.form.frequency')}
                            value={recurringForm.frequency}
                            onChange={(value) => setRecurringForm((prev) => ({ ...prev, frequency: value as RecurringFrequency }))}
                            options={frequencyOptions}
                        />
                        <TextInput
                            label={t('finance.form.category')}
                            value={recurringForm.category}
                            onChange={(event) => setRecurringForm((prev) => ({ ...prev, category: event.target.value }))}
                            placeholder={t('finance.form.categoryPlaceholder')}
                            list="finance-category-list"
                        />
                        <TextInput
                            label={t('finance.form.amount')}
                            value={recurringForm.amount}
                            onChange={(event) => setRecurringForm((prev) => ({ ...prev, amount: event.target.value }))}
                            placeholder={t('finance.form.amountPlaceholder')}
                            type="number"
                            min="0"
                            step="0.01"
                        />
                        <TextArea
                            label={t('finance.form.notes')}
                            value={recurringForm.notes}
                            onChange={(event) => setRecurringForm((prev) => ({ ...prev, notes: event.target.value }))}
                            placeholder={t('finance.form.notesPlaceholder')}
                            rows={3}
                        />
                    </div>

                    <div className="finance-modal__actions">
                        <Button variant="ghost" onClick={() => setRecurringModalOpen(false)} disabled={savingRecurring}>
                            {t('finance.actions.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSaveRecurring} isLoading={savingRecurring}>
                            {t('finance.actions.save')}
                        </Button>
                    </div>
                </div>
            </Modal>

            <datalist id="finance-category-list">
                {categoryOptions.map((category) => (
                    <option key={category} value={category} />
                ))}
            </datalist>
        </div>
    );
};
