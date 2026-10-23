import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'finance',
    category: 'workspace',
    icon: 'account_balance_wallet',
    title: 'Finanzen',
    summary: 'Erfasse Einnahmen und Ausgaben, wiederkehrende Buchungen, Rechnungen und Bankzeilen und sieh, wie profitabel deine Projekte sind.',
    keywords: ['Finanzen', 'Buchhaltung', 'Einnahmen', 'Ausgaben', 'Transaktionen', 'wiederkehrend', 'Rechnungen', 'Forderungen', 'Verbindlichkeiten', 'Bank', 'Abgleich', 'Steuern', 'DATEV', 'Export', 'Reports', 'Profitabilität', 'Cockpit', 'finance', 'accounting', 'income', 'expenses', 'invoices'],
    sections: [
        {
            id: 'access',
            title: 'Wo finde ich Finanzen, und wer sieht es?',
            keywords: ['Zugriff', 'Berechtigung', 'Mehr', 'Seitenleiste', 'eingeschränkt'],
            blocks: [
                { type: 'text', text: 'Finanzen ist ein Bereich für den ganzen Workspace, getrennt von deinen Projekten. Öffne **Finanzen** in der Seitenleiste (evtl. unter **Mehr**) oder gehe direkt zum [Finanz-Cockpit](/finance/cockpit).' },
                { type: 'text', text: 'Nur Personen mit Finanzzugriff sehen den Bereich, Gäste nie. Ohne Berechtigung erscheint **Zugriff eingeschränkt**. Ansehen und Bearbeiten sind getrennte Rechte: Um Buchungen anzulegen oder zu ändern, brauchst du die Verwalten-Berechtigung, sonst sind die Buttons deaktiviert.' },
            ],
        },
        {
            id: 'cockpit',
            title: 'Was sehe ich im Cockpit?',
            keywords: ['Überblick', 'Diagramm', 'Zeitraum', 'Filter', 'Nettosaldo', 'Profitabilität'],
            blocks: [
                { type: 'text', text: 'Das Cockpit ist die Übersicht. Es zeigt **Gesamteinnahmen**, **Gesamtausgaben** und **Nettosaldo** sowie ein Diagramm **Einnahmen vs Ausgaben** mit Monatssummen.' },
                { type: 'text', text: 'Wähle einen Zeitraum (zum Beispiel **30D**, **3M**, **YTD**, **Gesamt** oder **Benutzerdefiniert**) und grenze die Daten unter **Filter** nach Typ, Projekt oder Kategorie ein. **Filter zurücksetzen** setzt alles zurück. **Projektprofitabilität** listet Einnahmen, Kosten, Nettogewinn und Marge pro Projekt.' },
            ],
        },
        {
            id: 'add-bookings',
            title: 'Wie erfasse ich Einnahmen und Ausgaben?',
            keywords: ['Transaktion hinzufügen', 'wiederkehrend', 'Buchung', 'Einnahme', 'Ausgabe', 'Projekt', 'Kategorie'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne das **Cockpit** oder **Buchungen**.',
                        'Klicke auf **Transaktion hinzufügen** für eine einmalige Buchung oder **Wiederkehrend hinzufügen** für etwas, das sich wiederholt.',
                        'Wähle **Einnahme** oder **Ausgabe** und gib Datum, Kategorie, Betrag und Notizen ein.',
                        'Verknüpfe optional ein **Projekt**, damit die Buchung in der **Projektprofitabilität** auftaucht.',
                        'Klicke auf **Speichern**.',
                    ],
                },
                { type: 'text', text: 'Alle erfassten Buchungen findest du unter **Transaktionen**.' },
            ],
        },
        {
            id: 'areas',
            title: 'Welche weiteren Bereiche gibt es?',
            keywords: ['Forderungen', 'Verbindlichkeiten', 'Bank', 'Steuern', 'Reports', 'Exports', 'Abschluss', 'Sync', 'Einstellungen', 'Kalkulation', 'Planung', 'Funktionen', 'DATEV'],
            blocks: [
                { type: 'text', text: 'Solange du in Finanzen bist, zeigt die Seitenleiste die Finanzbereiche:' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Buchungen', text: 'Buchungen und Hauptbuchdaten in einer Liste.' },
                        { term: 'Forderungen', text: 'Offene Kundenrechnungen und ihr Zahlungsstatus.' },
                        { term: 'Verbindlichkeiten', text: 'Offene Lieferantenrechnungen und ausgehende Zahlungen.' },
                        { term: 'Bank & Abgleich', text: 'Bankzeilen importieren, Zuordnungsvorschläge erhalten und Abgleiche bestätigen.' },
                        { term: 'Steuern', text: 'Steuerreports für DE-konforme Abläufe.' },
                        { term: 'Reports', text: 'Summen- und Saldenliste, GuV, Bilanz und Projektprofitabilität.' },
                        { term: 'Exports & Abschluss', text: 'DATEV-Exportjobs und Periodenabschluss.' },
                        { term: 'Sync', text: 'Synchronisationen mit externen Billing- und Buchhaltungssystemen ausführen und überwachen.' },
                        { term: 'Einstellungen', text: 'Standardwerte und Steuerungseinstellungen für den Buchhaltungskern.' },
                        { term: 'Kalkulation & Planung', text: 'Werkzeuge für Kalkulation und Planung.' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'Jeder Bereich hat eine eigene Berechtigung (zum Beispiel für Rechnungen, Bankdaten, Steuern, Abschluss oder DATEV-Export). Fehlt dir eine Aktion, bitte einen Workspace-Admin, deine Rolle zu prüfen.' },
            ],
        },
    ],
};

export default article;
