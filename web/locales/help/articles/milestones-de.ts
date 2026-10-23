import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'milestones',
    category: 'planning',
    icon: 'flag',
    title: 'Meilensteine',
    summary: 'Wichtige Fristen und Lieferzeitpunkte auf der Projekt-Roadmap markieren.',
    keywords: ['Meilenstein', 'Roadmap', 'Frist', 'Lieferung', 'Fälligkeit', 'erreicht', 'Zeitleiste', 'milestone', 'deadline', 'timeline'],
    sections: [
        {
            id: 'what-is',
            title: 'Was ist ein Meilenstein?',
            keywords: ['Roadmap', 'Frist', 'roadmap'],
            blocks: [
                { type: 'text', text: 'Ein Meilenstein markiert eine Frist, ein Gate oder einen Lieferzeitpunkt im Projekt, zum Beispiel einen MVP-Release. Die Roadmap findest du unter **Meilensteine** in der Projekt-Navigation.' },
                { type: 'text', text: 'Die Seite zeigt eine Zeitleiste mit dem nächsten Meilenstein zuerst, deinen Fortschritt und wie viele Meilensteine erreicht sind. Das Modul Meilensteine muss für das Projekt aktiv sein.' },
            ],
        },
        {
            id: 'create',
            title: 'Meilenstein anlegen',
            keywords: ['neuer Meilenstein', 'hinzufügen', 'new milestone'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne **Meilensteine** im Projekt.',
                        'Klicke auf **Neuer Meilenstein**.',
                        'Gib einen **Titel** ein und wähle **Fällig am**. Eine **Beschreibung** ist optional.',
                        'Nutze optional **Initiative verknüpfen** und **Aufgaben verknüpfen**.',
                        'Klicke auf **Meilenstein erstellen**.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'Verknüpfte Aufgaben ohne Termin übernehmen das Datum des Meilensteins.' },
            ],
        },
        {
            id: 'status',
            title: 'Meilenstein verfolgen und abschließen',
            keywords: ['erreicht', 'verpasst', 'ausstehend', 'als offen markieren', 'achieve'],
            blocks: [
                { type: 'text', text: 'Ein Meilenstein ist **Ausstehend**, **Erreicht** oder **Verpasst**. Öffne ihn, um Fälligkeit, verknüpfte Initiative und verknüpfte Aufgaben samt Unteraufgaben-Zähler zu sehen.' },
                { type: 'text', text: 'Ist die Arbeit erledigt, wähle **Meilenstein abschließen**. Doch noch nicht fertig? Mit **Als offen markieren** setzt du ihn zurück. Meilensteine können außerdem ein Risiko-Label von **Geringes Risiko** bis **Hohes Risiko** tragen.' },
            ],
        },
        {
            id: 'edit-delete',
            title: 'Meilenstein bearbeiten oder löschen',
            keywords: ['entfernen', 'Datum ändern'],
            blocks: [
                { type: 'text', text: 'Mit **Meilenstein bearbeiten** änderst du Titel, Datum, Verknüpfungen oder Status. **Meilenstein löschen** entfernt ihn nach einer Bestätigung.' },
                { type: 'text', text: 'Der nächste Meilenstein erscheint auch auf den Projektkarten unter [Projekte](/projects).' },
            ],
        },
    ],
};

export default article;
