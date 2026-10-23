import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'desktop',
    category: 'workspace',
    icon: 'desktop_mac',
    title: 'Desktop-App',
    summary: 'Installiere ProjectFlow auf macOS oder Windows und erfasse Aufgaben, fokussiere dich und plane deinen Tag von überall.',
    keywords: ['Desktop', 'App', 'Download', 'Installation', 'Mac', 'macOS', 'Windows', 'Tray', 'Menüleiste', 'Schnell erfassen', 'Quick Capture', 'Schnellzugriff', 'Fokus', 'Spotlight', 'Befehlspalette', 'Screenshot', 'Tastenkürzel', 'Update', 'desktop', 'install', 'shortcuts'],
    sections: [
        {
            id: 'install',
            title: 'Wie bekomme ich die Desktop-App?',
            keywords: ['Download', 'Installation', 'macOS', 'Windows', 'Voraussetzungen', 'Update', 'anmelden'],
            blocks: [
                { type: 'text', text: 'Öffne die [Download-Seite](/download), wähle deine Plattform und melde dich mit deinem bestehenden Konto an. Die App gibt es für macOS 12 oder neuer (Apple Silicon und Intel) und Windows 10 oder 11 (64-Bit und ARM).' },
                {
                    type: 'steps',
                    items: [
                        'macOS: Öffne die heruntergeladene .dmg-Datei und ziehe ProjectFlow in den Programme-Ordner.',
                        'Windows: Starte das heruntergeladene Installationsprogramm; es richtet ProjectFlow ein und startet es sofort.',
                        'Starte ProjectFlow und melde dich mit deinem Konto an.',
                    ],
                },
                { type: 'text', text: 'Updates installieren sich automatisch.' },
            ],
        },
        {
            id: 'capture',
            title: 'Wie erfasse ich eine Aufgabe aus jeder App heraus?',
            keywords: ['Schnell erfassen', 'Quick Capture', 'globales Tastenkürzel', 'Screenshot', 'Schnellzugriff', 'schwebendes Fenster'],
            blocks: [
                { type: 'text', text: 'Mit **Schnell erfassen** legst du eine Aufgabe an, ohne das Hauptfenster zu öffnen. Das globale Tastenkürzel stellst du in den Einstellungen im Tab **Desktop-App** unter **Schnell erfassen** ein. Im selben Tab gibt es ein Kürzel für das schwebende **Schnellzugriff-Fenster**.' },
                { type: 'text', text: 'Mit **Screenshot als Aufgabe** wählst du einen Bildschirmbereich aus, und Schnell erfassen öffnet sich mit dem Bild als Anhang.' },
                { type: 'callout', tone: 'tip', text: 'Wird ein Kürzel schon von einer anderen App genutzt, behält ProjectFlow dein bisheriges und sagt dir Bescheid.' },
            ],
        },
        {
            id: 'focus-and-day',
            title: 'Fokus, Tray und Tagesrhythmus',
            keywords: ['Tray', 'Menüleiste', 'Fokus', 'Pause', 'Tagesstart', 'Tagesabschluss', 'Meetings', 'Kalender', 'Medientaste', 'Touch Bar'],
            blocks: [
                { type: 'text', text: 'Der Tray (unter macOS die Menüleiste) zeigt deine Aufgaben in den Tabs **Heute**, **Angepinnt** und **Inbox** sowie deinen aktuellen **Fokus**. Wähle eine Aufgabe, um einen Fokus zu starten, und pausiere ihn für 30 Minuten, wenn du eine Pause brauchst.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Tagesstart', text: 'Zeigt deinen Tagesplan, wenn du den Computer morgens zum ersten Mal entsperrst.' },
                        { term: 'Tagesabschluss', text: 'Bietet zu einer gewählten Uhrzeit an, den Tag abzuschließen, nur während du am Computer bist.' },
                        { term: 'Kalender & Meetings', text: 'Liest anstehende Meetings aus den Kalendern deines Macs, um vor einem Meeting den Fokus zu pausieren und danach Notizen zu erfassen. Es wird nichts hochgeladen.' },
                        { term: 'Fokus-Kurzbefehle', text: 'Führe bei Fokusstart oder -ende einen macOS-Kurzbefehl aus, etwa um einen Fokus-Modus einzuschalten.' },
                    ],
                },
                { type: 'text', text: 'Außerdem kann die Play/Pause-Medientaste deinen Fokus pausieren und fortsetzen. Auf Macs mit Touch Bar erscheinen die Fokus-Aufgabe und Schnellaktionen dort automatisch.' },
            ],
        },
        {
            id: 'search-and-settings',
            title: 'Spotlight, Befehlspalette und Einstellungen',
            keywords: ['Spotlight', 'Befehlspalette', 'Beim Anmelden öffnen', 'Einstellungen', 'Präferenzen'],
            blocks: [
                { type: 'text', text: 'Unter macOS findest du Projekte und deine offenen Aufgaben in **Spotlight** (nur auf deinem Mac gespeichert). Die **Befehlspalette** durchsucht Projekte und Aufgaben von überall, du kannst sie öffnen, erledigen oder fokussieren.' },
                { type: 'text', text: 'Schalte diese Funktionen ein oder aus und stelle **Beim Anmelden öffnen** ein, in den Einstellungen im Tab **Desktop-App**. Dieser Tab erscheint nur in der Desktop-App.' },
            ],
        },
        {
            id: 'shortcuts',
            title: 'Welche Tastenkürzel bringt die App mit?',
            keywords: ['Tastatur', 'Tastenkürzel', 'Menü', 'Zoom', 'zurück', 'vor', 'neues Fenster'],
            blocks: [
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['⌘', 'N'], label: 'Neue Aufgabe' },
                        { keys: ['⌘', '⇧', 'N'], label: 'Neues Projekt' },
                        { keys: ['⌘', '⌥', 'N'], label: 'Neues Fenster' },
                        { keys: ['⌘', '1'], label: 'Dashboard (⌘2 Projekte, ⌘3 Aufgaben, ⌘4 Kalender, ⌘5 Benachrichtigungen)' },
                        { keys: ['⌘', '['], label: 'Zurück (⌘ ] vor)' },
                        { keys: ['⌘', '0'], label: 'Originalgröße (⌘ + und ⌘ - zoomen)' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'Unter Windows nimmst du Strg statt ⌘ und Alt statt ⌥. Zurück und vor sind dort Alt+← und Alt+→.' },
            ],
        },
    ],
};

export default article;
