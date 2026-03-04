import Foundation

enum AppLocale: String {
    case en
    case de

    static var current: AppLocale {
        let code = Locale.current.languageCode?.lowercased() ?? "en"
        return code == "de" ? .de : .en
    }
}

enum FlowLocalization {
    private static let en: [String: String] = [
        "flows.stage.brainstorm": "Brainstorm",
        "flows.stage.refining": "Refining",
        "flows.stage.concept": "Concept",
        "flows.stage.review": "Review",
        "flows.stage.approved": "Approved",
        "flows.stage.implemented": "Implemented",
        "flows.stage.archived": "Archived",
        "flows.type.feature": "Feature",
        "flows.type.product": "Product",
        "flows.type.optimization": "Optimization",
        "flows.type.marketing": "Marketing",
        "flows.type.moonshot": "Moonshot"
    ]

    private static let de: [String: String] = [
        "flows.stage.brainstorm": "Brainstorming",
        "flows.stage.refining": "Verfeinerung",
        "flows.stage.concept": "Konzept",
        "flows.stage.review": "Prüfung",
        "flows.stage.approved": "Genehmigt",
        "flows.stage.implemented": "Implementiert",
        "flows.stage.archived": "Archiviert",
        "flows.type.feature": "Feature",
        "flows.type.product": "Produkt",
        "flows.type.optimization": "Optimierung",
        "flows.type.marketing": "Marketing",
        "flows.type.moonshot": "Moonshot"
    ]

    static func stage(_ stage: String, locale: AppLocale = .current) -> String {
        let key = "flows.stage.\(stage.lowercased())"
        switch locale {
        case .de: return de[key] ?? en[key] ?? stage
        case .en: return en[key] ?? stage
        }
    }

    static func type(_ type: String, locale: AppLocale = .current) -> String {
        let key = "flows.type.\(type.lowercased())"
        switch locale {
        case .de: return de[key] ?? en[key] ?? type
        case .en: return en[key] ?? type
        }
    }
}

enum HealthLocalization {
    private static let en: [String: String] = [
        "health.factors.deadline_overdue.label": "Deadline Overdue",
        "health.factors.deadline_overdue.description": "The project passed its deadline {days} days ago.",
        "health.factors.deadline_imminent.label": "Deadline Imminent",
        "health.factors.deadline_imminent.description": "The project deadline is less than 3 days away.",
        "health.factors.deadline_approaching.label": "Deadline Approaching",
        "health.factors.deadline_approaching.description": "The project is due within 2 weeks.",
        "health.factors.high_velocity.label": "High Velocity",
        "health.factors.high_velocity.description": "{count} tasks completed in the last week. Great momentum!",
        "health.factors.steady_progress.label": "Steady Progress",
        "health.factors.steady_progress.description": "Active progress is being made on project tasks.",
        "health.factors.stalled_velocity.label": "Stalled Velocity",
        "health.factors.stalled_velocity.description": "No tasks completed in the last 7 days.",
        "health.factors.scope_creep.label": "Scope Creep",
        "health.factors.scope_creep.description": "Tasks are being added faster than they are being completed.",
        "health.factors.tasks_overdue.label": "Overdue Tasks",
        "health.factors.tasks_overdue.description": "{count} tasks are past their deadline.",
        "health.factors.tasks_due_soon.label": "Tasks Due Soon",
        "health.factors.tasks_due_soon.description": "{count} tasks are due within 72 hours.",
        "health.factors.blocked_tasks.label": "Task Blockers",
        "health.factors.blocked_tasks.description": "{count} task(s) are currently blocked.",
        "health.factors.unresolved_issues.label": "Critical Issues",
        "health.factors.unresolved_issues.description": "{count} high-priority issue(s) remain unresolved.",
        "health.factors.stale_project.label": "Stale Project",
        "health.factors.stale_project.description": "No activity recorded for over {days} days.",
        "health.factors.inactive_recent.label": "Recent Inactivity",
        "health.factors.inactive_recent.description": "No activity in the last 7 days.",
        "health.factors.active_engagement.label": "Highly Engaged",
        "health.factors.active_engagement.description": "The project has seen recent activity and team engagement.",
        "health.factors.missed_milestones.label": "Milestone Delays",
        "health.factors.missed_milestones.description": "{count} milestone(s) have been missed or are overdue.",
        "health.recommendations.updateDeadline": "Update project deadline or complete outstanding core milestones.",
        "health.recommendations.prioritizeTasks": "Prioritize remaining high-priority tasks to meet the deadline.",
        "health.recommendations.breakdownTasks": "Consider breaking down large tasks to regain momentum.",
        "health.recommendations.reviewScope": "Review project scope and prioritize essential features.",
        "health.recommendations.rescheduleOverdue": "Complete or reschedule overdue tasks immediately.",
        "health.recommendations.resolveBlockers": "Resolve dependencies or clear blockers for the restricted tasks.",
        "health.recommendations.addressIssues": "Address critical issues to stabilize project health.",
        "health.recommendations.reactivateProject": "Reactivate the project with a status update or team meeting.",
        "health.recommendations.replanMilestones": "Replan missed milestones to provide a realistic project timeline."
    ]

