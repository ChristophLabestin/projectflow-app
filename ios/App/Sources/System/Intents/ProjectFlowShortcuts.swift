import AppIntents

/// Phrases for Siri and Spotlight. The code carries the German phrases (development language); the English
/// ones live in `AppShortcuts.xcstrings`.
struct ProjectFlowShortcuts: AppShortcutsProvider {
    static let shortcutTileColor: ShortcutTileColor = .navy

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: WhatsNextIntent(),
            phrases: [
                "Was steht heute in \(.applicationName) an?",
                "Was ist heute in \(.applicationName) dran?",
                "Was kommt als Nächstes in \(.applicationName)?",
            ],
            shortTitle: "Was steht an?",
            systemImageName: "sun.max"
        )
        AppShortcut(
            intent: CaptureTaskIntent(),
            phrases: [
                "Erfasse eine Aufgabe in \(.applicationName)",
                "Neue Aufgabe in \(.applicationName)",
                "Merke mir etwas in \(.applicationName)",
            ],
            shortTitle: "Aufgabe erfassen",
            systemImageName: "plus"
        )
        AppShortcut(
            intent: CompleteFocusIntent(),
            phrases: [
                "Fokus in \(.applicationName) erledigen",
                "Fokus in \(.applicationName) abschließen",
            ],
            shortTitle: "Fokus erledigen",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: PauseFocusIntent(),
            phrases: [
                "Fokus in \(.applicationName) pausieren",
                "Pause in \(.applicationName)",
            ],
            shortTitle: "Fokus pausieren",
            systemImageName: "pause.circle"
        )
        AppShortcut(
            intent: StartFocusIntent(),
            phrases: [
                "Starte den Fokus auf \(\.$task) in \(.applicationName)",
                "Fokus auf \(\.$task) in \(.applicationName)",
            ],
            shortTitle: "Fokus starten",
            systemImageName: "scope"
        )
        AppShortcut(
            intent: OpenProjectIntent(),
            phrases: [
                "Öffne \(\.$target) in \(.applicationName)",
            ],
            shortTitle: "Projekt öffnen",
            systemImageName: "square.stack"
        )
        AppShortcut(
            intent: OpenCaptureIntent(),
            phrases: [
                "Öffne den Composer in \(.applicationName)",
            ],
            shortTitle: "Erfassen öffnen",
            systemImageName: "square.and.pencil"
        )
        AppShortcut(
            intent: AskProjectFlowIntent(),
            phrases: [
                "Frag \(.applicationName)",
                "Ask \(.applicationName)",
            ],
            shortTitle: "Frag ProjectFlow",
            systemImageName: "sparkles"
        )
    }
}
