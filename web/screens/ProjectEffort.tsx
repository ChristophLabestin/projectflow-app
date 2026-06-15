import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';
import { Button } from '../components/common/Button/Button';
import { BareNumberInput } from '../components/common/Input/NumberInput';
import { EffortMarkdownImportModal } from '../components/effort/EffortMarkdownImportModal';
import { effortToMarkdown } from '../utils/effortMarkdown';
import { formatNumber } from '../utils/invoiceCalc';
import {
    createEffortEntries,
    createEffortEntry,
    deleteEffortEntry,
    getProjectEffort,
    updateEffortEntry
} from '../services/domain/effortService';
import { getProjectInvoices } from '../services/domain/invoiceService';
import type { EffortEntry } from '../types';

type EditableField = 'date' | 'task' | 'durationValue' | 'durationUnit' | 'tokenValue' | 'tokenUnit' | 'note';

const DURATION_UNITS = ['h', 'min', 'Tag'];
const TOKEN_UNITS = ['', 'Token', 'k', 'Mio.'];
const withCurrent = (options: string[], current?: string) =>
    (current && !options.includes(current) ? [current, ...options] : options);

const todayIso = () => new Date().toISOString().slice(0, 10);

const sumByUnit = (rows: EffortEntry[], pick: (e: EffortEntry) => { value: number; unit: string }) => {
    const map = new Map<string, number>();
    rows.forEach(e => {
        const { value, unit } = pick(e);
        if (!value) return;
        map.set(unit || '—', (map.get(unit || '—') || 0) + value);
    });
    return map;
};

