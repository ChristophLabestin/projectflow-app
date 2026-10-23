import SwiftUI
import PFData
import PFDesign
import PFModel

/// Management actions of the initiative screen: edit, status, task assignment and delete. The screen
/// adds `items()` to its `•••` menu when the user may manage initiatives.
@MainActor
struct InitiativeManagement {
    let model: AppModel
    let store: ProjectStore
    let initiative: Initiative

    private var presenter: PFPresenter { model.presenter }

    func items() -> [ActionSheet.Item] {
        [
            .init(title: L10n.t("planning.initiative.edit"), systemImage: "pencil") { presentEditor() },
            .init(title: L10n.t("planning.initiative.setStatus"), systemImage: "circle.dotted") { presentStatus() },
            .init(title: L10n.t("planning.initiative.attach"), systemImage: "checklist") { presentAttach() },
            .init(title: L10n.t("common.delete"), systemImage: "trash", destructive: true) { presentDelete() },
        ]
    }

    func presentDelete() {
        let initiative = initiative
        let projectId = store.projectId
        let router = model.router
        presenter.present(detents: [.fit]) {
            ProjectConfirmSheet(title: L10n.t("planning.initiative.delete.title"),
                                message: L10n.t("planning.initiative.delete.message", ["title": initiative.title]),
                                confirmTitle: L10n.t("common.delete")) {
                guard let actions = model.planning else { return }
                Task {
                    if await model.perform({ try await actions.deleteInitiative(projectId: projectId, id: initiative.id, title: initiative.title) }) {
                        PFHaptics.success()
                        router.pop()
                        model.toasts.show(PFToast(L10n.t("planning.initiative.deleted"), style: .success))
                    }
                }
            }
        }
    }

    func presentEditor() {
        let people = model.people(of: store.project)
        let projectId = store.projectId
        let initiative = initiative
        let router = model.router
        presenter.present(detents: [.large]) {
            InitiativeEditorSheet(projectId: projectId, initiative: initiative, people: people, onDeleted: { router.pop() })
        }
    }

    func presentStatus() {
        let statuses = ["Planning", "Open", "In Progress", "Review", "On Hold", "Blocked", "Done"]
        let initiative = initiative
        let projectId = store.projectId
        presenter.present(detents: [.fit]) {
            PlanningChoiceSheet(eyebrow: L10n.t("planning.initiative.setStatus"), title: initiative.title,
                                options: statuses.map { PlanningOption(id: $0, title: L10n.t("status.\($0)"), tint: PFColor.statusBase($0 == "Planning" ? .planning : TaskStatus(raw: $0).tone)) },
                                selection: initiative.statusRaw) { status in
                guard let status, status != initiative.statusRaw, let actions = model.planning else { return }
                var draft = InitiativeDraft(initiative)
                draft.status = status
                Task {
                    if await model.perform({ try await actions.updateInitiative(projectId: projectId, id: initiative.id, draft) }) { PFHaptics.success() }
                }
            }
        }
    }

    /// Attach and detach tasks in one go: the selection is the new set of tasks of this initiative.
    func presentAttach() {
        let initiative = initiative
        let current = Set(store.tasks.filter { $0.initiativeId == initiative.id }.map(\.id))
        let initiativeNames = Dictionary(store.initiatives.map { ($0.id, $0.title) }, uniquingKeysWith: { first, _ in first })
        let options = store.tasks
            .filter { !$0.isCompleted || current.contains($0.id) }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            .map { task -> PlanningOption in
                let other = task.initiativeId.flatMap { $0 == initiative.id ? nil : initiativeNames[$0] }
                return PlanningOption(id: task.id, title: task.title,
                                      subtitle: other.map { L10n.t("planning.initiative.otherInitiative", ["name": $0]) } ?? task.status.label)
            }
        let tenantId = store.tenantId
        let projectId = store.projectId
        presenter.present(detents: [.large]) {
            PlanningMultiSheet(eyebrow: L10n.t("planning.initiative.attach.title"), title: initiative.title, options: options, initial: current,
                               emptyText: L10n.t("planning.tasks.empty"), searchable: true) { selected in
                let after = Set(selected)
                guard let actions = model.planning, after != current else { return }
                Task {
                    let ok = await model.perform {
                        for id in after.subtracting(current) {
                            try await actions.setInitiative(TaskRef(tenantId: tenantId, projectId: projectId, taskId: id), initiative.id)
                        }
                        for id in current.subtracting(after) {
                            try await actions.setInitiative(TaskRef(tenantId: tenantId, projectId: projectId, taskId: id), nil)
                        }
                    }
                    if ok {
                        PFHaptics.success()
                        model.toasts.show(PFToast(L10n.t("planning.initiative.attach.done"), style: .success))
                    }
                }
            }
        }
    }
}

/// Feedback form of an initiative: shares the public link when the form is enabled, otherwise points to
/// the web where it is set up.
struct InitiativeFeedbackCard: View {
    let initiative: Initiative
    let projectId: String
    @Environment(AppModel.self) private var model

    private var link: URL? {
        guard initiative.feedbackEnabled, let token = initiative.feedbackToken else { return nil }
        return URL(string: "\(ProjectLinks.base)/feedback/initiative/\(token)")
    }

    var body: some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            Image(systemName: link == nil ? "text.bubble" : "text.bubble.fill")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(link == nil ? PFColor.textMuted : PFColor.successText)
                .frame(width: 38, height: 38)
                .background(PFColor.raised, in: .circle)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(L10n.t("planning.feedback.title")).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                Text(link == nil ? L10n.t("planning.feedback.off") : L10n.t("planning.feedback.on"))
                    .pfText(.metaStrong).foregroundStyle(link == nil ? PFColor.textMuted : PFColor.successText)
                Text(L10n.t("planning.feedback.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                actions.padding(.top, 6)
            }
            Spacer(minLength: 0)
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .padding(.horizontal, PFSpace.page)
    }

    @ViewBuilder private var actions: some View {
        if let link {
            HStack(spacing: PFSpace.xs) {
                ShareLink(item: link) {
                    Label(L10n.t("planning.feedback.share"), systemImage: "square.and.arrow.up")
                        .pfText(.buttonSmall)
                        .foregroundStyle(PFColor.onPrimary)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 36)
                        .background(PFColor.primary, in: .capsule)
                        .contentShape(.capsule)
                }
                .buttonStyle(.pfPressable)
                PFButton(L10n.t("common.copyLink"), systemImage: "link", kind: .ghost, size: .small) { ProjectsClipboard.copy(link, model: model) }
            }
        } else {
            PFButton(L10n.t("planning.feedback.setupWeb"), systemImage: "safari", kind: .secondary, size: .small) {
                ProjectsClipboard.open(ProjectLinks.initiative(projectId: projectId, id: initiative.id))
            }
        }
    }
}
