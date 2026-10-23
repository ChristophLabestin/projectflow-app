import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'projects',
    category: 'work',
    icon: 'folder',
    title: 'Projekte',
    summary: 'Projekte anlegen, Module wählen und Kundenarbeit mit Aufwand und Rechnungen steuern.',
    keywords: ['Projekt', 'Projekt erstellen', 'Vorlage', 'Module', 'Status', 'Import', 'Kunde', 'Kundenprojekt', 'project', 'client', 'template'],
    sections: [
        {
            id: 'overview',
            title: 'Was ist ein Projekt?',
            keywords: ['Portfolio', 'Liste', 'portfolio'],
            blocks: [
                { type: 'text', text: 'Ein Projekt bündelt Aufgaben, Meilensteine und Team für eine Arbeit. Unter [Projekte](/projects) siehst du alle, geordnet danach, was zuerst Aufmerksamkeit braucht.' },
                { type: 'text', text: 'Jede Karte zeigt offene und überfällige Arbeit und den nächsten Meilenstein. Mit **Projekte suchen** findest du ein Projekt schnell.' },
            ],
        },
        {
            id: 'create-project',
            title: 'Projekt erstellen',
            keywords: ['neues Projekt', 'Assistent', 'Vorlage', 'new project', 'wizard'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne [Projekte](/projects) und klicke auf **Projekt erstellen**.',
                        'Wähle bei **Typ** eine Vorlage, zum Beispiel **Allgemeines Projekt**, **Software-Release** oder **Kundenprojekt**.',
                        'Fülle die weiteren Schritte aus. Zum Start reicht ein Name.',
                        'Schalte bei **Module** die Werkzeuge ein, die du brauchst.',
                        'Klicke auf **Projekt erstellen**.',
                    ],
                },
                { type: 'text', text: 'Du willst mit vorhandenen Daten starten? Nutze **Import** und lade eine JSON-Datei hoch, um mehrere Projekte auf einmal anzulegen. Gespeicherte Setups findest du unter **Vorlagen**.' },
            ],
        },
        {
            id: 'modules',
            title: 'Module und Projekt-Navigation',
            keywords: ['Sprints', 'Marketing', 'Buchhaltung', 'Aktivität', 'modules'],
            blocks: [
                { type: 'text', text: 'Module bestimmen, welche Seiten in der Projekt-Navigation erscheinen. Verfügbar sind:' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Aufgaben', text: 'Alltägliche Arbeitspakete.' },
                        { term: 'Initiativen', text: 'Größere Ergebnisse, die Aufgaben bündeln.' },
                        { term: 'Meilensteine', text: 'Fristen und Lieferzeitpunkte.' },
                        { term: 'Sprints', text: 'Kurze Planungszyklen.' },
                        { term: 'Marketing', text: 'Projekt-Blog und Beiträge.' },
                        { term: 'Buchhaltung', text: 'Planung, Ausgaben und Buchhaltungsarbeit.' },
                        { term: 'Aktivität', text: 'Ein lesbares Protokoll dessen, was passiert ist.' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'Manche Module, etwa Sprints, zeigen **In deinem Plan nicht verfügbar**. Sie funktionieren nur, wenn dein Workspace Zugriff hat.' },
            ],
        },
        {
            id: 'status',
            title: 'Projektstatus',
            keywords: ['Health', 'Gesundheit', 'pausiert', 'abgeschlossen', 'health'],
            blocks: [
                { type: 'text', text: 'Ein Projekt ist **Aktiv**, **Im Test**, **Im Review**, **Planung**, **Brainstorming**, **Backlog**, **Pausiert**, **Abgeschlossen** oder **Abgebrochen**. Die Liste gruppiert nach diesem Status, Projekte mit Handlungsbedarf stehen oben.' },
                { type: 'text', text: 'Die Projektübersicht zeigt außerdem eine Health-Bewertung von **Excellent** bis **Critical**. Sie berücksichtigt den Status und sinkt zum Beispiel bei überfälliger oder blockierter Arbeit.' },
            ],
        },
        {
            id: 'client-projects',
            title: 'Kundenprojekte: Aufwand und Rechnungen',
            keywords: ['Aufwand', 'Rechnung', 'Kunde', 'Abrechnung', 'effort', 'invoice', 'client', 'billing'],
            blocks: [
                { type: 'text', text: 'Projekte aus der Vorlage **Kundenprojekt** sind Kundenprojekte. Sie erscheinen unter **Kundenprojekte** und haben zwei zusätzliche Seiten in der Projekt-Navigation: **Aufwand** und **Rechnungen**.' },
                {
                    type: 'steps',
                    items: [
                        'Öffne **Aufwand** und klicke auf **Zeile**, um Datum, Aufgabe, Dauer und optional eine Notiz zu erfassen. Alternativ nutzt du **Markdown importieren**.',
                        'Öffne **Rechnungen** und klicke auf **Neue Rechnung**.',
                        'Nutze in der Rechnung **Aufwand übernehmen**, um erfassten Aufwand als Positionen einzufügen.',
                        'Lade die fertige Rechnung mit **PDF** herunter.',
                    ],
                },
                { type: 'callout', tone: 'warning', text: 'Eine finalisierte Rechnung ist festgeschrieben und kann weder geändert noch gelöscht werden. Korrekturen laufen über eine Storno- oder Korrekturrechnung. Aufwand in einer finalisierten Rechnung ist ebenfalls gesperrt.' },
            ],
        },
    ],
};

export default article;
