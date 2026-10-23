import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'notifications',
    category: 'collaboration',
    icon: 'notifications',
    title: 'Benachrichtigungen',
    summary: 'Behalte Zuweisungen, Erwähnungen und Fälligkeiten im Blick und lege fest, was per Push oder E-Mail bei dir ankommt.',
    keywords: ['Benachrichtigungen', 'Glocke', 'ungelesen', 'Erwähnungen', 'Push', 'E-Mail', 'Briefing', 'Erinnerungen', 'notifications', 'bell', 'unread', 'mentions', 'alerts'],
    sections: [
        {
            id: 'bell',
            title: 'Neue Benachrichtigungen ansehen',
            keywords: ['Glocke', 'ungelesen', 'Seitenleiste', 'bell', 'unread'],
            blocks: [
                { type: 'text', text: 'Die Glocke in der Seitenleiste zeigt, wie viele Benachrichtigungen ungelesen sind. Klicke darauf, um die neuesten zu sehen, nach **Alle** oder **Ungelesen** zu filtern oder **Alle als gelesen markieren** zu nutzen.' },
                { type: 'text', text: 'Klicke auf eine Benachrichtigung, um direkt zur betroffenen Aufgabe zu springen. **Alle Benachrichtigungen anzeigen** öffnet die Seite [Benachrichtigungen](/notifications).' },
            ],
        },
        {
            id: 'page',
            title: 'Die Seite Benachrichtigungen nutzen',
            keywords: ['als gelesen markieren', 'löschen', 'alle löschen', 'andere Workspaces', 'älter', 'mark as read', 'delete'],
            blocks: [
                { type: 'text', text: 'Die Seite gruppiert Benachrichtigungen in **Heute**, **Gestern** und **Älter**. Mit dem Filter wechselst du zwischen **Alle** und **Ungelesen**.' },
                { type: 'list', items: [
                    '**Als gelesen markieren** / **Als ungelesen markieren** bei einer einzelnen Benachrichtigung.',
                    '**Benachrichtigung löschen** entfernt einen Eintrag.',
                    '**Alle löschen** entfernt nach Bestätigung sämtliche Benachrichtigungen. Das lässt sich nicht rückgängig machen.',
                ] },
                { type: 'text', text: 'Hast du ungelesene Benachrichtigungen in anderen Workspaces, erscheinen sie unter **Ungelesen in anderen Workspaces**, damit du nichts verpasst.' },
            ],
        },
        {
            id: 'settings',
            title: 'Festlegen, was bei dir ankommt',
            keywords: ['Einstellungen', 'Push', 'E-Mail', 'Morgenbriefing', 'Tagesabschluss', 'Zeitzone', 'settings', 'preferences'],
            blocks: [
                { type: 'text', text: 'Klicke auf die Glocke und dann auf **Benachrichtigungseinstellungen**. Das öffnet den Tab **Benachrichtigungen** in deinen persönlichen Einstellungen.' },
                { type: 'terms', items: [
                    { term: 'Zuweisungen', text: 'Aufgaben und Teilaufgaben, die dir zugewiesen werden.' },
                    { term: 'Erwähnungen', text: 'Jemand erwähnt dich in einem Kommentar.' },
                    { term: 'Kommentare', text: 'Neue Kommentare zu Aufgaben, an denen du beteiligt bist.' },
                    { term: 'Fälligkeiten', text: 'Eine Zusammenfassung dessen, was heute fällig ist.' },
                    { term: 'Erinnerungen', text: 'Erinnerungen, die du setzt oder die dich einschließen.' },
                ] },
                { type: 'text', text: 'Für jede Kategorie schaltest du **Push** und **E-Mail** an oder aus. Unter **Tagesrhythmus** aktivierst du ein **Morgenbriefing** und einen **Tagesabschluss**, legst die Uhrzeit fest und wählst deine **Zeitzone**.' },
                { type: 'callout', tone: 'note', text: 'Die Benachrichtigungsliste in ProjectFlow behält immer alles. Die Schalter steuern nur Push und E-Mail.' },
            ],
        },
        {
            id: 'web-push',
            title: 'Push im Browser reparieren',
            keywords: ['Web-Push', 'Browser', 'Berechtigung', 'Test', 'Zustellung', 'funktioniert nicht', 'web push', 'diagnostics'],
            blocks: [
                { type: 'text', text: 'Auf der Seite Benachrichtigungen prüft die Karte **Zustellstatus für Benachrichtigungen**, ob dieser Browser Push empfangen kann.' },
                { type: 'steps', items: [
                    'Klicke auf **Web-Push aktivieren** und erlaube Benachrichtigungen, wenn dein Browser fragt.',
                    'Klicke auf **Test senden**, um eine Testbenachrichtigung auszulösen.',
                    'Steht irgendwo **Einrichtung nötig** oder **Blockiert**, prüfe die Website-Berechtigungen deines Browsers und klicke dann auf **Aktualisieren**.',
                ] },
                { type: 'text', text: 'Unter **Letzte Zustellversuche** siehst du, was per Push oder E-Mail verschickt wurde und ob es gesendet, fehlgeschlagen oder übersprungen wurde.' },
            ],
        },
    ],
};

export default article;
