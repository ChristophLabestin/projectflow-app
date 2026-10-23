import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'media',
    category: 'ai',
    icon: 'perm_media',
    title: 'Medienbibliothek',
    summary: 'Halte Bilder und Videos an einem Ort, lade Dateien hoch, bearbeite Bilder und wähle Medien dort aus, wo du sie brauchst.',
    keywords: ['Medien', 'Mediathek', 'Medienbibliothek', 'Bilder', 'Videos', 'hochladen', 'Dateien', 'Fotos', 'Stockfotos', 'Unsplash', 'Nano Banana', 'Bild bearbeiten', 'Cover', 'media', 'library', 'upload', 'images'],
    sections: [
        {
            id: 'overview',
            title: 'Was die Medienbibliothek enthält',
            keywords: ['Dateien', 'Ordner', 'Projekte', 'nicht zugeordnet', 'assets', 'files'],
            blocks: [
                { type: 'text', text: 'Die Seite [Medien](/media) sammelt die Bilder und Videos deiner Projekte an einem Ort. Bilder, die du in Projekten hochlädst oder mit KI erzeugst, erscheinen ebenfalls hier.' },
                { type: 'text', text: 'Die Dateien sind nach Projekt gruppiert. Dateien ohne Projekt stehen unter **Nicht zugeordnete Workspace-Dateien**. Je nach Seitenleiste liegt **Medien** hinter **Mehr**.' },
            ],
        },
        {
            id: 'upload',
            title: 'Medien hochladen',
            keywords: ['hochladen', 'hinzufügen', 'Bild', 'Video', 'Projekt', 'upload'],
            blocks: [
                { type: 'steps', items: [
                    'Klicke auf **Medien hochladen**, um Dateien zur Workspace-Bibliothek hinzuzufügen, oder auf **In … hochladen** in einer Projektgruppe, um sie diesem Projekt zuzuordnen.',
                    'Wähle ein oder mehrere Bilder oder Videos aus.',
                    'Warte auf die Bestätigung. Die Dateien erscheinen in ihrer Gruppe.',
                ] },
            ],
        },
        {
            id: 'manage',
            title: 'Kopieren, herunterladen, bearbeiten und löschen',
            keywords: ['Link kopieren', 'herunterladen', 'bearbeiten', 'löschen', 'ersetzen', 'zuschneiden', 'edit', 'delete'],
            blocks: [
                { type: 'text', text: 'Fahre über eine Datei, um ihre Aktionen zu sehen:' },
                { type: 'list', items: [
                    '**Link kopieren** legt die Datei-URL in die Zwischenablage.',
                    '**Herunterladen** speichert die Datei auf deinem Rechner.',
                    '**Bearbeiten** öffnet den Bildeditor. Das Ergebnis speicherst du als neues Bild oder ersetzt das Original.',
                    '**Löschen** entfernt die Datei nach Bestätigung. Das lässt sich nicht rückgängig machen.',
                ] },
            ],
        },
        {
            id: 'picker',
            title: 'Medien in der App auswählen',
            keywords: ['Auswahl', 'Bild auswählen', 'Titelbild', 'Blog', 'Stockfotos', 'Nano Banana', 'KI-Bild', 'Unsplash', 'picker'],
            blocks: [
                { type: 'text', text: 'Wo du ein Bild auswählst, zum Beispiel als Titelbild eines Blogbeitrags, öffnet sich ein Fenster **Medienbibliothek** mit diesen Tabs:' },
                { type: 'terms', items: [
                    { term: 'Persönliche Bilder / Projektbilder', text: 'Wähle aus vorhandenen Dateien. Du kannst zwischen dem aktuellen Projekt und allen Medien im Workspace wechseln.' },
                    { term: 'Hochladen', text: 'Ziehe Dateien hinein oder wähle sie aus. PNG, JPG, GIF und MP4 bis 10 MB werden unterstützt.' },
                    { term: 'Nano Banana', text: 'Ein KI-Designstudio. Mit **Generieren** erzeugst du ein Bild aus einer Beschreibung, mit **Überarbeiten** verwandelst du ein Referenzbild.' },
                    { term: 'Stockfotos', text: 'Suche Fotos von Unsplash und speichere sie in deiner Bibliothek.' },
                ] },
                { type: 'callout', tone: 'note', text: 'Für KI-Bilder gibt es ein eigenes monatliches Bildlimit.' },
            ],
        },
    ],
};

export default article;
