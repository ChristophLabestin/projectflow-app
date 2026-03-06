import { orderBy } from 'firebase/firestore';

import type {
    FinancePayment,
    FinanceSubscription,
    FinanceSubscriptionEvent,
} from '../../types';
import {
    FINANCE_V2_COLLECTIONS,
    callFinanceFunction,
    subscribeTenantFinanceCollection,
    withTenant,
} from './common';

export interface RecordPaymentInput {
    tenantId?: string;
    paymentDate: string;
    direction: 'incoming' | 'outgoing';
    amount: number;
    currencyCode?: string;
    bankAccountId?: string;
    customerId?: string;
    vendorId?: string;
    projectId?: string;
    notes?: string;
}

export interface AllocationInput {
    tenantId?: string;
    paymentId: string;
    targetType: 'invoice' | 'bill';
    targetId: string;
    amount: number;
}

export const subscribeFinancePayments = (
    callback: (rows: FinancePayment[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinancePayment>(
        FINANCE_V2_COLLECTIONS.payments,
        callback,
        tenantId,
        [orderBy('paymentDate', 'desc'), orderBy('createdAt', 'desc')]
    );
};

export const subscribeFinanceSubscriptions = (
    callback: (rows: FinanceSubscription[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceSubscription>(
        FINANCE_V2_COLLECTIONS.subscriptions,
        callback,
        tenantId,
        [orderBy('createdAt', 'desc')]
    );
};

export const subscribeFinanceSubscriptionEvents = (
    callback: (rows: FinanceSubscriptionEvent[]) => void,
    tenantId?: string
) => {
    return subscribeTenantFinanceCollection<FinanceSubscriptionEvent>(
        FINANCE_V2_COLLECTIONS.subscriptionEvents,
        callback,
        tenantId,
        [orderBy('createdAt', 'desc')]
    );
};

export const recordPayment = async (input: RecordPaymentInput) => {
    return callFinanceFunction('recordPayment', withTenant(input, input.tenantId));
};

export const allocatePayment = async (input: AllocationInput) => {
    return callFinanceFunction('allocatePayment', withTenant(input, input.tenantId));
};

export const unallocatePayment = async (input: AllocationInput) => {
    return callFinanceFunction('unallocatePayment', withTenant(input, input.tenantId));
};
