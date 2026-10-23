import Foundation
import Observation
import FirebaseFirestore
import PFModel

/// Live data of the active workspace for the signed-in user: projects, people, my tasks,
/// personal tasks and inbox. Today and Work are realtime (the web loads them once).
@Observable
public final class WorkspaceStore {
    public let tenantId: String
    public let uid: String
    public let role: WorkspaceRole

    public private(set) var projects: [Project] = []
    public private(set) var people: [String: Person] = [:]
    public private(set) var myTasks: [WorkTask] = []
    public private(set) var personalTasks: [PersonalTask] = []
    public private(set) var inbox: [InboxItem] = []
    public private(set) var healthSnapshots: [String: HealthSnapshot] = [:]
    public private(set) var loaded: Set<Feed> = []
    public private(set) var lastError: String?
    public private(set) var usesProjectFallback = false

    public enum Feed: Hashable, Sendable { case projects, people, myTasks, personalTasks, inbox }

    private let listeners = ListenerBag()
    private var fallbackTasks: [String: [WorkTask]] = [:]

    public init(tenantId: String, uid: String, role: WorkspaceRole) {
        self.tenantId = tenantId
        self.uid = uid
        self.role = role
    }

    public var isReady: Bool { loaded.isSuperset(of: [.projects, .myTasks]) }
    public var unreadCount: Int { inbox.filter { !$0.read }.count }
    public var projectsById: [String: Project] { Dictionary(projects.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a }) }

    public func project(_ id: String?) -> Project? { id.flatMap { projectsById[$0] } }
    public func person(_ id: String?) -> Person? { id.flatMap { people[$0] } }
    public func task(_ id: String) -> WorkTask? { myTasks.first { $0.id == id } }

    public func start() {
        listenProjects()
        listenPeople()
        listenMyTasks()
        listenPersonalTasks()
        listenInbox()
    }

    public func stop() { listeners.removeAll() }

    // MARK: Projects

    private func listenProjects() {
        var query: Query = PFPath.projects(tenantId)
        if !role.isFullMember { query = query.whereField("memberIds", arrayContains: uid) }
        listeners.set("projects", query.addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                if let error { self.lastError = error.localizedDescription }
                guard let snapshot else { return }
                self.projects = snapshot.documents.compactMap { doc in
                    doc.fields.map { Project(id: doc.documentID, tenantId: self.tenantId, fields: $0) }
                }
                .filter { !$0.isPersonal }
                .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
                self.loaded.insert(.projects)
                if self.usesProjectFallback { self.syncFallbackListeners() }
                self.loadHealthSnapshots()
            }
        })
    }

    /// Latest server health snapshot per project (`healthSnapshots`, written daily by
    /// `dailyHealthSnapshots`). Concept §5.5: iOS reads snapshots instead of porting `healthService.ts`.
    private func loadHealthSnapshots() {
        for project in projects where healthSnapshots[project.id] == nil {
            let projectId = project.id
            PFPath.healthSnapshots(tenantId, projectId).order(by: "date", descending: true).limit(to: 2).getDocuments { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self, let docs = snapshot?.documents, let first = docs.first?.fields else { return }
                    var latest = HealthSnapshot(fields: first)
                    if latest.trend == nil, docs.count > 1, let prev = docs[1].fields.map(HealthSnapshot.init(fields:)),
                       let a = latest.score, let b = prev.score {
                        latest.trend = a > b + 2 ? "improving" : (a < b - 2 ? "declining" : "stable")
                    }
                    self.healthSnapshots[projectId] = latest
                }
            }
        }
    }

    // MARK: People

    private func listenPeople() {
        listeners.set("people", PFPath.members(tenantId).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                var map: [String: Person] = [:]
                for doc in snapshot.documents {
                    guard let fields = doc.fields else { continue }
                    let person = Person(id: fields.string("uid") ?? doc.documentID, fields: fields)
                    map[person.id] = person
                }
                self.people = map
                self.loaded.insert(.people)
            }
        })
    }

    // MARK: My tasks (contract C7)

    /// Contract C7 collection-group query (`tenantId` + `assigneeIds`). On since the production backfill
    /// (2026-10-23) normalised `assigneeIds`. Guests and query errors (e.g. index still building) fall back
    /// to per-project listeners that mirror the web filter.
    public nonisolated(unsafe) static var useAssigneeQuery = true

    private func listenMyTasks() {
        guard role.isFullMember, Self.useAssigneeQuery else {
            usesProjectFallback = true
            syncFallbackListeners()
            return
        }
        let query = PFFirebase.db.collectionGroup("tasks")
            .whereField("tenantId", isEqualTo: tenantId)
            .whereField("assigneeIds", arrayContains: uid)
        listeners.set("myTasks", query.addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                if error != nil {
                    // Index or rules not deployed yet, or legacy data: fall back to per-project listeners.
                    self.listeners.remove("myTasks")
                    self.usesProjectFallback = true
                    self.syncFallbackListeners()
                    return
                }
                guard let snapshot else { return }
                self.myTasks = snapshot.documents.compactMap(self.decodeTask)
                self.loaded.insert(.myTasks)
            }
        })
    }

    private func decodeTask(_ doc: QueryDocumentSnapshot) -> WorkTask? {
        guard let fields = doc.fields else { return nil }
        let projectId = doc.reference.parent.parent?.documentID ?? ""
        return WorkTask(id: doc.documentID, projectId: projectId, tenantId: tenantId, fields: fields)
    }

    /// One listener per open project; keeps tasks assigned to me (incl. legacy `assigneeId` and
    /// owner-only tasks, like web `tasksService.ts`).
    private func syncFallbackListeners() {
        let wanted = Set(projects.filter { $0.status.lifecycle != .closed }.map(\.id))
        for key in listeners.keys where key.hasPrefix("ptasks:") && !wanted.contains(String(key.dropFirst(7))) {
            listeners.remove(key)
            fallbackTasks[String(key.dropFirst(7))] = nil
        }
        for projectId in wanted where !listeners.keys.contains("ptasks:\(projectId)") {
            listeners.set("ptasks:\(projectId)", PFPath.tasks(tenantId, projectId).addSnapshotListener { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self, let snapshot else { return }
                    self.fallbackTasks[projectId] = snapshot.documents.compactMap(self.decodeTask).filter { $0.effectiveAssignees.contains(self.uid) }
                    self.myTasks = self.fallbackTasks.values.flatMap { $0 }
                    self.loaded.insert(.myTasks)
                }
            })
        }
        if wanted.isEmpty, loaded.contains(.projects) { loaded.insert(.myTasks) }
    }

    // MARK: Personal tasks

    private func listenPersonalTasks() {
        listeners.set("personal", PFPath.personalTasks(tenantId, uid).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.personalTasks = snapshot.documents.compactMap { doc in
                    doc.fields.map { PersonalTask(id: doc.documentID, tenantId: self.tenantId, ownerId: self.uid, fields: $0) }
                }
                self.loaded.insert(.personalTasks)
            }
        })
    }

    // MARK: Inbox

    private func listenInbox(ordered: Bool = true) {
        var query: Query = PFPath.notifications(tenantId).whereField("userId", isEqualTo: uid)
        if ordered { query = query.order(by: "createdAt", descending: true).limit(to: 100) }
        listeners.set("inbox", query.addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                if error != nil, ordered {
                    self.listenInbox(ordered: false)
                    return
                }
                guard let snapshot else { return }
                self.inbox = snapshot.documents
                    .compactMap { doc in doc.fields.map { InboxItem(id: doc.documentID, tenantId: self.tenantId, fields: $0) } }
                    .sorted { ($0.createdAt?.instant ?? .distantPast) > ($1.createdAt?.instant ?? .distantPast) }
                self.loaded.insert(.inbox)
            }
        })
    }

    // MARK: Lookups for other people's tasks

    /// Tasks in this workspace that depend on any of `taskIds` ("Wartet auf dich").
    public func tasksDepending(on taskIds: [String]) async -> [WorkTask] {
        guard !taskIds.isEmpty else { return [] }
        var results: [WorkTask] = []
        for chunk in stride(from: 0, to: taskIds.count, by: 10).map({ Array(taskIds[$0..<min($0 + 10, taskIds.count)]) }) {
            let query = PFFirebase.db.collectionGroup("tasks")
                .whereField("tenantId", isEqualTo: tenantId)
                .whereField("dependencies", arrayContainsAny: chunk)
            if let snapshot = try? await query.getDocuments() {
                results += snapshot.documents.compactMap(decodeTask)
            }
        }
        return results
    }

    /// All tasks of one project (one-shot, used by search and pickers).
    public func projectTasks(_ projectId: String) async -> [WorkTask] {
        guard let snapshot = try? await PFPath.tasks(tenantId, projectId).getDocuments() else { return [] }
        return snapshot.documents.compactMap(decodeTask)
    }
}
