/**
 * Purchase page backend: Firebase Auth (same project as the app) + billing callables in europe-west3.
 * `?mock=1` swaps everything for an in-memory demo (no account, no payment) – shown with a banner.
 * Callable contract: see brain/plans/landing-purchase.md (agreed with the billing session).
 */
import type { Auth, User } from 'firebase/auth';
import type { Functions } from 'firebase/functions';

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
export type OAuthKind = 'google' | 'apple' | 'github';

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
    /** Set when the request created a pending new workspace (it only exists once the card is saved). */
    tenantId?: string;
    subscriptionId: string;
    clientSecret: string;
    /** 'none' = an existing subscription was changed and the card on file was charged; nothing to confirm. */
    intentType: 'payment' | 'setup' | 'none';
    trialEnd?: string | number | null;
    summary?: { currency: string; lines: SummaryLine[]; subtotal: number; discount?: number; tax?: number; total?: number; amountDue?: number; trialEnd?: string | number | null };
}

export interface SubscriptionStatus { status: string; plan?: string; active?: boolean }

export interface BuyApi {
    mock: boolean;
    onUser(cb: (user: BuyUser | null) => void): void;
    signIn(email: string, password: string): Promise<void>;
    register(name: string, email: string, password: string): Promise<void>;
    oauth(kind: OAuthKind): Promise<void>;
    reset(email: string): Promise<void>;
    signOut(): Promise<void>;
    publishableKey(): Promise<string>;
    workspaces(language: string): Promise<Workspace[]>;
    createTeam(name: string, language: string): Promise<string>;
    /** `newWorkspace` instead of `tenantId`: the backend reserves the workspace and creates it after card saving. */
    intent(input: { tenantId?: string; newWorkspace?: { name: string; language?: string }; plan: Plan; interval: Interval; seats?: number; language: string }): Promise<Intent>;
    status(tenantId: string, plan: Plan): Promise<SubscriptionStatus>;
    /** Checkout consent (AGB + early start, § 356 Abs. 4 BGB); must succeed before the payment is confirmed. */
    consent(subscriptionId: string, language: string): Promise<void>;
}

const toUser = (u: { uid: string; email: string | null; displayName: string | null } | null): BuyUser | null =>
    (u ? { uid: u.uid, email: u.email, name: u.displayName } : null);

/**
 * Firebase is loaded after the page has rendered (it is ~200 kB): the plan step needs none of it, and by the time
 * someone signs in it is ready. Every method waits for the same load.
 */
