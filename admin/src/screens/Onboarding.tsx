import React, { useMemo, useState } from 'react';
import { useAdminQuery } from '../lib/useAsync';
import { num, pct } from '../lib/format';
import { AreaChart, BarList } from '../ui/charts';
import { dayKeyList } from '../lib/days';
import { Card, ErrorNote, PageHead, Segmented, Skeleton, Stat } from '../ui/primitives';

type Stats = { total: number; sinceDays: number | null; platforms: Record<string, number>; questions: Record<string, Record<string, number>>; days: Record<string, number> };

// Option ids are a contract with web/ios (web/utils/onboardingSurvey.ts); labels as in web/locales/de.ts.
const QUESTIONS: { id: string; label: string; options: Record<string, string> }[] = [
    { id: 'role', label: 'Rolle', options: { founder: 'Gründer:in', project_manager: 'Projektmanager:in', developer: 'Entwickler:in', designer: 'Designer:in', marketing: 'Marketing', agency_freelancer: 'Agentur / Freelancer:in', other: 'Etwas anderes' } },
    { id: 'useCases', label: 'Wofür (Mehrfachauswahl)', options: { client_projects: 'Kundenprojekte', product_development: 'Produktentwicklung', startup: 'Startup gründen', marketing: 'Marketing', team_organization: 'Team organisieren', personal: 'Persönliche Aufgaben' } },
    { id: 'teamSize', label: 'Teamgröße', options: { solo: 'Nur ich', '2_5': '2–5', '6_20': '6–20', '21_50': '21–50', '50_plus': 'Über 50' } },
    { id: 'industry', label: 'Branche', options: { software: 'Software / IT', agency: 'Agentur', ecommerce: 'E-Commerce', consulting: 'Beratung', education: 'Bildung', other: 'Andere' } },
    { id: 'source', label: 'Wie gefunden', options: { google: 'Google', app_store: 'App Store', linkedin: 'LinkedIn', instagram_tiktok: 'Instagram / TikTok', referral: 'Empfehlung', article: 'Artikel / Blog', event: 'Event', other: 'Sonstiges' } },
    { id: 'previousTool', label: 'Bisheriges Tool', options: { asana: 'Asana', trello: 'Trello', notion: 'Notion', jira: 'Jira', clickup: 'ClickUp', monday: 'monday.com', spreadsheet: 'Tabellen / Excel', none: 'Noch keins', other: 'Anderes' } },
];

export const Onboarding: React.FC = () => {
    const [range, setRange] = useState('30');
    const { data, loading, error, reload } = useAdminQuery<Stats>('onboarding.stats', { sinceDays: range === 'all' ? null : Number(range) });
    const days = useMemo(() => dayKeyList(range === 'all' ? 90 : Number(range)), [range]);
    const total = data?.total ?? 0;

    return (
        <div className="ac-page">
            <PageHead title="Onboarding" subtitle="Antworten der Onboarding-Umfrage (Web + iOS), aggregiert. Keine Einzelantworten." actions={<Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7 T.' }, { value: '30', label: '30 T.' }, { value: '90', label: '90 T.' }, { value: 'all', label: 'Gesamt' }]} />} />
            <ErrorNote error={error} onRetry={reload} />
            {loading && !data ? <Skeleton /> : data && (
                <div className="ac-stack">
                    <div className="ac-grid ac-grid--stats">
                        <Stat label="Antworten" value={num(total)} series={days.map((d) => data.days?.[d] || 0)} />
                        {Object.entries(data.platforms).map(([platform, count]) => <Stat key={platform} label={platform === 'ios' ? 'iOS' : platform === 'web' ? 'Web' : platform} value={num(count)} meta={pct(total ? count / total : 0, 0)} />)}
                    </div>
                    <Card title={range === 'all' ? 'Antworten pro Tag (letzte 90 Tage)' : 'Antworten pro Tag'}>
                        <AreaChart days={days} series={[{ label: 'Antworten', values: days.map((d) => data.days?.[d] || 0) }]} height={160} bars />
                    </Card>
                    <div className="ac-grid ac-grid--3">
                        {QUESTIONS.map((q) => {
                            const counts = data.questions[q.id] || {};
                            const answered = Object.values(counts).reduce((a, b) => a + b, 0);
                            return (
                                <Card key={q.id} title={q.label} subtitle={`${num(answered)} Antworten`}>
                                    <BarList limit={10} format={(v) => `${num(v)} · ${pct(total ? v / total : 0, 0)}`} items={Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ key: id, label: q.options[id] || id, value }))} />
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
