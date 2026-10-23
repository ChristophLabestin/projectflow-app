import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../services/firebase';
import { createDesktopAuthCode, desktopAuthCallbackUrl, isValidDesktopChallenge } from '../services/desktopAuth';
import appIconUrl from '../assets/desktop-app-icon.png';
import '../components/common/Button/button.scss';
import './download-page.scss';

type HandoffState = 'idle' | 'working' | 'sent' | 'error';

/**
 * Browser page of the desktop OAuth handoff (/desktop/auth?challenge=…): after a normal web sign-in
 * (any provider) it hands a one-time code to the desktop app via projectflow://auth.
 */
export const DesktopAuthHandoff = () => {
    const { user, isAuthReady } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const challenge = searchParams.get('challenge');
    const [state, setState] = useState<HandoffState>('idle');
    const autoStarted = useRef(false);

    const handOff = useCallback(async () => {
        if (!isValidDesktopChallenge(challenge)) return;
        setState('working');
        try {
            const code = await createDesktopAuthCode(challenge);
            window.location.href = desktopAuthCallbackUrl(code);
            setState('sent');
        } catch (error) {
            console.error('Desktop handoff failed', error);
            setState('error');
        }
    }, [challenge]);

    useEffect(() => {
        if (!user || autoStarted.current || !isValidDesktopChallenge(challenge)) return;
        autoStarted.current = true;
        void handOff();
    }, [user, challenge, handOff]);

    if (!isAuthReady) return null;
    if (isValidDesktopChallenge(challenge) && !user) {
        return <Navigate to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
    }

    return (
        <div className="download-page">
            <main className="download-page__main">
                <section className="download-page__hero">
                    <img className="download-page__icon" src={appIconUrl} alt="" />
                    <h1>{t('desktopAuth.title')}</h1>
                    {!isValidDesktopChallenge(challenge) ? (
                        <p className="download-page__lead">{t('desktopAuth.invalid')}</p>
                    ) : (
                        <>
                            <p className="download-page__lead">
                                {t(state === 'error' ? 'desktopAuth.error' : state === 'sent' ? 'desktopAuth.sent' : 'desktopAuth.working')}
                            </p>
                            {user?.email && <p className="download-page__meta">{t('desktopAuth.account').replace('{email}', user.email)}</p>}
                            <button
                                type="button"
                                className="btn btn--primary btn--lg download-page__primary"
                                onClick={() => void handOff()}
                                disabled={state === 'working'}
                            >
                                <span className="material-symbols-outlined">open_in_new</span>
                                {t('desktopAuth.open')}
                            </button>
                            <button type="button" className="btn btn--ghost" onClick={() => void signOut(auth)}>
                                {t('desktopAuth.switchAccount')}
                            </button>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
};
