import React, { useEffect, useMemo, useState } from 'react';
import { endOfDay, startOfDay, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
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
import { auth } from '../services/firebase';
import { getActiveTenantId } from '../services/domain/authService';
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
import type { RecurringFrequency, RecurringTransaction, Transaction, TransactionType } from '../types';
import {
    buildMonthlySeries,
    calculateFinanceTotals,
    filterTransactions,
    sortTransactionsByDate,
} from '../utils/finance';
import { toDate } from '../utils/time';

interface TransactionFormState {
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
    type: TransactionType;
    frequency: RecurringFrequency;
    startDate: Date | null;
    endDate: Date | null;
    category: string;
    amount: string;
    notes: string;
}

type ChartPeriod = 'today' | '3d' | '7d' | '30d' | '90d' | '3m' | '6m' | '12m' | 'ytd' | 'all' | 'custom';

const buildEmptyTransactionForm = (): TransactionFormState => ({
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
    type: 'expense',
    frequency: 'monthly',
    startDate: new Date(),
    endDate: null,
    category: '',
    amount: '',
    notes: '',
});

export const FinanceTracking = () => {
    const { t, language, dateLocale, financeTranslationsReady, loadFinanceTranslations } = useLanguage();
    const { hasPermission, loading: permissionLoading } = usePermissions();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();

    const tenantId = getActiveTenantId() || auth?.currentUser?.uid || null;
    const canView = hasPermission('tenant.finance.view');
    const canManage = hasPermission('tenant.finance.manage');

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
    const [transactionsLoaded, setTransactionsLoaded] = useState(false);
    const [recurringLoaded, setRecurringLoaded] = useState(false);

    const [filters, setFilters] = useState({
        startDate: null as Date | null,
        endDate: null as Date | null,
        type: 'all' as TransactionType | 'all',
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

    const locale = language === 'de' ? 'de-DE' : 'en-US';
    const currencyCode = t('finance.currencyCode');

    useEffect(() => {
        void loadFinanceTranslations();
    }, [loadFinanceTranslations]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 2,
        }).format(value);
    };

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
        if (!tenantId || !canManage) return;
        if (!transactionsLoaded || !recurringLoaded) return;

        generateMissingRecurringTransactions(recurringTransactions, transactions, tenantId).catch((error) => {
            console.error('Failed to generate recurring transactions', error);
        });
    }, [tenantId, canManage, transactionsLoaded, recurringLoaded, recurringTransactions, transactions]);

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

    const frequencyOptions: SelectOption[] = [
        { label: t('finance.frequency.daily'), value: 'daily' },
        { label: t('finance.frequency.weekly'), value: 'weekly' },
        { label: t('finance.frequency.monthly'), value: 'monthly' },
        { label: t('finance.frequency.yearly'), value: 'yearly' },
    ];

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
                    type: transactionForm.type,
                    date: transactionForm.date,
                    category: transactionForm.category.trim(),
                    amount: amountValue,
                    notes: transactionForm.notes.trim(),
                }, tenantId || undefined);
                showSuccess(t('finance.toast.updated'));
            } else if (transactionForm.isRecurring) {
                const recurringId = await createRecurringTransaction({
                    type: transactionForm.type,
                    frequency: transactionForm.frequency,
                    startDate: transactionForm.date,
                    endDate: transactionForm.endDate,
                    category: transactionForm.category.trim(),
                    amount: amountValue,
                    notes: transactionForm.notes.trim(),
                }, tenantId || undefined);

                await createTransaction({
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
            t('finance.table.category'),
            t('finance.table.amount'),
            t('finance.table.type'),
            t('finance.table.notes')
        ];

        const rows = filteredTransactions.map((transaction) => [
            toDate(transaction.date)?.toLocaleDateString(locale) || '',
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
                    <Button variant="secondary" onClick={openNewRecurringModal} disabled={!canManage}>
                        {t('finance.actions.addRecurring')}
                    </Button>
                    <Button variant="primary" onClick={openNewTransactionModal} disabled={!canManage}>
                        {t('finance.actions.addTransaction')}
                    </Button>
                </div>
            </div>

            <div className="finance-summary">
                <Card className="finance-summary-card finance-summary-card--income">
                    <div className="finance-summary-card__header">
                        <div className="finance-summary-card__label">{t('finance.summary.income')}</div>
                        <div className="finance-summary-card__icon">
                            <span className="material-symbols-outlined">trending_up</span>
                        </div>
                    </div>
                    <div className="finance-summary-card__value">{formatCurrency(totals.income)}</div>
                </Card>
                <Card className="finance-summary-card finance-summary-card--expense">
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

            <div className="finance-panels">
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
                            <ResponsiveContainer width="100%" height={240}>
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
                                    setFilters({ startDate: null, endDate: null, type: 'all', categories: [], search: '' });
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
            </div>

            <div className="finance-panels">
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
            </div>

            <Card className="finance-panel">
                <div className="finance-panel__header">
                    <h3 className="h3">{t('finance.table.title')}</h3>
                    <span className="text-muted">{t('finance.table.subtitle')}</span>
                </div>

                <div className="finance-table">
                    <div className="finance-table__header">
                        <span>{t('finance.table.date')}</span>
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
                                    className="finance-table__row"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <span>{transactionDate ? transactionDate.toLocaleDateString(locale) : '-'}</span>
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
            </Card>

            <Card className="finance-panel">
                <div className="finance-panel__header">
                    <h3 className="h3">{t('finance.recurring.title')}</h3>
                    <span className="text-muted">{t('finance.recurring.subtitle')}</span>
                </div>
                <div className="finance-table">
                    <div className="finance-table__header">
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
                                    className="finance-table__row"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
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
            </Card>

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
