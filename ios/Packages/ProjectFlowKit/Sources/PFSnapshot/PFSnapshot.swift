import Foundation
import PFModel

/// Compact, already-localised state shared with widgets, the Live Activity and the share extension
/// through the App Group container. Extensions never talk to Firebase themselves.
public struct TodaySnapshot: Codable, Hashable, Sendable {
    public struct Stop: Codable, Hashable, Sendable, Identifiable {
        public let id: String
        public let title: String
        public let subtitle: String
        /// "overdue" | "due" | "scheduled" | "blocked" | "suggested"
        public let severity: String
        public let tenantId: String
        public let projectId: String?
        public let isPersonal: Bool
        /// "Low" | "Medium" | "High" | "Urgent" (optional, drives the priority signal in widgets).
        public var priority: String?

        public init(id: String, title: String, subtitle: String, severity: String, tenantId: String, projectId: String?, isPersonal: Bool,
                    priority: String? = nil) {
            self.id = id; self.title = title; self.subtitle = subtitle; self.severity = severity
            self.tenantId = tenantId; self.projectId = projectId; self.isPersonal = isPersonal; self.priority = priority
        }
    }

    public struct Focus: Codable, Hashable, Sendable {
        public let itemId: String
        public let itemType: String
        public let title: String
        public let projectName: String?
        public let nextStep: String?
        public let status: String
        public let startedAt: Date?
        public let tenantId: String?
        public let projectId: String?
        /// End of the pause when `status == "snoozed"`.
        public var snoozedUntil: Date?

        public init(itemId: String, itemType: String, title: String, projectName: String?, nextStep: String?, status: String,
                    startedAt: Date?, tenantId: String?, projectId: String?, snoozedUntil: Date? = nil) {
            self.itemId = itemId; self.itemType = itemType; self.title = title; self.projectName = projectName
            self.nextStep = nextStep; self.status = status; self.startedAt = startedAt; self.tenantId = tenantId; self.projectId = projectId
            self.snoozedUntil = snoozedUntil
        }
    }

    /// A project the share extension and widgets can target (title only, no content).
    public struct ProjectRef: Codable, Hashable, Sendable, Identifiable {
        public let id: String
        public let title: String
        public let tenantId: String

        public init(id: String, title: String, tenantId: String) {
            self.id = id; self.title = title; self.tenantId = tenantId
        }
    }

    public var generatedAt: Date
    public var workspaceName: String
    public var headline: String
    public var summary: String
    /// Day band segments: "overdue" | "due" | "waiting" | "free"
    public var band: [String]
    public var overdueCount: Int
    public var dueTodayCount: Int
    public var stops: [Stop]
    public var moreCount: Int
    public var focus: Focus?
    public var signedIn: Bool
    /// Projects of the active workspace (share extension targets). Written by the app.
    public var projects: [ProjectRef]
    /// App language ("de" | "en") so extensions speak the same language as the app copy in this snapshot.
    public var language: String?

    public init(generatedAt: Date = .now, workspaceName: String, headline: String, summary: String, band: [String],
                overdueCount: Int, dueTodayCount: Int, stops: [Stop], moreCount: Int, focus: Focus?, signedIn: Bool = true,
                projects: [ProjectRef] = [], language: String? = nil) {
        self.generatedAt = generatedAt; self.workspaceName = workspaceName; self.headline = headline; self.summary = summary
        self.band = band; self.overdueCount = overdueCount; self.dueTodayCount = dueTodayCount; self.stops = stops
        self.moreCount = moreCount; self.focus = focus; self.signedIn = signedIn
        self.projects = projects; self.language = language
    }

