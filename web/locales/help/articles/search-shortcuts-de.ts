import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'search-shortcuts',
    category: 'basics',
    icon: 'keyboard',
    title: 'Suche und Tastenkürzel',
    summary: 'Springe mit der Suche überall hin, grenze Ergebnisse mit Präfixen und Filtern ein und arbeite schneller mit Tastenkürzeln.',
    keywords: ['suche', 'finden', 'befehlspalette', 'tastatur', 'tastenkürzel', 'shortcuts', 'hotkeys', 'tasten', 'filter', 'is:overdue', 'prio:high', 'schnellzugriff', 'search', 'command palette', 'keyboard'],
    sections: [
        {
            id: 'open-search',
            title: 'Wie öffne ich die Suche?',
            keywords: ['cmd k', 'strg k', 'schrägstrich', 'globale suche', 'global search'],
            blocks: [
                { type: 'text', text: 'Klicke auf das Suchfeld in der oberen Leiste oder nutze ein Tastenkürzel. Die Suche findet Projekte, Aufgaben, Seiten, Aktionen und Themen im Hilfezentrum.' },
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['⌘', 'K'], label: 'Suche öffnen oder schließen (Strg + K unter Windows und Linux)' },
                        { keys: ['/'], label: 'Suche öffnen, wenn du nicht in einem Feld tippst' },
                    ],
                },
                { type: 'text', text: 'Eine leere Suche zeigt zuletzt geöffnete Elemente und letzte Suchen. Mit **Leeren** entfernst du deinen Verlauf.' },
            ],
        },
        {
            id: 'narrow-results',
            title: 'Wie grenze ich Ergebnisse ein?',
            keywords: ['präfix', 'filter', 'überfällig', 'mir zugewiesen', 'priorität', 'bereich', 'aktionen', 'prefix'],
            blocks: [
                { type: 'text', text: 'Beginne deine Suche mit einem Präfix, um den Ergebnistyp zu begrenzen.' },
                {
                    type: 'terms',
                    items: [
                        { term: '>', text: 'Aktionen, zum Beispiel **Aufgabe erstellen** oder **Projekt erstellen**.' },
                        { term: '#', text: 'Nur Projekte.' },
                        { term: '!', text: 'Nur Aufgaben.' },
                        { term: '?', text: 'Nur Hilfethemen.' },
                    ],
                },
                { type: 'text', text: 'Für Aufgaben kannst du Filter ergänzen: `is:overdue` für überfällige Aufgaben, `is:mine` für Aufgaben, die dir zugewiesen sind, und `prio:high` für hohe Priorität. Kombiniere sie mit Wörtern, zum Beispiel `is:mine prio:high launch`.' },
                { type: 'callout', tone: 'tip', text: 'Mit Tab wechselst du zwischen den Ergebnisfiltern, etwa **Alle** und **Seiten & Aktionen**.' },
            ],
        },
        {
            id: 'navigate-results',
            title: 'Wie bewege ich mich durch die Ergebnisse?',
            keywords: ['pfeiltasten', 'enter', 'neuer tab', 'escape'],
            blocks: [
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['↑', '↓'], label: 'Durch die Ergebnisse gehen' },
                        { keys: ['Pos1'], label: 'Zum ersten Ergebnis springen (bei leerem Suchfeld)' },
                        { keys: ['Ende'], label: 'Zum letzten Ergebnis springen (bei leerem Suchfeld)' },
                        { keys: ['Enter'], label: 'Das ausgewählte Ergebnis öffnen' },
                        { keys: ['⌘', 'Enter'], label: 'In einem neuen Tab öffnen (Strg + Enter unter Windows und Linux)' },
                        { keys: ['Esc'], label: 'Erst den Text, dann den Filter löschen, dann die Suche schließen' },
                    ],
                },
            ],
        },
        {
            id: 'shortcuts',
            title: 'Welche Tastenkürzel gibt es?',
            keywords: ['hotkeys', 'neue aufgabe', 'auswählen', 'fixierte aufgaben', 'schnellzugriff', 'hilfe', 'new task'],
            blocks: [
                { type: 'text', text: 'Diese Kürzel funktionieren in der Web-App. Unter Windows und Linux nutzt du Strg statt ⌘ und Alt statt Option.' },
                {
                    type: 'shortcuts',
                    items: [
                        { keys: ['?'], label: 'Hilfezentrum öffnen oder schließen' },
                        { keys: ['⌥', 'T'], label: 'Aufgabe in deinem fixierten Projekt erstellen (braucht ein fixiertes Projekt)' },
                        { keys: ['⌘', '⇧', 'F'], label: 'Schnellzugriff auf deine fixierten Aufgaben öffnen' },
                        { keys: ['N'], label: 'Schnellerfassung unter **Meine Aufgaben** und bei den **Aufgaben** eines Projekts fokussieren' },
                        { keys: ['X'], label: 'Die fokussierte Aufgabenzeile auswählen' },
                        { keys: ['⇧', 'X'], label: 'Einen Bereich von Zeilen auswählen' },
                        { keys: ['Esc'], label: 'Auswahl aufheben oder ein offenes Panel schließen' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'Einzeltasten-Kürzel wie `N`, `X` und `?` funktionieren nicht, während du in einem Textfeld tippst.' },
            ],
        },
    ],
};

export default article;
