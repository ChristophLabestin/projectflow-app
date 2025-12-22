import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { bootstrapTenantForCurrentUser, getActiveTenantId } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
                // CRITICAL FIX: Do NOT use getActiveTenantId() for new registrations
                // unless it is explicitly an invite (handled by location state usually).
                // Previously, this would grab a stale ID from localStorage (e.g. from a previous user)
                // and add the NEW user to the OLD user's workspace.
                const inviteTenant = (location.state as any)?.inviteTenantId;
                await bootstrapTenantForCurrentUser(inviteTenant || undefined, true);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                await bootstrapTenantForCurrentUser();
            }
            await handleAuthSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred.');
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
            setError('Failed to sign in with Google.');
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
            setError('Failed to sign in with GitHub.');
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
                        Focus.<br />Build.<br />Ship.
                    </h1>
                    <p className="text-xl text-zinc-400 font-light leading-relaxed mb-12">
                        The minimalist workspace for creators. No clutter, just clarity.
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 size-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                                <span className="material-symbols-outlined text-sm">check</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Streamlined Tasks</h3>
                                <p className="text-zinc-500 text-sm">Kanban, lists, and focus modes.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="mt-1 size-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                                <span className="material-symbols-outlined text-sm">hub</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Idea Mapping</h3>
                                <p className="text-zinc-500 text-sm">Connect thoughts visually.</p>
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
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold tracking-tight mb-2 text-[var(--color-text-main)]">
                            {isRegister ? 'Join ProjectFlow' : 'Welcome back'}
                        </h2>
                        <p className="text-[var(--color-text-muted)]">
                            {isRegister ? 'Create your workspace today.' : 'Enter your credentials to access your projects.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {isRegister && (
                            <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
                        )}
                        <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />

                        {error && (
                            <div className="p-3 rounded bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-lg">error</span>
                                {error}
                            </div>
                        )}

                        <Button type="submit" loading={isLoading} variant="primary" className="w-full h-12 text-base shadow-xl">
                            {isRegister ? 'Create Account' : 'Sign In'}
                        </Button>
                    </form>

                    <div className="relative flex items-center justify-center py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-surface-border)]"></div></div>
                        <div className="relative bg-[var(--color-surface-bg)] px-4 text-xs font-semibold text-[var(--color-text-subtle)] uppercase tracking-widest">Or continue with</div>
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
                        {isRegister ? 'Already have an account?' : "New to ProjectFlow?"}
                        <button onClick={() => { setIsRegister(!isRegister); setError(''); }} className="ml-1 font-bold text-[var(--color-primary)] hover:underline">
                            {isRegister ? 'Log in' : 'Create account'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};
