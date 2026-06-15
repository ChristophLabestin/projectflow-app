import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice } from '../types';
import { computeInvoiceTotals, formatCurrency, formatInvoiceDate, formatNumber, formatQuantity, lineItemTotal } from './invoiceCalc';

// A4 portrait, millimetres. DIN 5008 writing area: left 25mm, right 20mm.
const PAGE_W = 210;
const PAGE_H = 297;
const ML = 25;
const MR = 20;
const MT = 20;
const CONTENT_W = PAGE_W - ML - MR; // 165mm

const SALUTATION = 'Sehr geehrte Damen und Herren,';

const INK: [number, number, number] = [26, 26, 29];
const SOFT: [number, number, number] = [68, 68, 76];
const MUTED: [number, number, number] = [107, 107, 115];
const HAIR: [number, number, number] = [205, 205, 211];

const PT_MM = 0.3528;
const lh = (pt: number, f = 1.3) => pt * f * PT_MM;

interface LoadedImage { dataUrl: string; width: number; height: number; }

const loadImage = (url: string): Promise<LoadedImage | null> => new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });
        } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
});

const hairline = (doc: jsPDF, y: number, color = HAIR, w = 0.2) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(w);
    doc.line(ML, y, PAGE_W - MR, y);
};

const drawFooter = (doc: jsPDF, invoice: Invoice, page: number, pages: number) => {
    const top = PAGE_H - 36;
    hairline(doc, top, HAIR, 0.2);

    const i = invoice.issuer || { name: '' };
    const b = invoice.bank || {};
    const colW = CONTENT_W / 3;
    const headY = top + 5;
    const rh = lh(7.5, 1.45);

    const cols: Array<{ head: string; lines: string[] }> = [
        {
            head: i.name || '',
            lines: [
                i.addressLine1,
                [i.zip, i.city].filter(Boolean).join(' '),
                i.country,
                i.phone ? `Tel.: ${i.phone}` : '',
                i.email ? `E-Mail: ${i.email}` : '',
                i.website ? `Web: ${i.website}` : ''
            ].filter(Boolean) as string[]
        },
        {
            head: 'Bankverbindung',
            lines: [
                b.bankName || '',
                b.iban ? `IBAN: ${b.iban}` : '',
                b.bic ? `BIC: ${b.bic}` : '',
                i.vatId ? `USt-IdNr.: ${i.vatId}` : '',
                i.taxNumber ? `Steuernr.: ${i.taxNumber}` : ''
            ].filter(Boolean) as string[]
        },
        {
            head: 'Hinweis',
            lines: [invoice.footerText?.trim() || 'Vielen Dank für die gute Zusammenarbeit.']
        }
    ];

    cols.forEach((col, idx) => {
        const x = ML + idx * colW;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...INK);
        doc.text(doc.splitTextToSize(col.head, colW - 4), x, headY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        let y = headY + 4.5;
        col.lines.forEach((line) => {
            const wrapped = doc.splitTextToSize(line, colW - 4);
            doc.text(wrapped, x, y);
            y += wrapped.length * rh;
        });
    });

    if (pages > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text(`Seite ${page} / ${pages}`, PAGE_W - MR, PAGE_H - 4, { align: 'right' });
    }
};

