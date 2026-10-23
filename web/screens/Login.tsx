import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, type AuthProvider, getMultiFactorResolver, TotpMultiFactorGenerator, signInWithCustomToken } from 'firebase/auth';
import { sendVerificationEmail } from '../services/domain/emailVerification';
import { auth } from '../services/firebase';
import { Button } from '../components/common/Button/Button';
import { TextInput } from '../components/common/Input/TextInput';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { WorkspaceConnecting } from '../context/WorkspaceContext';
import { BrandGlyph } from '../components/brand/BrandMark';
import { FlowField } from '../components/brand/FlowField';
import { loginWithPasskey, preparePasskeyLogin, shouldAutoPrompt } from '../services/passkeyService';
import { getDesktopBridge, hasDesktopCapability, isDesktop, type DesktopAuthProvider } from '../services/desktop';
import { COMPANY_NAME } from '../config/company';
import { AppleLogo } from '../components/ui/AppleLogo';
import './login.scss';

const OAUTH_REDIRECT_KEY = 'pf.oauthRedirect';

export const Login = () => {
    const { t, authScreenTranslationsReady, loadAuthScreenTranslations } = useLanguage();
    const { user, isAuthReady } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mfaResolver, setMfaResolver] = useState<any>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [showMfaStep, setShowMfaStep] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Get redirect URL from query param OR from location.state
    const fromLocation = (location.state as any)?.from;
    // Keep the query (e.g. `?openSettings=account` from the desktop app) when coming back after sign-in.
    const requestedRedirect = searchParams.get('redirect') || (fromLocation?.pathname ? `${fromLocation.pathname}${fromLocation.search || ''}` : '');
    const redirectUrl = requestedRedirect || '/';
    const inviteTenantId = (location.state as any)?.inviteTenantId;
    const hasRedirectContext = requestedRedirect !== '' && requestedRedirect !== location.pathname;
    // Desktop app (Electron): no platform authenticator for passkeys and Google blocks embedded OAuth,
    // so only email/password (+ MFA) is offered there until the system-browser handoff exists.
    const isDesktopApp = isDesktop();
    const passkeyAvailable = authScreenTranslationsReady && !isRegister && !showMfaStep && !isDesktopApp && shouldAutoPrompt();

    useEffect(() => {
        void loadAuthScreenTranslations();
    }, [loadAuthScreenTranslations]);

    // Target to leave the login screen for once the auth context has the user.
    // Navigating before that bounced between /login and the app (the protected
    // layout still saw no user), which made sign-in flicker.
    const [pendingRedirect, setPendingRedirect] = useState<string | null>(() =>
        auth.currentUser && redirectUrl !== window.location.pathname ? redirectUrl : null);
    const isBusy = isLoading || pendingRedirect !== null;

    useEffect(() => {
        if (!pendingRedirect || !user) return;
        // Full URLs (with search params) are navigated within the app.
        if (pendingRedirect.startsWith('http')) {
            try {
                const url = new URL(pendingRedirect);
                navigate(url.pathname + url.search, { replace: true });
            } catch (e) {
                navigate('/', { replace: true });
            }
        } else {
            navigate(pendingRedirect, { replace: true });
        }
    }, [pendingRedirect, user, navigate]);

    useEffect(() => {
        const isRegisterMode = location.pathname.endsWith('/register') || searchParams.get('mode') === 'register';

        if (inviteTenantId || isRegisterMode) {
            setIsRegister(true);
            return;
        }

        setIsRegister(false);
    }, [inviteTenantId, location.state, searchParams, location.pathname]);

    // Desktop: OAuth providers run in the system browser and come back via projectflow://auth (DesktopBridge).
    const canSignInExternally = isDesktopApp && hasDesktopCapability('external-auth');
    const [browserSignInStarted, setBrowserSignInStarted] = useState(false);
    const handleBrowserSignIn = async (provider: DesktopAuthProvider) => {
        setError('');
        try {
            await getDesktopBridge()?.signInExternally?.(provider);
            setBrowserSignInStarted(true);
        } catch (err) {
            console.error(err);
            setError(t('login.desktop.browserFailed'));
        }
    };

    const handleAuthSuccess = async (target: string = redirectUrl) => {
        setPendingRedirect(target);
    };

    const createMfaResolver = (err: any) => {
        const serverResponse = err.customData?._serverResponse || err.customData?.serverResponse;
        const operationType = err.customData?.operationType || 'signIn';

        try {
            return getMultiFactorResolver(auth, err);
        } catch (resolverError) {
            if (!serverResponse) {
                throw resolverError;
            }

            return getMultiFactorResolver(auth, {
                code: 'auth/multi-factor-auth-required',
                message: err.message,
                name: 'FirebaseError',
                operationType,
                customData: {
                    operationType,
                    _serverResponse: serverResponse,
                    serverResponse,
                    appName: err.customData?.appName
                }
            } as any);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isRegister) {
                await createUserWithEmailAndPassword(auth, email, password);
                // Confirmation mail right away; invitations require a verified address.
                void sendVerificationEmail(redirectUrl.startsWith('/') ? redirectUrl : '/').catch((verifyError) => console.warn('Could not send verification email', verifyError));
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            }
            await handleAuthSuccess();
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/multi-factor-auth-required') {
                try {
                    const resolver = createMfaResolver(err);
                    setMfaResolver(resolver);
                    setMfaCode('');
                    setShowMfaStep(true);
                    setError('');
                } catch (resolverError) {
                    console.error('Failed to prepare MFA resolver:', resolverError);
                    setError(t('login.error.mfaSetup'));
                }
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
            await handleAuthSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('login.error.mfaInvalid'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOAuthMfaError = (err: any, fallbackKey: string) => {
        console.error(err);
        if (err.code === 'auth/multi-factor-auth-required') {
            try {
                const resolver = createMfaResolver(err);
                setMfaResolver(resolver);
                setMfaCode('');
                setShowMfaStep(true);
                setError('');
            } catch (resolverError) {
                console.error('Failed to prepare OAuth MFA resolver:', resolverError);
                setError(t('login.error.mfaSetup'));
            }
            return;
        }

        setError(t(fallbackKey));
    };

    // Popups hang or get blocked in embedded (in-app) browsers; there we use a
    // full-page redirect and pick the result up in the effect below.
    const prefersRedirect = () => /FBAN|FBAV|Instagram|LinkedInApp|Line\/|WhatsApp|; wv\)/i.test(navigator.userAgent);

    const handleOAuthSignIn = async (provider: AuthProvider, fallbackKey: string) => {
        setError('');
        setIsLoading(true);
        const startRedirect = async () => {
            sessionStorage.setItem(OAUTH_REDIRECT_KEY, JSON.stringify({ redirectUrl, fallbackKey }));
            await signInWithRedirect(auth, provider);
        };
        try {
            if (prefersRedirect()) {
                await startRedirect();
                return;
            }
            await signInWithPopup(auth, provider);
            await handleAuthSuccess();
        } catch (err: any) {
            if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
                try {
                    await startRedirect();
                    return;
                } catch (redirectError) {
                    err = redirectError;
                }
            }
            handleOAuthMfaError(err, fallbackKey);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = () => handleOAuthSignIn(new GoogleAuthProvider(), 'login.error.google');

    const handleGithubSignIn = () => handleOAuthSignIn(new GithubAuthProvider(), 'login.error.github');

    // Sign in with Apple (Firebase provider apple.com). Apple only returns the
    // name on the very first authorization, so request both scopes.
    const createAppleProvider = () => {
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        return provider;
    };
    const handleAppleSignIn = () => handleOAuthSignIn(createAppleProvider(), 'login.error.apple');

    const renderSocialGrid = (onGoogle: () => void, onGithub: () => void, onApple: () => void) => (
        <div className="login-page__social-grid">
            <Button
                type="button"
                variant="secondary"
                className="login-page__social-button"
                onClick={onGoogle}
                icon={<img src="https://www.svgrepo.com/show/475656/google-color.svg" className="login-page__social-icon" alt={t('login.social.google')} />}
            >
                {t('login.social.google')}
            </Button>
            <Button
                type="button"
                variant="secondary"
                className="login-page__social-button"
                onClick={onGithub}
                icon={<img src="https://www.svgrepo.com/show/512317/github-142.svg" className="login-page__social-icon login-page__social-icon--invert" alt={t('login.social.github')} />}
            >
                {t('login.social.github')}
            </Button>
            <Button
                type="button"
                variant="secondary"
                className="login-page__social-button login-page__social-button--apple"
                onClick={onApple}
                disabled={isBusy}
                icon={<AppleLogo className="login-page__social-icon login-page__social-icon--glyph" />}
            >
                {t('login.social.apple')}
            </Button>
        </div>
    );

    // Desktop handoff (/desktop/auth?provider=…): the browser starts the provider the user picked in the app
    // right away, as a full-page redirect (no popup without a click). Once per tab session, so a cancelled or
    // failed attempt falls back to the normal login page.
    const handoffProvider = !isDesktopApp && redirectUrl.startsWith('/desktop/auth') ? searchParams.get('provider') : null;
    useEffect(() => {
        if (!handoffProvider || !isAuthReady || auth.currentUser || sessionStorage.getItem(OAUTH_REDIRECT_KEY)) return;
        const startedKey = `pf_desktop_handoff_${handoffProvider}`;
        if (sessionStorage.getItem(startedKey)) return;
        sessionStorage.setItem(startedKey, '1');
        const provider = handoffProvider === 'google' ? new GoogleAuthProvider()
            : handoffProvider === 'github' ? new GithubAuthProvider()
                : handoffProvider === 'apple' ? createAppleProvider() : null;
        if (!provider) return;
        sessionStorage.setItem(OAUTH_REDIRECT_KEY, JSON.stringify({ redirectUrl, fallbackKey: `login.error.${handoffProvider}` }));
        setIsLoading(true);
        signInWithRedirect(auth, provider).catch((err) => {
            sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
            setIsLoading(false);
            handleOAuthMfaError(err, `login.error.${handoffProvider}`);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handoffProvider, isAuthReady]);

    // Completes a sign-in that went through signInWithRedirect.
    useEffect(() => {
        const pending = sessionStorage.getItem(OAUTH_REDIRECT_KEY);
        if (!pending) return;
        sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
        let stored: { redirectUrl?: string; fallbackKey?: string } = {};
        try {
            stored = JSON.parse(pending);
        } catch {
            stored = {};
        }
        setIsLoading(true);
        getRedirectResult(auth)
            .then((result) => {
                if (result) void handleAuthSuccess(stored.redirectUrl || redirectUrl);
            })
            .catch((err) => handleOAuthMfaError(err, stored.fallbackKey || 'login.error.google'))
            .finally(() => setIsLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const handlePasskeySignIn = async (isAuto = false) => {
        setIsLoading(true);
        if (!isAuto) setError(''); // Only clear error on manual attempt
        try {
            const token = await loginWithPasskey(email);
            await signInWithCustomToken(auth, token);
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

    // Fetch a challenge and wake the verify function while the screen is open.
    useEffect(() => {
        if (!isRegister && !auth.currentUser) preparePasskeyLogin();
    }, [isRegister]);

    // Auto-prompt effect
    useEffect(() => {
        // Only auto-prompt if checking for login, not register, and not already redirected
        if (authScreenTranslationsReady && !isRegister && !auth.currentUser && !showMfaStep && !isDesktopApp && shouldAutoPrompt()) {
            handlePasskeySignIn(true);
        }
    }, [authScreenTranslationsReady, isRegister, showMfaStep]); // Run once on mount/mode switch if conditions met

    // Signed in and about to leave: the workspace gate remounts this screen once
    // before the redirect; keep showing its loading state instead of the form.
    if (user && pendingRedirect) {
        return <WorkspaceConnecting />;
    }

    if (!authScreenTranslationsReady) {
        return (
            <div className="login-page">
                <div className="login-page__panel">
                    <div className="login-page__panel-inner">
                        <div className="login-page__heading">
                            <h2 className="login-page__title">Loading sign-in...</h2>
                            <p className="login-page__subtitle">Please wait while we prepare the authentication screen.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            {/* Left Side - Brand (Monochrome) */}
            <div className="login-page__hero">
                {/* Brand ripples spread from the logo (same field as the app loading scene). */}
                <FlowField tone="onDark" originX={0.09} originY={0.07} spacing={24} period={4.8} />
                <div className="login-page__hero-content">
                    <div className="login-page__brand">
                        <div className="login-page__brand-mark"><BrandGlyph /></div>
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
                                    <span className="material-symbols-outlined">groups</span>
                                </div>
                                <div>
                                    <h3 className="login-page__feature-title">{t('login.hero.feature.flows.title')}</h3>
                                    <p className="login-page__feature-text">{t('login.hero.feature.flows.detail')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="login-page__hero-footer">
                        {t('login.footer.copyright')
                            .replace('{year}', String(new Date().getFullYear()))
                            .replace('{company}', COMPANY_NAME)}
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="login-page__panel">
                <div className="login-page__panel-inner">
                    {!showMfaStep ? (
                        <>
                            {inviteTenantId && (
                                <div className="login-page__notice">
                                    <span className="material-symbols-outlined">group_add</span>
                                    <span>{t('login.notice.inviteWorkspace')}</span>
                                </div>
                            )}

                            {!inviteTenantId && hasRedirectContext && !isRegister && (
                                <div className="login-page__notice">
                                    <span className="material-symbols-outlined">subdirectory_arrow_right</span>
                                    <span>{t('login.notice.redirectContinue')}</span>
                                </div>
                            )}

                            {passkeyAvailable && (
                                <div className="login-page__notice">
                                    <span className="material-symbols-outlined">fingerprint</span>
                                    <span>{t('login.notice.passkeyReady')}</span>
                                </div>
                            )}

                            <div className="login-page__heading">
                                <h2 className="login-page__title">
                                    {isRegister ? t('login.heading.register') : t('login.heading.login')}
                                </h2>
                                <p className="login-page__subtitle">
                                    {isRegister ? t('login.subheading.register') : t('login.subheading.login')}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="login-page__form">
                                <TextInput
                                    label={t('login.label.email')}
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('login.placeholder.email')}
                                />
                                <TextInput
                                    label={t('login.label.password')}
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('login.placeholder.password')}
                                />

                                {error && (
                                    <div className="login-page__error">
                                        <span className="material-symbols-outlined">error</span>
                                        {error}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    isLoading={isBusy}
                                    className="login-page__primary"
                                    disabled={isBusy}
                                >
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
                                    <Button type="submit" isLoading={isBusy} className="login-page__primary" disabled={mfaCode.length !== 6}>
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

                    {!isRegister && !showMfaStep && isDesktopApp && (
                        canSignInExternally ? (
                            <>
                                <div className="login-page__divider">{t('login.divider.orContinue')}</div>
                                {renderSocialGrid(() => void handleBrowserSignIn('google'), () => void handleBrowserSignIn('github'), () => void handleBrowserSignIn('apple'))}
                                <p className="login-page__desktop-hint">
                                    {t(browserSignInStarted ? 'login.desktop.browserWaiting' : 'login.desktop.browserHint')}
                                </p>
                            </>
                        ) : (
                            <p className="login-page__desktop-hint">{t('login.desktop.oauthHint')}</p>
                        )
                    )}

                    {!isRegister && !showMfaStep && !isDesktopApp && (
                        <>
                            <div className="login-page__divider">{t('login.divider.orContinue')}</div>

                            <Button
                                type="button"
                                variant="secondary"
                                className="login-page__primary"
                                onClick={() => handlePasskeySignIn()}
                                disabled={isBusy}
                                icon={<span className="material-symbols-outlined">fingerprint</span>}
                            >
                                {t('passkey.login.action')}
                            </Button>

                            {renderSocialGrid(handleGoogleSignIn, handleGithubSignIn, handleAppleSignIn)}
                        </>
                    )}

                    <p className="login-page__toggle">
                        {isRegister ? t('login.toggle.hasAccount') : t('login.toggle.newToProjectFlow')}
                        <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
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
