import Foundation
import Observation
import PFData
import PFDesign
import PFDomain
import PFModel

/// Portfolio data of the Projects tab: the tasks of every open project (loaded once, refreshed when the
/// tab is shown again) so the signals match the web portfolio list, plus the attention ranking.
@Observable
final class ProjectsPortfolio {
    private(set) var tasksByProject: [String: [WorkTask]] = [:]
    private(set) var loadedProjectIds: Set<String> = []
    private var isLoading = false

    struct Row: Identifiable {
        let project: Project
        let children: [Project]
        let group: PortfolioGroup
        let signals: PortfolioSignals?
        let dueToday: Int
        let done: Int
        let total: Int

        var id: String { project.id }
        var hasTasks: Bool { signals != nil }

        /// Share of finished tasks; falls back to the stored project progress while tasks load.
        var progress: Double {
            total > 0 ? Double(done) / Double(total) : min(max(project.progress / 100, 0), 1)
        }
    }

    func refresh(model: AppModel) async {
        guard let workspace = model.workspace, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        let ids = workspace.projects.filter { $0.status.lifecycle != .closed }.map(\.id)
        // One query per open project, in parallel.
        let loads = ids.map { id in
            Task {
                guard let workspace = model.workspace else { return }
                let tasks = await workspace.projectTasks(id)
                tasksByProject[id] = tasks
                loadedProjectIds.insert(id)
            }
        }
        for load in loads { await load.value }
    }

    // MARK: Derived

    private var now: AttentionDate { AttentionDate(Date()) }
    private var timeZoneId: String { Formatting.timeZone.identifier }

    private func attentionTasks(_ tasks: [WorkTask]) -> [AttentionTask] {
        tasks.map {
            AttentionTask(id: $0.id, title: $0.title, projectId: $0.projectId, isCompleted: $0.isCompleted, status: $0.status.rawValue,
                          dueDate: AttentionDate($0.dueDate), createdAt: AttentionDate($0.createdAt), completedAt: AttentionDate($0.completedAt))
        }
    }

    private func attentionProject(_ project: Project, health: HealthSnapshot?) -> AttentionProject {
        AttentionProject(id: project.id, title: project.title, status: project.status.rawValue, dueDate: AttentionDate(project.dueDate),
                         health: AttentionHealth(status: health?.status, trend: health?.trend))
    }

    /// "Wo hinschauen": ranking over the active projects (Active / In Testing), exactly as the web dashboard.
    func attention(projects: [Project], health: [String: HealthSnapshot]) -> AttentionResult {
        let active = projects.filter { $0.status == .active || $0.status == .inTesting }
        let ids = Set(active.map(\.id))
        let tasks = tasksByProject.filter { ids.contains($0.key) }.values.flatMap { attentionTasks($0) }
        return Attention.build(AttentionInput(now: now, timeZone: timeZoneId, projects: active.map { attentionProject($0, health: health[$0.id]) }, tasks: tasks))
    }

    /// Portfolio rows in display order: containers carry their children, everything is grouped like the web list.
    func rows(projects: [Project], health: [String: HealthSnapshot]) -> [PortfolioGroup: [Row]] {
        let visibleIds = Set(projects.map(\.id))
        let containers = Set(projects.filter(\.isContainer).map(\.id))
        let childrenByParent = Dictionary(grouping: projects.filter { $0.companyProjectId.map { containers.contains($0) && visibleIds.contains($0) } ?? false },
                                          by: { $0.companyProjectId ?? "" })
        let nested = Set(childrenByParent.values.flatMap { $0.map(\.id) })

        var result: [PortfolioGroup: [Row]] = [:]
        for project in projects where !nested.contains(project.id) {
            let tasks = tasksByProject[project.id]
            let loaded = loadedProjectIds.contains(project.id) && tasks != nil
            let signals = loaded ? Attention.signals(for: project.id, tasks: attentionTasks(tasks ?? []), now: now, timeZone: timeZoneId) : nil
            let group = Attention.portfolioGroup(status: project.status.rawValue, dueDate: AttentionDate(project.dueDate), signals: signals,
                                                 healthStatus: health[project.id]?.status, clock: AttentionClock(now: now, timeZone: timeZoneId))
            let open = (tasks ?? []).filter { !$0.isCompleted }
            let dueToday = open.filter { $0.dueDate.map { Formatting.dayOffset($0) == 0 } ?? false }.count
            let row = Row(project: project, children: (childrenByParent[project.id] ?? []).sorted { $0.title < $1.title }, group: group,
                          signals: signals, dueToday: dueToday, done: (tasks ?? []).count - open.count, total: tasks?.count ?? 0)
            result[group, default: []].append(row)
        }
        return result
    }

    /// Progress and signals of a child project (rendered indented under its container).
    func childRow(_ project: Project) -> Row {
        let tasks = tasksByProject[project.id] ?? []
        let open = tasks.filter { !$0.isCompleted }
        let loaded = loadedProjectIds.contains(project.id)
        let signals = loaded ? Attention.signals(for: project.id, tasks: attentionTasks(tasks), now: now, timeZone: timeZoneId) : nil
        return Row(project: project, children: [], group: .active, signals: signals,
                   dueToday: open.filter { $0.dueDate.map { Formatting.dayOffset($0) == 0 } ?? false }.count,
                   done: tasks.count - open.count, total: tasks.count)
    }
}
