import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, updateProfile, getMultiFactorResolver, TotpMultiFactorGenerator, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../services/firebase';
import { bootstrapTenantForCurrentUser, getActiveTenantId } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../context/LanguageContext';
import { loginWithPasskey, shouldAutoPrompt } from '../services/passkeyService';

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
        const isRegisterMode = location.pathname.endsWith('/register') || searchParams.get('mode') === 'register';

        if (inviteTenant || searchParams.get('redirect') || isRegisterMode) {
            setIsRegister(true);
        }
    }, [location.state, searchParams, location.pathname]);

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


    const handlePasskeySignIn = async (isAuto = false) => {
        setIsLoading(true);
        if (!isAuto) setError(''); // Only clear error on manual attempt
        try {
            const token = await loginWithPasskey(email);
            await signInWithCustomToken(auth, token);
            await bootstrapTenantForCurrentUser();
            await handleAuthSuccess();
        } catch (e: any) {
            console.error(e);
            // If auto-prompt and user cancelled, don't show error
            const isCancellation = e.name === 'NotAllowedError' || e.message.includes('The operation was canceled');

            if (isAuto && isCancellation) {
                // Just stop loading, user wants to use password
                setIsLoading(false);
                return;
            }

            setError(e.message || t('passkey.login.error'));
        } finally {
            // If manual or successful, stop loading. If auto-cancelled, we stopped above.
            setIsLoading(false);
        }
    };

    // Auto-prompt effect
    useEffect(() => {
        // Only auto-prompt if checking for login, not register, and not already redirected
        if (!isRegister && !auth.currentUser && !showMfaStep && shouldAutoPrompt()) {
            handlePasskeySignIn(true);
        }
    }, [isRegister]); // Run once on mount/mode switch if conditions met

    return (
        <div className="login-page">
            {/* Left Side - Brand (Monochrome) */}
            <div className="login-brand-side">
                {/* Subtle Grid Pattern */}
                {/* Subtle Grid Pattern */}
                <div className="grid-pattern" />

                <div className="brand-header">
                    <div className="brand-logo">
                        PF
                    </div>
                    <span>ProjectFlow</span>
                </div>

                <div className="brand-hero">
                    <h1>
                        {t('login.hero.line1')}<br />{t('login.hero.line2')}<br />{t('login.hero.line3')}
                    </h1>
                    <p>
                        {t('login.hero.subtitle')}
                    </p>

                    <div className="brand-features">
                        <div className="brand-feature-item">
                            <div className="icon">
                                <span className="material-symbols-outlined">check</span>
                            </div>
                            <div>
                                <h3>{t('login.hero.feature.tasks.title')}</h3>
                                <p>{t('login.hero.feature.tasks.detail')}</p>
                            </div>
                        </div>
                        <div className="brand-feature-item">
                            <div className="icon">
                                <span className="material-symbols-outlined">hub</span>
                            </div>
                            <div>
                                <h3>{t('login.hero.feature.flows.title')}</h3>
                                <p>{t('login.hero.feature.flows.detail')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="brand-footer">
                    &copy; 2024 ProjectFlow Scorp.
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="login-form-side">
                <div className="login-form-container">
                    {!showMfaStep ? (
                        <>
                            <div className="form-header">
                                <h2>
                                    {isRegister ? t('login.heading.register') : t('login.heading.login')}
                                </h2>
                                <p>
                                    {isRegister ? t('login.subheading.register') : t('login.subheading.login')}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                                <div className="alert-box warning">
                                    <span className="material-symbols-outlined">warning</span>
                                    <span>{t('login.warning.preBeta')}</span>
                                </div>

                                {isRegister && (
                                    <div className="alert-box error">
                                        <span className="material-symbols-outlined">block</span>
                                        <span>Registration is currently disabled. Please contact support if you need an account.</span>
                                    </div>
                                )}

                                {isRegister && (
                                    <Input label={t('login.label.fullName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('login.placeholder.fullName')} disabled={true} />
                                )}
                                <Input label={t('login.label.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.placeholder.email')} disabled={isRegister} />
                                <Input label={t('login.label.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={isRegister} />

                                {error && (
                                    <div className="alert-box error">
                                        <span className="material-symbols-outlined">error</span>
                                        {error}
                                    </div>
                                )}

                                <Button type="submit" loading={isLoading} variant="primary" className="btn-submit" disabled={isRegister || isLoading}>
                                    {isRegister ? t('login.action.createAccount') : t('login.action.signIn')}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="form-header">
                                <h2>
                                    Verify your identity
                                </h2>
                                <p>
                                    Enter the 6-digit code from your authenticator app.
                                </p>
                            </div>

                            <form onSubmit={handleMfaSubmit} className="space-y-5">
                                <Input
                                    label="Security Code"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000 000"
                                    className="input-mfa"
                                    autoFocus
                                />

                                {error && (
                                    <div className="alert-box error">
                                        <span className="material-symbols-outlined">error</span>
                                        {error}
                                    </div>
                                )}

                                <Button type="submit" loading={isLoading} variant="primary" className="btn-submit" disabled={mfaCode.length !== 6}>
                                    Verify & Sign In
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => { setShowMfaStep(false); setMfaCode(''); setMfaResolver(null); }}
                                    className="btn-text"
                                >
                                    Back to Login
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="login-divider">
                        <div className="line"></div>
                        <div className="text">{t('login.divider.orContinue')}</div>
                    </div>

                    {!isRegister && (
                        <Button
                            type="button"
                            variant="secondary"
                            className="btn-passkey"
                            onClick={handlePasskeySignIn}
                            disabled={isLoading}
                        >
                            <span className="material-symbols-outlined mr-2">fingerprint</span>
                            {t('passkey.login.action')}
                        </Button>
                    )}

                    {!isRegister && (
                        <div className="social-buttons">
                            <button onClick={handleGoogleSignIn} className="btn-social">
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                                Google
                            </button>
                            <button onClick={handleGithubSignIn} className="btn-social">
                                {/* In dark mode, github icon needs inversion if it's black. SVG is usually black. */}
                                <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="dark:invert" alt="GitHub" />
                                GitHub
                            </button>
                        </div>
                    )}

                    <p className="text-center text-sm text-[var(--color-text-muted)] mt-8">
                        {isRegister ? t('login.toggle.hasAccount') : t('login.toggle.newToProjectFlow')}
                        <button onClick={() => { setIsRegister(!isRegister); setError(''); }} className="toggle-link">
                            {isRegister ? t('login.toggle.logIn') : t('login.toggle.createAccount')}
                        </button>
                    </p>

                    <div className="login-footer-links">
                        <Link to="/legal/privacy">
                            {t('legal.nav.privacy')}
                        </Link>
                        <Link to="/legal/terms">
                            {t('legal.nav.terms')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