function firebaseApi(): BuyApi {
    const load = (async () => {
        await new Promise<void>((resolve) => {
            if (document.readyState === 'complete') resolve();
            else window.addEventListener('load', () => resolve(), { once: true });
        });
        const [appMod, authMod, fnMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/functions')]);
        const app = appMod.initializeApp(firebaseConfig);
        const auth: Auth = authMod.getAuth(app);
        void authMod.setPersistence(auth, authMod.browserLocalPersistence);
        const fns: Functions = fnMod.getFunctions(app, 'europe-west3');
        return { auth, fns, a: authMod, f: fnMod };
    })();
    const call = async <T>(name: string, data: unknown = {}) => {
        const { fns, f } = await load;
        return (await f.httpsCallable(fns, name)(data)).data as T;
    };
    return {
        mock: false,
        onUser: (cb) => { void load.then(({ auth, a }) => a.onAuthStateChanged(auth, (u: User | null) => cb(toUser(u)))); },
        signIn: async (email, password) => { const { auth, a } = await load; await a.signInWithEmailAndPassword(auth, email, password); },
        register: async (name, email, password) => {
            const { auth, a } = await load;
            const cred = await a.createUserWithEmailAndPassword(auth, email, password);
            if (name) await a.updateProfile(cred.user, { displayName: name });
        },
        // Same providers as the app (Firebase Auth → Sign-in method): Google, Apple, GitHub.
        oauth: async (kind) => {
            const { auth, a } = await load;
            let provider: InstanceType<typeof a.GoogleAuthProvider> | InstanceType<typeof a.GithubAuthProvider> | InstanceType<typeof a.OAuthProvider>;
            if (kind === 'google') provider = new a.GoogleAuthProvider();
            else if (kind === 'github') provider = new a.GithubAuthProvider();
            else {
                provider = new a.OAuthProvider('apple.com');
                provider.addScope('email');
                provider.addScope('name');
            }
            await a.signInWithPopup(auth, provider);
        },
        reset: async (email) => { const { auth, a } = await load; await a.sendPasswordResetEmail(auth, email); },
        signOut: async () => { const { auth, a } = await load; await a.signOut(auth); },
        publishableKey: async () => (await call<{ publishableKey: string }>('getBillingConfig')).publishableKey,
        workspaces: async (language) => {
            const res = await call<Workspace[] | { workspaces: Workspace[] }>('listBillingWorkspaces', { language });
            return Array.isArray(res) ? res : res.workspaces;
        },
        createTeam: async (name, language) => (await call<{ tenantId: string }>('createTeamWorkspace', { name, language })).tenantId,
        // Personal targets the caller's own personal workspace (`personal: true`), Team a workspace they own.
        intent: ({ tenantId, newWorkspace, ...rest }) => call<Intent>('createSubscriptionIntent',
            rest.plan === 'personal' ? { personal: true, ...rest } : newWorkspace ? { newWorkspace, ...rest } : { tenantId, ...rest }),
        status: (tenantId, plan) => call<SubscriptionStatus>('getSubscriptionStatus', plan === 'personal' ? { personal: true } : { tenantId }),
        consent: async (subscriptionId, language) => {
            await call('recordCheckoutConsent', { subscriptionId, terms: true, earlyStart: true, lang: language });
        },
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
        oauth: async () => { await wait(); set({ uid: 'demo', email: 'demo@example.com', name: 'Demo' }); },
        reset: async () => { await wait(); },
        signOut: async () => { set(null); },
        publishableKey: async () => '',
        workspaces: async () => { await wait(); return spaces; },
        createTeam: async (name) => { await wait(); spaces.push({ tenantId: 'team_new', name, workspaceType: 'team', status: 'trialing', memberCount: 1, trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString() }); return 'team_new'; },
        intent: async ({ tenantId: id, newWorkspace, plan, interval, seats: wanted }) => {
            await wait();
            // Pending new workspace: appears in the list as if the webhook had created it after card saving.
            const tenantId = newWorkspace ? 'team_new' : id ?? '';
            if (newWorkspace && !spaces.some((w) => w.tenantId === tenantId)) {
                spaces.push({ tenantId, name: newWorkspace.name, workspaceType: 'team', status: 'trialing', memberCount: 1, trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString() });
            }
            const ws = spaces.find((w) => w.tenantId === tenantId);
            const seats = plan === 'team' ? Math.max(wanted ?? 1, ws?.memberCount ?? 1) : 1;
            const unit = plan === 'team' ? (interval === 'year' ? 120 : 12) : (interval === 'year' ? 48 : 5);
            const lines: SummaryLine[] = [{ label: plan === 'team' ? 'Team' : 'Personal', quantity: seats, unitAmount: unit * 100, amount: unit * seats * 100 }];
            const trialing = ws?.status === 'trialing';
            const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
            return {
                tenantId, subscriptionId: 'sub_demo', clientSecret: 'demo', intentType: trialing ? 'setup' : 'payment',
                summary: { currency: 'eur', lines, subtotal, total: subtotal, amountDue: trialing ? 0 : subtotal, trialEnd: trialing ? ws?.trialEndsAt : null },
            };
        },
        status: async () => { await wait(800); return { status: 'active', active: true }; },
        consent: async () => { await wait(200); },
    };
}

export const createApi = (): BuyApi => (new URLSearchParams(location.search).has('mock') ? mockApi() : firebaseApi());
