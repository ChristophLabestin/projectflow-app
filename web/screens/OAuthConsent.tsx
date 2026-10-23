import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../services/firebase';
import {
    approveOAuthConsent,
    denyOAuthConsent,
    getOAuthConsentRequest,
    isValidConsentRequestId,
    type OAuthConsentRequest
} from '../services/aiIntegrations';
import appIconUrl from '../assets/desktop-app-icon.png';
import '../components/common/Button/button.scss';
import './oauth-consent.scss';

type ConsentState = 'loading' | 'ready' | 'working' | 'done' | 'error';

const isDeleteScope = (scope: string) => scope.endsWith(':delete');

/**
 * OAuth consent for AI clients (/oauth/consent?request=…): the authorization server
 * (functions/src/oauth-server.ts) parks the request and sends the browser here; the signed-in user
 * picks one workspace and the scopes, then the browser returns to the client with a code.
 */
export const OAuthConsent = () => {
    const { user, isAuthReady } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const requestId = searchParams.get('request');
    const [state, setState] = useState<ConsentState>('loading');
    const [request, setRequest] = useState<OAuthConsentRequest | null>(null);
    const [tenantId, setTenantId] = useState('');
    const [scopes, setScopes] = useState<string[]>([]);

    useEffect(() => {
        if (!user || !isValidConsentRequestId(requestId)) return;
        let cancelled = false;
        getOAuthConsentRequest(requestId)
            .then((data) => {
                if (cancelled) return;
                setRequest(data);
                setTenantId(data.workspaces.find((workspace) => workspace.allowed)?.tenantId || '');
                setScopes(data.requestedScopes.filter((scope) => !isDeleteScope(scope)));
                setState('ready');
            })
            .catch((error) => {
                console.error('OAuth consent request failed', error);
                if (!cancelled) setState('error');
            });
        return () => {
            cancelled = true;
        };
    }, [user, requestId]);

    const workspace = useMemo(() => request?.workspaces.find((entry) => entry.tenantId === tenantId) || null, [request, tenantId]);

    if (!isAuthReady) return null;
    if (isValidConsentRequestId(requestId) && !user) {
        return <Navigate to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
    }

    const finish = async (approve: boolean) => {
        if (!isValidConsentRequestId(requestId)) return;
        setState('working');
        try {
            const redirectUrl = approve
                ? await approveOAuthConsent(requestId, tenantId, scopes.filter((scope) => !isDeleteScope(scope) || workspace?.allowDeleteScopes))
                : await denyOAuthConsent(requestId);
            setState('done');
            window.location.href = redirectUrl;
        } catch (error) {
            console.error('OAuth consent failed', error);
            setState('error');
        }
    };

    const toggleScope = (scope: string) =>
        setScopes((current) => (current.includes(scope) ? current.filter((entry) => entry !== scope) : [...current, scope]));

    const invalid = !isValidConsentRequestId(requestId);
    const client = request?.client;

    return (
        <div className="oauth-consent">
            <main className="oauth-consent__card">
                <div className="oauth-consent__logos">
                    {client?.logoUri ? <img src={client.logoUri} alt="" /> : <span className="material-symbols-outlined">smart_toy</span>}
                    <span className="material-symbols-outlined oauth-consent__link-icon">sync_alt</span>
                    <img src={appIconUrl} alt="" />
                </div>

                {invalid || state === 'error' ? (
                    <>
                        <h1>{t('oauthConsent.errorTitle')}</h1>
                        <p className="oauth-consent__lead">{t(invalid ? 'oauthConsent.invalid' : 'oauthConsent.error')}</p>
                    </>
                ) : state === 'loading' || !request || !client ? (
                    <p className="oauth-consent__lead">{t('oauthConsent.loading')}</p>
                ) : state === 'done' ? (
                    <p className="oauth-consent__lead">{t('oauthConsent.done').replace('{client}', client.name)}</p>
                ) : (
                    <>
                        <h1>{t('oauthConsent.title').replace('{client}', client.name)}</h1>
                        <p className="oauth-consent__lead">{t('oauthConsent.lead')}</p>
                        <p className="oauth-consent__meta">
                            {t('oauthConsent.redirect').replace('{host}', client.redirectHost)}
                            {!client.verified && <span className="oauth-consent__unverified"> · {t('oauthConsent.unverified')}</span>}
                        </p>

                        <label className="oauth-consent__label" htmlFor="oauth-consent-workspace">{t('oauthConsent.workspace')}</label>
                        <select
                            id="oauth-consent-workspace"
                            className="oauth-consent__select"
                            value={tenantId}
                            onChange={(event) => setTenantId(event.target.value)}
                        >
                            {request.workspaces.map((entry) => (
                                <option key={entry.tenantId} value={entry.tenantId} disabled={!entry.allowed}>
                                    {entry.name} · {entry.role}
                                    {entry.reason ? ` — ${t(`oauthConsent.blocked.${entry.reason}`)}` : ''}
                                </option>
                            ))}
                        </select>
                        {!request.workspaces.some((entry) => entry.allowed) && (
                            <p className="oauth-consent__warning">{t('oauthConsent.noWorkspace')}</p>
                        )}

                        <p className="oauth-consent__label">{t('oauthConsent.permissions')}</p>
                        <ul className="oauth-consent__scopes">
                            {request.requestedScopes.map((scope) => {
                                const blocked = isDeleteScope(scope) && !workspace?.allowDeleteScopes;
                                return (
                                    <li key={scope}>
                                        <label className={blocked ? 'is-disabled' : undefined}>
                                            <input
                                                type="checkbox"
                                                checked={scopes.includes(scope) && !blocked}
                                                disabled={blocked}
                                                onChange={() => toggleScope(scope)}
                                            />
                                            <span>
                                                {t(`oauthConsent.scope.${scope}`)}
                                                {isDeleteScope(scope) && <em> · {t(blocked ? 'oauthConsent.deleteBlocked' : 'oauthConsent.deleteHint')}</em>}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="oauth-consent__meta">{t('oauthConsent.actsAsYou').replace('{role}', workspace?.role || '')}</p>
                        {user?.email && <p className="oauth-consent__meta">{t('oauthConsent.account').replace('{email}', user.email)}</p>}

                        <div className="oauth-consent__actions">
                            <button type="button" className="btn btn--ghost" onClick={() => void finish(false)} disabled={state === 'working'}>
                                {t('oauthConsent.deny')}
                            </button>
                            <button
                                type="button"
                                className="btn btn--primary"
                                onClick={() => void finish(true)}
                                disabled={state === 'working' || !workspace?.allowed || scopes.length === 0}
                            >
                                {t('oauthConsent.allow')}
                            </button>
                        </div>
                        <button type="button" className="btn btn--ghost oauth-consent__switch" onClick={() => void signOut(auth)}>
                            {t('oauthConsent.switchAccount')}
                        </button>
                    </>
                )}
            </main>
        </div>
    );
};