export const ProjectEffort: React.FC = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const { showError, showSuccess } = useToast();

    const [rows, setRows] = useState<EffortEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [mdOpen, setMdOpen] = useState(false);
    // IDs of effort entries billed on a FINALISED (non-draft) invoice — locked here.
    // Drafts don't lock: their effort can still be edited and new effort added.
    const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!projectId) return;
        getProjectEffort(projectId)
            .then(setRows)
            .catch(() => showError(t('effort.toast.loadError', 'Aufwand konnte nicht geladen werden.')))
            .finally(() => setLoading(false));
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        getProjectInvoices(projectId)
            .then(list => setLockedIds(new Set(
                list.filter(inv => inv.status !== 'draft').flatMap(inv => inv.effortEntryIds || [])
            )))
            .catch(() => setLockedIds(new Set()));
    }, [projectId]);

    const isLocked = (id: string) => lockedIds.has(id);

    const setField = (id: string, field: EditableField, value: string) => {
        if (isLocked(id)) return;
        setRows(prev => prev.map(r => r.id === id
            ? { ...r, [field]: field === 'durationValue' || field === 'tokenValue' ? (Number(value.replace(',', '.')) || 0) : value }
            : r));
    };

    const setNumField = (id: string, field: 'durationValue' | 'tokenValue', n: number) => {
        if (isLocked(id)) return;
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: n } : r));
    };

    const persistRow = async (id: string, override?: Partial<EffortEntry>) => {
        if (isLocked(id)) return;
        const base = rows.find(r => r.id === id);
        if (!base || !projectId) return;
        const row = { ...base, ...override };
        try {
            await updateEffortEntry(projectId, id, {
                date: row.date,
                task: row.task,
                durationValue: row.durationValue,
                durationUnit: row.durationUnit,
                tokenValue: row.tokenValue,
                tokenUnit: row.tokenUnit,
                note: row.note
            });
        } catch {
            showError(t('effort.toast.saveError', 'Speichern fehlgeschlagen.'));
        }
    };

    // Selects commit immediately (no blur needed) with the explicit new value.
    const setUnit = (id: string, field: 'durationUnit' | 'tokenUnit', value: string) => {
        if (isLocked(id)) return;
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        persistRow(id, { [field]: value });
    };

    const addRow = async () => {
        if (!projectId) return;
        const draft = { date: todayIso(), task: '', durationValue: 0, durationUnit: 'h', tokenValue: 0, tokenUnit: '', note: '' };
        try {
            const id = await createEffortEntry(projectId, draft);
            setRows(prev => [{ id, projectId, ...draft }, ...prev]);
        } catch {
            showError(t('effort.toast.saveError', 'Speichern fehlgeschlagen.'));
        }
    };

    const removeRow = async (id: string) => {
        if (!projectId || isLocked(id)) return;
        const prev = rows;
        setRows(rows.filter(r => r.id !== id));
        try {
            await deleteEffortEntry(projectId, id);
        } catch {
            setRows(prev);
            showError(t('effort.toast.deleteError', 'Löschen fehlgeschlagen.'));
        }
    };

    const handleImport = async (parsed: Array<Omit<EffortEntry, 'id' | 'projectId' | 'tenantId' | 'createdAt' | 'updatedAt'>>) => {
        if (!projectId || parsed.length === 0) return;
        try {
            await createEffortEntries(projectId, parsed);
            const fresh = await getProjectEffort(projectId);
            setRows(fresh);
            showSuccess(t('effort.toast.imported', '{n} Einträge importiert.').replace('{n}', String(parsed.length)));
        } catch {
            showError(t('effort.toast.importError', 'Import fehlgeschlagen.'));
        }
    };

    const copyMarkdown = async () => {
        try {
            await navigator.clipboard.writeText(effortToMarkdown(rows));
            showSuccess(t('effort.toast.copied', 'Als Markdown kopiert.'));
        } catch {
            showError(t('effort.toast.copyError', 'Kopieren fehlgeschlagen.'));
        }
    };

    const durationTotals = useMemo(() => sumByUnit(rows, e => ({ value: Number(e.durationValue) || 0, unit: e.durationUnit || 'h' })), [rows]);
    const tokenTotals = useMemo(() => sumByUnit(rows, e => ({ value: Number(e.tokenValue) || 0, unit: e.tokenUnit || 'Token' })), [rows]);

    if (!projectId) return null;

    return (
        <div className="effort-screen">
            <header className="inv-screen__header">
                <div>
                    <h1 className="inv-screen__title">{t('effort.title', 'Aufwand')}</h1>
                    <p className="inv-screen__subtitle">{t('effort.subtitle', 'Erfasse geleisteten Aufwand und übernimm ihn später in eine Rechnung.')}</p>
                </div>
                <div className="inv-screen__actions">
                    <Button variant="ghost" onClick={copyMarkdown} icon={<span className="material-symbols-outlined">content_copy</span>}>
                        {t('effort.copyMarkdown', 'Als Markdown')}
                    </Button>
                    <Button variant="secondary" onClick={() => setMdOpen(true)} icon={<span className="material-symbols-outlined">table_view</span>}>
                        {t('effort.import', 'Markdown importieren')}
                    </Button>
                    <Button variant="primary" onClick={addRow} icon={<span className="material-symbols-outlined">add</span>}>
                        {t('effort.addRow', 'Zeile')}
                    </Button>
                </div>
            </header>

            {!loading && rows.length > 0 && (
                <div className="effort-summary">
                    <div className="inv-stat">
                        <span className="inv-stat__label">{t('effort.summary.entries', 'Einträge')}</span>
                        <span className="inv-stat__value">{rows.length}</span>
                    </div>
                    {[...durationTotals.entries()].map(([unit, val]) => (
                        <div className="inv-stat" key={`d-${unit}`}>
                            <span className="inv-stat__label">{t('effort.summary.duration', 'Dauer')} ({unit})</span>
                            <span className="inv-stat__value">{formatNumber(val)}</span>
                        </div>
                    ))}
                    {[...tokenTotals.entries()].map(([unit, val]) => (
                        <div className="inv-stat" key={`tk-${unit}`}>
                            <span className="inv-stat__label">{t('effort.summary.token', 'Token')} ({unit})</span>
                            <span className="inv-stat__value">{formatNumber(val, 0)}</span>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="inv-screen__empty">{t('common.loading', 'Wird geladen…')}</div>
            ) : rows.length === 0 ? (
                <div className="inv-screen__empty">
                    <span className="material-symbols-outlined">schedule</span>
                    <h3>{t('effort.emptyTitle', 'Noch kein Aufwand erfasst')}</h3>
                    <p>{t('effort.emptyHint', 'Lege eine Zeile an oder importiere eine Markdown-Tabelle.')}</p>
                    <div className="inv-screen__actions">
                        <Button variant="secondary" onClick={() => setMdOpen(true)} icon={<span className="material-symbols-outlined">table_view</span>}>
                            {t('effort.import', 'Markdown importieren')}
                        </Button>
                        <Button variant="primary" onClick={addRow} icon={<span className="material-symbols-outlined">add</span>}>
                            {t('effort.addRow', 'Zeile')}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="effort-table">
                    <div className="effort-table__head">
                        <span>{t('effort.col.date', 'Datum')}</span>
                        <span>{t('effort.col.task', 'Aufgabe')}</span>
                        <span>{t('effort.col.durationValue', 'Dauer (Wert)')}</span>
                        <span>{t('effort.col.durationUnit', 'Dauer (Einheit)')}</span>
                        <span>{t('effort.col.tokenValue', 'Token (Wert)')}</span>
                        <span>{t('effort.col.tokenUnit', 'Token (Einheit)')}</span>
                        <span>{t('effort.col.note', 'Notiz')}</span>
                        <span className="is-actions" />
                    </div>
                    {rows.map(row => {
                        const locked = isLocked(row.id);
                        return (
                        <div className={`effort-table__row ${locked ? 'is-locked' : ''}`} key={row.id}>
                            <input type="date" value={row.date} disabled={locked} onChange={e => setField(row.id, 'date', e.target.value)} onBlur={() => persistRow(row.id)} />
                            <input value={row.task} disabled={locked} placeholder={t('effort.col.task', 'Aufgabe')} onChange={e => setField(row.id, 'task', e.target.value)} onBlur={() => persistRow(row.id)} />
                            <BareNumberInput value={row.durationValue || 0} disabled={locked} onValueChange={n => setNumField(row.id, 'durationValue', n)} onBlur={() => persistRow(row.id)} />
                            <select value={row.durationUnit} disabled={locked} onChange={e => setUnit(row.id, 'durationUnit', e.target.value)}>
                                {withCurrent(DURATION_UNITS, row.durationUnit).map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <BareNumberInput value={row.tokenValue || 0} disabled={locked} onValueChange={n => setNumField(row.id, 'tokenValue', n)} onBlur={() => persistRow(row.id)} />
                            <select value={row.tokenUnit || ''} disabled={locked} onChange={e => setUnit(row.id, 'tokenUnit', e.target.value)}>
                                {withCurrent(TOKEN_UNITS, row.tokenUnit).map(u => <option key={u || 'none'} value={u}>{u || '—'}</option>)}
                            </select>
                            <input value={row.note || ''} disabled={locked} onChange={e => setField(row.id, 'note', e.target.value)} onBlur={() => persistRow(row.id)} />
                            {locked ? (
                                <span className="inv-icon-btn inv-icon-btn--locked" title={t('effort.locked.hint', 'In einer gespeicherten Rechnung enthalten – nicht änderbar.')}>
                                    <span className="material-symbols-outlined">lock</span>
                                </span>
                            ) : (
                                <button type="button" className="inv-icon-btn inv-icon-btn--danger" title={t('common.delete', 'Löschen')} onClick={() => removeRow(row.id)}>
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            )}
                        </div>
                        );
                    })}
                </div>
            )}

            <EffortMarkdownImportModal isOpen={mdOpen} onClose={() => setMdOpen(false)} onImport={handleImport} />
        </div>
    );
};

export default ProjectEffort;
