import Foundation
import FirebaseFirestore

// Activity events and insights (contract `brain/plans/activity-events-contract.md`, concept
// `brain/plans/activity-insights-concept.md`). Server-written; clients only read.

public struct ActivityEvent: Identifiable, Hashable, Sendable {
    public struct Actor: Hashable, Sendable {
        public let kind: String
        public let id: String?
        public let name: String
        public let photoURL: String?
        public let client: String?
    }
    public let id: String
    public let type: String
    public let domain: String
    public let actor: Actor
    public let objectType: String
    public let objectId: String
    public let objectTitle: String
    public let parentType: String?
    public let parentId: String?
    public let projectId: String?
    public let projectTitle: String?
    public let changes: [String: (from: String?, to: String?)]
    public let meta: [String: String]
    public let createdAt: Date

    public static func == (lhs: ActivityEvent, rhs: ActivityEvent) -> Bool { lhs.id == rhs.id }
    public func hash(into hasher: inout Hasher) { hasher.combine(id) }

    init?(id: String, data: [String: Any]) {
        guard let type = data["type"] as? String else { return nil }
        self.id = id
        self.type = type
        domain = data["domain"] as? String ?? String(type.split(separator: ".").first ?? "")
        let actor = data["actor"] as? [String: Any] ?? [:]
        self.actor = Actor(kind: actor["kind"] as? String ?? "user", id: actor["id"] as? String,
                           name: actor["name"] as? String ?? "", photoURL: actor["photoURL"] as? String,
                           client: actor["client"] as? String)
        let object = data["object"] as? [String: Any] ?? [:]
        objectType = object["type"] as? String ?? ""
        objectId = object["id"] as? String ?? ""
        objectTitle = object["title"] as? String ?? ""
        parentType = object["parentType"] as? String
        parentId = object["parentId"] as? String
        projectId = data["projectId"] as? String
        projectTitle = data["projectTitle"] as? String
        var changes: [String: (from: String?, to: String?)] = [:]
        for (field, value) in data["changes"] as? [String: Any] ?? [:] {
            let change = value as? [String: Any] ?? [:]
            changes[field] = (Self.text(change["from"]), Self.text(change["to"]))
        }
        self.changes = changes
        var meta: [String: String] = [:]
        for (key, value) in data["meta"] as? [String: Any] ?? [:] {
            if let list = value as? [Any] { meta[key] = list.compactMap(Self.text).joined(separator: ", ") }
            else if let text = Self.text(value) { meta[key] = text }
        }
        self.meta = meta
        createdAt = (data["createdAt"] as? Timestamp)?.dateValue() ?? .distantPast
    }

    static func text(_ value: Any?) -> String? {
        switch value {
        case let string as String: string
        case let number as NSNumber: number.stringValue
        case let timestamp as Timestamp: ISO8601DateFormatter().string(from: timestamp.dateValue())
        default: nil
        }
    }
}

/// Live first page + cursor pages of `tenants/{t}/activity` (30 per page), optionally for one project.
@Observable
public final class ActivityFeedStore {
    public let tenantId: String
    public let projectId: String?
    public private(set) var events: [ActivityEvent] = []
    public private(set) var isLoading = true
    public private(set) var hasMore = false
    public private(set) var failed = false
    private var registration: ListenerRegistration?
    private var olderEvents: [ActivityEvent] = []
    private var cursor: DocumentSnapshot?
    private static let pageSize = 30

    public init(tenantId: String, projectId: String? = nil) {
        self.tenantId = tenantId
        self.projectId = projectId
    }

    private var baseQuery: Query {
        var query: Query = PFFirebase.db.collection("tenants").document(tenantId).collection("activity")
        if let projectId { query = query.whereField("projectId", isEqualTo: projectId) }
        return query.order(by: "createdAt", descending: true)
    }

    public func start() {
        guard registration == nil else { return }
        registration = baseQuery.limit(to: Self.pageSize).addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.isLoading = false
                guard let snapshot else { self.failed = error != nil; return }
                let first = snapshot.documents.compactMap { ActivityEvent(id: $0.documentID, data: $0.data()) }
                if self.olderEvents.isEmpty { self.cursor = snapshot.documents.last }
                self.hasMore = self.olderEvents.isEmpty ? snapshot.documents.count == Self.pageSize : self.hasMore
                self.events = first + self.olderEvents.filter { old in !first.contains(where: { $0.id == old.id }) }
            }
        }
    }

    public func stop() { registration?.remove(); registration = nil }

    public func loadMore() async {
        guard hasMore, let cursor else { return }
        guard let snapshot = try? await baseQuery.start(afterDocument: cursor).limit(to: Self.pageSize).getDocuments() else { return }
        let page = snapshot.documents.compactMap { ActivityEvent(id: $0.documentID, data: $0.data()) }
        olderEvents += page
        self.cursor = snapshot.documents.last ?? cursor
        hasMore = snapshot.documents.count == Self.pageSize
        events += page.filter { new in !events.contains(where: { $0.id == new.id }) }
    }
}

