import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, updateProfile, getMultiFactorResolver, TotpMultiFactorGenerator } from 'firebase/auth';
import { auth } from '../services/firebase';
import { bootstrapTenantForCurrentUser, getActiveTenantId } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../context/LanguageContext';

export const Login = () => {
    const { t } = useLanguage();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mfaResolver, setMfaResolver] = useState<any>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [showMfaStep, setShowMfaStep] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Get redirect URL from query param OR from location.state
    const redirectUrl = searchParams.get('redirect') || (location.state as any)?.from?.pathname || '/';

    useEffect(() => {
        // If already logged in AND we have a redirect that isn't the current page, redirect now
        if (auth.currentUser && redirectUrl !== window.location.pathname) {
            handleAuthSuccess();
        }
    }, [auth.currentUser, redirectUrl]);

    useEffect(() => {
        const inviteTenant = (location.state as any)?.inviteTenantId || getActiveTenantId();
        if (inviteTenant || searchParams.get('redirect')) {
            setIsRegister(true);
        }
    }, [location.state, searchParams]);

    const handleAuthSuccess = async () => {
        // If we have a complex redirect URL (with search params), we need to extract the path and search
        if (redirectUrl.startsWith('http')) {
            // It's a full URL, but we want to navigate within the app
            try {
                const url = new URL(redirectUrl);
                navigate(url.pathname + url.search);
            } catch (e) {
                navigate('/');
            }
        } else {
            navigate(redirectUrl);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isRegister) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (name) await updateProfile(userCredential.user, { displayName: name });
                const inviteTenant = (location.state as any)?.inviteTenantId;
                await bootstrapTenantForCurrentUser(inviteTenant || undefined, true);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
                await bootstrapTenantForCurrentUser();
            }
            await handleAuthSuccess();
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/multi-factor-auth-required') {
                const resolver = getMultiFactorResolver(auth, err);
                setMfaResolver(resolver);
                setShowMfaStep(true);
            } else if (err.code === 'auth/invalid-credential') {
                setError("Invalid email or password. Please double-check your credentials.");
            } else {
                setError(err.message || t('login.error.generic'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleMfaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaResolver || !mfaCode) return;
        setError('');
        setIsLoading(true);

        try {
            const hint = mfaResolver.hints[0];
            const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode);
            await mfaResolver.resolveSignIn(assertion);
            await bootstrapTenantForCurrentUser();
            await handleAuthSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Invalid 2FA code. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            await bootstrapTenantForCurrentUser();
            await handleAuthSuccess();
        } catch (err) {
            console.error(err);
            setError(t('login.error.google'));
        }
    };

    const handleGithubSignIn = async () => {
        try {
            const provider = new GithubAuthProvider();
            await signInWithPopup(auth, provider);
            await bootstrapTenantForCurrentUser();
            await handleAuthSuccess();
        } catch (err) {
            console.error(err);
            setError(t('login.error.github'));
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-[var(--color-surface-bg)] text-[var(--color-text-main)] font-sans">
            {/* Left Side - Brand (Monochrome) */}
            <div className="hidden lg:flex w-1/2 p-12 bg-zinc-950 text-white relative overflow-hidden flex-col justify-between border-r border-zinc-900">
                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
                />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="size-10 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                            PF
                        </div>
                        <span className="font-bold text-xl tracking-tight">ProjectFlow</span>
                    </div>
                </div>

                <div className="relative z-10 max-w-lg">
                    <h1 className="text-6xl font-extrabold tracking-tighter leading-tight mb-6">
                        {t('login.hero.line1')}<br />{t('login.hero.line2')}<br />{t('login.hero.line3')}
                    </h1>
                    <p className="text-xl text-zinc-400 font-light leading-relaxed mb-12">
                        {t('login.hero.subtitle')}
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 size-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                                <span className="material-symbols-outlined text-sm">check</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{t('login.hero.feature.tasks.title')}</h3>
                                <p className="text-zinc-500 text-sm">{t('login.hero.feature.tasks.detail')}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="mt-1 size-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                                <span className="material-symbols-outlined text-sm">hub</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{t('login.hero.feature.flows.title')}</h3>
                                <p className="text-zinc-500 text-sm">{t('login.hero.feature.flows.detail')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-xs text-zinc-600 uppercase tracking-widest">
                    &copy; 2024 ProjectFlow Scorp.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-[var(--color-surface-bg)]">
                <div className="w-full max-w-sm space-y-8">
                    {!showMfaStep ? (
                        <>
                            <div className="text-center md:text-left">
                                <h2 className="text-3xl font-bold tracking-tight mb-2 text-[var(--color-text-main)]">
                                    {isRegister ? t('login.heading.register') : t('login.heading.login')}
                                </h2>
                                <p className="text-[var(--color-text-muted)]">
                                    {isRegister ? t('login.subheading.register') : t('login.subheading.login')}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {isRegister && (
                                    <Input label={t('login.label.fullName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('login.placeholder.fullName')} />
                                )}
                                <Input label={t('login.label.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.placeholder.email')} />
                                <Input label={t('login.label.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

                                {error && (
                                    <div className="p-3 rounded bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-medium flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">error</span>
                                        {error}
                                    </div>
                                )}

                                <Button type="submit" loading={isLoading} variant="primary" className="w-full h-12 text-base shadow-xl">
                                    {isRegister ? t('login.action.createAccount') : t('login.action.signIn')}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="text-center md:text-left">
                                <h2 className="text-3xl font-bold tracking-tight mb-2 text-[var(--color-text-main)]">
                                    Verify your identity
                                </h2>
                                <p className="text-[var(--color-text-muted)]">
                                    Enter the 6-digit code from your authenticator app.
                                </p>
                            </div>

                            <form onSubmit={handleMfaSubmit} className="space-y-5">
                                <Input
                                    label="Security Code"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000 000"
                                    className="text-center text-2xl tracking-[0.5em] font-mono"
                                    autoFocus
                                />

                                {error && (
                                    <div className="p-3 rounded bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-medium flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">error</span>
                                        {error}
                                    </div>
                                )}

                                <Button type="submit" loading={isLoading} variant="primary" className="w-full h-12 text-base shadow-xl" disabled={mfaCode.length !== 6}>
                                    Verify & Sign In
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => { setShowMfaStep(false); setMfaCode(''); setMfaResolver(null); }}
                                    className="w-full text-sm font-bold text-[var(--color-primary)] hover:underline"
                                >
                                    Back to Login
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="relative flex items-center justify-center py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-surface-border)]"></div></div>
                        <div className="relative bg-[var(--color-surface-bg)] px-4 text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">{t('login.divider.orContinue')}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleGoogleSignIn} className="flex items-center justify-center gap-2 h-12 rounded-xl border border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-all font-medium text-sm text-[var(--color-text-main)]">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                            Google
                        </button>
                        <button onClick={handleGithubSignIn} className="flex items-center justify-center gap-2 h-12 rounded-xl border border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-all font-medium text-sm text-[var(--color-text-main)]">
                            {/* In dark mode, github icon needs inversion if it's black. SVG is usually black. */}
                            <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-5 h-5 dark:invert" alt="GitHub" />
                            GitHub
                        </button>
                    </div>

                    <p className="text-center text-sm text-[var(--color-text-muted)] mt-8">
                        {isRegister ? t('login.toggle.hasAccount') : t('login.toggle.newToProjectFlow')}
                        <button onClick={() => { setIsRegister(!isRegister); setError(''); }} className="ml-1 font-bold text-[var(--color-primary)] hover:underline">
                            {isRegister ? t('login.toggle.logIn') : t('login.toggle.createAccount')}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
