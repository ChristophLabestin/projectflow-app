import Foundation
import PFModel

/// App copy in German and English, mirroring the web dictionaries (`web/locales/*-de.ts` / `*-en.ts`).
/// Every feature registers its keys in its own `Strings+<Feature>.swift` file (`L10n.register`), so
/// parallel work never collides. Keys that also exist on the web keep the web key and wording.
enum L10n {
    enum Language: String, Sendable { case de, en }

    /// Observable, so every view that looked up a string re-renders on a language change — no shell
    /// rebuild, the navigation state stays exactly where it is.
    static var language: Language {
        get { LanguageStore.shared.language }
        set { LanguageStore.shared.language = newValue }
    }

    nonisolated(unsafe) private static var tables: [Language: [String: String]] = [.de: [:], .en: [:]]
    nonisolated(unsafe) private static var registered = false

    /// Applies the user's profile language (`users/{uid}.language`) when set.
    static func apply(profileLanguage: String?) {
        guard let profileLanguage, let language = Language(rawValue: String(profileLanguage.prefix(2))) else {
            // No explicit choice (or "system"): the first-install choice, else the device language.
            self.language = LanguageStore.deviceDefault
            return
        }
        self.language = language
    }

    static var locale: Locale { Locale(identifier: language == .de ? "de_DE" : "en_US") }

    static func register(de: [String: String], en: [String: String]) {
        tables[.de, default: [:]].merge(de) { _, new in new }
        tables[.en, default: [:]].merge(en) { _, new in new }
    }

    private static func ensureRegistered() {
        guard !registered else { return }
        registered = true
        StringTables.registerAll()
    }

    /// Looks up `key`, replacing `{name}` placeholders with `values`. Falls back to English, then the key.
    static func t(_ key: String, _ values: [String: CustomStringConvertible] = [:]) -> String {
        ensureRegistered()
        let language = self.language // registers an observation dependency in the calling view
        var text = tables[language]?[key] ?? tables[.en]?[key] ?? key
        for (name, value) in values {
            text = text.replacingOccurrences(of: "{\(name)}", with: value.description)
        }
        return text
    }

    /// Picks `key.one` or `key.other` based on `count` and substitutes `{count}`.
    static func plural(_ key: String, _ count: Int, _ values: [String: CustomStringConvertible] = [:]) -> String {
        var all = values
        all["count"] = count
        return t(count == 1 ? "\(key).one" : "\(key).other", all)
    }
}

@Observable
nonisolated final class LanguageStore: @unchecked Sendable {
    static let shared = LanguageStore()
    var language: L10n.Language = LanguageStore.deviceDefault

    /// Language picked in the first-install flow, else the device language.
    static var deviceDefault: L10n.Language {
        if let stored = FirstRunState.language, let language = L10n.Language(rawValue: stored) { return language }
        return (Locale.preferredLanguages.first ?? "de").hasPrefix("de") ? .de : .en
    }
}

/// Central list of string tables. Each feature adds one line here and keeps its table in its own file.
enum StringTables {
    static func registerAll() {
        L10n.register(de: CommonStrings.de, en: CommonStrings.en)
        L10n.register(de: AuthStrings.de, en: AuthStrings.en)
        L10n.register(de: ShellStrings.de, en: ShellStrings.en)
        FeatureStringTables.registerAll()
    }
}

// MARK: - Shared vocabulary (same words as the web)

