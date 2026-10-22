import Foundation
import Observation
import FirebaseFirestore
import PFModel

/// Live data for one project screen (tasks, initiatives, milestones, sprints, activity).
@Observable
public final class ProjectStore {
    public let tenantId: String
    public let projectId: String
    public private(set) var project: Project?
    public private(set) var tasks: [WorkTask] = []
    public private(set) var initiatives: [Initiative] = []
    public private(set) var milestones: [Milestone] = []
    public private(set) var sprints: [Sprint] = []
    public private(set) var activity: [ActivityEntry] = []
    public private(set) var isLoaded = false
    public private(set) var isMissing = false
    private let listeners = ListenerBag()

    public init(tenantId: String, projectId: String) {
        self.tenantId = tenantId
        self.projectId = projectId
    }

    public func start() {
        guard listeners.keys.isEmpty else { return }
        let t = tenantId, p = projectId
        listeners.set("project", PFPath.project(t, p).addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                if let snapshot, snapshot.exists, let fields = snapshot.fields {
                    self.project = Project(id: p, tenantId: t, fields: fields)
                    self.isMissing = false
                } else if error != nil || snapshot?.exists == false {
                    self.isMissing = true
                }
            }
        })
        listeners.set("tasks", PFPath.tasks(t, p).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.tasks = snapshot.documents.compactMap { doc in doc.fields.map { WorkTask(id: doc.documentID, projectId: p, tenantId: t, fields: $0) } }
                self.isLoaded = true
            }
        })
        listeners.set("initiatives", PFPath.initiatives(t, p).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.initiatives = snapshot.documents.compactMap { doc in doc.fields.map { Initiative(id: doc.documentID, projectId: p, tenantId: t, fields: $0) } }
            }
        })
        listeners.set("milestones", PFPath.milestones(t, p).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.milestones = snapshot.documents.compactMap { doc in doc.fields.map { Milestone(id: doc.documentID, fields: $0) } }
                    .sorted { ($0.dueDate?.instant ?? .distantFuture) < ($1.dueDate?.instant ?? .distantFuture) }
            }
        })
        listeners.set("sprints", PFPath.sprints(t, p).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.sprints = snapshot.documents.compactMap { doc in doc.fields.map { Sprint(id: doc.documentID, fields: $0) } }
            }
        })
        listeners.set("activity", PFPath.activities(t, p).order(by: "createdAt", descending: true).limit(to: 60).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.activity = snapshot.documents.compactMap { doc in doc.fields.map { ActivityEntry(id: doc.documentID, fields: $0) } }
            }
        })
    }

    public func stop() { listeners.removeAll() }
}

/// Live data for the task workbench: the task, its subtasks, comments and recent activity.
@Observable
public final class TaskDetailStore {
    public let ref: TaskRef
    public private(set) var task: WorkTask?
    public private(set) var subtasks: [SubTask] = []
    public private(set) var comments: [Comment] = []
    public private(set) var activity: [ActivityEntry] = []
    public private(set) var related: [String: WorkTask] = [:]
    public private(set) var isMissing = false
    private let listeners = ListenerBag()

    public init(ref: TaskRef) { self.ref = ref }

    public func start() {
        guard listeners.keys.isEmpty else { return }
        let ref = self.ref
        listeners.set("task", PFPath.task(ref).addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                if let snapshot, snapshot.exists, let fields = snapshot.fields {
                    let task = WorkTask(id: ref.taskId, projectId: ref.projectId, tenantId: ref.tenantId, fields: fields)
                    self.task = task
                    self.isMissing = false
                    self.loadRelated(task)
                } else if error != nil || snapshot?.exists == false {
                    self.isMissing = true
                }
            }
        })
        listeners.set("subtasks", PFPath.subtasks(ref).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.subtasks = snapshot.documents.compactMap { doc in doc.fields.map { SubTask(id: doc.documentID, fields: $0) } }
                    .sorted { ($0.createdAt?.instant ?? .distantPast) < ($1.createdAt?.instant ?? .distantPast) }
            }
        })
        let comments = PFPath.comments(ref.tenantId, ref.projectId).whereField("targetId", isEqualTo: ref.taskId)
        listeners.set("comments", comments.addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.comments = snapshot.documents.compactMap { doc in doc.fields.map { Comment(id: doc.documentID, fields: $0) } }
                    .sorted { ($0.createdAt?.instant ?? .distantFuture) < ($1.createdAt?.instant ?? .distantFuture) }
            }
        })
        let activity = PFPath.activities(ref.tenantId, ref.projectId).whereField("relatedId", isEqualTo: ref.taskId)
        listeners.set("activity", activity.addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.activity = snapshot.documents.compactMap { doc in doc.fields.map { ActivityEntry(id: doc.documentID, fields: $0) } }
                    .sorted { ($0.createdAt?.instant ?? .distantPast) > ($1.createdAt?.instant ?? .distantPast) }
            }
        })
    }

    public func stop() { listeners.removeAll() }

    /// Dependencies, parent and children (one-shot lookups within the same project).
    private func loadRelated(_ task: WorkTask) {
        let ids = Set(task.dependencies + [task.parentTaskId].compactMap { $0 }).subtracting(related.keys)
        let ref = self.ref
        for id in ids {
            PFPath.tasks(ref.tenantId, ref.projectId).document(id).getDocument { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self, let snapshot, let fields = snapshot.fields else { return }
                    self.related[id] = WorkTask(id: id, projectId: ref.projectId, tenantId: ref.tenantId, fields: fields)
                }
            }
        }
        if !listeners.keys.contains("children") {
            let children = PFPath.tasks(ref.tenantId, ref.projectId).whereField("parentTaskId", isEqualTo: ref.taskId)
            listeners.set("children", children.addSnapshotListener { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self, let snapshot else { return }
                    for doc in snapshot.documents {
                        if let fields = doc.fields {
                            self.related[doc.documentID] = WorkTask(id: doc.documentID, projectId: ref.projectId, tenantId: ref.tenantId, fields: fields)
                        }
                    }
                }
            })
            let blocking = PFPath.tasks(ref.tenantId, ref.projectId).whereField("dependencies", arrayContains: ref.taskId)
            listeners.set("blocking", blocking.addSnapshotListener { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self, let snapshot else { return }
                    for doc in snapshot.documents {
                        if let fields = doc.fields {
                            self.related[doc.documentID] = WorkTask(id: doc.documentID, projectId: ref.projectId, tenantId: ref.tenantId, fields: fields)
                        }
                    }
                }
            })
        }
    }

    public var children: [WorkTask] { related.values.filter { $0.parentTaskId == ref.taskId } }
    public var blocking: [WorkTask] { related.values.filter { $0.dependencies.contains(ref.taskId) } }
    public var blockedBy: [WorkTask] { (task?.dependencies ?? []).compactMap { related[$0] } }
    public var parent: WorkTask? { task?.parentTaskId.flatMap { related[$0] } }
}

/// Calls into Cloud Functions used by the app.
@MainActor
public enum PFCallables {
    public static func call(_ name: String, _ data: [String: Any] = [:]) async throws -> Any? {
        try await PFFirebase.functions.httpsCallable(name).call(data).data
    }
}
