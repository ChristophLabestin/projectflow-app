import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'getting-started',
    category: 'basics',
    icon: 'explore',
    title: 'Erste Schritte',
    summary: 'Finde dich in ProjectFlow zurecht und richte in wenigen Minuten dein erstes Projekt ein.',
    keywords: ['start', 'einstieg', 'onboarding', 'erste schritte', 'schnellstart', 'einführung', 'grundlagen', 'übersicht', 'navigation', 'seitenleiste', 'sidebar', 'workspace', 'getting started', 'first steps'],
    sections: [
        {
            id: 'layout',
            title: 'Wie ist die App aufgebaut?',
            keywords: ['sidebar', 'seitenleiste', 'top bar', 'navigation', 'menü', 'layout'],
            blocks: [
                { type: 'text', text: 'Die **Seitenleiste** links ist deine Hauptnavigation. Sie führt zu **Dashboard**, **Meine Aufgaben**, **Kalender** und **Projekte**. Je nach Zugriff erscheinen dort auch **Finanzen** und **Medien**, manchmal hinter **Mehr**.' },
                { type: 'text', text: 'Öffnest du ein Projekt, zeigt die Seitenleiste zusätzlich dessen Bereiche, zum Beispiel **Übersicht**, **Initiativen** und **Aufgaben**. Die obere Leiste enthält Suche, **Fixierte Aufgaben**, Benachrichtigungen, das Team-Menü und das **Hilfezentrum**.' },
            ],
        },
        {
            id: 'concepts',
            title: 'Was sind Workspaces, Projekte und Aufgaben?',
            keywords: ['konzepte', 'glossar', 'begriffe', 'workspace', 'projekt', 'aufgabe', 'initiative', 'meilenstein', 'task', 'milestone'],
            blocks: [
                {
                    type: 'terms',
                    items: [
                        { term: 'Workspace', text: 'Das Zuhause deines Teams. Er enthält alle Projekte, Mitglieder und Einstellungen. Du kannst mehreren Workspaces angehören und in der Seitenleiste zwischen ihnen wechseln.' },
                        { term: 'Projekt', text: 'Ein Vorhaben mit Ziel, Status und Team.' },
                        { term: 'Aufgabe', text: 'Ein einzelnes Arbeitspaket mit Status, Priorität, Fälligkeit und Zuständigen.' },
                        { term: 'Initiative', text: 'Ein größeres Vorhaben innerhalb eines Projekts, das zusammengehörige Aufgaben bündelt.' },
                        { term: 'Meilenstein', text: 'Ein wichtiger Termin oder Zwischenstand in einem Projekt.' },
                    ],
                },
            ],
        },
        {
            id: 'first-steps',
            title: 'Was mache ich zuerst?',
            keywords: ['erstes projekt', 'projekt erstellen', 'aufgaben anlegen', 'einladen', 'team', 'first project'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne **Projekte** und erstelle dein erstes Projekt, oder drücke ⌘/Strg + K und wähle **Projekt erstellen**.',
                        'Lege ein paar Aufgaben an. Unter **Meine Aufgaben** tippst du einen Titel ins Schnellerfassungsfeld und drückst Enter.',
                        'Lade dein Team über das Team-Menü in der oberen Leiste mit **Einladen** ein.',
                        'Öffne das [Dashboard](/), um deinen Plan für heute zu sehen.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'Du musst nicht alles auf einmal einrichten. Ein Projekt mit ein paar Aufgaben reicht für den Start.' },
            ],
        },
        {
            id: 'find-things',
            title: 'Wie finde ich Dinge schnell?',
            keywords: ['suche', 'tastenkürzel', 'shortcuts', 'springen', 'search'],
            blocks: [
                { type: 'text', text: 'Drücke ⌘/Strg + K oder `/`, um die Suche zu öffnen. Sie findet Projekte, Aufgaben, Seiten und Aktionen und durchsucht auch das Hilfezentrum.' },
                { type: 'text', text: 'Drücke `?` (außerhalb eines Textfelds), um dieses Hilfezentrum zu öffnen. Alle Tasten findest du unter „Suche und Tastenkürzel“.' },
            ],
        },
        {
            id: 'workspaces',
            title: 'Wie wechsle ich den Workspace?',
            keywords: ['mehrere workspaces', 'wechseln', 'einladung', 'einladungslink', 'switch workspace'],
            blocks: [
                { type: 'text', text: 'Mit dem Workspace-Wechsler in der Seitenleiste wechselst du zwischen deinen Workspaces. Wirst du eingeladen, öffnest du den Einladungslink und nimmst die Einladung an, um dem Workspace beizutreten.' },
            ],
        },
    ],
};

export default article;
