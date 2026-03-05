import { addDays, addMonths, addWeeks, addYears, endOfDay, format, isAfter, isBefore, isWithinInterval, startOfDay } from 'date-fns';
import type { Locale } from 'date-fns';
import type { RecurringTransaction, RecurringFrequency, Transaction, TransactionType } from '../types';
import { toDate } from './time';

export interface FinanceFilters {
    startDate?: Date | null;
    endDate?: Date | null;
    categories?: string[];
    type?: TransactionType | 'all';
    projectId?: string;
}

export interface FinanceTotals {
    income: number;
    expenses: number;
    net: number;
}

export interface MonthlySeriesPoint {
    key: string;
    label: string;
    income: number;
    expenses: number;
    date: Date;
}

const MAX_OCCURRENCES = 500;

export const normalizeToDay = (value?: Date | null) => (value ? startOfDay(value) : null);

export const getTransactionDate = (transaction: Transaction): Date | null => {
    return toDate(transaction.date);
};

export const calculateFinanceTotals = (transactions: Transaction[]): FinanceTotals => {
    const totals = transactions.reduce(
        (acc, transaction) => {
            const amount = Number(transaction.amount) || 0;
            if (transaction.type === 'income') {
                acc.income += amount;
            } else {
                acc.expenses += amount;
            }
            return acc;
        },
        { income: 0, expenses: 0 }
    );

    return {
        income: totals.income,
        expenses: totals.expenses,
        net: totals.income - totals.expenses,
    };
};

export const filterTransactions = (transactions: Transaction[], filters: FinanceFilters): Transaction[] => {
    const { startDate, endDate, categories = [], type = 'all', projectId = 'all' } = filters;
    const normalizedStart = normalizeToDay(startDate || null);
    const normalizedEnd = endDate ? endOfDay(endDate) : null;

    return transactions.filter((transaction) => {
        const transactionDate = getTransactionDate(transaction);

        if (type !== 'all' && transaction.type !== type) return false;

        if (categories.length > 0 && !categories.includes(transaction.category)) {
            return false;
        }

        if (projectId !== 'all') {
            if (projectId === '__unassigned__') {
                if (transaction.projectId) return false;
            } else if (transaction.projectId !== projectId) {
                return false;
            }
        }

        if (!transactionDate) return false;

        if (normalizedStart && normalizedEnd) {
            return isWithinInterval(transactionDate, { start: normalizedStart, end: normalizedEnd });
        }

        if (normalizedStart && isBefore(transactionDate, normalizedStart)) return false;
        if (normalizedEnd && isAfter(transactionDate, normalizedEnd)) return false;

        return true;
    });
};

export const sortTransactionsByDate = (transactions: Transaction[], direction: 'asc' | 'desc' = 'desc') => {
    return [...transactions].sort((a, b) => {
        const aDate = getTransactionDate(a)?.getTime() || 0;
        const bDate = getTransactionDate(b)?.getTime() || 0;
        return direction === 'asc' ? aDate - bDate : bDate - aDate;
    });
};

export const buildMonthlySeries = (transactions: Transaction[], locale?: Locale): MonthlySeriesPoint[] => {
    const buckets = new Map<string, MonthlySeriesPoint>();

    transactions.forEach((transaction) => {
        const date = getTransactionDate(transaction);
        if (!date) return;
        const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const key = format(monthDate, 'yyyy-MM');

        if (!buckets.has(key)) {
            buckets.set(key, {
                key,
                label: format(monthDate, 'MMM yyyy', { locale }),
                income: 0,
                expenses: 0,
                date: monthDate,
            });
        }

        const entry = buckets.get(key);
        if (!entry) return;
        const amount = Number(transaction.amount) || 0;
        if (transaction.type === 'income') {
            entry.income += amount;
        } else {
            entry.expenses += amount;
        }
    });

    return Array.from(buckets.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const buildOccurrenceKey = (recurringId: string, date: Date) => {
    return `${recurringId}__${format(date, 'yyyy-MM-dd')}`;
};

const incrementDate = (date: Date, frequency: RecurringFrequency) => {
    switch (frequency) {
        case 'daily':
            return addDays(date, 1);
        case 'weekly':
            return addWeeks(date, 1);
        case 'yearly':
            return addYears(date, 1);
        case 'monthly':
        default:
            return addMonths(date, 1);
    }
};

export const generateRecurringOccurrences = (
    recurring: RecurringTransaction,
    options?: {
        untilDate?: Date;
        maxOccurrences?: number;
    }
): Date[] => {
    const start = toDate(recurring.startDate);
    if (!start) return [];

    const until = options?.untilDate || new Date();
    const endDate = recurring.endDate ? toDate(recurring.endDate) : null;
    const finalDate = endDate && isBefore(endDate, until) ? endDate : until;

    const occurrences: Date[] = [];
    let current = startOfDay(start);
    const max = options?.maxOccurrences ?? MAX_OCCURRENCES;

    while (!isAfter(current, finalDate) && occurrences.length < max) {
        occurrences.push(current);
        current = incrementDate(current, recurring.frequency);
    }

    return occurrences;
};
