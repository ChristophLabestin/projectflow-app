import AppIntents
import CoreSpotlight
import Foundation
import PFData
import PFModel
import PFSnapshot

// App Entities for Siri, Shortcuts and Spotlight. Only title + project name leave the app model
// (Spotlight index is title and project only; no descriptions, no people).

/// A task the user can name in Siri/Shortcuts: project task or personal task.
struct TaskEntity: AppEntity, IndexedEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Aufgabe")
    static let defaultQuery = TaskEntityQuery()

    /// `t|<tenant>|<project>|<task>` or `p|<tenant>|<personalTaskId>`.
    let id: String
    @Property(title: "Titel") var title: String
    @Property(title: "Projekt") var projectName: String?

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: projectName.map { "\($0)" } ?? "Persönlich")
    }

    var attributeSet: CSSearchableItemAttributeSet {
        let set = CSSearchableItemAttributeSet(contentType: .content)
        set.title = title
        set.displayName = title
        set.contentDescription = projectName
        return set
    }

    init(id: String, title: String, projectName: String?) {
        self.id = id
        self.title = title
        self.projectName = projectName
    }

    init(task: WorkTask, projectName: String?) {
        self.init(id: "t|\(task.tenantId)|\(task.projectId)|\(task.id)", title: task.title, projectName: projectName)
    }

    init(personal: PersonalTask) {
        self.init(id: "p|\(personal.tenantId)|\(personal.id)", title: personal.title, projectName: nil)
    }

    init(stop: TodaySnapshot.Stop, projectName: String? = nil) {
        if stop.isPersonal || stop.projectId == nil {
            self.init(id: "p|\(stop.tenantId)|\(stop.id)", title: stop.title, projectName: nil)
        } else {
            self.init(id: "t|\(stop.tenantId)|\(stop.projectId ?? "")|\(stop.id)", title: stop.title, projectName: projectName)
        }
    }

    /// Decoded identifier.
    struct Reference {
        let tenantId: String
        let projectId: String?
        let taskId: String
        var isPersonal: Bool { projectId == nil }
    }

    var reference: Reference? {
        let parts = id.split(separator: "|", omittingEmptySubsequences: false).map(String.init)
        if parts.count == 4, parts[0] == "t" { return Reference(tenantId: parts[1], projectId: parts[2], taskId: parts[3]) }
        if parts.count == 3, parts[0] == "p" { return Reference(tenantId: parts[1], projectId: nil, taskId: parts[2]) }
        return nil
    }

    var link: URL? {
        guard let reference else { return nil }
        return PFLink.stop(id: reference.taskId, tenantId: reference.tenantId, projectId: reference.projectId, isPersonal: reference.isPersonal)
    }
}

struct TaskEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [TaskEntity] {
        let all = await IntentData.tasks(includeCompleted: true)
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func entities(matching string: String) async throws -> [TaskEntity] {
        let needle = string.trimmingCharacters(in: .whitespacesAndNewlines)
        let all = await IntentData.tasks()
        guard !needle.isEmpty else { return Array(all.prefix(25)) }
        return all.filter { $0.title.localizedCaseInsensitiveContains(needle) || ($0.projectName?.localizedCaseInsensitiveContains(needle) ?? false) }
    }

    func suggestedEntities() async throws -> [TaskEntity] {
        Array(await IntentData.tasks().prefix(20))
    }
}

/// A project (not personal tasks) for "Projekt öffnen" and as capture target.
struct ProjectEntity: AppEntity, IndexedEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Projekt")
    static let defaultQuery = ProjectEntityQuery()

    /// `<tenant>|<project>`
    let id: String
    @Property(title: "Name") var title: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }

    var attributeSet: CSSearchableItemAttributeSet {
        let set = CSSearchableItemAttributeSet(contentType: .content)
        set.title = title
        set.displayName = title
        return set
    }

    init(id: String, title: String) {
        self.id = id
        self.title = title
    }

    init(project: Project) {
        self.init(id: "\(project.tenantId)|\(project.id)", title: project.title)
    }

    var tenantId: String { String(id.split(separator: "|").first ?? "") }
    var projectId: String { String(id.split(separator: "|").last ?? "") }
    var link: URL { PFLink.project(tenantId: tenantId, projectId: projectId) }
}

struct ProjectEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [ProjectEntity] {
        let all = await IntentData.projects(includeClosed: true)
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func entities(matching string: String) async throws -> [ProjectEntity] {
        let needle = string.trimmingCharacters(in: .whitespacesAndNewlines)
        let all = await IntentData.projects()
        guard !needle.isEmpty else { return all }
        return all.filter { $0.title.localizedCaseInsensitiveContains(needle) }
    }

    func suggestedEntities() async throws -> [ProjectEntity] {
        Array(await IntentData.projects().prefix(20))
    }
}

/// Reads entities from the app model; falls back to the widget snapshot when the model is not loaded
/// (e.g. Siri resolving a parameter before the session is restored).
@MainActor
enum IntentData {
    static func tasks(includeCompleted: Bool = false) async -> [TaskEntity] {
        let stopFirst = SnapshotStore.load()?.stops ?? []
        if let model = await AppIntentBridge.shared.readyModel(.workspace, timeout: 6), let workspace = model.workspace {
            let curated = Dictionary(stopFirst.enumerated().map { ($1.id, $0) }, uniquingKeysWith: { first, _ in first })
            let projectTasks = workspace.myTasks.filter { includeCompleted || !$0.isCompleted }
            let personal = workspace.personalTasks.filter { includeCompleted || !$0.isCompleted }
            let items: [(rank: Int, due: Date, entity: TaskEntity)] =
                projectTasks.map { (curated[$0.id] ?? Int.max, $0.dueDate?.instant ?? .distantFuture, TaskEntity(task: $0, projectName: workspace.project($0.projectId)?.title)) }
                + personal.map { (curated[$0.id] ?? Int.max, $0.dueDate?.instant ?? .distantFuture, TaskEntity(personal: $0)) }
            return items.sorted { ($0.rank, $0.due) < ($1.rank, $1.due) }.map(\.entity)
        }
        guard let snapshot = SnapshotStore.load(), snapshot.signedIn else { return [] }
        let names = Dictionary(snapshot.projects.map { ($0.id, $0.title) }, uniquingKeysWith: { first, _ in first })
        return snapshot.stops.map { TaskEntity(stop: $0, projectName: $0.projectId.flatMap { names[$0] }) }
    }

    static func projects(includeClosed: Bool = false) async -> [ProjectEntity] {
        if let model = await AppIntentBridge.shared.readyModel(.workspace, timeout: 6), let workspace = model.workspace {
            return workspace.projects
                .filter { !$0.isPersonal && (includeClosed || $0.status.lifecycle != .closed) }
                .sorted { ($0.updatedAt?.instant ?? .distantPast) > ($1.updatedAt?.instant ?? .distantPast) }
                .map(ProjectEntity.init(project:))
        }
        guard let snapshot = SnapshotStore.load(), snapshot.signedIn else { return [] }
        return snapshot.projects.map { ProjectEntity(id: "\($0.tenantId)|\($0.id)", title: $0.title) }
    }
}
