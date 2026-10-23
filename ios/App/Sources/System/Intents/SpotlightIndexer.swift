import AppIntents
import CoreSpotlight
import Foundation
import PFData
import PFModel

/// Indexes open tasks and projects (title + project name only) so they are found in Spotlight and Siri.
/// The index follows the active workspace and is wiped on sign-out and workspace switch.
@MainActor
enum SpotlightIndexer {
    private static var lastSignature = 0
    private static let taskLimit = 400

    static func reindex(model: AppModel) {
        guard model.uid != nil, let workspace = model.workspace, workspace.isReady else { return }
        let tasks = workspace.myTasks.filter { !$0.isCompleted }.prefix(taskLimit)
            .map { TaskEntity(task: $0, projectName: workspace.project($0.projectId)?.title) }
        let personal = workspace.personalTasks.filter { !$0.isCompleted }.prefix(100).map(TaskEntity.init(personal:))
        let projects = workspace.projects.filter { !$0.isPersonal && $0.status.lifecycle != .closed }.map(ProjectEntity.init(project:))

        var hasher = Hasher()
        for entity in tasks + personal { hasher.combine(entity.id); hasher.combine(entity.title); hasher.combine(entity.projectName) }
        for entity in projects { hasher.combine(entity.id); hasher.combine(entity.title) }
        let signature = hasher.finalize()
        guard signature != lastSignature else { return }
        lastSignature = signature

        let allTasks = Array(tasks) + Array(personal)
        Task {
            let index = CSSearchableIndex.default()
            try? await index.deleteAppEntities(ofType: TaskEntity.self)
            try? await index.deleteAppEntities(ofType: ProjectEntity.self)
            try? await index.indexAppEntities(allTasks)
            try? await index.indexAppEntities(projects)
        }
    }

    static func clear() {
        lastSignature = 0
        Task { try? await CSSearchableIndex.default().deleteAllSearchableItems() }
    }
}
