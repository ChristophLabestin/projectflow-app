import React, { useLayoutEffect, useRef, useState } from 'react';
import type { Invoice, InvoiceAppendixRow, InvoiceLineItem } from '../../types';
import { computeInvoiceTotals, formatCurrency, formatInvoiceDate, formatNumber, formatQuantity, lineItemTotal } from '../../utils/invoiceCalc';

interface InvoicePreviewProps {
    invoice: Invoice;
    zoom?: number;
    displayNumber?: string; // predicted number shown while the invoice is still a draft
}

const BASE_WIDTH = 720; // px at 100% zoom; cqw font-size scales everything with it
const CAP_SAFETY = 12;  // px slack so we break a touch early rather than overflow

/** One renderable unit placed by the paginator. */
type Block =
    | { k: 'meta' }
    | { k: 'intro' }
    | { k: 'thead' }
    | { k: 'row'; i: number }
    | { k: 'tail' }
    | { k: 'app-header' }
    | { k: 'app-thead' }
    | { k: 'app-row'; i: number }
    | { k: 'app-sum' };

interface Page { header: boolean; blocks: Block[]; }

/**
 * On-screen A4 preview that mirrors the generated PDF (utils/invoicePdf.ts).
 * Classic German business-letter layout. Content is measured and split across
 * real DIN A4 sheets — the table header repeats, totals stay together, the
 * itemised appendix gets its own page(s), and the footer sits on every sheet.
 */