export const buildInvoicePdf = async (invoice: Invoice): Promise<jsPDF> => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const totals = computeInvoiceTotals(invoice);
    const currency = invoice.currency || 'EUR';
    const issuer = invoice.issuer;
    const customer = invoice.customer || { name: '' };

    // ---- Header: logo / wordmark (left) + "Rechnung" (right) ---------------
    let logoDrawn = false;
    if (invoice.logoUrl) {
        const logo = await loadImage(invoice.logoUrl);
        if (logo) {
            const maxW = 55, maxH = 16;
            const r = logo.width / logo.height;
            let w = maxW, h = w / r;
            if (h > maxH) { h = maxH; w = h * r; }
            doc.addImage(logo.dataUrl, 'PNG', ML, MT, w, h);
            logoDrawn = true;
        }
    }
    if (!logoDrawn && issuer) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.setTextColor(...INK);
        doc.text((issuer.name || '').toUpperCase(), ML, MT + 9, { charSpace: 1.1 });
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(30);
    doc.setTextColor(...INK);
    doc.text('Rechnung', PAGE_W - MR, MT + 11, { align: 'right' });

    hairline(doc, MT + 22, HAIR, 0.2);

    // ---- Sender line ------------------------------------------------------
    let y = MT + 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const sender = issuer ? [issuer.name, issuer.addressLine1, [issuer.zip, issuer.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : '';
    doc.text(sender, ML, y);

    // ---- Recipient (left) -------------------------------------------------
    const blockTop = y + 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(customer.name || 'Kundenname', ML, blockTop);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const custLines = [
        customer.contactPerson,
        customer.addressLine1,
        customer.addressLine2,
        [customer.zip, customer.city].filter(Boolean).join(' '),
        customer.country
    ].filter(Boolean) as string[];
    custLines.forEach((line, idx) => doc.text(line, ML, blockTop + 5 + idx * 4.7));
    const recipientBottom = blockTop + 5 + custLines.length * 4.7;

    // ---- Meta (right) -----------------------------------------------------
    const metaLabelX = 120;
    const metaValueX = 158;
    const metaRows: Array<[string, string]> = [
        ['Rechnungsnummer:', invoice.number || 'Entwurf'],
        ['Rechnungsdatum:', formatInvoiceDate(invoice.issueDate)]
    ];
    if (invoice.serviceDate) {
        const svc = invoice.serviceDateEnd && invoice.serviceDateEnd !== invoice.serviceDate
            ? `${formatInvoiceDate(invoice.serviceDate)} – ${formatInvoiceDate(invoice.serviceDateEnd)}`
            : formatInvoiceDate(invoice.serviceDate);
        metaRows.push(['Leistungszeitraum:', svc]);
    }
    if (invoice.dueDate) metaRows.push(['Fällig am:', formatInvoiceDate(invoice.dueDate)]);
    if (customer.customerNumber) metaRows.push(['Kundennummer:', customer.customerNumber]);

    let my = blockTop;
    doc.setFontSize(9.5);
    metaRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MUTED);
        doc.text(label, metaLabelX, my);
        doc.setTextColor(...INK);
        doc.text(value, metaValueX, my);
        my += 6.2;
    });

    hairline(doc, Math.max(recipientBottom, my) + 4, HAIR, 0.2);
    let cursorY = Math.max(recipientBottom, my) + 13;

    // ---- Salutation (generic) + greeting ----------------------------------
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(SALUTATION, ML, cursorY);
    cursorY += lh(10, 1.5) + (invoice.introText && invoice.introText.trim() ? 3 : 6);

    if (invoice.introText && invoice.introText.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        const intro = doc.splitTextToSize(invoice.introText.trim(), CONTENT_W);
        doc.text(intro, ML, cursorY);
        cursorY += intro.length * lh(10, 1.5) + 6;
    }

    // ---- Positions: Leistung | Menge | Einzelpreis | Betrag ---------------
    const padC = 1.4;
    const items = invoice.items || [];
    const descColWidth = 84;
    const descTextWidth = descColWidth - padC * 2;
    const nameLh = lh(10, 1.15);
    const descLh = lh(8.4, 1.3);

    const body = items.map((item) => {
        const qty = Number(item.quantity) || 0;
        const menge = item.useFixedPrice
            ? '–'
            : `${formatQuantity(qty)}${item.unit ? ` ${item.unit}` : ''}`;
        return [
            '',
            menge,
            item.useFixedPrice ? 'pauschal' : formatCurrency(Number(item.unitPrice) || 0, currency),
            formatCurrency(lineItemTotal(item), currency)
        ];
    });

    autoTable(doc, {
        startY: cursorY,
        head: [['Leistung', 'Menge', 'Einzelpreis', 'Betrag']],
        body,
        showHead: 'everyPage',
        rowPageBreak: 'avoid',   // never split a row (name+description) across pages
        margin: { left: ML, right: MR, top: 24, bottom: 42 },
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 3.4, bottom: 3.4, left: padC, right: padC }, textColor: INK, valign: 'top' },
        headStyles: { fontStyle: 'bold', fontSize: 9.5, textColor: INK, cellPadding: { top: 0, bottom: 2.6, left: padC, right: padC }, lineWidth: { bottom: 0.3 }, lineColor: HAIR },
        columnStyles: {
            0: { cellWidth: descColWidth },
            1: { cellWidth: 27, halign: 'right' },
            2: { cellWidth: 27, halign: 'right' },
            3: { cellWidth: 27, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const item = items[data.row.index];
                if (!item) return;
                const descLines = item.description ? doc.splitTextToSize(item.description, descTextWidth) : [];
                data.cell.styles.minCellHeight = Math.max(data.cell.styles.minCellHeight || 0, 3.4 * 2 + nameLh + descLines.length * descLh);
            }
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const item = items[data.row.index];
                if (!item) return;
                const x = data.cell.x + padC;
                let ty = data.cell.y + 3.4 + nameLh - 1.2;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...INK);
                doc.text(item.name || '', x, ty);
                if (item.description) {
                    const dl = doc.splitTextToSize(item.description, descTextWidth);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8.4);
                    doc.setTextColor(...MUTED);
                    dl.forEach((line: string) => { ty += descLh; doc.text(line, x, ty); });
                }
            }
        }
    });

    // ---- Totals -----------------------------------------------------------
    const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    const totalsX = 120;            // left edge of the totals block
    const labelX = totalsX;
    const valX = PAGE_W - MR;

    // Keep the totals block (and the notes/closing that follow) together: if it
    // would collide with the footer, push the whole block onto a fresh page.
    const FOOTER_TOP = PAGE_H - 36;
    const notesCount = (!totals.vatEnabled ? 1 : 0) + (invoice.dueDate ? 1 : 0) + (invoice.notes && invoice.notes.trim() ? 1 : 0);
    const totalsHeight = (totals.vatEnabled ? 10.6 : 0) + 6 + 11;            // sub/vat + rule + gross
    const tailHeight = totalsHeight + notesCount * 12 + (issuer?.name ? 13 : 0) + 6;
    let blockStart = afterTable + 5;
    if (blockStart + tailHeight > FOOTER_TOP - 4) {
        doc.addPage();
        blockStart = MT + 8;
    }
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.2);
    doc.line(totalsX, blockStart, valX, blockStart);
    let ty = blockStart + 6;

    const row = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        doc.setFontSize(opts.size || 9.5);
        doc.setTextColor(...(opts.bold ? INK : SOFT));
        doc.text(label, labelX, ty);
        doc.setTextColor(...INK);
        doc.text(value, valX, ty, { align: 'right' });
    };

    if (totals.vatEnabled) {
        row('Zwischensumme', formatCurrency(totals.net, currency)); ty += 5.8;
        row(`MwSt. (${formatNumber(totals.vatRate, totals.vatRate % 1 === 0 ? 0 : 1)}%)`, formatCurrency(totals.vat, currency)); ty += 4.8;
    }
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(totalsX, ty, valX, ty);
    ty += 6;
    row('Gesamtbetrag', formatCurrency(totals.gross, currency), { bold: true, size: 12.5 });
    ty += 11;

    // ---- Notes + closing --------------------------------------------------
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...SOFT);
    let ny = ty;
    const note = (text: string) => {
        const lines = doc.splitTextToSize(text, CONTENT_W);
        doc.text(lines, ML, ny);
        ny += lines.length * lh(9.5, 1.45) + 2.5;
    };
    if (!totals.vatEnabled) note('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).');
    if (invoice.dueDate) note(`Bitte überweisen Sie den Gesamtbetrag bis zum ${formatInvoiceDate(invoice.dueDate)} auf das unten angegebene Konto.`);
    if (invoice.notes && invoice.notes.trim()) note(invoice.notes.trim());

    if (issuer?.name) {
        ny += 4;
        doc.setTextColor(...INK);
        doc.text('Mit freundlichen Grüßen', ML, ny);
        doc.text(issuer.name, ML, ny + 5);
    }

    // ---- Appendix: itemised breakdown on a dedicated page -----------------
    const appendix = invoice.appendix || [];
    if (appendix.length) {
        doc.addPage();
        const hasAmounts = appendix.some((r) => typeof r.amount === 'number');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(...INK);
        doc.text(invoice.appendixTitle || 'Anlage – Einzelnachweis', ML, MT + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text(`zu Rechnung ${invoice.number || ''}`.trim(), ML, MT + 12);
        hairline(doc, MT + 17, HAIR, 0.2);

        const appHead = hasAmounts
            ? [['Datum', 'Leistung', 'Menge', 'Betrag']]
            : [['Datum', 'Leistung', 'Menge']];
        const appBody = appendix.map((r) => {
            const qty = Number(r.quantity) || 0;
            const menge = `${formatQuantity(qty)}${r.unit ? ` ${r.unit}` : ''}`;
            const desc = r.note ? `${r.description}\n${r.note}` : r.description;
            const cells = [r.date ? formatInvoiceDate(r.date) : '', desc, menge];
            if (hasAmounts) cells.push(typeof r.amount === 'number' ? formatCurrency(r.amount, currency) : '');
            return cells;
        });

        autoTable(doc, {
            startY: MT + 22,
            head: appHead,
            body: appBody,
            showHead: 'everyPage',
            rowPageBreak: 'avoid',   // never split a row (description+note) across pages
            margin: { left: ML, right: MR, top: MT + 10, bottom: 42 },
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 2.8, bottom: 2.8, left: 1.4, right: 1.4 }, textColor: INK, valign: 'top' },
            headStyles: { fontStyle: 'bold', fontSize: 9, textColor: INK, cellPadding: { top: 0, bottom: 2.6, left: 1.4, right: 1.4 }, lineWidth: { bottom: 0.3 }, lineColor: HAIR },
            bodyStyles: { lineWidth: { bottom: 0.15 }, lineColor: HAIR },
            columnStyles: hasAmounts
                ? { 0: { cellWidth: 24 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 26, halign: 'right' }, 3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' } }
                : { 0: { cellWidth: 24 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 28, halign: 'right' } }
        });

        if (hasAmounts) {
            const appAfter = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
            const appSum = appendix.reduce((s, r) => s + (typeof r.amount === 'number' ? r.amount : 0), 0);
            let sy = appAfter + 4;
            if (sy + 12 > PAGE_H - 36) { doc.addPage(); sy = MT + 12; }
            doc.setDrawColor(...HAIR);
            doc.setLineWidth(0.3);
            doc.line(120, sy, PAGE_W - MR, sy);
            sy += 6;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(...INK);
            doc.text('Summe Einzelnachweis', 120, sy);
            doc.text(formatCurrency(appSum, currency), PAGE_W - MR, sy, { align: 'right' });
        }
    }

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        // Continuation header on every page after the first: keep the invoice
        // identifiable even if the recipient separates the sheets.
        if (p > 1) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text(`Rechnung ${invoice.number || ''}`.trim(), ML, MT - 6);
            doc.text(formatInvoiceDate(invoice.issueDate), PAGE_W - MR, MT - 6, { align: 'right' });
            hairline(doc, MT - 3, HAIR, 0.15);
        }
        drawFooter(doc, invoice, p, pages);
    }
    return doc;
};

export const invoiceFileName = (invoice: Invoice): string => {
    const base = invoice.number ? invoice.number.replace(/[^\w\-]+/g, '_') : 'Entwurf';
    return `Rechnung_${base}.pdf`;
};

export const downloadInvoicePdf = async (invoice: Invoice): Promise<void> => {
    const doc = await buildInvoicePdf(invoice);
    doc.save(invoiceFileName(invoice));
};

export const getInvoicePdfBlobUrl = async (invoice: Invoice): Promise<string> => {
    const doc = await buildInvoicePdf(invoice);
    return doc.output('bloburl').toString();
};
