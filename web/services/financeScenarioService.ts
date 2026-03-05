import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { resolveTenantId } from './dataService';
import type { FinanceScenario } from '../types';
import { sanitizeFinanceCostItems } from '../utils/finance-calculations';

const TENANTS = 'tenants';
const FINANCE_SCENARIOS = 'financeScenarios';

const tenantFinanceScenariosCollection = (tenantId: string) =>
    collection(db, TENANTS, tenantId, FINANCE_SCENARIOS);

export const subscribeFinanceScenarios = (
    callback: (scenarios: FinanceScenario[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(tenantFinanceScenariosCollection(resolvedTenant), orderBy('updatedAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
        })) as FinanceScenario[];

        callback(results);
    });
};

type FinanceScenarioInput = Omit<FinanceScenario, 'id' | 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'> & {
    userId?: string;
};

export const createFinanceScenario = async (
    scenario: FinanceScenarioInput,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const userId = scenario.userId || auth.currentUser?.uid;

    if (!userId) {
        throw new Error('User not authenticated');
    }

    const payload = {
        ...scenario,
        projectId: scenario.projectId || undefined,
        tenantId: resolvedTenant,
        userId,
        fixedCostItems: sanitizeFinanceCostItems(scenario.fixedCostItems || []),
        variableCostItemsPerUnit: sanitizeFinanceCostItems(scenario.variableCostItemsPerUnit || []),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(tenantFinanceScenariosCollection(resolvedTenant), payload);
    return docRef.id;
};

export const updateFinanceScenario = async (
    scenarioId: string,
    updates: Partial<Omit<FinanceScenario, 'id' | 'tenantId' | 'userId'>>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, FINANCE_SCENARIOS, scenarioId);

    const payload: Record<string, any> = {
        ...updates,
        ...('projectId' in updates ? { projectId: updates.projectId || null } : {}),
        updatedAt: serverTimestamp(),
    };

    if (updates.fixedCostItems) {
        payload.fixedCostItems = sanitizeFinanceCostItems(updates.fixedCostItems);
    }
    if (updates.variableCostItemsPerUnit) {
        payload.variableCostItemsPerUnit = sanitizeFinanceCostItems(updates.variableCostItemsPerUnit);
    }

    await updateDoc(ref, payload);
};

export const deleteFinanceScenario = async (scenarioId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(db, TENANTS, resolvedTenant, FINANCE_SCENARIOS, scenarioId);
    await deleteDoc(ref);
};