export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, zoom = 1, displayNumber }) => {
    const totals = computeInvoiceTotals(invoice);
    const currency = invoice.currency || 'EUR';
    const issuer = invoice.issuer;
    const customer = invoice.customer || { name: '' };
    const bank = invoice.bank || {};
    const items = invoice.items || [];
    const appendix = invoice.appendix || [];
    const appendixHasAmounts = appendix.some((r) => typeof r.amount === 'number');

    const senderLine = issuer
        ? [issuer.name, issuer.addressLine1, [issuer.zip, issuer.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
        : '';

    const servicePeriod = invoice.serviceDate
        ? (invoice.serviceDateEnd && invoice.serviceDateEnd !== invoice.serviceDate
            ? `${formatInvoiceDate(invoice.serviceDate)} – ${formatInvoiceDate(invoice.serviceDateEnd)}`
            : formatInvoiceDate(invoice.serviceDate))
        : '';

    const vatRateLabel = formatNumber(totals.vatRate, totals.vatRate % 1 === 0 ? 0 : 1);
    const shownNumber = invoice.number || displayNumber || '';

    // --- Block renderers (shared by the measurer and the real pages) -------
    const Header = (
        <>
            <header className="inv-preview__head">
                <div className="inv-preview__brand">
                    {invoice.logoUrl
                        ? <img className="inv-preview__logo" src={invoice.logoUrl} alt="" />
                        : <span className="inv-preview__wordmark">{issuer?.name || 'Logo'}</span>}
                </div>
                <div className="inv-preview__doctitle">Rechnung</div>
            </header>
            <div className="inv-preview__rule" />
            <div className="inv-preview__sender">{senderLine}</div>
        </>
    );

    const MetaBlock = (
        <>
            <div className="inv-preview__body">
                <div className="inv-preview__address">
                    <div className="inv-preview__recipient-name">{customer.name || 'Kundenname'}</div>
                    {customer.contactPerson && <div>{customer.contactPerson}</div>}
                    {customer.addressLine1 && <div>{customer.addressLine1}</div>}
                    {customer.addressLine2 && <div>{customer.addressLine2}</div>}
                    <div>{[customer.zip, customer.city].filter(Boolean).join(' ')}</div>
                    {customer.country && <div>{customer.country}</div>}
                </div>
                <dl className="inv-preview__meta">
                    <dt>Rechnungsnummer:</dt><dd>{shownNumber || 'Entwurf'}</dd>
                    <dt>Rechnungsdatum:</dt><dd>{formatInvoiceDate(invoice.issueDate)}</dd>
                    {servicePeriod && <><dt>Leistungszeitraum:</dt><dd>{servicePeriod}</dd></>}
                    {invoice.dueDate && <><dt>Fällig am:</dt><dd>{formatInvoiceDate(invoice.dueDate)}</dd></>}
                    {customer.customerNumber && <><dt>Kundennummer:</dt><dd>{customer.customerNumber}</dd></>}
                </dl>
            </div>
            <div className="inv-preview__rule" />
        </>
    );

    const Greeting = (
        <div className="inv-preview__greeting">
            <p className="inv-preview__salutation">Sehr geehrte Damen und Herren,</p>
            {invoice.introText && <p className="inv-preview__intro">{invoice.introText}</p>}
        </div>
    );

    const TableColgroup = (
        <colgroup>
            <col className="c-desc" />
            <col className="c-qty" />
            <col className="c-price" />
            <col className="c-total" />
        </colgroup>
    );
    const TableHead = (
        <tr>
            <th>Leistung</th>
            <th className="is-num">Menge</th>
            <th className="is-num">Einzelpreis</th>
            <th className="is-num">Betrag</th>
        </tr>
    );
    const renderRow = (item?: InvoiceLineItem) => {
        if (!item) return null; // pages state can briefly reference a just-deleted row
        const qty = Number(item.quantity) || 0;
        return (
            <tr key={item.id}>
                <td>
                    <div className="inv-preview__item-name">{item.name || '—'}</div>
                    {item.description && <div className="inv-preview__item-desc">{item.description}</div>}
                </td>
                <td className="is-num">{item.useFixedPrice ? '–' : `${formatQuantity(qty)}${item.unit ? ` ${item.unit}` : ''}`}</td>
                <td className="is-num">{item.useFixedPrice ? 'pauschal' : formatCurrency(Number(item.unitPrice) || 0, currency)}</td>
                <td className="is-num is-strong">{formatCurrency(lineItemTotal(item), currency)}</td>
            </tr>
        );
    };

    const Tail = (
        <>
            <div className="inv-preview__totals">
                <div className="inv-preview__rule inv-preview__rule--totals" />
                {totals.vatEnabled && (
                    <>
                        <div className="inv-preview__totals-row">
                            <span>Zwischensumme</span>
                            <span>{formatCurrency(totals.net, currency)}</span>
                        </div>
                        <div className="inv-preview__totals-row">
                            <span>MwSt. ({vatRateLabel}%)</span>
                            <span>{formatCurrency(totals.vat, currency)}</span>
                        </div>
                    </>
                )}
                <div className="inv-preview__grandtotal">
                    <span>Gesamtbetrag</span>
                    <span>{formatCurrency(totals.gross, currency)}</span>
                </div>
            </div>
            <div className="inv-preview__notes">
                {!totals.vatEnabled && <p>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</p>}
                {invoice.dueDate && <p>Bitte überweisen Sie den Gesamtbetrag bis zum {formatInvoiceDate(invoice.dueDate)} auf das unten angegebene Konto.</p>}
                {invoice.notes && <p>{invoice.notes}</p>}
            </div>
            {issuer?.name && (
                <div className="inv-preview__closing">
                    <div>Mit freundlichen Grüßen</div>
                    <div>{issuer.name}</div>
                </div>
            )}
        </>
    );

    const AppHeader = (
        <div className="inv-preview__app-head">
            <div className="inv-preview__app-title">{invoice.appendixTitle || 'Anlage – Einzelnachweis'}</div>
            <div className="inv-preview__app-sub">zu Rechnung {shownNumber}</div>
            <div className="inv-preview__rule" />
        </div>
    );
    const AppColgroup = appendixHasAmounts ? (
        <colgroup>
            <col className="c-app-date" /><col className="c-app-desc" /><col className="c-app-qty" /><col className="c-app-amt" />
        </colgroup>
    ) : (
        <colgroup>
            <col className="c-app-date" /><col className="c-app-desc2" /><col className="c-app-qty2" />
        </colgroup>
    );
    const AppHead = appendixHasAmounts ? (
        <tr><th>Datum</th><th>Leistung</th><th className="is-num">Menge</th><th className="is-num">Betrag</th></tr>
    ) : (
        <tr><th>Datum</th><th>Leistung</th><th className="is-num">Menge</th></tr>
    );
    const renderAppRow = (r?: InvoiceAppendixRow) => {
        if (!r) return null; // pages state can briefly reference a just-removed appendix row
        const qty = Number(r.quantity) || 0;
        const menge = `${formatQuantity(qty)}${r.unit ? ` ${r.unit}` : ''}`;
        return (
            <tr key={r.id}>
                <td>{r.date ? formatInvoiceDate(r.date) : ''}</td>
                <td>
                    <div>{r.description}</div>
                    {r.note && <div className="inv-preview__item-desc">{r.note}</div>}
                </td>
                <td className="is-num">{menge}</td>
                {appendixHasAmounts && <td className="is-num is-strong">{typeof r.amount === 'number' ? formatCurrency(r.amount, currency) : ''}</td>}
            </tr>
        );
    };
    const appSum = appendix.reduce((s, r) => s + (typeof r.amount === 'number' ? r.amount! : 0), 0);
    const AppSum = (
        <div className="inv-preview__app-sum">
            <div className="inv-preview__rule inv-preview__rule--totals" />
            <div className="inv-preview__grandtotal">
                <span>Summe Einzelnachweis</span>
                <span>{formatCurrency(appSum, currency)}</span>
            </div>
        </div>
    );

    const Footer = (
        <footer className="inv-preview__footer">
            <div>
                <div className="inv-preview__footer-head">{issuer?.name}</div>
                {issuer?.addressLine1 && <div>{issuer.addressLine1}</div>}
                <div>{[issuer?.zip, issuer?.city].filter(Boolean).join(' ')}</div>
                {issuer?.country && <div>{issuer.country}</div>}
                {issuer?.phone && <div className="inv-preview__footer-kv">Tel.: {issuer.phone}</div>}
                {issuer?.email && <div>E-Mail: {issuer.email}</div>}
                {issuer?.website && <div>Web: {issuer.website}</div>}
            </div>
            <div>
                <div className="inv-preview__footer-head">Bankverbindung</div>
                {bank.bankName && <div>{bank.bankName}</div>}
                {bank.iban && <div>IBAN: {bank.iban}</div>}
                {bank.bic && <div>BIC: {bank.bic}</div>}
                {issuer?.vatId && <div className="inv-preview__footer-kv">USt-IdNr.: {issuer.vatId}</div>}
                {issuer?.taxNumber && <div>Steuernr.: {issuer.taxNumber}</div>}
            </div>
            <div>
                <div className="inv-preview__footer-head">Hinweis</div>
                {invoice.footerText
                    ? <div>{invoice.footerText}</div>
                    : <div>Vielen Dank für die gute Zusammenarbeit.</div>}
            </div>
        </footer>
    );

    // --- Measurement + pagination -----------------------------------------
    const capRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<Page[]>([]);

    // A signature that changes whenever anything affecting layout changes.
    const sig = JSON.stringify({
        z: zoom,
        items: items.map((i) => [i.id, i.name, i.description, i.quantity, i.unit, i.unitPrice, i.useFixedPrice, i.fixedPrice]),
        app: appendix.map((r) => [r.id, r.date, r.description, r.note, r.quantity, r.unit, r.amount]),
        appTitle: invoice.appendixTitle,
        meta: [invoice.number, displayNumber, invoice.issueDate, invoice.dueDate, invoice.serviceDate, invoice.serviceDateEnd, invoice.introText, invoice.notes, totals.vatEnabled, totals.gross, customer.name, customer.contactPerson, issuer?.name, invoice.logoUrl, invoice.footerText]
    });

    useLayoutEffect(() => {
        const cap = capRef.current;
        const root = measureRef.current;
        if (!cap || !root) return;

        const capacity = cap.clientHeight - CAP_SAFETY;
        const outerH = (el: Element): number => {
            const cs = getComputedStyle(el);
            return el.getBoundingClientRect().height + parseFloat(cs.marginTop || '0') + parseFloat(cs.marginBottom || '0');
        };
        const h = (mk: string): number => {
            const el = root.querySelector(`[data-mk="${CSS.escape(mk)}"]`);
            return el ? outerH(el) : 0;
        };

        const headerH = h('header');
        const metaH = h('meta');
        const greetingH = h('intro');
        const contHeadH = h('conthead'); // the "Rechnung … / date" bar on sheets 2+
        const theadH = items.length ? h('thead') : 0;
        const rowH = items.map((it) => h(`row:${it.id}`));
        const tailH = h('tail');
        const appHeaderH = appendix.length ? h('app-header') : 0;
        const appTheadH = appendix.length ? h('app-thead') : 0;
        const appRowH = appendix.map((r) => h(`app-row:${r.id}`));
        const appSumH = appendix.length && appendixHasAmounts ? h('app-sum') : 0;

        const out: Page[] = [];
        let cur: Page = { header: true, blocks: [] };
        let used = 0;
        let tableOpen = false;

        // Every flushed (continuation) sheet renders a header bar — reserve its height.
        const flush = () => { out.push(cur); cur = { header: false, blocks: [] }; used = contHeadH; tableOpen = false; };

        // Page 1 opener — these always lead the first sheet.
        cur.blocks.push({ k: 'meta' }); used += headerH + metaH;
        cur.blocks.push({ k: 'intro' }); used += greetingH;

        // Positions table — repeat the head whenever it spills to a new sheet.
        items.forEach((_, i) => {
            if (!tableOpen) {
                if (used + theadH + rowH[i] > capacity && used > 0) flush();
                cur.blocks.push({ k: 'thead' }); used += theadH; tableOpen = true;
            } else if (used + rowH[i] > capacity) {
                flush();
                cur.blocks.push({ k: 'thead' }); used += theadH; tableOpen = true;
            }
            cur.blocks.push({ k: 'row', i }); used += rowH[i];
        });

        // Totals + notes + closing stay together.
        if (used + tailH > capacity && used > 0) flush();
        cur.blocks.push({ k: 'tail' });
        flush();

        // Appendix — always opens a fresh sheet.
        if (appendix.length) {
            cur.blocks.push({ k: 'app-header' }); used += appHeaderH;
            tableOpen = false;
            appendix.forEach((_, i) => {
                if (!tableOpen) {
                    if (used + appTheadH + appRowH[i] > capacity && used > 0) flush();
                    cur.blocks.push({ k: 'app-thead' }); used += appTheadH; tableOpen = true;
                } else if (used + appRowH[i] > capacity) {
                    flush();
                    cur.blocks.push({ k: 'app-thead' }); used += appTheadH; tableOpen = true;
                }
                cur.blocks.push({ k: 'app-row', i }); used += appRowH[i];
            });
            if (appendixHasAmounts) {
                if (used + appSumH > capacity && used > 0) flush();
                cur.blocks.push({ k: 'app-sum' });
            }
            flush();
        }

        setPages(out);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sig]);

    // --- Render one paginated sheet ---------------------------------------
    const renderBlocks = (blocks: Block[]): React.ReactNode[] => {
        const out: React.ReactNode[] = [];
        let i = 0;
        while (i < blocks.length) {
            const b = blocks[i];
            if (b.k === 'thead') {
                const rows: number[] = [];
                i++;
                while (i < blocks.length && blocks[i].k === 'row') { rows.push((blocks[i] as { k: 'row'; i: number }).i); i++; }
                out.push(
                    <table className="inv-preview__table" key={`tbl-${i}`}>
                        {TableColgroup}
                        <thead>{TableHead}</thead>
                        <tbody>{rows.map((ri) => renderRow(items[ri]))}</tbody>
                    </table>
                );
                continue;
            }
            if (b.k === 'app-thead') {
                const rows: number[] = [];
                i++;
                while (i < blocks.length && blocks[i].k === 'app-row') { rows.push((blocks[i] as { k: 'app-row'; i: number }).i); i++; }
                out.push(
                    <table className="inv-preview__table inv-preview__table--app" key={`atbl-${i}`}>
                        {AppColgroup}
                        <thead>{AppHead}</thead>
                        <tbody>{rows.map((ri) => renderAppRow(appendix[ri]))}</tbody>
                    </table>
                );
                continue;
            }
            switch (b.k) {
                case 'meta': out.push(<React.Fragment key={`b-${i}`}>{MetaBlock}</React.Fragment>); break;
                case 'intro': out.push(<React.Fragment key={`b-${i}`}>{Greeting}</React.Fragment>); break;
                case 'tail': out.push(<React.Fragment key={`b-${i}`}>{Tail}</React.Fragment>); break;
                case 'app-header': out.push(<React.Fragment key={`b-${i}`}>{AppHeader}</React.Fragment>); break;
                case 'app-sum': out.push(<React.Fragment key={`b-${i}`}>{AppSum}</React.Fragment>); break;
                default: break;
            }
            i++;
        }
        return out;
    };

    return (
        <div className="inv-preview" style={{ width: `${Math.round(BASE_WIDTH * zoom)}px`, maxWidth: 'none' }}>
            {pages.map((page, idx) => (
                <div className="inv-preview__page" key={idx}>
                    <div className="inv-preview__flow">
                        {page.header
                            ? Header
                            : <div className="inv-preview__conthead">
                                <span>Rechnung {shownNumber}</span>
                                <span>{formatInvoiceDate(invoice.issueDate)}</span>
                            </div>}
                        {renderBlocks(page.blocks)}
                    </div>
                    {Footer}
                    {pages.length > 1 && <div className="inv-preview__pageno">Seite {idx + 1} / {pages.length}</div>}
                </div>
            ))}

            {/* Hidden measurement layer — never painted, drives pagination. */}
            <div className="inv-preview__measure" aria-hidden ref={measureRef}>
                <div className="inv-preview__page inv-preview__page--probe">
                    <div className="inv-preview__flow" ref={capRef} />
                    {Footer}
                </div>
                <div className="inv-preview__page inv-preview__page--natural">
                    <div className="inv-preview__flow inv-preview__flow--natural">
                        <div data-mk="header">{Header}</div>
                        <div data-mk="conthead">
                            <div className="inv-preview__conthead"><span>Rechnung {shownNumber}</span><span>{formatInvoiceDate(invoice.issueDate)}</span></div>
                        </div>
                        <div data-mk="meta">{MetaBlock}</div>
                        <div data-mk="intro">{Greeting}</div>
                        {items.length > 0 && (
                            <table className="inv-preview__table">
                                {TableColgroup}
                                <thead data-mk="thead">{TableHead}</thead>
                                <tbody>
                                    {items.map((it) => (
                                        <tr key={it.id} data-mk={`row:${it.id}`}>
                                            <td>
                                                <div className="inv-preview__item-name">{it.name || '—'}</div>
                                                {it.description && <div className="inv-preview__item-desc">{it.description}</div>}
                                            </td>
                                            <td className="is-num">{it.useFixedPrice ? '–' : `${formatQuantity(Number(it.quantity) || 0)}${it.unit ? ` ${it.unit}` : ''}`}</td>
                                            <td className="is-num">{it.useFixedPrice ? 'pauschal' : formatCurrency(Number(it.unitPrice) || 0, currency)}</td>
                                            <td className="is-num is-strong">{formatCurrency(lineItemTotal(it), currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <div data-mk="tail">{Tail}</div>
                        {appendix.length > 0 && (
                            <>
                                <div data-mk="app-header">{AppHeader}</div>
                                <table className="inv-preview__table inv-preview__table--app">
                                    {AppColgroup}
                                    <thead data-mk="app-thead">{AppHead}</thead>
                                    <tbody>
                                        {appendix.map((r) => (
                                            <tr key={r.id} data-mk={`app-row:${r.id}`}>
                                                <td>{r.date ? formatInvoiceDate(r.date) : ''}</td>
                                                <td>
                                                    <div>{r.description}</div>
                                                    {r.note && <div className="inv-preview__item-desc">{r.note}</div>}
                                                </td>
                                                <td className="is-num">{`${formatQuantity(Number(r.quantity) || 0)}${r.unit ? ` ${r.unit}` : ''}`}</td>
                                                {appendixHasAmounts && <td className="is-num is-strong">{typeof r.amount === 'number' ? formatCurrency(r.amount, currency) : ''}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {appendixHasAmounts && <div data-mk="app-sum">{AppSum}</div>}
                            </>
                        )}
                    </div>
                    {Footer}
                </div>
            </div>
        </div>
    );
};
