import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { ReauthDialog } from '../auth/reauth';
import { adminApi } from '../lib/api';
import { useAdminQuery } from '../lib/useAsync';
import { Badge, Card, ErrorNote, PageHead, Skeleton } from '../ui/primitives';

type Consent = { clientId: string; clientName: string; clientStatus: string; redirectUri: string; scopes: string[]; resource: string; killSwitchOn: boolean; expiresAt: number | null };

/** OAuth consent for the admin MCP (`/oauth/consent?request=…`, reached from /oauth/authorize). */
export const McpConsent: React.FC = () => {
    const [params] = useSearchParams();
    const requestId = params.get('request') || '';
    const { data, error, loading } = useAdminQuery<Consent>(requestId ? 'mcp.consent.get' : null, { requestId });
    const [write, setWrite] = useState(false);
    const [approveClient, setApproveClient] = useState(false);
    const [reauth, setReauth] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const approve = async () => {
        setBusy(true);
        setFailure(null);
        try {
            const result = await adminApi<{ redirectUrl: string }>('mcp.consent.approve', { requestId, scopes: write ? ['admin:read', 'admin:write'] : ['admin:read'], approveClient });
            window.location.assign(result.redirectUrl);
        } catch (err: any) {
            if (/reauth-required/.test(err.message)) setReauth(true);
            else setFailure(err.message);
            setBusy(false);
        }
    };
    const deny = async () => {
        try { const r = await adminApi<{ redirectUrl: string }>('mcp.consent.deny', { requestId }); window.location.assign(r.redirectUrl); } catch (err: any) { setFailure(err.message); }
    };

    if (!requestId) return <div className="ac-page"><ErrorNote error={new Error('Keine Anfrage angegeben.')} /></div>;
    if (loading && !data) return <div className="ac-page"><Skeleton /></div>;
    if (!data) return <div className="ac-page"><ErrorNote error={error} /></div>;
    const host = (() => { try { const u = new URL(data.redirectUri); return u.protocol === 'http:' ? `${u.hostname} (lokal, z. B. Claude Code)` : u.host; } catch { return data.redirectUri; } })();
    const pending = data.clientStatus !== 'approved';

    return (
        <div className="ac-page" style={{ maxWidth: 640 }}>
            <PageHead title="Admin-MCP verbinden" subtitle="Ein KI-Client möchte auf die Admin-Konsole zugreifen." />
            <Card title={<span className="ac-row"><ShieldCheck size={16} />{data.clientName}</span>} actions={pending ? <Badge tone="amber">neuer Client</Badge> : <Badge tone="green">freigegeben</Badge>}>
                <div className="ac-stack">
                    <dl className="ac-kv">
                        <dt>Rückleitung an</dt><dd className="mono">{host}</dd>
                        <dt>Resource</dt><dd className="mono">{data.resource}</dd>
                        <dt>Laufzeit</dt><dd>Access 15 min, Verbindung max. 7 Tage</dd>
                    </dl>
                    {!data.killSwitchOn && <div className="ac-alert ac-alert--error">Der Admin-MCP ist ausgeschaltet. Schalte ihn unter Admin-MCP ein und starte die Verbindung neu.</div>}
                    <label className="ac-check"><input type="checkbox" checked disabled />Lesen (Kennzahlen, Nutzer, Workspaces, Crashes, KI, System, Audit)</label>
                    {data.scopes.includes('admin:write') && <label className="ac-check"><input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />Schreiben (Sperren, Banner, KI, Intern, Speicher, Crash-Status) — jede Aktion braucht zusätzlich einen Code aus der Konsole</label>}
                    {pending && <label className="ac-check"><input type="checkbox" checked={approveClient} onChange={(e) => setApproveClient(e.target.checked)} />Diesen Client dauerhaft freigeben</label>}
                    {failure && <div className="ac-alert ac-alert--error">{failure}</div>}
                    <div className="ac-row">
                        <button className="ac-btn ac-btn--primary" disabled={busy || !data.killSwitchOn || (pending && !approveClient)} onClick={approve}>Mit TOTP bestätigen und verbinden</button>
                        <button className="ac-btn" disabled={busy} onClick={deny}>Ablehnen</button>
                    </div>
                </div>
            </Card>
            {reauth && <ReauthDialog onDone={(ok) => { setReauth(false); if (ok) void approve(); }} />}
        </div>
    );
};
