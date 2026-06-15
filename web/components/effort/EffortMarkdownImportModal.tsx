import React, { useMemo, useState } from 'react';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { useLanguage } from '../../context/LanguageContext';
import { parseEffortMarkdown } from '../../utils/effortMarkdown';
import { formatNumber, formatInvoiceDate } from '../../utils/invoiceCalc';

interface EffortMarkdownImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (rows: ReturnType<typeof parseEffortMarkdown>['rows']) => Promise<void> | void;
}

const SAMPLE = `| Datum | Aufgabe | Dauer (Wert) | Dauer (Einheit) | Token (Wert) | Token (Einheit) | Notiz |
| --- | --- | --- | --- | --- | --- | --- |
| 14.06.2026 | Setup & Konzept | 3,5 | h | 120 | k | Kickoff |`;

export const EffortMarkdownImportModal: React.FC<EffortMarkdownImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const { t } = useLanguage();
    const [text, setText] = useState('');
    const [importing, setImporting] = useState(false);

    const result = useMemo(() => parseEffortMarkdown(text), [text]);

    const handleImport = async () => {
        if (result.rows.length === 0) return;
        setImporting(true);
        try {
            await onImport(result.rows);
            setText('');
            onClose();
        } finally {
            setImporting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('effort.md.title', 'Aufwand aus Markdown importieren')}
            size="lg"
            footer={(
                <div className="inv-modal-footer">
                    <span className="effort-import__summary">
                        {t('effort.md.detected', '{count} Zeile(n) erkannt').replace('{count}', String(result.rows.length))}
                    </span>
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Abbrechen')}</Button>
                    <Button variant="primary" onClick={handleImport} isLoading={importing} disabled={result.rows.length === 0}>
                        {t('effort.md.import', 'Importieren')}
                    </Button>
                </div>
            )}
        >
            <div className="effort-md">
                <p className="effort-md__hint">{t('effort.md.hint', 'Füge eine Markdown-Tabelle mit den Spalten Datum, Aufgabe, Dauer (Wert), Dauer (Einheit), Token (Wert), Token (Einheit), Notiz ein.')}</p>
                <textarea
                    className="effort-md__input"
                    rows={8}
                    value={text}
                    placeholder={SAMPLE}
                    onChange={e => setText(e.target.value)}
                />
                {result.rows.length > 0 && (
                    <div className="effort-md__preview">
                        <div className="effort-md__preview-head">{t('effort.md.preview', 'Vorschau')}</div>
                        <table className="effort-md__table">
                            <thead>
                                <tr>
                                    <th>{t('effort.col.date', 'Datum')}</th>
                                    <th>{t('effort.col.task', 'Aufgabe')}</th>
                                    <th className="is-num">{t('effort.col.duration', 'Dauer')}</th>
                                    <th className="is-num">{t('effort.col.token', 'Token')}</th>
                                    <th>{t('effort.col.note', 'Notiz')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.rows.slice(0, 12).map((r, i) => (
                                    <tr key={i}>
                                        <td>{formatInvoiceDate(r.date)}</td>
                                        <td>{r.task}</td>
                                        <td className="is-num">{r.durationValue ? `${formatNumber(r.durationValue)} ${r.durationUnit}` : '—'}</td>
                                        <td className="is-num">{r.tokenValue ? `${formatNumber(r.tokenValue)} ${r.tokenUnit || ''}` : '—'}</td>
                                        <td>{r.note}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {result.rows.length > 12 && (
                            <div className="effort-md__more">{t('effort.md.more', '… und {n} weitere').replace('{n}', String(result.rows.length - 12))}</div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
