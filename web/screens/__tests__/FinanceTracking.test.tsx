import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    it('renders subscribed transactions', async () => {
        render(<FinanceTracking />);
        const salesMatches = await screen.findAllByText('Sales');
        expect(salesMatches.length).toBeGreaterThan(0);
        expect(screen.getByText('Initial payment')).toBeInTheDocument();
    });

    it('submits a new transaction from the form', async () => {
        const user = userEvent.setup();
        render(<FinanceTracking />);

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
        const user = userEvent.setup();
        render(<FinanceTracking />);

        await user.click(screen.getByText('finance.views.calculations'));

        expect(screen.getByText('finance.calc.editor.new')).toBeInTheDocument();
        expect(screen.getByText('finance.calc.actions.save')).toBeInTheDocument();
    });
});
