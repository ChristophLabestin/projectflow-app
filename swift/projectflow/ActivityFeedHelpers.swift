import Foundation
import FirebaseFirestore

enum ActivityFeedFilter: String, CaseIterable, Identifiable {
    case all
    case task
    case member
    case report

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return L10n.tr("activity.all", fallback: "All")
        case .task: return L10n.tr("activity.tasks", fallback: "Tasks")
        case .member: return L10n.tr("activity.members", fallback: "Members")
        case .report: return L10n.tr("activity.reports", fallback: "Reports")
        }
    }
}

enum ActivityTimeRange: String, CaseIterable, Identifiable {
    case week
    case month
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .week: return L10n.tr("activity.range.7d", fallback: "7 days")
        case .month: return L10n.tr("activity.range.30d", fallback: "30 days")
        case .all: return L10n.tr("activity.range.all", fallback: "All time")
        }
    }

    var startDate: Date? {
        let calendar = Calendar.current
        let now = Date()
        switch self {
        case .week: return calendar.date(byAdding: .day, value: -7, to: now)
        case .month: return calendar.date(byAdding: .day, value: -30, to: now)
        case .all: return nil
        }
    }
}

enum ActivityPresentation {
    static func icon(for item: ActivityItem) -> String {
        let type = item.type.lowercased()
        let action = item.action.lowercased()
        if type.contains("task") || action.contains("task") { return "checkmark.circle" }
        if type.contains("member") || action.contains("member") || action.contains("invite") { return "person.2" }
        if type.contains("report") || action.contains("report") { return "doc.text" }
        if type.contains("comment") { return "bubble.left" }
        if type.contains("milestone") { return "flag.checkered" }
        if type.contains("sprint") { return "figure.run" }
        return "clock.arrow.circlepath"
    }

    static func matches(filter: ActivityFeedFilter, item: ActivityItem) -> Bool {
        switch filter {
        case .all: return true
        case .task: return item.type.lowercased().contains("task") || item.action.lowercased().contains("task")
        case .member: return item.type.lowercased().contains("member") || item.action.lowercased().contains("member")
        case .report: return item.type.lowercased().contains("report") || item.action.lowercased().contains("report")
        }
    }

    static func filter(_ items: [ActivityItem], type: ActivityFeedFilter, range: ActivityTimeRange) -> [ActivityItem] {
        items.filter { item in
            guard ActivityPresentation.matches(filter: type, item: item) else { return false }
            guard let start = range.startDate else { return true }
            let created = item.createdAt?.dateValue() ?? .distantPast
            return created >= start
        }
    }
}
