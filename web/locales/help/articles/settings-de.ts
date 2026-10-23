import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'settings',
    category: 'workspace',
    icon: 'settings',
    title: 'Einstellungen',
    summary: 'Persönliche Einstellungen und Workspace-Einstellungen: wo du sie findest und was du ändern kannst.',
    keywords: ['Einstellungen', 'Präferenzen', 'Sprache', 'Datumsformat', 'Passwort', 'Sicherheit', '2FA', 'Passkey', 'Benachrichtigungen', 'Workspace-Einstellungen', 'Rollen', 'Mitglieder', 'API', 'MCP', 'Gefahrenzone', 'Workspace löschen', 'settings', 'preferences', 'language'],
    sections: [
        {
            id: 'open-settings',
            title: 'Wo finde ich die Einstellungen?',
            keywords: ['öffnen', 'Fenster', 'Benutzermenü', 'Workspace-Einstellungen', 'user menu'],
            blocks: [
                { type: 'text', text: 'Die Einstellungen öffnen sich als Fenster über der Seite, nicht als eigene Seite. Es gibt zwei Gruppen: deine **persönlichen** Einstellungen und die Einstellungen des **aktuellen Workspace** (**Workspace-Einstellungen**). Persönliche Einstellungen öffnest du über dein **Benutzermenü**; **Workspace-Einstellungen** ist ein Eintrag im Workspace-Menü oben in der Seitenleiste.' },
                { type: 'text', text: 'Persönliche Einstellungen gelten für dein Konto in jedem Workspace. Workspace-Einstellungen gelten für den Workspace, in dem du gerade bist.' },
            ],
        },
        {
            id: 'personal',
            title: 'Was kann ich für mich selbst ändern?',
            keywords: ['Konto', 'Präferenzen', 'Sprache', 'Datumsformat', 'Passwort', 'E-Mail-Verifizierung', 'verbundene Konten', 'Pre-Alpha', 'Gemini', 'account'],
            blocks: [
                {
                    type: 'terms',
                    items: [
                        { term: 'Konto', text: 'Profil, **Passwort** (ändern oder setzen, um die Anmeldung mit E-Mail und Passwort zu aktivieren), **E-Mail-Verifizierung** und **Verbundene Konten**.' },
                        { term: 'Präferenzen', text: 'Die **Sprache** der App und das **Datumsformat**.' },
                        { term: 'Benachrichtigungen', text: 'Was dich per Push und E-Mail erreicht, dazu Morgenbriefing und Tagesabschluss. Siehe den Artikel zu Benachrichtigungen.' },
                        { term: 'Desktop-App', text: 'Nur in der Desktop-App sichtbar. Siehe den Artikel zur Desktop-App.' },
                        { term: 'Sicherheit', text: '**Zwei-Faktor-Authentifizierung** und **Passkeys** (Anmeldung mit Face ID, Touch ID oder Windows Hello).' },
                        { term: 'Pre-Alpha-Konfiguration', text: 'Dein persönlicher Gemini API-Schlüssel und das monatliche Token-Limit für CORA während der Pre-Alpha-Phase.' },
                    ],
                },
            ],
        },
        {
            id: 'workspace-settings',
            title: 'Was kann ich für den Workspace ändern?',
            keywords: ['Workspace', 'Name', 'Website', 'Kontakt-E-Mail', 'Mitglieder', 'einladen', 'Rollen', 'E-Mail', 'Speicher', 'SMTP', 'KI', 'Integrationen'],
            blocks: [
                { type: 'text', text: 'Nur Inhaber und Admins können Workspace-Einstellungen ändern. Alle anderen sehen höchstens einzelne Bereiche und können dort nichts ändern.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Workspace', text: 'Name, Website, Kontakt-E-Mail und Beschreibung.' },
                        { term: 'Mitglieder', text: 'Überblick über Personen, Gäste und offene Einladungen, mit **Mitglieder & Einladungen verwalten** und **Einladen**.' },
                        { term: 'Rollen', text: 'Eigene Rollen und ihre Berechtigungen. Für Inhaber und Admins sichtbar.' },
                        { term: 'E-Mail & Speicher', text: 'E-Mail-Versand und Dateispeicher des Workspace, dazu **Onboarding neu starten** für die Dashboard-Tour. Für Inhaber und Admins sichtbar.' },
                        { term: 'KI & Integrationen', text: 'KI-Einstellungen und verbundene Dienste für den Workspace.' },
                        { term: 'API & MCP', text: 'API-Tokens und Zugriff für externe Tools. Nur für den Inhaber des Workspace sichtbar.' },
                        { term: 'Gefahrenzone', text: '**Workspace verlassen**, **Eigentum übertragen** und **Workspace löschen**.' },
                    ],
                },
            ],
        },
        {
            id: 'secure-account',
            title: 'Wie sichere ich mein Konto?',
            keywords: ['2FA', 'Zwei-Faktor', 'Passkey', 'Face ID', 'Touch ID', 'Windows Hello', 'Passwort'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Öffne dein Benutzermenü und wähle die Einstellungen, dann **Sicherheit**.',
                        'Klicke unter **Zwei-Faktor-Authentifizierung** auf **Aktivieren** (oder **Verwalten**, wenn sie schon aktiv ist).',
                        'Klicke unter **Passkeys** auf **Passkey hinzufügen** und bestätige mit deinem Gerät. Einen Passkey kannst du später umbenennen oder entfernen.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'Mit einem Passkey meldest du dich per Fingerabdruck, Gesicht oder Geräte-PIN an, ganz ohne Passwort.' },
            ],
        },
        {
            id: 'leave-or-delete',
            title: 'Wie verlasse, übergebe oder lösche ich einen Workspace?',
            keywords: ['verlassen', 'Eigentum übertragen', 'Workspace löschen', 'Inhaber'],
            blocks: [
                { type: 'text', text: 'Öffne die **Workspace-Einstellungen** im Workspace-Menü der Seitenleiste und gehe zur **Gefahrenzone**. **Workspace verlassen** entzieht dir den Zugriff auf alle Projekte dort; ein Admin kann dich wieder einladen. **Eigentum übertragen** gibt den Workspace an ein anderes Mitglied oder einen Admin, du bleibst Admin.' },
                { type: 'callout', tone: 'warning', text: '**Workspace löschen** entfernt dauerhaft alle Projekte, Aufgaben, Mitglieder und Einstellungen. Zur Bestätigung musst du den Workspace-Namen eintippen, und es lässt sich nicht rückgängig machen.' },
            ],
        },
    ],
};

export default article;
