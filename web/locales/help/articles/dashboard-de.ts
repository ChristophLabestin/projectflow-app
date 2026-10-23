import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'dashboard',
    category: 'basics',
    icon: 'space_dashboard',
    title: 'Dashboard',
    summary: 'Dein Plan für heute und ein Puls, wie es um deine Projekte steht.',
    keywords: ['startseite', 'home', 'heute', 'plan', 'fokus', 'puls', 'übersicht', 'portfolio', 'momentum', 'überfällig', 'wartet', 'today', 'focus', 'pulse'],
    sections: [
        {
            id: 'what-is-it',
            title: 'Was ist das Dashboard?',
            keywords: ['startseite', 'home', 'begrüßung'],
            blocks: [
                { type: 'text', text: 'Das [Dashboard](/) ist die erste Seite, die du siehst. Es begrüßt dich, zeigt deinen aktuellen Fokus und führt dann durch zwei Stufen: **Dein Plan für heute** und den Puls des Workspace.' },
                { type: 'text', text: 'Mit **Zum Portfolio-Puls** springst du zum Puls, mit **Zurück zum Tag** kehrst du zurück.' },
            ],
        },
        {
            id: 'today',
            title: 'Wie nutze ich meinen Plan für heute?',
            keywords: ['heute', 'plan', 'überfällig', 'fällig', 'wartet', 'nachfassen', 'über nacht', 'diese woche', 'today'],
            blocks: [
                { type: 'text', text: '**Dein Plan für heute** listet die Aufgaben, die dich brauchen: überfällige, heute fällige und solche, die auf andere warten. Ist nichts geplant, schlägt das Dashboard ein paar Aufgaben aus dem Backlog vor.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Wartet auf dich', text: 'Aufgaben anderer, die erst weitergehen, wenn du deine Aufgabe erledigt hast.' },
                        { term: 'Über Nacht', text: 'Was sich seit deinem letzten Besuch geändert hat, zum Beispiel eine Aufgabe, die überfällig wurde.' },
                        { term: 'Diese Woche', text: 'Anstehende Termine in der aktuellen Woche.' },
                    ],
                },
                {
                    type: 'steps',
                    items: [
                        'Wähle eine Aufgabe aus deinem Plan.',
                        'Mit **Als erledigt markieren** schließt du sie ab, mit **Für heute** planst du sie für heute ein.',
                        'Mit **Aufgabe** legst du eine neue an.',
                    ],
                },
            ],
        },
        {
            id: 'focus',
            title: 'Was ist mein aktueller Fokus?',
            keywords: ['fokus', 'fixierte aufgabe', 'fortsetzen', 'fokus starten', 'focus', 'pinned task'],
            blocks: [
                { type: 'text', text: 'Dein Fokus ist die Aufgabe, an der du gerade arbeitest. Das Dashboard bietet **Fokus starten** an, um eine Aufgabe zu deinem aktuellen Fokus zu machen. Es zeigt sie ganz oben, damit du dort weitermachen kannst, wo du aufgehört hast.' },
            ],
        },
        {
            id: 'pulse',
            title: 'Was zeigt der Puls des Workspace?',
            keywords: ['puls', 'portfolio', 'momentum', 'auslastung', 'projekte', 'gesundheit', 'deadline', 'pulse'],
            blocks: [
                { type: 'text', text: 'Der Puls gibt dir einen schnellen Überblick über alle Projekte im Workspace.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Der Workspace in Zahlen', text: 'Aktive Projekte, offene Aufgaben, überfällige Aufgaben und diese Woche erledigte Aufgaben.' },
                        { term: 'Wo die Arbeit liegt', text: 'Wie sich offene Aufgaben auf die Projekte verteilen.' },
                        { term: 'Wo du hinschauen solltest', text: 'Projekte, die Aufmerksamkeit brauchen, zum Beispiel wegen überfälliger oder blockierter Aufgaben, wenig Aktivität oder einer nahen Deadline.' },
                        { term: 'Momentum', text: 'In den letzten 7 Tagen erledigte Aufgaben im Vergleich zu den 7 Tagen davor.' },
                        { term: 'Nächste Termine', text: 'Fälligkeiten und Projekt-Deadlines in den nächsten 14 Tagen.' },
                        { term: 'Läuft gut', text: 'Positive Signale, zum Beispiel das Projekt mit dem besten Lauf in dieser Woche.' },
                    ],
                },
            ],
        },
    ],
};

export default article;
