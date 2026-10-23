import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'cora',
    category: 'cora',
    icon: 'auto_awesome',
    title: 'CORA, dein KI-Assistent',
    summary: 'Frag CORA im Hilfezentrum, lass Blogbeiträge entwerfen und Bilder erstellen und verbinde deine eigenen KI-Tools.',
    keywords: ['CORA', 'KI', 'Assistent', 'fragen', 'Frage', 'Blog-Assistent', 'Entwurf', 'Bilderstellung', 'Limit', 'Tokens', 'MCP', 'Claude', 'ChatGPT', 'Gemini', 'ai', 'assistant', 'ask'],
    sections: [
        {
            id: 'what-is-cora',
            title: 'Was ist CORA?',
            keywords: ['über', 'KI', 'Assistent', 'Workspace-Kontext', 'about'],
            blocks: [
                { type: 'text', text: 'CORA ist der in ProjectFlow eingebaute KI-Assistent. Er beantwortet Fragen mit Workspace-Kontext, entwirft Inhalte und erzeugt Bilder.' },
                { type: 'text', text: 'CORA arbeitet an bestimmten Stellen in der App, die unten beschrieben sind. Er verändert deine Daten nicht von selbst.' },
            ],
        },
        {
            id: 'ask-cora',
            title: 'CORA eine Frage stellen',
            keywords: ['fragen', 'Hilfezentrum', 'Frage', 'Antwort', 'Suche', 'ask'],
            blocks: [
                { type: 'steps', items: [
                    'Öffne das **Hilfezentrum** in der Top-Leiste.',
                    'Tippe deine Frage in das Suchfeld.',
                    'Klicke unter den Ergebnissen auf **CORA zu „…“ fragen**.',
                ] },
                { type: 'text', text: 'CORA fasst eine Antwort mit Workspace-Kontext zusammen. Klappt es nicht, siehst du „CORA-Suche fehlgeschlagen“ und kannst es erneut versuchen.' },
                { type: 'callout', tone: 'tip', text: 'Schau zuerst in die Hilfeartikel in den Ergebnissen. Für Anleitungsfragen sind sie oft schneller.' },
            ],
        },
        {
            id: 'blog-assistant',
            title: 'Einen Blogbeitrag entwerfen',
            keywords: ['Blog', 'Marketing', 'Entwurf', 'schreiben', 'Themen', 'Websuche', 'Beitrag', 'draft'],
            blocks: [
                { type: 'text', text: 'Im Blog-Editor eines Projekts mit dem Marketing-Modul öffnest du mit **CORA fragen** den **CORA Blog-Assistent**.' },
                { type: 'steps', items: [
                    'Beschreibe, worum es im Beitrag gehen soll, oder klicke auf **Themen vorschlagen**.',
                    'Wähle die **Sprache** und entscheide, ob die **Websuche** für Quellen aktiv sein soll.',
                    'Klicke auf **Kompletten Beitrag erstellen**. CORA füllt Titel, Auszug und Inhalt.',
                    'Prüfe und überarbeite den Entwurf, bevor du ihn veröffentlichst.',
                ] },
            ],
        },
        {
            id: 'images',
            title: 'Bilder erstellen und überarbeiten',
            keywords: ['Bild', 'generieren', 'Nano Banana', 'überarbeiten', 'Titelbild', 'image', 'rework'],
            blocks: [
                { type: 'text', text: 'Überall, wo du ein Bild auswählst, kannst du im Tab **Nano Banana** des Fensters **Medienbibliothek** ein Bild aus einer Beschreibung **Generieren** oder ein Referenzbild **Überarbeiten**. Den vollständigen Auswahldialog beschreibt der Artikel [Medien](/media).' },
            ],
        },
        {
            id: 'limits',
            title: 'Limits und deine eigenen KI-Tools',
            keywords: ['Limit', 'Tokens', 'monatlich', 'MCP', 'Integrationen', 'Claude', 'ChatGPT', 'Codex', 'Cursor'],
            blocks: [
                { type: 'text', text: 'CORA hat monatliche Limits für Text und für Bilder. Erreichst du eines, siehst du eine Meldung dazu. Es wird monatlich zurückgesetzt.' },
                { type: 'text', text: 'Um eigene KI-Tools mit ProjectFlow zu nutzen, öffne die **Einstellungen** und gehe zu **KI & Integrationen**. Dort steht, wie du Claude, ChatGPT, Codex, Cursor oder jeden MCP-Client mit deinem Workspace verbindest.' },
            ],
        },
    ],
};

export default article;
