import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Bot, Bug, Building2, Euro, FileCheck2, FolderKanban, Plug, Users } from 'lucide-react';
import { useAdminQuery } from '../lib/useAsync';
import { compact, dateTime, eur, num, pct, usd } from '../lib/format';
import { AreaChart, BarList, Legend, Meter } from '../ui/charts';
import { Card, ErrorNote, PageHead, Segmented, Skeleton, Stat } from '../ui/primitives';

type Overview = {
    days: string[]; generatedAt: number;
    users: { total: number; dau: number; wau: number; mau: number; disabled: number; mfa: number; providers: Record<string, number>; signups: number[]; activeDaily: number[] };
    workspaces: { total: number; created: number[] };
    content: { projects: number; tasks: number; activityEvents: number[] };
    crashes: { web: number[]; ios: number[]; total: number; perActiveUser: number | null };
    ai: { text: number[]; images: number[]; users: number; monthTokens: number; monthImages: number; monthCostUsd: number; usdPerMTokens: number };
    mcp: { active: number; kinds: Record<string, number>; clients: Record<string, number> };
    legal: { termsVersion: number; termsAccepted: number; acceptanceRate: number | null };
    versions: Record<'ios' | 'desktop' | 'web', Record<string, number>>;
    billing: { mrr: number; paying: number; seats: number; aiAddonSeats: number; plans: Record<string, number>; statuses: Record<string, number>; trialsEndingSoon: number };
};

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const halfChange = (v: number[]) => {
    const h = Math.floor(v.length / 2);
    const a = sum(v.slice(0, h));
    const b = sum(v.slice(h));
    return a ? (b - a) / a : null;
};
const PROVIDER: Record<string, string> = { password: 'E-Mail/Passwort', 'google.com': 'Google', 'github.com': 'GitHub', 'apple.com': 'Apple' };
const entries = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, key: label }));

