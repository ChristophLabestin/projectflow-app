import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'marketing',
    category: 'cora',
    icon: 'edit_note',
    title: 'Marketing: Projekt-Blog',
    summary: 'Verbinde den Blog deiner Website mit einem Projekt, schreibe Beiträge mit CORA und veröffentliche sie.',
    keywords: ['Blog', 'Beiträge', 'veröffentlichen', 'CMS', 'Inhalte', 'API', 'Artikel', 'Entwurf', 'Übersetzung', 'Marketing-Modul', 'blog', 'posts', 'publish', 'content'],
    sections: [
        {
            id: 'what-it-is',
            title: 'Was das Marketing-Modul macht',
            keywords: ['Modul', 'Blog', 'Website', 'module'],
            blocks: [
                { type: 'text', text: 'Marketing ist ein Projektmodul für deinen **Blog**. Du schreibst und verwaltest Beiträge in ProjectFlow, sie werden über die REST-API mit dem Blog deiner eigenen Website abgeglichen.' },
                { type: 'text', text: 'Das Modul wird pro Projekt aktiviert. Siehst du **Marketing** in einem Projekt nicht, ist das Modul dort nicht aktiv oder deine Rolle hat keinen Zugriff.' },
            ],
        },
        {
            id: 'connect-blog',
            title: 'Wie verbinde ich den Blog meiner Website?',
            keywords: ['Einrichtung', 'Assistent', 'Integration', 'API', 'Basis-URL', 'Header', 'Endpunkt', 'Datenmodell', 'Sprachen', 'setup', 'wizard'],
            blocks: [
                { type: 'text', text: 'Ohne Verbindung zeigt das Modul **Keine API verbunden**. Der Einrichtungsassistent verknüpft ProjectFlow mit deinem CMS oder eigenen Backend, damit Beiträge und Kategorien abgeglichen werden können.' },
                {
                    type: 'steps',
                    items: [
                        'Öffne **Marketing** in deinem Projekt und gehe zu den Blog-Einstellungen (**Blog-Integration**).',
                        'Klicke auf **Einrichtungsassistent starten** (später: **Neu konfigurieren**).',
                        'Gib unter **Basiskonfiguration** die **Basis-URL** deiner API und bei Bedarf **Globale Header (JSON)** an.',
                        'Lege unter **Ressourcen-Konfiguration** die Endpunkte für **Beiträge** und **Kategorien** fest und prüfe den Listen-Endpunkt mit **Endpunkt testen**.',
                        'Optional: Beschreibe die Struktur deiner Beiträge unter **Datenmodell (optional)**. Enthält es ein Sprachfeld, kannst du die unterstützten Sprachen wählen.',
                        'Klicke auf **Konfiguration validieren** und dann auf **Konfiguration speichern**.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'Nutze in den Pfaden für Aktualisieren, Löschen und Abrufen einen Platzhalter für die Ressourcen-ID. Der Assistent zeigt neben den Endpunkt-Feldern, welchen er erwartet.' },
            ],
        },
        {
            id: 'write-post',
            title: 'Wie schreibe und veröffentliche ich einen Beitrag?',
            keywords: ['erstellen', 'Editor', 'Entwurf', 'veröffentlichen', 'Titelbild', 'Kategorie', 'Tags', 'Vorschau', 'Autospeichern'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne im Projekt **Marketing**, dort siehst du deine **Blogbeiträge**. Klicke auf **Neuen Beitrag erstellen**.',
                        'Gib den **Beitragstitel** ein und füge optional ein Titelbild, eine Kategorie und **Tags** hinzu.',
                        'Schreibe den Inhalt. Mit `/` im Editor rufst du Formatierungsbefehle auf.',
                        'Prüfe das Ergebnis in der **Live-Vorschau**.',
                        'Klicke auf **Als Entwurf speichern**, um ihn privat zu halten, oder auf **Beitrag veröffentlichen**, um ihn an deinen Blog zu senden.',
                    ],
                },
                { type: 'text', text: 'Der Editor speichert automatisch mit. **Als neu speichern** legt eine Kopie des aktuellen Beitrags an. Mit **Kategorien verwalten** und **Vorlagen verwalten** pflegst du Kategorien und wiederverwendbare Vorlagen.' },
            ],
        },
        {
            id: 'cora-and-languages',
            title: 'Hilft CORA bei Beiträgen und Übersetzungen?',
            keywords: ['KI', 'CORA', 'generieren', 'Themen', 'übersetzen', 'Sprache', 'Websuche', 'ai', 'translate'],
            blocks: [
                { type: 'text', text: 'Ja. **CORA fragen** im Editor öffnet den **CORA Blog-Assistenten**. Beschreibe, worum es im Beitrag gehen soll, oder klicke auf **Themen vorschlagen**, und dann auf **Kompletten Beitrag erstellen**, um einen Entwurf zu erhalten. Mit **Websuche** kann CORA Quellen nutzen.' },
                { type: 'text', text: 'Unterstützt deine Blog-Verbindung mehrere Sprachen, wechselst du die Beitragssprache mit **Sprache auswählen**. ProjectFlow fragt dann, ob der Inhalt zuerst per KI übersetzt werden soll.' },
                { type: 'callout', tone: 'note', text: 'KI-Entwürfe sind ein Ausgangspunkt. Lies und überarbeite sie, bevor du veröffentlichst.' },
            ],
        },
        {
            id: 'status',
            title: 'Entwurf oder veröffentlicht?',
            keywords: ['Status', 'Filter', 'Rasteransicht', 'Listenansicht', 'löschen'],
            blocks: [
                { type: 'text', text: 'Die Beitragsliste zeigt jeden Beitrag mit Status, Autor und Datum. Du kannst nach Sprache filtern und zwischen **Rasteransicht** und **Listenansicht** wechseln.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Entwurf', text: 'In ProjectFlow gespeichert, noch nicht in deinem Blog veröffentlicht.' },
                        { term: 'Veröffentlicht', text: 'Live auf deinem verbundenen Blog.' },
                    ],
                },
            ],
        },
    ],
};

export default article;
