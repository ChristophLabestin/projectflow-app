import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, updateProfile, getMultiFactorResolver, TotpMultiFactorGenerator, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../services/firebase';
import { bootstrapTenantForCurrentUser, getActiveTenantId } from '../services/dataService';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { useLanguage } from '../context/LanguageContext';
import { loginWithPasskey, shouldAutoPrompt } from '../services/passkeyService';
import './login.scss';

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
                setError(t('login.error.invalidCredentials'));
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
            setError(err.message || t('login.error.mfaInvalid'));
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
            <div className="login-page__hero">
                <div className="login-page__hero-content">
                    <div className="login-page__brand">
                        <div className="login-page__brand-mark">PF</div>
                        <span className="login-page__brand-name">{t('app.brand')}</span>
                    </div>

                    <div>
                        <h1 className="login-page__hero-title">
                            {t('login.hero.line1')}<br />{t('login.hero.line2')}<br />{t('login.hero.line3')}
                        </h1>
                        <p className="login-page__hero-subtitle">
                            {t('login.hero.subtitle')}
                        </p>

                        <div className="login-page__feature-list">
                            <div className="login-page__feature">
                                <div className="login-page__feature-icon">
                                    <span className="material-symbols-outlined">check</span>
                                </div>
                                <div>
                                    <h3 className="login-page__feature-title">{t('login.hero.feature.tasks.title')}</h3>
                                    <p className="login-page__feature-text">{t('login.hero.feature.tasks.detail')}</p>
                                </div>
                            </div>
                            <div className="login-page__feature">
                                <div className="login-page__feature-icon">
                                    <span className="material-symbols-outlined">hub</span>
                                </div>
                                <div>
                                    <h3 className="login-page__feature-title">{t('login.hero.feature.flows.title')}</h3>
                                    <p className="login-page__feature-text">{t('login.hero.feature.flows.detail')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="login-page__hero-footer">
                        {t('login.footer.copyright')}
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="login-page__panel">
                <div className="login-page__panel-inner">
                    {!showMfaStep ? (
                        <>
                            <div className="login-page__heading">
                                <h2 className="login-page__title">
                                    {isRegister ? t('login.heading.register') : t('login.heading.login')}
                                </h2>
                                <p className="login-page__subtitle">
                                    {isRegister ? t('login.subheading.register') : t('login.subheading.login')}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="login-page__form">
                                <div className="login-page__notice login-page__notice--warning">
                                    <span className="material-symbols-outlined">warning</span>
                                    <span>{t('login.warning.preBeta')}</span>
                                </div>

                                {isRegister && (
                                    <div className="login-page__notice login-page__notice--danger">
                                        <span className="material-symbols-outlined">block</span>
                                        <span>{t('login.warning.registrationDisabled')}</span>
                                    </div>
                                )}

                                {isRegister && (
                                    <TextInput
                                        label={t('login.label.fullName')}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t('login.placeholder.fullName')}
                                        disabled
                                    />
                                )}
                                <TextInput
                                    label={t('login.label.email')}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('login.placeholder.email')}
                                    disabled={isRegister}
                                />
                                <TextInput
                                    label={t('login.label.password')}
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('login.placeholder.password')}
                                    disabled={isRegister}
                                />

                                {error && (
                                    <div className="login-page__error">
                                        <span className="material-symbols-outlined">error</span>
                                        {error}
                                    </div>
                                )}

                                <Button type="submit" isLoading={isLoading} className="login-page__primary" disabled={isRegister || isLoading}>
                                    {isRegister ? t('login.action.createAccount') : t('login.action.signIn')}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="login-page__mfa">
                            <div className="login-page__heading">
                                <h2 className="login-page__title">{t('login.mfa.title')}</h2>
                                <p className="login-page__subtitle">{t('login.mfa.subtitle')}</p>
                            </div>

                            <form onSubmit={handleMfaSubmit} className="login-page__form">
                                <TextInput
                                    label={t('login.mfa.label')}
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder={t('login.mfa.placeholder')}
                                    style={{ textAlign: 'center', letterSpacing: '0.35em', fontSize: '1.5rem' }}
                                    autoFocus
                                />

                                {error && (
                                    <div className="login-page__error">
                                        <span className="material-symbols-outlined">error</span>
                                        {error}
                                    </div>
                                )}

                                <div className="login-page__mfa-actions">
                                    <Button type="submit" isLoading={isLoading} className="login-page__primary" disabled={mfaCode.length !== 6}>
                                        {t('login.mfa.submit')}
                                    </Button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowMfaStep(false); setMfaCode(''); setMfaResolver(null); }}
                                        className="login-page__ghost-button"
                                    >
                                        {t('login.mfa.back')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="login-page__divider">{t('login.divider.orContinue')}</div>

                    {!isRegister && (
                        <Button
                            type="button"
                            variant="secondary"
                            className="login-page__primary"
                            onClick={handlePasskeySignIn}
                            disabled={isLoading}
                            icon={<span className="material-symbols-outlined">fingerprint</span>}
                        >
                            {t('passkey.login.action')}
                        </Button>
                    )}

                    {!isRegister && (
                        <div className="login-page__social-grid">
                            <Button
                                type="button"
                                variant="secondary"
                                className="login-page__social-button"
                                onClick={handleGoogleSignIn}
                                icon={<img src="https://www.svgrepo.com/show/475656/google-color.svg" className="login-page__social-icon" alt={t('login.social.google')} />}
                            >
                                {t('login.social.google')}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                className="login-page__social-button"
                                onClick={handleGithubSignIn}
                                icon={<img src="https://www.svgrepo.com/show/512317/github-142.svg" className="login-page__social-icon login-page__social-icon--invert" alt={t('login.social.github')} />}
                            >
                                {t('login.social.github')}
                            </Button>
                        </div>
                    )}

                    <p className="login-page__toggle">
                        {isRegister ? t('login.toggle.hasAccount') : t('login.toggle.newToProjectFlow')}
                        <button onClick={() => { setIsRegister(!isRegister); setError(''); }}>
                            {isRegister ? t('login.toggle.logIn') : t('login.toggle.createAccount')}
                        </button>
                    </p>

                    <div className="login-page__legal-links">
                        <Link to="/legal/privacy">{t('legal.nav.privacy')}</Link>
                        <Link to="/legal/terms">{t('legal.nav.terms')}</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
