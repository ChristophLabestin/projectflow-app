import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { calculateFinanceTotals, filterTransactions, generateRecurringOccurrences } from '../../utils/finance';
import type { RecurringTransaction, Transaction } from '../../types';

const baseTransactions: Transaction[] = [
    {
        id: 't1',
        tenantId: 'tenant-a',
        userId: 'user-a',
        type: 'income',
        date: new Date('2025-01-10'),
        category: 'Sales',
        amount: 2000,
        notes: '',
        isRecurring: false,
    },
    {
        id: 't2',
        tenantId: 'tenant-a',
        userId: 'user-a',
        type: 'expense',
        date: new Date('2025-01-12'),
        category: 'Rent',
        amount: 800,
        notes: 'Office',
        isRecurring: false,
    },
];

describe('finance utils', () => {
    it('calculates totals for income and expenses', () => {
        const totals = calculateFinanceTotals(baseTransactions);
        expect(totals.income).toBe(2000);
        expect(totals.expenses).toBe(800);
        expect(totals.net).toBe(1200);
    });

    it('filters transactions by date range and category', () => {
        const filtered = filterTransactions(baseTransactions, {
            startDate: new Date('2025-01-11'),
            endDate: new Date('2025-01-20'),
            categories: ['Rent'],
            type: 'all',
        });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('t2');
    });

    it('generates recurring occurrences based on frequency', () => {
        const recurring: RecurringTransaction = {
            id: 'r1',
            tenantId: 'tenant-a',
            userId: 'user-a',
            type: 'expense',
            frequency: 'monthly',
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-03-01'),
            category: 'Rent',
            amount: 1000,
            notes: '',
        };

        const occurrences = generateRecurringOccurrences(recurring, {
            untilDate: new Date('2025-03-05'),
        });

        expect(occurrences).toHaveLength(3);
        expect(format(occurrences[0], 'yyyy-MM-dd')).toBe('2025-01-01');
        expect(format(occurrences[2], 'yyyy-MM-dd')).toBe('2025-03-01');
    });
});
