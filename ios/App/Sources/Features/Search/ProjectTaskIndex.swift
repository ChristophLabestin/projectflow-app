import Foundation
import Observation
import PFData
import PFModel

/// One-shot cache of all tasks per project (concept §5.8): my own tasks are live from the workspace
/// store, everybody else's are loaded per project the first time a search (or an inbox row) needs them,
/// then kept for ten minutes. Shared by Search and Inbox; scoped to one workspace + user.
@Observable
final class ProjectTaskIndex {
    static let shared = ProjectTaskIndex()

    private(set) var tasksByProject: [String: [WorkTask]] = [:]
    private(set) var loadingCount = 0
    private var loadedAt: [String: Date] = [:]
    private var inFlight: Set<String> = []
    private var scope: String?
    private let timeToLive: TimeInterval = 600

    var isLoading: Bool { loadingCount > 0 }

    /// Drops everything when the workspace or user changed.
    func prepare(for workspace: WorkspaceStore) {
        let key = "\(workspace.tenantId)/\(workspace.uid)"
        guard key != scope else { return }
        scope = key
        tasksByProject = [:]
        loadedAt = [:]
        inFlight = []
        loadingCount = 0
    }

    func task(projectId: String?, id: String?) -> WorkTask? {
        guard let projectId, let id else { return nil }
        return tasksByProject[projectId]?.first { $0.id == id }
    }

    /// Everything cached, excluding tasks that are also in `live` (those come from the realtime listener).
    func cachedTasks(excluding live: Set<String>) -> [WorkTask] {
        tasksByProject.values.flatMap { $0 }.filter { !live.contains($0.id) }
    }

    /// Loads the given projects (up to three in parallel); already fresh ones are skipped.
    func ensureLoaded(projectIds: [String], workspace: WorkspaceStore) async {
        prepare(for: workspace)
        let pending = projectIds.filter { id in
            guard !inFlight.contains(id) else { return false }
            guard let at = loadedAt[id] else { return true }
            return Date.now.timeIntervalSince(at) > timeToLive
        }
        guard !pending.isEmpty else { return }
        inFlight.formUnion(pending)
        loadingCount += pending.count
        for chunk in stride(from: 0, to: pending.count, by: 3).map({ Array(pending[$0..<min($0 + 3, pending.count)]) }) {
            let loads = chunk.map { id in Task { (id, await workspace.projectTasks(id)) } }
            for load in loads {
                let (id, tasks) = await load.value
                tasksByProject[id] = tasks
                loadedAt[id] = .now
                inFlight.remove(id)
                loadingCount -= 1
            }
        }
    }
}
