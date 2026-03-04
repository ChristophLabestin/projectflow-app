import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { resolveTenantId } from './dataService';
import type { RecurringTransaction, Transaction } from '../types';
import { buildOccurrenceKey, generateRecurringOccurrences } from '../utils/finance';
import { toDate } from '../utils/time';

const TENANTS = 'tenants';
const TRANSACTIONS = 'transactions';
const RECURRING_TRANSACTIONS = 'recurringTransactions';
const MAX_GENERATED_BATCH = 50;

const tenantTransactionsCollection = (tenantId: string) =>
    collection(db, TENANTS, tenantId, TRANSACTIONS);

const tenantRecurringCollection = (tenantId: string) =>
    collection(db, TENANTS, tenantId, RECURRING_TRANSACTIONS);

const coerceDate = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return Timestamp.fromDate(value);
    return value;
};

export const subscribeTransactions = (
    callback: (transactions: Transaction[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(tenantTransactionsCollection(resolvedTenant), orderBy('date', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
        })) as Transaction[];
        callback(results);
    });
};

export const subscribeRecurringTransactions = (
    callback: (transactions: RecurringTransaction[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(tenantRecurringCollection(resolvedTenant), orderBy('startDate', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
        })) as RecurringTransaction[];
        callback(results);
    });
};

type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'tenantId'> & { userId?: string };
type RecurringTransactionInput = Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'tenantId'> & { userId?: string };

export const createTransaction = async (
    transaction: TransactionInput,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const userId = transaction.userId || auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const payload = {
        ...transaction,
        tenantId: resolvedTenant,
        userId,
        date: coerceDate(transaction.date),
        notes: transaction.notes ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(tenantTransactionsCollection(resolvedTenant), payload);
    return docRef.id;
};

export const updateTransaction = async (
    transactionId: string,
    updates: Partial<Omit<Transaction, 'id' | 'tenantId' | 'userId'>>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, TRANSACTIONS, transactionId);

    await updateDoc(ref, {
        ...updates,
        ...(updates.date ? { date: coerceDate(updates.date) } : {}),
        updatedAt: serverTimestamp(),
    });
};

export const deleteTransaction = async (transactionId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, TRANSACTIONS, transactionId);
    await deleteDoc(ref);
};

export const createRecurringTransaction = async (
    transaction: RecurringTransactionInput,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const userId = transaction.userId || auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const payload = {
        ...transaction,
        tenantId: resolvedTenant,
        userId,
        startDate: coerceDate(transaction.startDate),
        endDate: transaction.endDate ? coerceDate(transaction.endDate) : null,
        notes: transaction.notes ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(tenantRecurringCollection(resolvedTenant), payload);
    return docRef.id;
};

export const updateRecurringTransaction = async (
    transactionId: string,
    updates: Partial<Omit<RecurringTransaction, 'id' | 'tenantId' | 'userId'>>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, RECURRING_TRANSACTIONS, transactionId);

    await updateDoc(ref, {
        ...updates,
        ...(updates.startDate ? { startDate: coerceDate(updates.startDate) } : {}),
        ...('endDate' in updates ? { endDate: updates.endDate ? coerceDate(updates.endDate) : null } : {}),
        updatedAt: serverTimestamp(),
    });
};

export const deleteRecurringTransaction = async (transactionId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, RECURRING_TRANSACTIONS, transactionId);
    await deleteDoc(ref);
};

export const generateMissingRecurringTransactions = async (
    recurringTransactions: RecurringTransaction[],
    existingTransactions: Transaction[],
    tenantId?: string
) => {
    if (recurringTransactions.length === 0) return;

    const resolvedTenant = resolveTenantId(tenantId);
    const existingKeys = new Set<string>();

    existingTransactions.forEach((transaction) => {
        if (!transaction.recurringId) return;
        const date = toDate(transaction.date);
        if (!date) return;
        existingKeys.add(buildOccurrenceKey(transaction.recurringId, date));
    });

    const batch = writeBatch(db);
    let pending = 0;

    recurringTransactions.forEach((recurring) => {
        const occurrences = generateRecurringOccurrences(recurring);
        occurrences.forEach((date) => {
            if (pending >= MAX_GENERATED_BATCH) return;
            const key = buildOccurrenceKey(recurring.id, date);
            if (existingKeys.has(key)) return;

            const ref = doc(tenantTransactionsCollection(resolvedTenant));
            batch.set(ref, {
                tenantId: resolvedTenant,
                userId: recurring.userId,
                type: recurring.type,
                date: Timestamp.fromDate(date),
                category: recurring.category,
                amount: recurring.amount,
                notes: recurring.notes || '',
                isRecurring: true,
                recurringId: recurring.id,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            existingKeys.add(key);
            pending += 1;
        });
    });

    if (pending > 0) {
        await batch.commit();
    }
};
