import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup,
    updateProfile
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { bootstrapTenantForCurrentUser, getActiveTenantId, clearActiveTenantId } from '../services/dataService';

export const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const inviteTenant = (location.state as any)?.inviteTenantId || getActiveTenantId();
        if (inviteTenant) {
            setIsRegister(true);
        }
    }, [location.state]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isRegister) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                if (name) {
                    await updateProfile(userCredential.user, { displayName: name });
                }
                const inviteTenant = getActiveTenantId();
                await bootstrapTenantForCurrentUser(inviteTenant || undefined);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                await bootstrapTenantForCurrentUser();
            }
            navigate('/');
        } catch (err: any) {
            console.error(err);
            let msg = 'An error occurred. Please try again.';
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                msg = 'Invalid email or password.';
            } else if (err.code === 'auth/email-already-in-use') {
                msg = 'Email is already registered.';
            } else if (err.code === 'auth/weak-password') {
                msg = 'Password should be at least 6 characters.';
            }
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            await bootstrapTenantForCurrentUser();
            navigate('/');
        } catch (err: any) {
            console.error(err);
            setError('Failed to sign in with Google.');
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white dark:bg-background-dark text-gray-900 dark:text-white">
            {/* Left Side - Visual / Branding (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 bg-gray-50 dark:bg-card-dark relative items-center justify-center border-r border-gray-200 dark:border-gray-800 p-12 overflow-hidden">
               {/* Decorative background elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-primary/5 dark:bg-primary/10 blur-[120px]"></div>
                     <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-[100px]"></div>
                </div>

                <div className="relative z-10 max-w-lg">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="size-10 text-primary dark:text-white">
                            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight">ProjectFlow AI</h1>
                    </div>
                    <p className="text-3xl font-bold leading-tight mb-4">Manage your projects with the power of Gemini.</p>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">Brainstorm ideas, track progress, and get automated insights to keep your team aligned and moving forward.</p>
                    
                    <div className="mt-12 grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-background-dark p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <span className="material-symbols-outlined text-purple-500 mb-2">auto_awesome</span>
                            <p className="font-bold text-sm">AI Insights</p>
                            <p className="text-xs text-gray-500 mt-1">Smart suggestions</p>
                        </div>
                        <div className="bg-white dark:bg-background-dark p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <span className="material-symbols-outlined text-green-500 mb-2">check_circle</span>
                            <p className="font-bold text-sm">Task Tracking</p>
                            <p className="text-xs text-gray-500 mt-1">Stay organized</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-24 bg-white dark:bg-background-dark relative">
                {/* Mobile Logo */}
                <div className="lg:hidden absolute top-8 left-8 size-8 text-primary dark:text-white">
                     <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M39.475 21.6262C40.358 21.4363 40.6863 21.5589 40.7581 21.5934C40.7876 21.655 40.8547 21.857 40.8082 22.3336C40.7408 23.0255 40.4502 24.0046 39.8572 25.2301C38.6799 27.6631 36.5085 30.6631 33.5858 33.5858C30.6631 36.5085 27.6632 38.6799 25.2301 39.8572C24.0046 40.4502 23.0255 40.7407 22.3336 40.8082C21.8571 40.8547 21.6551 40.7875 21.5934 40.7581C21.5589 40.6863 21.4363 40.358 21.6262 39.475C21.8562 38.4054 22.4689 36.9657 23.5038 35.2817C24.7575 33.2417 26.5497 30.9744 28.7621 28.762C30.9744 26.5497 33.2417 24.7574 35.2817 23.5037C36.9657 22.4689 38.4054 21.8562 39.475 21.6262ZM4.41189 29.2403L18.7597 43.5881C19.8813 44.7097 21.4027 44.9179 22.7217 44.7893C24.0585 44.659 25.5148 44.1631 26.9723 43.4579C29.9052 42.0387 33.2618 39.5667 36.4142 36.4142C39.5667 33.2618 42.0387 29.9052 43.4579 26.9723C44.1631 25.5148 44.659 24.0585 44.7893 22.7217C44.9179 21.4027 44.7097 19.8813 43.5881 18.7597L29.2403 4.41187C27.8527 3.02428 25.8765 3.02573 24.2861 3.36776C22.6081 3.72863 20.7334 4.58419 18.8396 5.74801C16.4978 7.18716 13.9881 9.18353 11.5858 11.5858C9.18354 13.988 7.18717 16.4978 5.74802 18.8396C4.58421 20.7334 3.72865 22.6081 3.36778 24.2861C3.02574 25.8765 3.02429 27.8527 4.41189 29.2403Z" fillRule="evenodd"></path></svg>
                </div>

                <div className="w-full max-w-sm flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-3xl font-extrabold tracking-tight">{isRegister ? 'Create an account' : 'Welcome back'}</h2>
                        <p className="text-gray-500 dark:text-gray-400">
                            {isRegister ? 'Enter your details to get started.' : 'Please enter your details to sign in.'}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {isRegister && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold" htmlFor="name">Full Name</label>
                                <input 
                                    className="h-11 w-full rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:border-black dark:focus:border-white focus:ring-black dark:focus:ring-white transition-all" 
                                    id="name" 
                                    placeholder="John Doe" 
                                    required 
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold" htmlFor="email">Email</label>
                            <input 
                                className="h-11 w-full rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:border-black dark:focus:border-white focus:ring-black dark:focus:ring-white transition-all" 
                                id="email" 
                                placeholder="name@company.com" 
                                required 
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold" htmlFor="password">Password</label>
                            <input 
                                className="h-11 w-full rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:border-black dark:focus:border-white focus:ring-black dark:focus:ring-white transition-all" 
                                id="password" 
                                placeholder="••••••••" 
                                required 
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {!isRegister && (
                            <div className="flex justify-end">
                                <a href="#" className="text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">Forgot password?</a>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="h-11 w-full mt-2 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading && <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>}
                            <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                        </button>
                    </form>

                    <div className="relative flex items-center justify-center my-2">
                         <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-800"></div></div>
                         <div className="relative bg-white dark:bg-background-dark px-4 text-xs font-medium text-gray-400 uppercase">Or continue with</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            type="button" 
                            onClick={handleGoogleSignIn}
                            className="h-10 flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-card-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-sm"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="size-5" />
                            Google
                        </button>
                         <button type="button" className="h-10 flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-card-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-sm">
                            <img src="https://www.svgrepo.com/show/512317/github-142.svg" alt="GitHub" className="size-5 dark:invert" />
                            GitHub
                        </button>
                    </div>

                    <div className="text-center mt-2">
                        <p className="text-sm text-gray-500">
                            {isRegister ? 'Already have an account?' : "Don't have an account?"}
                            <button onClick={() => { setIsRegister(!isRegister); setError(''); clearActiveTenantId(); }} className="ml-1 font-bold text-black dark:text-white hover:underline">
                                {isRegister ? 'Sign in' : 'Sign up'}
                            </button>
                        </p>
                    </div>
                </div>
                
                <div className="mt-auto pt-10 text-xs text-gray-400 text-center">
                    &copy; 2024 ProjectFlow AI. All rights reserved.
                </div>
            </div>
        </div>
    );
};
