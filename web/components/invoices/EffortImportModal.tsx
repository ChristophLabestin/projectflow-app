import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { BareNumberInput } from '../common/Input/NumberInput';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import type { EffortEntry, InvoiceAppendixRow, InvoiceLineItem } from '../../types';
import { getProjectEffort } from '../../services/domain/effortService';
import { effortToAppendix, effortToLineItems, type EffortImportOptions } from './effortLineItems';
import { lineItemTotal, formatCurrency, formatInvoiceDate, formatNumber } from '../../utils/invoiceCalc';

interface EffortImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    currency: string;
    onApply: (items: InvoiceLineItem[], appendix?: InvoiceAppendixRow[], effortEntryIds?: string[]) => void;
}

export const EffortImportModal: React.FC<EffortImportModalProps> = ({ isOpen, onClose, projectId, currency, onApply }) => {
    const { t } = useLanguage();
    const { showError } = useToast();
    const [entries, setEntries] = useState<EffortEntry[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'sum' | 'individual'>('sum');
    const [billDuration, setBillDuration] = useState(true);
    const [durationRate, setDurationRate] = useState(0);
    const [durationUnit, setDurationUnit] = useState<'h' | 'min' | 'original'>('h');
    const [billTokens, setBillTokens] = useState(false);
    const [tokenRate, setTokenRate] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        getProjectEffort(projectId)
            .then(list => { setEntries(list); setSelected(new Set(list.map(e => e.id))); })
            .catch(() => { setEntries([]); showError(t('effort.import.loadError', 'Aufwand konnte nicht geladen werden.')); })
            .finally(() => setLoading(false));
    }, [isOpen, projectId]);

    const selectedEntries = useMemo(() => entries.filter(e => selected.has(e.id)), [entries, selected]);

    const options: EffortImportOptions = { mode, billDuration, durationRate, durationUnit, billTokens, tokenRate };
    // Page 1 always shows a collected position with the total — both modes summarise
    // on the invoice itself; "individual" additionally lists each entry as an appendix.
    const previewItems = useMemo(() => effortToLineItems(selectedEntries, { ...options, mode: 'sum' }),
        [selectedEntries, billDuration, durationRate, durationUnit, billTokens, tokenRate]);
    const previewNet = previewItems.reduce((s, i) => s + lineItemTotal(i), 0);

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const allSelected = entries.length > 0 && selected.size === entries.length;
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(entries.map(e => e.id)));

    const handleApply = () => {
        if (previewItems.length === 0) {
            showError(t('effort.import.nothing', 'Keine abrechenbaren Positionen ausgewählt.'));
            return;
        }
        const appendix = mode === 'individual'
            ? effortToAppendix(selectedEntries, options)
            : undefined;
        onApply(previewItems, appendix && appendix.length ? appendix : undefined, selectedEntries.map(e => e.id));
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('effort.import.title', 'Aufwand in Rechnung übernehmen')}
            size="lg"
            footer={(
                <div className="inv-modal-footer">
                    <span className="effort-import__summary">
                        {t('effort.import.resultCount', '{count} Position(en)').replace('{count}', String(previewItems.length))}
                        {' · '}{formatCurrency(previewNet, currency)}
                    </span>
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Abbrechen')}</Button>
                    <Button variant="primary" onClick={handleApply}>{t('effort.import.apply', 'Übernehmen')}</Button>
                </div>
            )}
        >
            {loading ? (
                <div className="inv-settings__loading">{t('common.loading', 'Wird geladen…')}</div>
            ) : entries.length === 0 ? (
                <div className="effort-import__empty">{t('effort.import.empty', 'Für dieses Projekt wurde noch kein Aufwand erfasst.')}</div>
            ) : (
                <div className="effort-import">
                    <div className="effort-import__seg" role="tablist">
                        <button type="button" className={`effort-import__seg-btn ${mode === 'sum' ? 'is-active' : ''}`} onClick={() => setMode('sum')}>
                            {t('effort.import.modeSum', 'Nur Sammelposition')}
                        </button>
                        <button type="button" className={`effort-import__seg-btn ${mode === 'individual' ? 'is-active' : ''}`} onClick={() => setMode('individual')}>
                            {t('effort.import.modeIndividual', 'Einzeln auflisten')}
                        </button>
                    </div>

                    <p className="effort-import__note">
                        {mode === 'individual'
                            ? t('effort.import.noteIndividual', 'Seite 1 zeigt eine Sammelposition mit Gesamtbetrag, die Einzelpositionen werden ab Seite 2 als Anlage aufgelistet.')
                            : t('effort.import.noteSum', 'Der gesamte Aufwand erscheint als eine Position auf der Rechnung.')}
                    </p>

                    <div className="effort-import__bill">
                        <div className="effort-import__billrow">
                            <label className="effort-import__toggle">
                                <input type="checkbox" checked={billDuration} onChange={e => setBillDuration(e.target.checked)} />
                                <span>{t('effort.import.billDuration', 'Dauer abrechnen')}</span>
                            </label>
                            <label className="effort-import__field">
                                <span>{t('effort.import.durationUnit', 'Einheit')}</span>
                                <select disabled={!billDuration} value={durationUnit} onChange={e => setDurationUnit(e.target.value as 'h' | 'min' | 'original')}>
                                    <option value="h">{t('effort.import.unitHours', 'Stunden (h)')}</option>
                                    <option value="min">{t('effort.import.unitMinutes', 'Minuten (min)')}</option>
                                    <option value="original">{t('effort.import.unitOriginal', 'Wie erfasst')}</option>
                                </select>
                            </label>
                            <label className="effort-import__field">
                                <span>{t('effort.import.durationRate', 'Satz / Einheit')}</span>
                                <BareNumberInput disabled={!billDuration} value={durationRate} onValueChange={setDurationRate} />
                            </label>
                        </div>
                        <div className="effort-import__billrow">
                            <label className="effort-import__toggle">
                                <input type="checkbox" checked={billTokens} onChange={e => setBillTokens(e.target.checked)} />
                                <span>{t('effort.import.billTokens', 'Token abrechnen')}</span>
                            </label>
                            <label className="effort-import__field effort-import__field--last">
                                <span>{t('effort.import.tokenRate', 'Satz / 1 Mio. Tokens')}</span>
                                <BareNumberInput disabled={!billTokens} value={tokenRate} onValueChange={setTokenRate} />
                            </label>
                        </div>
                    </div>

                    <div className="effort-import__list">
                        <label className="effort-import__row effort-import__row--head">
                            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                            <span>{t('effort.col.date', 'Datum')}</span>
                            <span>{t('effort.col.task', 'Aufgabe')}</span>
                            <span className="is-num">{t('effort.col.duration', 'Dauer')}</span>
                            <span className="is-num">{t('effort.col.token', 'Token')}</span>
                        </label>
                        {entries.map(e => (
                            <label className="effort-import__row" key={e.id}>
                                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                                <span>{formatInvoiceDate(e.date)}</span>
                                <span className="effort-import__task">{e.task}</span>
                                <span className="is-num">{e.durationValue ? `${formatNumber(e.durationValue)} ${e.durationUnit}` : '—'}</span>
                                <span className="is-num">{e.tokenValue ? `${formatNumber(e.tokenValue, 0)} ${e.tokenUnit || ''}` : '—'}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
};
