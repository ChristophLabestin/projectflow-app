import Foundation
import PFModel

enum InboxGroup: CaseIterable, Hashable {
    case today, week, earlier

    var title: String {
        switch self {
        case .today: L10n.t("inbox.group.today")
        case .week: L10n.t("inbox.group.week")
        case .earlier: L10n.t("inbox.group.earlier")
        }
    }
}

/// Pure presentation logic of the inbox: filtering, grouping, headlines and the "Seit gestern Abend" sentence.
enum InboxLogic {
    static func matches(_ item: InboxItem, filter: InboxFilter) -> Bool {
        switch filter {
        case .all: true
        case .mentions: item.kind == .commentMention
        case .assignments: item.kind == .taskAssigned || item.kind == .subtaskAssigned
        }
    }

    static func group(of item: InboxItem, now: Date = .now) -> InboxGroup {
        guard let date = item.createdAt?.instant else { return .earlier }
        let calendar = Formatting.calendar
        if calendar.isDate(date, inSameDayAs: now) { return .today }
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: date), to: calendar.startOfDay(for: now)).day ?? 99
        return days < 7 ? .week : .earlier
    }

    static func grouped(_ items: [InboxItem], now: Date = .now) -> [(group: InboxGroup, items: [InboxItem])] {
        InboxGroup.allCases.compactMap { group in
            let members = items.filter { Self.group(of: $0, now: now) == group }
            return members.isEmpty ? nil : (group, members)
        }
    }

    // MARK: Time

    static func timeLabel(_ item: InboxItem, now: Date = .now) -> String {
        guard let date = item.createdAt?.instant else { return "" }
        let seconds = now.timeIntervalSince(date)
        if seconds < 60 { return L10n.t("notifications.time.justNow") }
        let calendar = Formatting.calendar
        if calendar.isDate(date, inSameDayAs: now) || seconds < 86_400 { return Formatting.relative(date, now: now) }
        return date.formatted(.dateTime.day().month(.abbreviated).locale(L10n.locale))
    }

    // MARK: Headline per kind (own wording, the server text is English)

    static func firstName(_ name: String?) -> String? {
        name?.split(separator: " ").first.map(String.init)
    }

    static func headline(for item: InboxItem, actor: String?) -> String {
        let named = actor.map { ["name": $0] }
        func pick(_ withName: String, _ without: String) -> String {
            if let named { L10n.t(withName, named) } else { L10n.t(without) }
        }
        switch item.kind {
        case .taskAssigned: return pick("inbox.headline.assigned", "inbox.headline.assignedAnon")
        case .subtaskAssigned: return pick("inbox.headline.subtask", "inbox.headline.subtaskAnon")
        case .commentMention: return pick("inbox.headline.mention", "inbox.headline.mentionAnon")
        case .commentAdded: return pick("inbox.headline.comment", "inbox.headline.commentAnon")
        case .taskCompleted: return pick("inbox.headline.completed", "inbox.headline.completedAnon")
        case .taskUpdated: return pick("inbox.headline.updated", "inbox.headline.updatedAnon")
        case .workspaceInvite: return pick("inbox.headline.workspaceInvite", "inbox.headline.workspaceInviteAnon")
        case .projectInvite: return pick("inbox.headline.projectInvite", "inbox.headline.projectInviteAnon")
        case .projectShared: return L10n.t("inbox.headline.projectShared")
        case .joinRequest: return pick("inbox.headline.joinRequest", "inbox.headline.joinRequestAnon")
        case .joinRequestAccepted: return L10n.t("inbox.headline.joinAccepted")
        case .joinRequestDenied: return L10n.t("inbox.headline.joinDenied")
        case .reminder: return L10n.t("inbox.headline.reminder")
        case .taskDueToday: return L10n.t("inbox.headline.dueToday")
        case .morningBriefing: return L10n.t("inbox.headline.briefing")
        case .dayClose: return L10n.t("inbox.headline.dayClose")
        case .other: return item.title.isEmpty ? L10n.t("inbox.headline.other") : item.title
        }
    }

    /// Kinds that come from a person (avatar) versus the system (symbol tile).
    static func symbol(for kind: NotificationKind) -> String? {
        switch kind {
        case .reminder: "bell"
        case .taskDueToday: "calendar.badge.exclamationmark"
        case .morningBriefing: "sun.horizon"
        case .dayClose: "moon.stars"
        case .workspaceInvite, .projectInvite, .projectShared: "envelope"
        case .joinRequestAccepted, .joinRequestDenied: "person.crop.circle.badge.checkmark"
        case .other: "tray"
        default: nil
        }
    }

    /// Body text below the headline: the server message for system notices, nothing for task events
    /// (the mini task row says it) and comment excerpts are supplied by the caller.
    static func serverMessage(for item: InboxItem) -> String? {
        switch item.kind {
        case .reminder, .taskDueToday, .morningBriefing, .dayClose, .other, .projectShared, .joinRequest:
            item.message.isEmpty ? nil : item.message
        default:
            nil
        }
    }

    // MARK: "Seit gestern Abend"

    /// Yesterday 18:00 local time.
    static func sinceYesterdayEvening(now: Date = .now) -> Date {
        let calendar = Formatting.calendar
        let yesterday = calendar.date(byAdding: .day, value: -1, to: now) ?? now
        return calendar.date(bySettingHour: 18, minute: 0, second: 0, of: yesterday) ?? yesterday
    }

    /// "3 neue Zuweisungen, Lena hat dich zweimal erwähnt." — only unread entries since yesterday evening.
    static func summary(_ items: [InboxItem], now: Date = .now, actorName: (InboxItem) -> String?) -> String? {
        let since = sinceYesterdayEvening(now: now)
        let recent = items.filter { !$0.read && ($0.createdAt?.instant ?? .distantPast) >= since }
        guard !recent.isEmpty else { return nil }
        var clauses: [String] = []

        let assignments = recent.filter { $0.kind == .taskAssigned || $0.kind == .subtaskAssigned }.count
        if assignments > 0 { clauses.append(L10n.plural("inbox.summary.assignments", assignments)) }

        let mentions = recent.filter { $0.kind == .commentMention }
        if !mentions.isEmpty {
            let actors = Set(mentions.compactMap(actorName))
            if actors.count == 1, let name = actors.first {
                switch mentions.count {
                case 1: clauses.append(L10n.t("inbox.summary.mentionOnce", ["name": name]))
                case 2: clauses.append(L10n.t("inbox.summary.mentionTwice", ["name": name]))
                default: clauses.append(L10n.t("inbox.summary.mentionMany", ["name": name, "count": mentions.count]))
                }
            } else {
                clauses.append(L10n.plural("inbox.summary.mentions", mentions.count))
            }
        }

        let comments = recent.filter { $0.kind == .commentAdded }.count
        if comments > 0 { clauses.append(L10n.plural("inbox.summary.comments", comments)) }

        let invites = recent.filter { $0.kind == .workspaceInvite || $0.kind == .projectInvite }.count
        if invites > 0 { clauses.append(L10n.plural("inbox.summary.invites", invites)) }

        if clauses.isEmpty {
            clauses.append(L10n.plural("inbox.summary.other", recent.count))
        }
        return clauses.joined(separator: ", ") + "."
    }
}