export const Overview: React.FC = () => {
    const navigate = useNavigate();
    const [days, setDays] = useState('30');
    const [fresh, setFresh] = useState(0);
    const { data, loading, error, reload } = useAdminQuery<Overview>('overview.get', { days: Number(days), fresh: fresh > 0 ? fresh : undefined });

    return (
        <div className="ac-page">
            <PageHead title="Übersicht" subtitle={data ? `Stand ${dateTime(data.generatedAt)} · Zeitraum ${days} Tage, Veränderung = 2. vs. 1. Hälfte` : 'Plattform-Kennzahlen'} actions={<>
                <Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7 T.' }, { value: '30', label: '30 T.' }, { value: '90', label: '90 T.' }]} />
                <button className="ac-btn" onClick={() => setFresh(Date.now())}>Neu berechnen</button>
            </>} />
            <ErrorNote error={error} onRetry={reload} />
            {loading && !data ? <Skeleton rows={14} /> : data && (
                <div className="ac-stack">
                    <div className="ac-grid ac-grid--stats">
                        <Stat icon={<Euro size={13} />} label="MRR (netto)" value={eur(data.billing.mrr)} meta={`${num(data.billing.paying)} zahlend · ${num(data.billing.seats)} Plätze · ${num(data.billing.aiAddonSeats)} KI-Pakete`} />
                        <Stat icon={<Users size={13} />} label="Nutzer" value={num(data.users.total)} meta={`+${num(sum(data.users.signups))} im Zeitraum`} change={halfChange(data.users.signups)} series={data.users.signups} />
                        <Stat icon={<Activity size={13} />} label="DAU / WAU / MAU" value={`${num(data.users.dau)} / ${num(data.users.wau)} / ${num(data.users.mau)}`} meta={`Stickiness ${pct(data.users.mau ? data.users.dau / data.users.mau : null, 0)}`} series={data.users.activeDaily} color="var(--ac-chart-3)" />
                        <Stat icon={<Building2 size={13} />} label="Workspaces" value={num(data.workspaces.total)} meta={`+${num(sum(data.workspaces.created))} neu`} change={halfChange(data.workspaces.created)} series={data.workspaces.created} color="var(--ac-chart-2)" />
                        <Stat icon={<FolderKanban size={13} />} label="Projekte / Aufgaben" value={`${compact(data.content.projects)} / ${compact(data.content.tasks)}`} meta={`${compact(sum(data.content.activityEvents))} Aktivitäten`} series={data.content.activityEvents} color="var(--ac-chart-4)" />
                        <Stat icon={<Bug size={13} />} label="Crash-Events" value={num(data.crashes.total)} invert change={halfChange(data.crashes.web.map((w, i) => w + data.crashes.ios[i]))} meta={data.crashes.perActiveUser != null ? `${data.crashes.perActiveUser.toFixed(2).replace('.', ',')} pro aktivem Nutzer/Tag` : undefined} series={data.crashes.web.map((w, i) => w + data.crashes.ios[i])} color="var(--color-error)" />
                        <Stat icon={<Bot size={13} />} label="KI-Kosten (Monat, geschätzt)" value={usd(data.ai.monthCostUsd)} meta={`${compact(data.ai.monthTokens)} Tokens · ${num(data.ai.users)} Nutzer`} series={data.ai.text} color="var(--ac-chart-2)" />
                        <Stat icon={<Plug size={13} />} label="MCP-/API-Verbindungen" value={num(data.mcp.active)} meta={Object.entries(data.mcp.kinds).map(([k, v]) => `${v} ${k === 'personal-token' ? 'PAT' : 'OAuth'}`).join(' · ')} />
                        <Stat icon={<FileCheck2 size={13} />} label={`Zustimmung AGB v${data.legal.termsVersion || '–'}`} value={pct(data.legal.acceptanceRate, 0)} meta={`${num(data.legal.termsAccepted)} von ${num(data.users.total)}`} />
                    </div>

                    <div className="ac-grid ac-grid--2">
                        <Card title="Wachstum" actions={<Legend series={[{ label: 'Registrierungen', values: [] }, { label: 'Neue Workspaces', values: [] }]} />}>
                            <AreaChart days={data.days} series={[{ label: 'Registrierungen', values: data.users.signups }, { label: 'Neue Workspaces', values: data.workspaces.created }]} />
                        </Card>
                        <Card title="Aktive Nutzer pro Tag" subtitle="Unterschiedliche Akteure im Aktivitäts-Stream">
                            <AreaChart days={data.days} series={[{ label: 'Aktiv', values: data.users.activeDaily, color: 'var(--ac-chart-3)' }]} />
                        </Card>
                        <Card title="KI-Nutzung" subtitle={`Anfragen pro Tag · Monat: ${compact(data.ai.monthTokens)} Tokens, ${num(data.ai.monthImages)} Bilder · Schätzung ${usd(data.ai.usdPerMTokens)}/1M Tokens`} actions={<button className="ac-btn ac-btn--sm" onClick={() => navigate('/ai')}>Details</button>}>
                            <AreaChart days={data.days} bars series={[{ label: 'Text', values: data.ai.text, color: 'var(--ac-chart-2)' }, { label: 'Bilder', values: data.ai.images, color: 'var(--ac-chart-4)' }]} />
                        </Card>
                        <Card title="Crashes" actions={<button className="ac-btn ac-btn--sm" onClick={() => navigate('/crashes')}>Öffnen</button>}>
                            <AreaChart days={data.days} bars series={[{ label: 'Web', values: data.crashes.web }, { label: 'iOS', values: data.crashes.ios, color: 'var(--ac-chart-2)' }]} />
                        </Card>
                    </div>

                    <div className="ac-grid ac-grid--2">
                        <Card title="Login-Methoden" subtitle={`${num(data.users.mfa)} mit 2FA · ${num(data.users.disabled)} gesperrt`}>
                            <BarList items={entries(data.users.providers).map((e) => ({ ...e, label: PROVIDER[e.label] || e.label }))} />
                            <div style={{ marginTop: 10 }}><div className="ac-row" style={{ justifyContent: 'space-between', marginBottom: 4 }}><span className="ac-muted">2FA-Quote</span><b>{pct(data.users.total ? data.users.mfa / data.users.total : 0, 0)}</b></div><Meter value={data.users.total ? data.users.mfa / data.users.total : 0} /></div>
                        </Card>
                        <Card title="Pläne & Abo-Status" subtitle={data.billing.trialsEndingSoon ? `${data.billing.trialsEndingSoon} Tests enden in 7 Tagen` : undefined}>
                            <BarList items={entries(data.billing.plans)} />
                            <div style={{ marginTop: 10 }}><BarList items={entries(data.billing.statuses)} /></div>
                        </Card>
                        <Card title="MCP-Clients"><BarList items={entries(data.mcp.clients)} /></Card>
                        <Card title="Client-Versionen" subtitle="iOS: Geräte der letzten 60 Tage · Web/Desktop: letzte Zustimmung">
                            {(['ios', 'desktop', 'web'] as const).map((p) => Object.keys(data.versions[p]).length > 0 && (
                                <div key={p} style={{ marginBottom: 10 }}>
                                    <p className="ac-section-title">{p === 'ios' ? 'iOS' : p === 'desktop' ? 'Desktop' : 'Web'}</p>
                                    <BarList limit={4} items={entries(data.versions[p]).map((e) => ({ ...e, label: <span className="mono">{e.label}</span> }))} />
                                </div>
                            ))}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};
