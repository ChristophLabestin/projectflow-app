/**
 * Purchase page backend: Firebase Auth (same project as the app) + billing callables in europe-west3.
 * `?mock=1` swaps everything for an in-memory demo (no account, no payment) – shown with a banner.
 * Callable contract: see brain/plans/landing-purchase.md (agreed with the billing session).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
    browserLocalPersistence, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged,
    sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
    type Auth,
} from 'firebase/auth';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';

// Public web config of the Firebase project (the same values ship in the app bundle).
const firebaseConfig = {
    apiKey: 'AIzaSyB8BfEJ_Zwd7B35OVzcIPM4opgy3OUWZm4',
    authDomain: 'projectflow-labestin.firebaseapp.com',
    projectId: 'projectflow-labestin',
    storageBucket: 'projectflow-labestin.firebasestorage.app',
    messagingSenderId: '11139679569',
    appId: '1:11139679569:web:cbe0ba834a8dd97715bf70',
};

export type Plan = 'personal' | 'team';
export type Interval = 'month' | 'year';

export interface BuyUser { uid: string; email: string | null; name: string | null }
export interface Workspace {
    tenantId: string;
    name: string;
    workspaceType: 'personal' | 'team';
    status?: string;
    plan?: string;
    memberCount?: number;
    trialEndsAt?: string | number | null;
    hasSubscription?: boolean;
    billingExempt?: boolean;
}
export interface SummaryLine { label: string; quantity: number; unitAmount: number; amount: number }
export interface Intent {
    subscriptionId: string;
    clientSecret: string;
    /** 'none' = an existing subscription was changed and the card on file was charged; nothing to confirm. */
    intentType: 'payment' | 'setup' | 'none';
    trialEnd?: string | number | null;
    summary?: { currency: string; lines: SummaryLine[]; subtotal: number; total?: number; amountDue?: number; trialEnd?: string | number | null };
}

export interface SubscriptionStatus { status: string; plan?: string; active?: boolean }

export interface BuyApi {
    mock: boolean;
    onUser(cb: (user: BuyUser | null) => void): void;
    signIn(email: string, password: string): Promise<void>;
    register(name: string, email: string, password: string): Promise<void>;
    google(): Promise<void>;
    reset(email: string): Promise<void>;
    signOut(): Promise<void>;
    publishableKey(): Promise<string>;
    workspaces(language: string): Promise<Workspace[]>;
    createTeam(name: string, language: string): Promise<string>;
    intent(input: { tenantId: string; plan: Plan; interval: Interval; aiAddon: boolean; language: string }): Promise<Intent>;
    status(tenantId: string, plan: Plan): Promise<SubscriptionStatus>;
}

const toUser = (u: { uid: string; email: string | null; displayName: string | null } | null): BuyUser | null =>
    (u ? { uid: u.uid, email: u.email, name: u.displayName } : null);

function firebaseApi(): BuyApi {
    const app: FirebaseApp = initializeApp(firebaseConfig);
    const auth: Auth = getAuth(app);
    void setPersistence(auth, browserLocalPersistence);
    const fns: Functions = getFunctions(app, 'europe-west3');
    const call = async <T>(name: string, data: unknown = {}) => (await httpsCallable(fns, name)(data)).data as T;
    return {
        mock: false,
        onUser: (cb) => onAuthStateChanged(auth, (u) => cb(toUser(u))),
        signIn: async (email, password) => { await signInWithEmailAndPassword(auth, email, password); },
        register: async (name, email, password) => {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (name) await updateProfile(cred.user, { displayName: name });
        },
        google: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
        reset: (email) => sendPasswordResetEmail(auth, email),
        signOut: () => signOut(auth),
        publishableKey: async () => (await call<{ publishableKey: string }>('getBillingConfig')).publishableKey,
        workspaces: async (language) => {
            const res = await call<Workspace[] | { workspaces: Workspace[] }>('listBillingWorkspaces', { language });
            return Array.isArray(res) ? res : res.workspaces;
        },
        createTeam: async (name, language) => (await call<{ tenantId: string }>('createTeamWorkspace', { name, language })).tenantId,
        // Personal targets the caller's own personal workspace (`personal: true`), Team a workspace they own.
        intent: ({ tenantId, ...rest }) => call<Intent>('createSubscriptionIntent', rest.plan === 'personal' ? { personal: true, ...rest } : { tenantId, ...rest }),
        status: (tenantId, plan) => call<SubscriptionStatus>('getSubscriptionStatus', plan === 'personal' ? { personal: true } : { tenantId }),
    };
}

/** In-memory demo for design reviews: no network, no account, no payment. */
function mockApi(): BuyApi {
    let user: BuyUser | null = null;
    let listener: (u: BuyUser | null) => void = () => {};
    const wait = (ms = 450) => new Promise((r) => window.setTimeout(r, ms));
    const set = (u: BuyUser | null) => { user = u; listener(u); };
    const trial = new Date(Date.now() + 12 * 864e5).toISOString();
    const spaces: Workspace[] = [
        { tenantId: 'personal_demo', name: 'Persönlich', workspaceType: 'personal', status: 'free', memberCount: 1 },
        { tenantId: 'team_demo', name: 'Labestin Studio', workspaceType: 'team', status: 'trialing', memberCount: 4, trialEndsAt: trial },
    ];
    return {
        mock: true,
        onUser: (cb) => { listener = cb; cb(user); },
        signIn: async (email) => { await wait(); set({ uid: 'demo', email, name: null }); },
        register: async (name, email) => { await wait(); set({ uid: 'demo', email, name }); },
        google: async () => { await wait(); set({ uid: 'demo', email: 'demo@example.com', name: 'Demo' }); },
        reset: async () => { await wait(); },
        signOut: async () => { set(null); },
        publishableKey: async () => '',
        workspaces: async () => { await wait(); return spaces; },
        createTeam: async (name) => { await wait(); spaces.push({ tenantId: 'team_new', name, workspaceType: 'team', status: 'trialing', memberCount: 1, trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString() }); return 'team_new'; },
        intent: async ({ tenantId, plan, interval, aiAddon }) => {
            await wait();
            const ws = spaces.find((w) => w.tenantId === tenantId);
            const seats = plan === 'team' ? ws?.memberCount ?? 1 : 1;
            const unit = plan === 'team' ? (interval === 'year' ? 120 : 12) : (interval === 'year' ? 48 : 5);
            const ai = interval === 'year' ? 120 : 10;
            const lines: SummaryLine[] = [{ label: plan === 'team' ? 'Team' : 'Personal', quantity: seats, unitAmount: unit * 100, amount: unit * seats * 100 }];
            if (aiAddon) lines.push({ label: 'KI-Paket', quantity: 1, unitAmount: ai * 100, amount: ai * 100 });
            const trialing = ws?.status === 'trialing';
            const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
            return {
                subscriptionId: 'sub_demo', clientSecret: 'demo', intentType: trialing ? 'setup' : 'payment',
                summary: { currency: 'eur', lines, subtotal, total: subtotal, amountDue: trialing ? 0 : subtotal, trialEnd: trialing ? ws?.trialEndsAt : null },
            };
        },
        status: async () => { await wait(800); return { status: 'active', active: true }; },
    };
}

export const createApi = (): BuyApi => (new URLSearchParams(location.search).has('mock') ? mockApi() : firebaseApi());
