import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'initiatives',
    category: 'work',
    icon: 'rocket_launch',
    title: 'Initiativen',
    summary: 'Verwandte Aufgaben unter einem Ergebnis bündeln und Fortschritt und Risiko gemeinsam verfolgen.',
    keywords: ['Initiative', 'Ergebnis', 'Epic', 'Ziel', 'Feedback-Formular', 'Fokus', 'Health', 'initiative', 'outcome', 'feedback form'],
    sections: [
        {
            id: 'what-is',
            title: 'Was ist eine Initiative?',
            keywords: ['Epic', 'Ergebnis', 'epic'],
            blocks: [
                { type: 'text', text: 'Eine Initiative bündelt verwandte Aufgaben unter einem gemeinsamen Ergebnis, damit du Fortschritt und Risiko zusammen verfolgst. Du findest sie unter **Initiativen** in der Projekt-Navigation.' },
                { type: 'text', text: 'Die Liste zeigt, wie viele Initiativen aktiv, gefährdet oder blockiert sind. Mit Suche, Statusfilter und Raster- oder Listenansicht findest du, was du brauchst.' },
            ],
        },
        {
            id: 'create',
            title: 'Initiative erstellen',
            keywords: ['neue Initiative', 'hinzufügen', 'new initiative'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne das Projekt und gehe zu **Initiativen**.',
                        'Klicke auf **Initiative erstellen**.',
                        'Gib einen **Titel** ein und, wenn du magst, **Beschreibung**, **Status**, **Priorität**, **Startdatum** und **Fälligkeitsdatum**.',
                        'Ergänze eine **Erfolgsmetrik** oder ein **Ergebnis**, damit klar ist, was fertig bedeutet.',
                        'Bestätige, um sie anzulegen.',
                    ],
                },
            ],
        },
        {
            id: 'work',
            title: 'Arbeit hinzufügen und verwalten',
            keywords: ['Aufgaben', 'anhängen', 'lösen', 'Fokus', 'tasks'],
            blocks: [
                { type: 'text', text: 'Auf der Initiativen-Seite listet der Bereich **Arbeit** ihre Aufgaben. Mit **Aufgabe erstellen** legst du eine neue an, mit **Aufgabe anhängen** verknüpfst du eine bestehende.' },
                { type: 'text', text: 'Mit **Lösen** nimmst du eine Aufgabe aus der Initiative heraus. Sie bleibt im Projekt. Mit **Als Fokus setzen** markierst du die gerade wichtigste Aufgabe als **Aktueller Fokus**.' },
            ],
        },
        {
            id: 'status-health',
            title: 'Status und Health',
            keywords: ['gefährdet', 'außer Plan', 'im Plan', 'at risk'],
            blocks: [
                { type: 'text', text: 'Jede Initiative hat einen Status:' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Planung', text: 'Noch nicht gestartet, wird noch ausgearbeitet.' },
                        { term: 'Offen', text: 'Bereit zur Bearbeitung.' },
                        { term: 'In Arbeit', text: 'Die Arbeit läuft.' },
                        { term: 'Review', text: 'Wartet auf Prüfung.' },
                        { term: 'Pausiert', text: 'Vorerst angehalten.' },
                        { term: 'Blockiert', text: 'Etwas steht im Weg.' },
                        { term: 'Erledigt', text: 'Das Ergebnis ist erreicht.' },
                    ],
                },
                { type: 'text', text: 'Ein Health-Indikator zeigt **Im Plan**, **Gefährdet** oder **Außer Plan**. Meilensteine lassen sich mit einer Initiative verknüpfen, siehe Artikel Meilensteine.' },
            ],
        },
        {
            id: 'feedback-form',
            title: 'Feedback über ein öffentliches Formular sammeln',
            keywords: ['Eingabeformular', 'Kundenfeedback', 'öffentlicher Link', 'Formular', 'intake form'],
            blocks: [
                { type: 'text', text: 'Eine Initiative kann ein **Eingabeformular** haben. Auch Personen ohne Konto können über den gehosteten Link Feedback senden, optional mit Screenshots. Jede Einsendung wird zu einer Aufgabe in der Initiative.' },
                { type: 'text', text: 'Mit **Bearbeiten** am Eingabeformular legst du Titel, Felder und die Bildoption fest. Das Formular zeigt **Live**, wenn es aktiv ist, sonst **Aus**. Kopiere den **Gehosteter Formular-Link**, um ihn zu teilen.' },
                { type: 'callout', tone: 'tip', text: 'Ist ein Link in falsche Hände geraten, erzeugst du mit **Token neu erzeugen** einen neuen.' },
            ],
        },
    ],
};

export default article;
