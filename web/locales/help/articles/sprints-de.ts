import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'sprints',
    category: 'planning',
    icon: 'directions_run',
    title: 'Sprints',
    summary: 'Zeitlich begrenzte Zyklen planen, Aufgaben aus dem Backlog ziehen und sauber abschließen.',
    keywords: ['Sprint', 'Planung', 'Backlog', 'Iteration', 'Scrum', 'Zeitraum', 'Ziel', 'Velocity', 'sprint', 'planning'],
    sections: [
        {
            id: 'what-is',
            title: 'Was ist ein Sprint?',
            keywords: ['Iteration', 'Zeitraum', 'iteration'],
            blocks: [
                { type: 'text', text: 'Ein Sprint ist ein kurzer, zeitlich begrenzter Zyklus mit einem Ziel. Du wählst die Aufgaben aus, die du darin schaffen willst, und arbeitest sie ab. Du findest ihn unter **Sprints** in der Projekt-Navigation.' },
                { type: 'text', text: 'Die Seite hat drei Ansichten: **Aktueller Sprint**, **Planung** und **Verlauf**. Es kann immer nur ein Sprint gleichzeitig laufen.' },
                { type: 'callout', tone: 'note', text: 'Sprints sind ein Projektmodul. Siehst du **Sprints** nicht, ist das Modul ausgeschaltet oder nicht Teil deines Plans.' },
            ],
        },
        {
            id: 'plan',
            title: 'Sprint planen',
            keywords: ['Sprint anlegen', 'neuer Sprint', 'Backlog', 'ziehen', 'create sprint'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne **Sprints** und klicke auf **Neuer Sprint** (oder **Sprint planen**).',
                        'Gib einen **Name**, ein **Ziel** sowie **Beginn** und **Ende** an.',
                        'Klicke auf **Sprint anlegen**.',
                        'Wechsle zu **Planung**. Der **Backlog** listet offene Aufgaben ohne Sprint.',
                        'Ziehe Aufgaben in den Sprint oder nutze **Verschieben nach…** an einer Aufgabe.',
                    ],
                },
                { type: 'text', text: 'Mit **Zurück in den Backlog** nimmst du eine Aufgabe wieder aus dem Sprint.' },
            ],
        },
        {
            id: 'run',
            title: 'Aktuellen Sprint steuern',
            keywords: ['Sprint starten', 'Fortschritt', 'Board', 'Tempo', 'start sprint'],
            blocks: [
                { type: 'text', text: 'Klicke bei einem geplanten Sprint auf **Starten**. Läuft noch ein anderer Sprint, schließe ihn zuerst ab.' },
                { type: 'text', text: '**Aktueller Sprint** zeigt Ziel, verbleibende Tage, **Erledigt** und **Zeit verbraucht** sowie ob du **Im Plan** oder **Hinter Plan** bist. Die Aufgaben stehen in den Spalten **Offen**, **In Arbeit**, **Review** und **Erledigt**.' },
            ],
        },
        {
            id: 'complete',
            title: 'Sprint abschließen',
            keywords: ['beenden', 'schließen', 'offene Aufgaben', 'Verlauf', 'finish'],
            blocks: [
                { type: 'steps', items: [
                    'Öffne **Aktueller Sprint** und wähle **Sprint abschließen**.',
                    'Sind Aufgaben nicht erledigt, wähle, wohin sie gehen: in den nächsten Sprint oder **Zurück in den Backlog**.',
                    'Bestätige. Der Sprint wandert in den **Verlauf**, der zeigt, wie viele Aufgaben erledigt wurden.',
                ] },
            ],
        },
        {
            id: 'manage',
            title: 'Bearbeiten, Team und Löschen',
            keywords: ['Sprint-Team', 'Mitglieder', 'entfernen', 'members'],
            blocks: [
                { type: 'text', text: 'Über **Sprint-Aktionen** kannst du **Sprint bearbeiten**, das **Sprint-Team** verwalten oder **Sprint löschen**. Mitglieder können eine Beitrittsanfrage stellen, die du mit **Anfrage annehmen** oder **Anfrage ablehnen** bearbeitest.' },
                { type: 'callout', tone: 'tip', text: 'Beim Löschen eines Sprints bleiben seine Aufgaben im Projekt. Sie gehen zurück in den Backlog.' },
            ],
        },
    ],
};

export default article;