    private static let de: [String: String] = [
        "health.factors.deadline_overdue.label": "Frist überschritten",
        "health.factors.deadline_overdue.description": "Das Projekt hat seine Frist vor {days} Tagen überschritten.",
        "health.factors.deadline_imminent.label": "Frist steht bevor",
        "health.factors.deadline_imminent.description": "Die Projektfrist ist weniger als 3 Tage entfernt.",
        "health.factors.deadline_approaching.label": "Frist nähert sich",
        "health.factors.deadline_approaching.description": "Das Projekt ist innerhalb von 2 Wochen fällig.",
        "health.factors.high_velocity.label": "Hohe Geschwindigkeit",
        "health.factors.high_velocity.description": "{count} Aufgaben wurden in der letzten Woche abgeschlossen. Starkes Momentum!",
        "health.factors.steady_progress.label": "Konstanter Fortschritt",
        "health.factors.steady_progress.description": "Es gibt aktiven Fortschritt bei den Projektaufgaben.",
        "health.factors.stalled_velocity.label": "Stockender Fortschritt",
        "health.factors.stalled_velocity.description": "In den letzten 7 Tagen wurden keine Aufgaben abgeschlossen.",
        "health.factors.scope_creep.label": "Scope Creep",
        "health.factors.scope_creep.description": "Es kommen mehr Aufgaben hinzu, als abgeschlossen werden.",
        "health.factors.tasks_overdue.label": "Überfällige Aufgaben",
        "health.factors.tasks_overdue.description": "{count} Aufgaben sind überfällig.",
        "health.factors.tasks_due_soon.label": "Aufgaben bald fällig",
        "health.factors.tasks_due_soon.description": "{count} Aufgaben sind innerhalb von 72 Stunden fällig.",
        "health.factors.blocked_tasks.label": "Blockierte Aufgaben",
        "health.factors.blocked_tasks.description": "{count} Aufgabe(n) sind aktuell blockiert.",
        "health.factors.unresolved_issues.label": "Kritische Probleme",
        "health.factors.unresolved_issues.description": "{count} hochpriorisierte Probleme sind noch ungelöst.",
        "health.factors.stale_project.label": "Inaktives Projekt",
        "health.factors.stale_project.description": "Seit über {days} Tagen wurde keine Aktivität erfasst.",
        "health.factors.inactive_recent.label": "Kürzliche Inaktivität",
        "health.factors.inactive_recent.description": "Keine Aktivität in den letzten 7 Tagen.",
        "health.factors.active_engagement.label": "Hohe Aktivität",
        "health.factors.active_engagement.description": "Das Projekt zeigt aktuelle Aktivität und Teamengagement.",
        "health.factors.missed_milestones.label": "Meilenstein-Verzögerungen",
        "health.factors.missed_milestones.description": "{count} Meilenstein(e) wurden verpasst oder sind überfällig.",
        "health.recommendations.updateDeadline": "Projektfrist anpassen oder ausstehende Kern-Meilensteine abschließen.",
        "health.recommendations.prioritizeTasks": "Hochpriorisierte Aufgaben priorisieren, um die Frist einzuhalten.",
        "health.recommendations.breakdownTasks": "Große Aufgaben in kleinere Schritte aufteilen, um Momentum zurückzugewinnen.",
        "health.recommendations.reviewScope": "Projektumfang prüfen und essenzielle Funktionen priorisieren.",
        "health.recommendations.rescheduleOverdue": "Überfällige Aufgaben sofort abschließen oder neu terminieren.",
        "health.recommendations.resolveBlockers": "Abhängigkeiten auflösen oder Blocker für die betroffenen Aufgaben entfernen.",
        "health.recommendations.addressIssues": "Kritische Probleme beheben, um die Projektgesundheit zu stabilisieren.",
        "health.recommendations.reactivateProject": "Projekt mit einem Status-Update oder Team-Meeting reaktivieren.",
        "health.recommendations.replanMilestones": "Verpasste Meilensteine neu planen, um einen realistischen Zeitplan zu sichern."
    ]

    static func label(for factor: HealthFactor, locale: AppLocale = .current) -> String {
        resolvedText(for: factor.labelKey, fallback: factor.label, meta: factor.meta, locale: locale)
    }

    static func description(for factor: HealthFactor, locale: AppLocale = .current) -> String {
        resolvedText(for: factor.descriptionKey, fallback: factor.description, meta: factor.meta, locale: locale)
    }

    static func recommendations(keys: [String], fallbacks: [String], locale: AppLocale = .current) -> [String] {
        let count = max(keys.count, fallbacks.count)
        guard count > 0 else { return [] }

        return (0..<count).map { index in
            let key = index < keys.count ? keys[index] : nil
            let fallback = index < fallbacks.count ? fallbacks[index] : ""
            return resolvedText(for: key, fallback: fallback, meta: nil, locale: locale)
        }.filter { !$0.isEmpty }
    }

    static func highlights(for health: ProjectHealthSnapshot, locale: AppLocale = .current) -> [String] {
        let localized = health.factors.prefix(3).map { label(for: $0, locale: locale) }.filter { !$0.isEmpty }
        if !localized.isEmpty {
            return localized
        }
        return health.highlights
    }

    private static func resolvedText(
        for key: String?,
        fallback: String,
        meta: [String: String]?,
        locale: AppLocale
    ) -> String {
        guard let key else { return fallback }
        let template: String?
        switch locale {
        case .de:
            template = de[key] ?? en[key]
        case .en:
            template = en[key]
        }
        let text = template ?? fallback
        return replacePlaceholders(in: text, meta: meta)
    }

    private static func replacePlaceholders(in text: String, meta: [String: String]?) -> String {
        guard let meta, !meta.isEmpty else { return text }
        var output = text
        for (token, value) in meta {
            output = output.replacingOccurrences(of: "{\(token)}", with: value)
        }
        return output
    }
}
