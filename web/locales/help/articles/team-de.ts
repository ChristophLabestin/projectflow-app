import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'team',
    category: 'collaboration',
    icon: 'groups',
    title: 'Team',
    summary: 'Sieh, wer in deinem Workspace ist, lade Leute ein, lege Zugriff fest und gruppiere nach Abteilungen.',
    keywords: ['Team', 'Mitglieder', 'einladen', 'Einladung', 'Gast', 'Admin', 'Rolle', 'Abteilung', 'entfernen', 'Zugriff', 'Personen', 'invite', 'members', 'department'],
    sections: [
        {
            id: 'find-team',
            title: 'Die Teamseite öffnen',
            keywords: ['Mitglieder', 'Personen', 'wer', 'members', 'people'],
            blocks: [
                { type: 'text', text: 'Öffne das **Team**-Menü in der Top-Leiste und wähle **Alle anzeigen**, oder suche nach „Team“. Die Seite [Team](/team) listet alle Personen im aktuellen Workspace und zeigt, wie viele Personen, Abteilungen und Projekte es gibt.' },
                { type: 'text', text: 'Oben wechselst du zwischen den Ansichten **Abteilung**, **Projekt**, **Alle** und **Einladungen**. Klicke auf eine Person, um seitlich ein Detailfeld zu öffnen.' },
            ],
        },
        {
            id: 'invite',
            title: 'Leute einladen',
            keywords: ['einladen', 'E-Mail', 'Link', 'Gast', 'Kunde', 'Freelancer', 'beitreten', 'invite', 'guest'],
            blocks: [
                { type: 'text', text: 'Inhaber und Admins sehen auf der Teamseite den Button **Einladen**.' },
                { type: 'steps', items: [
                    'Klicke auf **Einladen**.',
                    'Wähle **Per E-Mail** oder **Link teilen**.',
                    'Lege den **Zugriff** fest. Für einen Gast wählst du mindestens ein Projekt aus, das er sehen darf.',
                    'Klicke auf **Einladung senden** (E-Mail) oder **Link erstellen** und kopiere den Link mit **Kopieren**, wenn du ihn selbst teilen willst.',
                ] },
                { type: 'terms', items: [
                    { term: 'Mitglied', text: 'Sieht und bearbeitet alle Projekte im Workspace.' },
                    { term: 'Admin', text: 'Wie Mitglied, plus Personen, Einladungen und Einstellungen verwalten.' },
                    { term: 'Gast', text: 'Sieht nur die in der Einladung gewählten Projekte. Ideal für Kunden und Freelancer.' },
                ] },
                { type: 'callout', tone: 'note', text: 'Einladungslinks laufen nach 14 Tagen ab und lassen sich jederzeit widerrufen.' },
            ],
        },
        {
            id: 'open-invitations',
            title: 'Offene Einladungen verwalten',
            keywords: ['widerrufen', 'Link kopieren', 'ausstehend', 'Einladungen', 'revoke', 'pending'],
            blocks: [
                { type: 'text', text: 'Die Ansicht **Einladungen** listet alle offenen Einladungen mit Zugriffsstufe und zeigt, ob sie für den ganzen Workspace oder für bestimmte Projekte gelten.' },
                { type: 'text', text: 'Mit **Link kopieren** teilst du eine Einladung erneut, mit **Widerrufen** brichst du sie ab.' },
            ],
        },
        {
            id: 'access-roles',
            title: 'Zugriff und Rollen ändern',
            keywords: ['Rolle', 'Berechtigung', 'Inhaber', 'Admin', 'eigene Rolle', 'Abteilung', 'Mitglied entfernen', 'role', 'permission'],
            blocks: [
                { type: 'text', text: 'Klicke auf eine Person und öffne **Workspace-Zugriff**. Inhaber können Personen zwischen Admin, Mitglied und Gast umstellen. Admins können zwischen Mitglied und Gast umstellen. Den Inhaber und deinen eigenen Zugriff kannst du hier nicht ändern.' },
                { type: 'text', text: 'Unter **Rollen** weist du die eigenen Rollen zu, die du in den Einstellungen angelegt hast. Das Feld zeigt außerdem das Projekt der Person und ihre **Zugewiesene Tasks**.' },
                { type: 'text', text: 'Zum Entfernen klickst du auf **Aus Workspace entfernen** und bestätigst.' },
            ],
        },
        {
            id: 'departments',
            title: 'Das Team nach Abteilungen gruppieren',
            keywords: ['Abteilung', 'eigene Rollen', 'gruppieren', 'Rollen', 'department', 'custom roles'],
            blocks: [
                { type: 'text', text: 'Abteilungen sind die eigenen Rollen deines Workspace. Lege Rollen in den **Einstellungen** unter **Rollen** an (auf der Teamseite über **Rollen einrichten**) und weise sie Mitgliedern zu. Jede Rolle erscheint dann als Abteilung in der Ansicht **Abteilung**.' },
                { type: 'text', text: 'Personen ohne eigene Rolle stehen unter **Ohne Abteilung**.' },
            ],
        },
    ],
};

export default article;