/// `insights_daily/latest` (precomputed nightly) — one read per screen.
public struct InsightsSnapshot: Sendable {
    public struct Project: Identifiable, Sendable {
        public let id: String
        public let title: String
        public let health: String
        public let open: Int
        public let overdue: Int
        public let blocked: Int
        public let dueNext7: Int
        public let onTime: Int
        public let late: Int
        public let activity7d: Int
        public let created: [Int]
        public let completed: [Int]
        public let cycleDaysSum: [Double]
        public let cycleCount: [Int]
        /// uid → (open, overdue, dueNext7)
        public let people: [String: (Int, Int, Int)]
    }
    public let day: String
    public let weeks: [String]
    public let projects: [Project]
    public let computedAt: Date?

    init?(data: [String: Any]) {
        guard let day = data["day"] as? String else { return nil }
        self.day = day
        weeks = data["weeks"] as? [String] ?? []
        computedAt = (data["computedAt"] as? Timestamp)?.dateValue()
        func ints(_ value: Any?) -> [Int] { (value as? [NSNumber])?.map(\.intValue) ?? [] }
        projects = (data["projects"] as? [[String: Any]] ?? []).compactMap { p in
            guard let id = p["id"] as? String else { return nil }
            var people: [String: (Int, Int, Int)] = [:]
            for (uid, value) in p["people"] as? [String: Any] ?? [:] {
                let list = ints(value)
                if list.count == 3 { people[uid] = (list[0], list[1], list[2]) }
            }
            return Project(id: id, title: p["title"] as? String ?? "", health: p["health"] as? String ?? "good",
                           open: (p["open"] as? NSNumber)?.intValue ?? 0, overdue: (p["overdue"] as? NSNumber)?.intValue ?? 0,
                           blocked: (p["blocked"] as? NSNumber)?.intValue ?? 0, dueNext7: (p["dueNext7"] as? NSNumber)?.intValue ?? 0,
                           onTime: (p["onTime"] as? NSNumber)?.intValue ?? 0, late: (p["late"] as? NSNumber)?.intValue ?? 0,
                           activity7d: (p["activity7d"] as? NSNumber)?.intValue ?? 0,
                           created: ints(p["created"]), completed: ints(p["completed"]),
                           cycleDaysSum: (p["cycleDaysSum"] as? [NSNumber])?.map(\.doubleValue) ?? [], cycleCount: ints(p["cycleCount"]),
                           people: people)
        }
    }
}

public enum InsightsData {
    public static func latest(tenantId: String) async -> InsightsSnapshot? {
        let doc = try? await PFFirebase.db.collection("tenants").document(tenantId).collection("insights_daily").document("latest").getDocument()
        return doc?.data().flatMap(InsightsSnapshot.init(data:))
    }

    /// Recomputes now (server rate-limits to once per 10 min) and returns the fresh snapshot.
    public static func refresh(tenantId: String) async throws -> InsightsSnapshot? {
        _ = try await PFCallables.call("refreshWorkspaceInsights", ["tenantId": tenantId])
        return await latest(tenantId: tenantId)
    }

    /// Latest stored AI weekly report in this language (`insights_reports/{isoWeek}-{lang}`), newest first.
    public static func latestReport(tenantId: String, language: String) async -> (week: String, markdown: String)? {
        let snap = try? await PFFirebase.db.collection("tenants").document(tenantId).collection("insights_reports")
            .whereField("language", isEqualTo: language).order(by: "createdAt", descending: true).limit(to: 1).getDocuments()
        guard let data = snap?.documents.first?.data(), let markdown = data["markdown"] as? String else { return nil }
        return (data["week"] as? String ?? "", markdown)
    }

    public static func generateReport(tenantId: String, language: String) async throws -> (week: String, markdown: String) {
        let data = try await PFCallables.call("generateWeeklyInsightsReport", ["tenantId": tenantId, "language": language]) as? [String: Any]
        return (data?["week"] as? String ?? "", data?["markdown"] as? String ?? "")
    }
}
