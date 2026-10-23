import SwiftUI
import PFData
import PFDesign
import PFModel

extension AppModel {
    /// People that can be assigned in a project: its members, falling back to the whole workspace.
    func people(of project: Project?) -> [Person] {
        let people = workspace?.people ?? [:]
        let found = (project?.memberIds ?? []).compactMap { people[$0] }
        let list = found.isEmpty ? Array(people.values) : found
        return list.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }
}

/// Create or edit an initiative: title, description, status, priority, health, dates, assignees,
/// success metric and accent colour (web `InitiativeCreateModal` + `InitiativeSettingsModal`).
struct InitiativeEditorSheet: View {
    let projectId: String
    /// nil creates a new initiative.
    let initiative: Initiative?
    let people: [Person]
    var onCreated: ((String) -> Void)?
    var onDeleted: (() -> Void)?

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var draft = InitiativeDraft()
    @State private var isSaving = false

    private var statusOptions: [(value: String, label: String)] {
        ["Planning", "Open", "In Progress", "Review", "On Hold", "Blocked", "Done"].map { (value: $0, label: L10n.t("status.\($0)")) }
    }

    private var priorityOptions: [(value: TaskPriority?, label: String)] {
        var options: [(value: TaskPriority?, label: String)] = [(value: nil, label: L10n.t("priority.none"))]
        for priority in [TaskPriority.low, .medium, .high, .urgent] { options.append((value: priority, label: priority.label)) }
        return options
    }

    private var healthOptions: [(value: InitiativeHealth?, label: String)] {
        var options: [(value: InitiativeHealth?, label: String)] = [(value: nil, label: L10n.t("planning.initiative.health.none"))]
        for health in InitiativeHealth.allCases { options.append((value: health, label: health.label)) }
        return options
    }

    private var deleteAction: (() -> Void)? {
        initiative == nil ? nil : { confirmDelete() }
    }

    var body: some View {
        PlanningEditorScaffold(
            eyebrow: L10n.t(initiative == nil ? "planning.initiative.new.eyebrow" : "planning.initiative.edit.eyebrow"),
            title: initiative?.title ?? L10n.t("planning.initiative.new.title"),
            saveTitle: L10n.t(initiative == nil ? "planning.initiative.create" : "common.save"),
            canSave: !draft.title.trimmingCharacters(in: .whitespaces).isEmpty && !isSaving,
            deleteTitle: initiative == nil ? nil : L10n.t("common.delete"),
            onDelete: deleteAction,
            onSave: save
        ) {
            PFTextField(L10n.t("planning.initiative.titlePlaceholder"), text: $draft.title)
            PFTextField(L10n.t("planning.description"), text: $draft.description, axis: .vertical)
            PlanningField(label: L10n.t("common.status")) {
                PlanningChips(options: statusOptions, selection: $draft.status)
            }
            PlanningField(label: L10n.t("common.priority")) {
                PlanningChips(options: priorityOptions, selection: $draft.priority)
            }
            PlanningField(label: L10n.t("planning.initiative.health")) {
                PlanningChips(options: healthOptions, selection: $draft.health)
            }
            PFCardList {
                PlanningDateRow(label: L10n.t("taskDetail.timeline.startDate"), date: $draft.startDate)
                PlanningDateRow(label: L10n.t("taskDetail.timeline.dueDate"), date: $draft.dueDate)
                PFDetailRow(L10n.t("taskDetail.assignees.label"), showsChevron: true, action: presentPeople) {
                    let selected = draft.assigneeIds.compactMap { model.workspace?.person($0) }
                    if selected.isEmpty {
                        Text("—").foregroundStyle(PFColor.textSubtle)
                    } else {
                        PFAvatarStack(people: selected.map { ($0.id, $0.displayName, $0.photoURL) }, size: 24, limit: 4)
                    }
                }
            }
            PlanningField(label: L10n.t("projects.initiative.successMetric")) {
                PFTextField(L10n.t("planning.initiative.metricPlaceholder"), text: $draft.successMetric, axis: .vertical)
            }
            PlanningField(label: L10n.t("planning.initiative.color")) {
                PlanningSwatchRow(selection: $draft.color, allowsNone: true, noneLabel: L10n.t("planning.initiative.color.none"))
            }
        }
        .onAppear { if let initiative { draft = InitiativeDraft(initiative) } }
    }

    private func presentPeople() {
        let binding = $draft
        var candidates = people
        for id in draft.assigneeIds where !candidates.contains(where: { $0.id == id }) {
            if let person = model.workspace?.person(id) { candidates.append(person) }
        }
        presenter.present(detents: [.fit]) {
            PeopleSheet(title: L10n.t("planning.initiative.assignees"), people: candidates, initial: binding.wrappedValue.assigneeIds) { ids in
                binding.wrappedValue.assigneeIds = ids
            }
        }
    }

    private func save() {
        guard let actions = model.planning, !isSaving else { return }
        isSaving = true
        let draft = draft
        let existing = initiative
        Task {
            var createdId: String?
            let ok = await model.perform {
                if let existing {
                    try await actions.updateInitiative(projectId: projectId, id: existing.id, draft)
                } else {
                    createdId = try await actions.createInitiative(projectId: projectId, draft)
                }
            }
            isSaving = false
            guard ok else { return }
            PFHaptics.success()
            presenter.dismiss()
            model.toasts.show(PFToast(L10n.t(existing == nil ? "planning.initiative.created" : "planning.initiative.saved"), style: .success))
            if let createdId { onCreated?(createdId) }
        }
    }

    private func confirmDelete() {
        guard let initiative else { return }
        let projectId = projectId
        let onDeleted = onDeleted
        presenter.present(detents: [.fit]) {
            ProjectConfirmSheet(title: L10n.t("planning.initiative.delete.title"),
                                message: L10n.t("planning.initiative.delete.message", ["title": initiative.title]),
                                confirmTitle: L10n.t("common.delete")) {
                guard let actions = model.planning else { return }
                Task {
                    if await model.perform({ try await actions.deleteInitiative(projectId: projectId, id: initiative.id, title: initiative.title) }) {
                        PFHaptics.success()
                        presenter.dismissAll()
                        model.toasts.show(PFToast(L10n.t("planning.initiative.deleted"), style: .success))
                        onDeleted?()
                    }
                }
            }
        }
    }
}
