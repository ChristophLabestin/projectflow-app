import Foundation

/// Small DE/EN string table for everything that runs outside the app (widgets, Live Activity, controls,
/// share extension, notification service). The app itself uses `L10n`; these extensions must not link it.
/// Language: the app's language when the snapshot carries it, otherwise `Locale.preferredLanguages`.
nonisolated struct ExtensionStrings: Sendable {
    let language: String

    init(language: String? = nil) {
        if let language, language == "de" || language == "en" {
            self.language = language
        } else {
            self.language = (Locale.preferredLanguages.first ?? "de").hasPrefix("de") ? "de" : "en"
        }
    }

    var locale: Locale { Locale(identifier: language == "de" ? "de_DE" : "en_US") }

    func t(_ key: String, _ values: [String: String] = [:]) -> String {
        var text = (language == "de" ? Self.de[key] : Self.en[key]) ?? Self.en[key] ?? key
        for (name, value) in values { text = text.replacingOccurrences(of: "{\(name)}", with: value) }
        return text
    }

    func plural(_ key: String, _ count: Int) -> String {
        t(count == 1 ? "\(key).one" : "\(key).other", ["count": String(count)])
    }

    /// "10:42" in the user's 12/24 h style.
    func time(_ date: Date) -> String {
        date.formatted(.dateTime.hour().minute().locale(locale))
    }

    /// "2 überfällig · 2 heute" (zero counts are left out).
    func counts(overdue: Int, today: Int) -> String {
        var parts: [String] = []
        if overdue > 0 { parts.append(t("w.overdue", ["count": String(overdue)])) }
        if today > 0 { parts.append(t("w.dueToday", ["count": String(today)])) }
        return parts.joined(separator: " · ")
    }

    static let de: [String: String] = [
        // Widget gallery
        "w.today.name": "Heute", "w.today.description": "Dein Tag auf einen Blick: Tagesband und die nächsten Stopps zum Abhaken.",
        "w.focus.name": "Fokus", "w.focus.description": "Woran du gerade arbeitest, mit Erledigt und Pause.",
        "w.eyebrow.today": "Heute", "w.eyebrow.focus": "Im Fokus",
        // Today widget
        "w.overdue": "{count} überfällig", "w.dueToday": "{count} heute",
        "w.more": "+{count} weitere", "w.allClear": "Alles erledigt", "w.freeDay": "Nichts offen für heute.",
        "w.signedOut": "Melde dich in ProjectFlow an, um deinen Tag zu sehen.",
        "w.stale": "Neuer Tag. Öffne ProjectFlow für deinen Plan.",
        "w.open.one": "{count} offen", "w.open.other": "{count} offen",
        "w.noStops": "Keine nächsten Stopps.",
        "w.complete": "Erledigt",
        // Focus widget / Live Activity
        "w.noFocus": "Kein Fokus", "w.noFocusHint": "Starte einen Fokus in ProjectFlow.",
        "w.since": "seit {time}", "w.pausedUntil": "Pause bis {time}", "w.paused": "Pausiert", "w.blocked": "Blockiert",
        "w.done": "Erledigt", "w.pause": "Pause", "w.resume": "Weiter", "w.nextStep": "Nächster Schritt",
        "w.focusOpen": "Fokus öffnen",
        // Controls
        "ctl.capture.name": "Erfassen", "ctl.capture.description": "Öffnet den Composer, um schnell etwas festzuhalten.",
        "ctl.focus.name": "Fokus", "ctl.focus.description": "Pausiert oder setzt deinen Fokus fort.",
        "ctl.focus.running": "Läuft", "ctl.focus.paused": "Pausiert", "ctl.focus.none": "Kein Fokus",
        // Share extension
        "share.title": "Aufgabe erfassen", "share.placeholder": "Was ist zu tun?", "share.target": "Ziel",
        "share.personal": "Persönlich", "share.save": "Erfassen", "share.cancel": "Abbrechen",
        "share.saved": "Erfasst", "share.saving": "Wird gesichert…",
        "share.queued": "Gemerkt. Öffne ProjectFlow einmal, dann wird die Aufgabe angelegt.",
        "share.signedOut": "Du bist in ProjectFlow nicht angemeldet. Die Aufgabe wird gemerkt und angelegt, sobald du die App öffnest.",
        "share.error": "Das hat nicht geklappt.", "share.retry": "Erneut versuchen", "share.later": "Für später merken",
        "share.note": "Notiz", "share.link": "Link", "share.empty": "Gib der Aufgabe einen Titel.",
        // Push enrichment
        "push.assigned": "Neue Aufgabe für dich", "push.mention": "Du wurdest erwähnt", "push.comment": "Neuer Kommentar",
        "push.due": "Heute fällig", "push.reminder": "Erinnerung", "push.briefing": "Dein Tag", "push.dayclose": "Tagesabschluss",
    ]

    static let en: [String: String] = [
        "w.today.name": "Today", "w.today.description": "Your day at a glance: the day band and the next stops to tick off.",
        "w.focus.name": "Focus", "w.focus.description": "What you are working on right now, with Done and Pause.",
        "w.eyebrow.today": "Today", "w.eyebrow.focus": "In focus",
        "w.overdue": "{count} overdue", "w.dueToday": "{count} today",
        "w.more": "+{count} more", "w.allClear": "All clear", "w.freeDay": "Nothing open for today.",
        "w.signedOut": "Sign in to ProjectFlow to see your day.",
        "w.stale": "New day. Open ProjectFlow for your plan.",
        "w.open.one": "{count} open", "w.open.other": "{count} open",
        "w.noStops": "No next stops.",
        "w.complete": "Done",
        "w.noFocus": "No focus", "w.noFocusHint": "Start a focus in ProjectFlow.",
        "w.since": "since {time}", "w.pausedUntil": "Paused until {time}", "w.paused": "Paused", "w.blocked": "Blocked",
        "w.done": "Done", "w.pause": "Pause", "w.resume": "Resume", "w.nextStep": "Next step",
        "w.focusOpen": "Open focus",
        "ctl.capture.name": "Capture", "ctl.capture.description": "Opens the composer to jot something down fast.",
        "ctl.focus.name": "Focus", "ctl.focus.description": "Pauses or resumes your focus.",
        "ctl.focus.running": "Running", "ctl.focus.paused": "Paused", "ctl.focus.none": "No focus",
        "share.title": "Capture task", "share.placeholder": "What needs doing?", "share.target": "Target",
        "share.personal": "Personal", "share.save": "Capture", "share.cancel": "Cancel",
        "share.saved": "Captured", "share.saving": "Saving…",
        "share.queued": "Noted. Open ProjectFlow once and the task will be created.",
        "share.signedOut": "You are not signed in to ProjectFlow. The task is kept and created as soon as you open the app.",
        "share.error": "That didn't work.", "share.retry": "Try again", "share.later": "Keep for later",
        "share.note": "Note", "share.link": "Link", "share.empty": "Give the task a title.",
        "push.assigned": "New task for you", "push.mention": "You were mentioned", "push.comment": "New comment",
        "push.due": "Due today", "push.reminder": "Reminder", "push.briefing": "Your day", "push.dayclose": "Day close",
    ]
}