enum CommonStrings {
    static let de: [String: String] = [
        "status.Backlog": "Backlog", "status.Open": "Offen", "status.In Progress": "In Arbeit", "status.Review": "Review",
        "status.On Hold": "Pausiert", "status.Blocked": "Blockiert", "status.Done": "Erledigt", "status.Planning": "Planung",
        "priority.Low": "Niedrig", "priority.Medium": "Mittel", "priority.High": "Hoch", "priority.Urgent": "Dringend",
        "priority.none": "Keine Priorität",
        "common.cancel": "Abbrechen", "common.save": "Sichern", "common.done": "Fertig", "common.delete": "Löschen",
        "common.undo": "Rückgängig", "common.retry": "Erneut", "common.close": "Schließen", "common.back": "Zurück",
        "common.open": "Öffnen", "common.more": "Mehr", "common.edit": "Bearbeiten", "common.add": "Hinzufügen",
        "common.today": "Heute", "common.tomorrow": "Morgen", "common.weekend": "Wochenende", "common.nextWeek": "Nächste Woche",
        "common.noDate": "Kein Datum", "common.pickDate": "Datum…", "common.remove": "Entfernen", "common.search": "Suchen",
        "common.offline": "Offline — Änderungen werden synchronisiert", "common.error": "Das hat nicht geklappt.",
        "common.personal": "Persönlich", "common.project": "Projekt", "common.priority": "Priorität",
        "common.assignee": "Wer", "common.date": "Datum", "common.loading": "Lädt…", "common.openInWeb": "Im Web öffnen",
        "common.share": "Teilen", "common.pin": "Anpinnen", "common.unpin": "Lösen", "common.startFocus": "Fokus starten",
        "common.complete": "Erledigt", "common.reopen": "Wieder öffnen", "common.later": "Später…",
        "common.copyLink": "Link kopieren", "common.linkCopied": "Link kopiert",
        "due.overdueDays.one": "Seit {count} Tag überfällig", "due.overdueDays.other": "Seit {count} Tagen überfällig",
        "due.yesterday": "Gestern überfällig geworden", "due.today": "Heute fällig", "due.tomorrow": "Morgen",
        "due.inDays.one": "In {count} Tag", "due.inDays.other": "In {count} Tagen",
        "task.completed": "Erledigt", "task.reopened": "Wieder geöffnet", "task.scheduledToday": "Für heute eingeplant",
        "task.moved": "Verschoben auf {date}",
        "common.status": "Status", "task.completedNamed": "„{title}“ erledigt",
        "task.plannedTodayOverdue": "Für heute eingeplant — ist aber noch überfällig", "task.moveDueToo": "Fällig heute",
        "task.nextStep": "Nächster Schritt", "later.eyebrow": "Später", "later.moveDue": "Fälligkeit auch verschieben",
        "later.unplan": "Aus Plan nehmen",
    ]

    static let en: [String: String] = [
        "status.Backlog": "Backlog", "status.Open": "Open", "status.In Progress": "In progress", "status.Review": "Review",
        "status.On Hold": "On hold", "status.Blocked": "Blocked", "status.Done": "Done", "status.Planning": "Planning",
        "priority.Low": "Low", "priority.Medium": "Medium", "priority.High": "High", "priority.Urgent": "Urgent",
        "priority.none": "No priority",
        "common.cancel": "Cancel", "common.save": "Save", "common.done": "Done", "common.delete": "Delete",
        "common.undo": "Undo", "common.retry": "Retry", "common.close": "Close", "common.back": "Back",
        "common.open": "Open", "common.more": "More", "common.edit": "Edit", "common.add": "Add",
        "common.today": "Today", "common.tomorrow": "Tomorrow", "common.weekend": "Weekend", "common.nextWeek": "Next week",
        "common.noDate": "No date", "common.pickDate": "Date…", "common.remove": "Remove", "common.search": "Search",
        "common.offline": "Offline — changes will sync", "common.error": "That didn't work.",
        "common.personal": "Personal", "common.project": "Project", "common.priority": "Priority",
        "common.assignee": "Who", "common.date": "Date", "common.loading": "Loading…", "common.openInWeb": "Open on the web",
        "common.share": "Share", "common.pin": "Pin", "common.unpin": "Unpin", "common.startFocus": "Start focus",
        "common.complete": "Done", "common.reopen": "Reopen", "common.later": "Later…",
        "common.copyLink": "Copy link", "common.linkCopied": "Link copied",
        "due.overdueDays.one": "Overdue for {count} day", "due.overdueDays.other": "Overdue for {count} days",
        "due.yesterday": "Became overdue yesterday", "due.today": "Due today", "due.tomorrow": "Tomorrow",
        "due.inDays.one": "In {count} day", "due.inDays.other": "In {count} days",
        "task.completed": "Done", "task.reopened": "Reopened", "task.scheduledToday": "Planned for today",
        "task.moved": "Moved to {date}",
        "common.status": "Status", "task.completedNamed": "“{title}” done",
        "task.plannedTodayOverdue": "Planned for today — still overdue though", "task.moveDueToo": "Due today",
        "task.nextStep": "Next step", "later.eyebrow": "Later", "later.moveDue": "Also move the due date",
        "later.unplan": "Remove from plan",
    ]
}

extension TaskStatus { var label: String { L10n.t("status.\(rawValue)") } }
extension TaskPriority { var label: String { L10n.t("priority.\(rawValue)") } }
