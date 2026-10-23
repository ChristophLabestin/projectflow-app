import SwiftUI
import PFData
import PFDesign
import PFModel

/// Create or edit a milestone: title, description, status, due date, linked initiative and tasks
/// (web `MilestoneModal`).
struct MilestoneEditorSheet: View {
    let projectId: String
    /// nil creates a new milestone.
    let milestone: Milestone?
    let tasks: [WorkTask]
    let initiatives: [Initiative]

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var draft = MilestoneDraft()
    @State private var isSaving = false

    private var statusOptions: [(value: String, label: String)] {
        ["Pending", "Achieved", "Missed"].map { (value: $0, label: L10n.t("planning.milestone.status.\($0)")) }
    }

    private var linkedInitiativeTitle: String? {
        guard let id = draft.linkedInitiativeId else { return nil }
        return initiatives.first { $0.id == id }?.title
    }

    private var deleteAction: (() -> Void)? {
        milestone == nil ? nil : { confirmDelete() }
    }

    var body: some View {
        PlanningEditorScaffold(
            eyebrow: L10n.t(milestone == nil ? "planning.milestone.new.eyebrow" : "planning.milestone.edit.eyebrow"),
            title: milestone?.title ?? L10n.t("planning.milestone.new.title"),
            saveTitle: L10n.t(milestone == nil ? "planning.milestone.create" : "common.save"),
            canSave: !draft.title.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving,
            deleteTitle: milestone == nil ? nil : L10n.t("common.delete"),
            onDelete: deleteAction,
            onSave: save
        ) {
            PFTextField(L10n.t("planning.milestone.titlePlaceholder"), text: $draft.title)
            PFTextField(L10n.t("planning.description"), text: $draft.description, axis: .vertical)
            PlanningField(label: L10n.t("common.status")) {
                PlanningChips(options: statusOptions, selection: $draft.status)
            }
            PFCardList {
                PlanningDateRow(label: L10n.t("planning.milestone.due"), date: $draft.dueDate)
                PFDetailRow(L10n.t("planning.milestone.initiative"), showsChevron: true, action: presentInitiatives) {
                    if let title = linkedInitiativeTitle {
                        Text(title).lineLimit(1)
                    } else {
                        Text("—").foregroundStyle(PFColor.textSubtle)
                    }
                }
                PFDetailRow(L10n.t("planning.milestone.tasks"), showsChevron: true, action: presentTasks) {
                    if draft.linkedTaskIds.isEmpty {
                        Text("—").foregroundStyle(PFColor.textSubtle)
                    } else {
                        Text(L10n.plural("planning.tasks.count", draft.linkedTaskIds.count))
                    }
                }
            }
        }
        .onAppear { if let milestone { draft = MilestoneDraft(milestone) } }
    }

    private func presentInitiatives() {
        let binding = $draft
        presenter.present(detents: [.fit]) {
            PlanningChoiceSheet(eyebrow: L10n.t("planning.milestone.initiative"), title: nil,
                                options: initiatives.map { PlanningOption(id: $0.id, title: $0.title, tint: PFColor.hex($0.color) ?? PFColor.statusBase($0.tone)) },
                                selection: binding.wrappedValue.linkedInitiativeId, noneTitle: L10n.t("planning.none"),
                                emptyText: L10n.t("planning.initiatives.empty")) { binding.wrappedValue.linkedInitiativeId = $0 }
        }
    }

    private func presentTasks() {
        let binding = $draft
        let options = tasks.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            .map { PlanningOption(id: $0.id, title: $0.title, subtitle: $0.status.label) }
        presenter.present(detents: [.large]) {
            PlanningMultiSheet(eyebrow: L10n.t("planning.milestone.tasks"), title: nil, options: options,
                               initial: Set(binding.wrappedValue.linkedTaskIds), emptyText: L10n.t("planning.tasks.empty"), searchable: true) { ids in
                binding.wrappedValue.linkedTaskIds = ids
            }
        }
    }

    private func save() {
        guard let actions = model.planning, !isSaving else { return }
        isSaving = true
        let draft = draft
        let existing = milestone
        let withoutDue = tasks.filter { $0.dueDate == nil }.map(\.id)
        Task {
            let ok = await model.perform {
                if let existing {
                    try await actions.updateMilestone(projectId: projectId, id: existing.id, draft, tasksWithoutDue: withoutDue)
                } else {
                    try await actions.createMilestone(projectId: projectId, draft, tasksWithoutDue: withoutDue)
                }
            }
            isSaving = false
            guard ok else { return }
            PFHaptics.success()
            presenter.dismiss()
            model.toasts.show(PFToast(L10n.t(existing == nil ? "planning.milestone.created" : "planning.milestone.saved"), style: .success))
        }
    }

    private func confirmDelete() {
        guard let milestone else { return }
        let projectId = projectId
        presenter.present(detents: [.fit]) {
            ProjectConfirmSheet(title: L10n.t("planning.milestone.delete.title"),
                                message: L10n.t("planning.milestone.delete.message", ["title": milestone.title]),
                                confirmTitle: L10n.t("common.delete")) {
                guard let actions = model.planning else { return }
                Task {
                    if await model.perform({ try await actions.deleteMilestone(projectId: projectId, id: milestone.id) }) {
                        PFHaptics.success()
                        presenter.dismissAll()
                        model.toasts.show(PFToast(L10n.t("planning.milestone.deleted"), style: .success))
                    }
                }
            }
        }
    }
}
