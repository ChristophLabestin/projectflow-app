import type { EffortEntry, InvoiceAppendixRow, InvoiceLineItem } from '../../types';
import { newLineId } from './invoiceDefaults';
import { formatInvoiceDate, formatNumber } from '../../utils/invoiceCalc';

const THOUSAND_UNITS = ['k', 'tsd', 'tsd.', 'tausend'];
const MILLION_UNITS = ['mio', 'mio.', 'm', 'mln', 'million', 'millionen', 'mil'];

/** Converts a recorded token amount + unit to a raw token count. */
export const tokensToRaw = (value: number, unit?: string): number => {
    const u = (unit || '').trim().toLowerCase();
    if (THOUSAND_UNITS.includes(u)) return value * 1_000;
    if (MILLION_UNITS.includes(u)) return value * 1_000_000;
    return value; // '', 'Token', 'Tokens', unknown → already raw
};

export type DurationUnitTarget = 'original' | 'h' | 'min';

export interface EffortImportOptions {
    mode: 'sum' | 'individual';
    billDuration: boolean;
    durationRate: number;
    billTokens: boolean;
    tokenRate: number;                  // price per 1 million tokens
    durationUnit?: DurationUnitTarget;  // convert recorded duration to this unit on the invoice
    summaryLabel?: string;
}

const MIN_UNITS = ['min', 'minute', 'minuten', 'minutes', 'm'];
const HOUR_UNITS = ['h', 'std', 'std.', 'stunde', 'stunden', 'hr', 'hrs', 'hour', 'hours'];

/** Converts a recorded duration to the target unit (min ⇄ h). Unknown units pass through. */
const convertDuration = (value: number, unit: string | undefined, target?: DurationUnitTarget): { value: number; unit: string } => {
    const u = (unit || '').trim().toLowerCase();
    const fallback = unit || 'h';
    if (!target || target === 'original') return { value, unit: fallback };

    const inHours = MIN_UNITS.includes(u) ? value / 60 : HOUR_UNITS.includes(u) ? value : null;
    if (inHours === null) return { value, unit: fallback }; // not a recognised time unit
    return target === 'min'
        ? { value: Math.round(inHours * 60 * 100) / 100, unit: 'min' }
        : { value: Math.round(inHours * 100) / 100, unit: 'h' };
};

const groupSumByUnit = (entries: EffortEntry[], pick: (e: EffortEntry) => { value: number; unit: string }) => {
    const map = new Map<string, number>();
    entries.forEach(e => {
        const { value, unit } = pick(e);
        if (!value) return;
        map.set(unit || '', (map.get(unit || '') || 0) + value);
    });
    return map;
};

/** Converts selected effort entries into invoice line items. */
export const effortToLineItems = (entries: EffortEntry[], opts: EffortImportOptions): InvoiceLineItem[] => {
    const items: InvoiceLineItem[] = [];
    const summaryLabel = opts.summaryLabel?.trim() || 'Aufwand';

    if (opts.mode === 'sum') {
        if (opts.billDuration) {
            const grouped = groupSumByUnit(entries, e => convertDuration(Number(e.durationValue) || 0, e.durationUnit, opts.durationUnit));
            const multiUnit = grouped.size > 1;
            grouped.forEach((value, unit) => {
                items.push({
                    id: newLineId(),
                    name: multiUnit ? `${summaryLabel} (${unit})` : summaryLabel,
                    description: `Zusammengefasster Aufwand aus ${entries.length} Einträgen`,
                    quantity: Math.round(value * 100) / 100,
                    unit: unit || 'h',
                    unitPrice: opts.durationRate,
                    useFixedPrice: false,
                    fixedPrice: 0
                });
            });
        }
        if (opts.billTokens) {
            // Tokens are billed per 1 million; quantity carried in millions, the exact
            // (thousand-grouped) count shown in the description.
            const rawTokens = entries.reduce((s, e) => s + tokensToRaw(Number(e.tokenValue) || 0, e.tokenUnit), 0);
            if (rawTokens > 0) {
                items.push({
                    id: newLineId(),
                    name: 'Token-Verbrauch',
                    description: `${formatNumber(rawTokens, 0)} Tokens`,
                    quantity: Math.round((rawTokens / 1_000_000) * 1_000_000) / 1_000_000,
                    unit: 'Mio. Tokens',
                    unitPrice: opts.tokenRate,
                    useFixedPrice: false,
                    fixedPrice: 0
                });
            }
        }
        return items;
    }

    // individual
    entries.forEach(e => {
        const noteParts = [formatInvoiceDate(e.date), e.note].filter(Boolean);
        if (opts.billDuration && (Number(e.durationValue) || 0) > 0) {
            const d = convertDuration(Number(e.durationValue) || 0, e.durationUnit, opts.durationUnit);
            items.push({
                id: newLineId(),
                name: e.task || 'Aufwand',
                description: noteParts.join(' · '),
                quantity: d.value,
                unit: d.unit,
                unitPrice: opts.durationRate,
                useFixedPrice: false,
                fixedPrice: 0
            });
        }
        if (opts.billTokens && (Number(e.tokenValue) || 0) > 0) {
            const rawTokens = tokensToRaw(Number(e.tokenValue) || 0, e.tokenUnit);
            items.push({
                id: newLineId(),
                name: `${e.task || 'Aufwand'} (Token)`,
                description: [`${formatNumber(rawTokens, 0)} Tokens`, ...noteParts].join(' · '),
                quantity: Math.round((rawTokens / 1_000_000) * 1_000_000) / 1_000_000,
                unit: 'Mio. Tokens',
                unitPrice: opts.tokenRate,
                useFixedPrice: false,
                fixedPrice: 0
            });
        }
    });
    return items;
};

/** Builds the detailed appendix rows (Leistungsnachweis) backing a summarised duration position. */
export const effortToAppendix = (entries: EffortEntry[], opts: EffortImportOptions): InvoiceAppendixRow[] => {
    if (!opts.billDuration) return [];
    return entries
        .filter(e => (Number(e.durationValue) || 0) > 0)
        .map(e => {
            const d = convertDuration(Number(e.durationValue) || 0, e.durationUnit, opts.durationUnit);
            return {
                id: newLineId(),
                date: e.date,
                description: e.task || 'Aufwand',
                quantity: d.value,
                unit: d.unit,
                amount: Math.round(d.value * (Number(opts.durationRate) || 0) * 100) / 100,
                note: e.note
            };
        });
};
