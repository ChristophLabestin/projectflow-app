import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FinanceTracking } from '../FinanceTracking';
import type { Transaction } from '../../types';

const mockTransactions: Transaction[] = [
    {
        id: 't1',
        tenantId: 'tenant-a',
        userId: 'user-a',
        type: 'income',
        date: new Date(),
        category: 'Sales',
        amount: 1500,
        notes: 'Initial payment',
        isRecurring: false,
    },
];

const { createTransaction } = vi.hoisted(() => ({
    createTransaction: vi.fn().mockResolvedValue('new-id'),
}));

vi.mock('../../context/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => (key === 'finance.currencyCode' ? 'USD' : key),
        language: 'en',
        dateLocale: undefined,
        dateFormat: 'MM/dd/yyyy',
        financeTranslationsReady: true,
        loadFinanceTranslations: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('../../context/PermissionContext', () => ({
    usePermissions: () => ({
        hasPermission: () => true,
        loading: false,
    }),
}));

vi.mock('../../context/UIContext', () => ({
    useConfirm: () => vi.fn(() => Promise.resolve(true)),
    useToast: () => ({
        showError: vi.fn(),
        showSuccess: vi.fn(),
    }),
}));

vi.mock('../../services/domain/authService', () => ({
    getActiveTenantId: () => 'tenant-a',
}));

vi.mock('../../services/firebase', () => ({
    auth: { currentUser: { uid: 'user-a' } },
}));

vi.mock('../../services/financeService', () => ({
    subscribeTransactions: (callback: (data: Transaction[]) => void) => {
        callback(mockTransactions);
        return () => undefined;
    },
    subscribeRecurringTransactions: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
    createTransaction,
    createRecurringTransaction: vi.fn().mockResolvedValue('recurring-id'),
    updateTransaction: vi.fn().mockResolvedValue(undefined),
    deleteTransaction: vi.fn().mockResolvedValue(undefined),
    updateRecurringTransaction: vi.fn().mockResolvedValue(undefined),
    deleteRecurringTransaction: vi.fn().mockResolvedValue(undefined),
    generateMissingRecurringTransactions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/domain/projectsService', () => ({
    subscribeTenantProjects: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
}));

vi.mock('../../services/financeScenarioService', () => ({
    subscribeFinanceScenarios: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
    createFinanceScenario: vi.fn().mockResolvedValue('scenario-id'),
    updateFinanceScenario: vi.fn().mockResolvedValue(undefined),
    deleteFinanceScenario: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/finance-v2/ledgerService', () => ({
    subscribeJournalEntries: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
}));

vi.mock('../../services/finance-v2/arService', () => ({
    subscribeFinanceCustomers: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
    subscribeFinanceInvoices: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
    upsertFinanceCustomer: vi.fn().mockResolvedValue({ customerId: 'customer-1' }),
    createInvoice: vi.fn().mockResolvedValue({ invoiceId: 'invoice-1' }),
    issueInvoice: vi.fn().mockResolvedValue({ invoiceId: 'invoice-1' }),
    voidInvoice: vi.fn().mockResolvedValue({ invoiceId: 'invoice-1' }),
}));

vi.mock('../../services/finance-v2/apService', () => ({
    subscribeFinanceVendors: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
    subscribeFinanceBills: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
    upsertFinanceVendor: vi.fn().mockResolvedValue({ vendorId: 'vendor-1' }),
    createBill: vi.fn().mockResolvedValue({ billId: 'bill-1' }),
    extractInvoiceFromDocument: vi.fn().mockResolvedValue({
        documentType: 'pdf',
        vendorName: 'Vendor',
        vendorEmail: '',
        vendorVatId: '',
        invoiceNumber: 'INV-1',
        invoiceDate: '2026-01-01',
        dueDate: '2026-01-15',
        currencyCode: 'EUR',
        lineDescription: 'Service',
        quantity: 1,
        unitCost: 100,
        taxRatePercent: 19,
        netAmount: 100,
        taxAmount: 19,
        grossAmount: 119,
        confidence: 'medium',
        isLikelyRecurring: false,
        recurringHint: '',
        notes: '',
        model: 'gpt-5-mini',
    }),
    postBill: vi.fn().mockResolvedValue({ billId: 'bill-1' }),
    voidBill: vi.fn().mockResolvedValue({ billId: 'bill-1' }),
}));

vi.mock('../../services/finance-v2/billingService', () => ({
    subscribeFinancePayments: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
}));

vi.mock('../../services/finance-v2/reconciliationService', () => ({
    subscribeFinanceBankTransactions: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
    subscribeFinanceReconciliations: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
}));

vi.mock('../../services/finance-v2/taxService', () => ({
    subscribeFinanceTaxReports: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
}));

vi.mock('../../services/finance-v2/exportService', () => ({
    subscribeFinanceExportJobs: (callback: (data: any[]) => void) => {
        callback([]);
        return () => undefined;
    },
}));

vi.mock('../../services/finance-v2/migrationService', () => ({
    migrateLegacyFinanceV1ToV2: vi.fn().mockResolvedValue({
        dryRun: true,
        transactions: { total: 0, migrated: 0, skipped: 0, incomeTotal: 0, expenseTotal: 0 },
        recurring: { total: 0, migrated: 0, skipped: 0 },
        scenarios: { total: 0, migrated: 0, skipped: 0 },
    }),
}));

vi.mock('../../services/domain/adminSettingsService', () => ({
    fetchWorkspaceFinancialUsage: vi.fn().mockResolvedValue({
        endpoint: 'https://example.com/financial',
        linkedProjectId: null,
        requestedMonths: 6,
        totals: {
            aiUsd: 42.5,
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
        },
        months: [],
    }),
    getWorkspaceFinancialConfig: vi.fn().mockResolvedValue(null),
    saveWorkspaceFinancialConfig: vi.fn().mockResolvedValue({
        endpoint: 'https://example.com/financial',
        months: 6,
        linkedProjectId: null,
        hasToken: true,
    }),
}));

describe('FinanceTracking', () => {
    const renderFinance = (path = '/finance') => {
        return render(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/finance" element={<FinanceTracking />} />
                    <Route path="/finance/:financeSection" element={<FinanceTracking />} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders subscribed transactions', async () => {
        renderFinance();
        const salesMatches = await screen.findAllByText('Sales');
        expect(salesMatches.length).toBeGreaterThan(0);
        expect(screen.getByText('Initial payment')).toBeInTheDocument();
    });

    it('submits a new transaction from the form', async () => {
        const user = userEvent.setup();
        renderFinance();

        await user.click(screen.getByText('finance.actions.addTransaction'));
        await user.type(screen.getByLabelText('finance.form.category'), 'Consulting');
        await user.type(screen.getByLabelText('finance.form.amount'), '250');
        await user.click(screen.getByText('finance.actions.save'));

        await waitFor(() => {
            expect(createTransaction).toHaveBeenCalled();
        });

        const payload = createTransaction.mock.calls[0][0];
        expect(payload.category).toBe('Consulting');
        expect(payload.amount).toBe(250);
    });

    it('switches to calculations view', async () => {
        renderFinance('/finance/calculations');

        expect(screen.getByText('finance.calc.editor.new')).toBeInTheDocument();
        expect(screen.getByText('finance.calc.actions.save')).toBeInTheDocument();
    });

    it('opens receivables section in finance v2 navigation', async () => {
        renderFinance('/finance/receivables');

        expect(screen.getByText('finance.v2.receivables.title')).toBeInTheDocument();
        expect(screen.getByText('finance.v2.receivables.newInvoice')).toBeInTheDocument();
    });
});
