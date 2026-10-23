import SwiftUI
import PFData
import PFDesign
import PFModel

/// "In Projekt verschieben" for personal tasks: pick a project, the task becomes a project task there
/// (web `movePersonalTaskToProject`) and the screen continues on the new task.
@MainActor
enum PersonalTaskMove {
    static func present(model: AppModel, taskId: String, title: String, willMove: @escaping () -> Void) {
        let projects = (model.workspace?.projects ?? [])
            .filter { $0.status.lifecycle != .closed && !$0.isPersonal && !$0.isContainer && ProjectAccess(model: model, project: $0).canEditTasks }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        model.presenter.present(detents: [.fit]) {
            PlanningChoiceSheet(eyebrow: L10n.t("planning.personal.move"), title: title,
                                options: projects.map { PlanningOption(id: $0.id, title: $0.title, subtitle: nil, symbol: "folder") },
                                selection: nil, emptyText: L10n.t("planning.personal.noProjects")) { projectId in
                guard let projectId, let project = projects.first(where: { $0.id == projectId }), let actions = model.planning else { return }
                willMove()
                Task {
                    var moved: TaskRef?
                    let ok = await model.perform { moved = try await actions.movePersonalTask(taskId, toProject: projectId) }
                    guard ok, let moved else { return }
                    PFHaptics.success()
                    model.router.pop()
                    model.router.push(.task(moved))
                    model.toasts.show(PFToast(L10n.t("planning.personal.moved", ["project": project.title]), style: .success))
                }
            }
        }
    }
}
