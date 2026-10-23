import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'tasks',
    category: 'work',
    icon: 'task_alt',
    title: 'Aufgaben',
    summary: 'Aufgaben erstellen, organisieren und abschließen, auf deiner eigenen Liste und in Projekten.',
    keywords: ['aufgabe', 'aufgaben', 'todo', 'meine aufgaben', 'schnellerfassung', 'status', 'priorität', 'fälligkeit', 'zuständig', 'teilaufgaben', 'board', 'liste', 'sammelaktion', 'gruppieren', 'filter', 'erinnerung', 'blockiert', 'task', 'tasks', 'subtasks'],
    sections: [
        {
            id: 'where',
            title: 'Wo finde ich meine Aufgaben?',
            keywords: ['meine aufgaben', 'projektaufgaben', 'übersicht', 'liste', 'my tasks'],
            blocks: [
                { type: 'text', text: '[Meine Aufgaben](/tasks) zeigt alle dir zugewiesenen Aufgaben aus allen Projekten, gruppiert nach Fälligkeit: **Überfällig**, **Heute**, **Nächste 7 Tage**, **Später** und **Ohne Datum**. Eine kurze Zusammenfassung oben nennt, wie viele überfällig, heute oder diese Woche fällig sind.' },
                { type: 'text', text: 'In einem Projekt öffnest du **Aufgaben** in der Seitenleiste, um die Aufgaben dieses Projekts zu sehen.' },
            ],
        },
        {
            id: 'create',
            title: 'Wie erstelle ich eine Aufgabe?',
            keywords: ['neue aufgabe', 'aufgabe anlegen', 'schnellerfassung', 'ausführliche aufgabe', 'new task'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Klicke unter **Meine Aufgaben** ins Schnellerfassungsfeld („Aufgabe eingeben und Enter drücken…“).',
                        'Tippe einen Titel und drücke Enter.',
                        'Für mehr Felder nutzt du stattdessen **Ausführliche Aufgabe**.',
                    ],
                },
                { type: 'text', text: 'Du kannst auch ⌘/Strg + K drücken und **Aufgabe erstellen** wählen. Mit `N` springst du ins Schnellerfassungsfeld.' },
            ],
        },
        {
            id: 'update',
            title: 'Wie ändere ich eine Aufgabe?',
            keywords: ['status', 'priorität', 'fälligkeit', 'zuständige', 'erledigen', 'bearbeiten', 'edit'],
            blocks: [
                { type: 'text', text: 'In einer Listenzeile kannst du eine Aufgabe als erledigt markieren oder **Status**, **Priorität**, **Fälligkeit** und **Zuständige** direkt ändern. Klicke die Aufgabe an, um die Detailseite für alles Weitere zu öffnen.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Status', text: 'Backlog, Todo, Offen, In Arbeit, Review, Pausiert, Blockiert oder Erledigt.' },
                        { term: 'Priorität', text: 'Niedrig, Mittel, Hoch oder Dringend.' },
                    ],
                },
                { type: 'text', text: 'Auf der Detailseite kannst du **Teilaufgaben** anlegen, in der **Diskussion** kommentieren, eine **Erinnerung** setzen und mit **Blockieren** festhalten, was die Aufgabe blockiert.' },
            ],
        },
        {
            id: 'views',
            title: 'Wie filtere und gruppiere ich, und wie wechsle ich die Ansicht?',
            keywords: ['filter', 'suche', 'gruppieren', 'board', 'liste', 'karten', 'erledigte', 'ansicht', 'group by'],
            blocks: [
                { type: 'text', text: 'Mit **Aufgaben suchen**, **Alle Projekte** und **Jede Priorität** filterst du. Aktiviere **Erledigte**, um abgeschlossene Aufgaben einzublenden.' },
                { type: 'text', text: 'Wechsle die **Ansicht** unter Meine Aufgaben zwischen **Liste** und **Board**. In einem Projekt wechselst du zwischen **Liste** und **Karten** und gruppierst mit **Gruppieren nach** nach **Fälligkeit**, **Status** oder **Zuständig**.' },
            ],
        },
        {
            id: 'bulk',
            title: 'Wie ändere ich mehrere Aufgaben auf einmal?',
            keywords: ['sammelaktion', 'mehrfachauswahl', 'auswählen', 'löschen', 'zu initiative verschieben', 'bulk'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Fokussiere eine Aufgabenzeile und drücke `X`, oder nutze die Schaltfläche **Auswählen**, um sie auszuwählen. Mit ⇧ X wählst du einen Bereich aus.',
                        'Nutze die Leiste, die erscheint: **Status setzen**, **Priorität setzen**, **Fälligkeit setzen**, **Zuweisen an**, **Zu Initiative verschieben** oder **Löschen**.',
                        'Drücke Esc oder **Auswahl aufheben**, wenn du fertig bist.',
                    ],
                },
                { type: 'callout', tone: 'warning', text: 'Löschen entfernt die ausgewählten Aufgaben. Prüfe deine Auswahl, bevor du bestätigst.' },
            ],
        },
    ],
};

export default article;
