import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'calendar',
    category: 'planning',
    icon: 'event',
    title: 'Kalender',
    summary: 'Sieh deine Aufgaben nach Tagen, plane deine Woche per Drag-and-drop und lass Smart Schedule Lücken füllen.',
    keywords: ['Kalender', 'Zeitplan', 'planen', 'Woche', 'Monat', 'ziehen', 'Fälligkeit', 'Smart Schedule', 'ungeplant', 'calendar', 'schedule', 'drag'],
    sections: [
        {
            id: 'overview',
            title: 'Was der Kalender zeigt',
            keywords: ['Woche', 'Monat', 'Ansicht', 'Fälligkeitsdatum', 'geplant', 'week', 'month'],
            blocks: [
                { type: 'text', text: 'Der [Kalender](/calendar) zeigt deine unerledigten Aufgaben an dem Tag, für den sie geplant sind. Hat eine Aufgabe keinen geplanten Tag, gilt ihr Fälligkeitsdatum. Erledigte Aufgaben werden ausgeblendet.' },
                { type: 'text', text: 'Oben wechselst du zwischen **Woche** und **Monat** und blätterst mit den Pfeilen. Auf dem Handy zeigt die Wochenansicht eine Tagesleiste mit der Agenda des gewählten Tages.' },
                { type: 'text', text: 'Klicke eine Aufgabe an, um sie zu öffnen. Beim Darüberfahren siehst du eine Vorschau mit Status, Datum und Zuweisung.' },
            ],
        },
        {
            id: 'plan-tasks',
            title: 'Aufgaben per Ziehen planen',
            keywords: ['ziehen', 'ablegen', 'verschieben', 'umplanen', 'ungeplant', 'drag', 'drop', 'unscheduled'],
            blocks: [
                { type: 'steps', items: [
                    'Öffne neben dem Kalender das Fach **Ungeplant**. Es listet Aufgaben ohne Datum.',
                    'Ziehe eine Aufgabe auf einen Tag. Sie wird für diesen Tag geplant.',
                    'Zum Verschieben ziehst du sie auf einen anderen Tag. Um sie aus dem Kalender zu nehmen, ziehst du sie zurück nach **Ungeplant** oder nutzt **Ausplanen** an der Aufgabe.',
                ] },
                { type: 'callout', tone: 'note', text: 'Ziehst du eine nicht zugewiesene Aufgabe aus **Ungeplant** auf einen Tag, wird sie dir zugewiesen.' },
            ],
        },
        {
            id: 'smart-schedule',
            title: 'Smart Schedule für dich planen lassen',
            keywords: ['Smart Schedule', 'optimieren', 'automatisch planen', 'überfällig', 'zuweisen', 'optimize'],
            blocks: [
                { type: 'text', text: '**Smart Schedule** schlägt Termine für ungeplante und überfällige Aufgaben vor, für dich und deine Mit-Zugewiesenen. Es ändert sich nichts, bevor du bestätigst.' },
                { type: 'steps', items: [
                    'Klicke auf **Smart Schedule**.',
                    'Prüfe in **Optimierter Zeitplan** jede vorgeschlagene Änderung. Wähle Aufgaben ab oder an, oder nutze **Alle auswählen** / **Alle abwählen**.',
                    'Klicke auf **Zeitplan starten**, um die gewählten Änderungen zu übernehmen, oder auf **Abbrechen**, um sie zu verwerfen.',
                ] },
                { type: 'text', text: 'Ist bereits alles gut geplant, siehst du die Meldung, dass keine Änderungen nötig sind.' },
            ],
        },
        {
            id: 'clean-up',
            title: 'Kalender aufräumen',
            keywords: ['ausplanen', 'leeren', 'zurücksetzen', 'zukünftig', 'unschedule', 'clear'],
            blocks: [
                { type: 'text', text: 'Zwei Aktionen im Fach **Ungeplant** helfen, wenn dein Plan veraltet ist:' },
                { type: 'list', items: [
                    '**Alle zukünftigen Elemente ausplanen (ab morgen)** entfernt den geplanten Tag bei allen unerledigten Aufgaben ab morgen.',
                    '**Nicht zugewiesene Aufgaben aus dem Kalender entfernen** schiebt geplante Aufgaben ohne Zuweisung zurück nach **Ungeplant**.',
                ] },
                { type: 'callout', tone: 'tip', text: 'Ausplanen entfernt nur den geplanten Tag. Aufgaben, Fälligkeiten und Zuweisungen bleiben erhalten.' },
            ],
        },
    ],
};

export default article;