    // Tolerant decoding: snapshots written by older app versions lack the newer keys.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        generatedAt = try c.decode(Date.self, forKey: .generatedAt)
        workspaceName = try c.decode(String.self, forKey: .workspaceName)
        headline = try c.decode(String.self, forKey: .headline)
        summary = try c.decode(String.self, forKey: .summary)
        band = try c.decode([String].self, forKey: .band)
        overdueCount = try c.decode(Int.self, forKey: .overdueCount)
        dueTodayCount = try c.decode(Int.self, forKey: .dueTodayCount)
        stops = try c.decode([Stop].self, forKey: .stops)
        moreCount = try c.decode(Int.self, forKey: .moreCount)
        focus = try c.decodeIfPresent(Focus.self, forKey: .focus)
        signedIn = try c.decodeIfPresent(Bool.self, forKey: .signedIn) ?? true
        projects = try c.decodeIfPresent([ProjectRef].self, forKey: .projects) ?? []
        language = try c.decodeIfPresent(String.self, forKey: .language)
    }

    public static let signedOut = TodaySnapshot(workspaceName: "", headline: "", summary: "", band: [], overdueCount: 0,
                                                dueTodayCount: 0, stops: [], moreCount: 0, focus: nil, signedIn: false)

    public static let preview = TodaySnapshot(
        workspaceName: "Demo Studio",
        headline: "Heute ist in 4 Zügen erledigt — der erste brennt.",
        summary: "2 überfällig · 2 heute",
        band: ["overdue", "overdue", "due", "due", "free"],
        overdueCount: 2, dueTodayCount: 2,
        stops: [
            Stop(id: "t1", title: "Set up 301 redirects", subtitle: "Seit 3 Tagen überfällig", severity: "overdue", tenantId: "t", projectId: "p", isPersonal: false, priority: "Urgent"),
            Stop(id: "t2", title: "Finalize hero copy", subtitle: "Heute fällig", severity: "due", tenantId: "t", projectId: "p", isPersonal: false, priority: "High"),
            Stop(id: "t3", title: "Onboarding screens", subtitle: "Heute fällig", severity: "due", tenantId: "t", projectId: "p", isPersonal: false, priority: "Medium"),
            Stop(id: "t4", title: "Review Q4 budget", subtitle: "Heute fällig", severity: "due", tenantId: "t", projectId: nil, isPersonal: true),
            Stop(id: "t5", title: "Send invoice to Studio Nord", subtitle: "Eingeplant", severity: "scheduled", tenantId: "t", projectId: "p", isPersonal: false, priority: "Low"),
        ],
        moreCount: 3,
        focus: Focus(itemId: "t1", itemType: "task", title: "Set up 301 redirects", projectName: "Website Relaunch",
                     nextStep: "Mapping-Tabelle exportieren", status: "active", startedAt: .now.addingTimeInterval(-2400), tenantId: "t", projectId: "p"),
        projects: [
            ProjectRef(id: "p", title: "Website Relaunch", tenantId: "t"),
            ProjectRef(id: "p2", title: "Brand Refresh", tenantId: "t"),
            ProjectRef(id: "p3", title: "Mobile App", tenantId: "t"),
        ],
        language: "de"
    )
}

/// Reads and writes snapshots in the shared container.
public enum SnapshotStore {
    public static let appGroup = "group.de.christophlabestin.projectflow"
    static let fileName = "today-snapshot.json"
    static let pendingActionsFile = "pending-actions.json"

    static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    }

    public static func load() -> TodaySnapshot? {
        guard let url = containerURL?.appendingPathComponent(fileName), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder.snapshot.decode(TodaySnapshot.self, from: data)
    }

    public static func save(_ snapshot: TodaySnapshot) {
        guard let url = containerURL?.appendingPathComponent(fileName), let data = try? JSONEncoder.snapshot.encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
    }

    public static func clear() { save(.signedOut) }

    // Actions queued by extensions (e.g. share extension capture without a valid session).
    public struct PendingCapture: Codable, Hashable, Sendable, Identifiable {
        public let id: UUID
        public let title: String
        public let note: String?
        public let createdAt: Date
        public init(title: String, note: String?) { id = UUID(); self.title = title; self.note = note; createdAt = .now }
    }

    public static func pendingCaptures() -> [PendingCapture] {
        guard let url = containerURL?.appendingPathComponent(pendingActionsFile), let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder.snapshot.decode([PendingCapture].self, from: data)) ?? []
    }

    public static func setPendingCaptures(_ captures: [PendingCapture]) {
        guard let url = containerURL?.appendingPathComponent(pendingActionsFile), let data = try? JSONEncoder.snapshot.encode(captures) else { return }
        try? data.write(to: url, options: .atomic)
    }
}

extension JSONDecoder {
    static var snapshot: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .secondsSince1970
        return d
    }
}

extension JSONEncoder {
    static var snapshot: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .secondsSince1970
        return e
    }
}
