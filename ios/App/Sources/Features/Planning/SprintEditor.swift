import SwiftUI
import PFData
import PFDesign
import PFModel

/// Create or edit a sprint: name, goal, start and end (web `ProjectSprints` form).
struct SprintEditorSheet: View {
    let projectId: String
    /// nil creates a new sprint.
    let sprint: Sprint?
    /// Tasks currently in the sprint (they go back to the backlog when it is deleted).
    var taskIds: [String] = []

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var draft = SprintDraft()
    @State private var isSaving = false

    private var datesValid: Bool {
        guard let start = draft.startDate, let end = draft.endDate else { return true }
        return end.instant >= start.instant
    }

    private var deleteAction: (() -> Void)? {
        sprint == nil ? nil : { confirmDelete() }
    }

    var body: some View {
        PlanningEditorScaffold(
            eyebrow: L10n.t(sprint == nil ? "planning.sprint.new.eyebrow" : "planning.sprint.edit.eyebrow"),
            title: sprint?.name ?? L10n.t("planning.sprint.new.title"),
            saveTitle: L10n.t(sprint == nil ? "planning.sprint.create" : "common.save"),
            canSave: !draft.name.trimmingCharacters(in: .whitespaces).isEmpty && datesValid && !isSaving,
            deleteTitle: sprint == nil ? nil : L10n.t("common.delete"),
            onDelete: deleteAction,
            onSave: save
        ) {
            PFTextField(L10n.t("planning.sprint.namePlaceholder"), text: $draft.name)
            PFTextField(L10n.t("planning.sprint.goal"), text: $draft.goal, axis: .vertical)
            PFCardList {
                PlanningDateRow(label: L10n.t("planning.sprint.start"), date: $draft.startDate)
                PlanningDateRow(label: L10n.t("planning.sprint.end"), date: $draft.endDate)
            }
            if !datesValid {
                Text(L10n.t("planning.sprint.datesInvalid")).pfText(.meta).foregroundStyle(PFColor.dangerText)
            }
        }
        .onAppear { if let sprint { draft = SprintDraft(sprint) } }
    }

    private func save() {
        guard let actions = model.planning, !isSaving else { return }
        isSaving = true
        let draft = draft
        let existing = sprint
        Task {
            let ok = await model.perform {
                if let existing {
                    try await actions.updateSprint(projectId: projectId, id: existing.id, draft)
                } else {
                    try await actions.createSprint(projectId: projectId, draft)
                }
            }
            isSaving = false
            guard ok else { return }
            PFHaptics.success()
            presenter.dismiss()
            model.toasts.show(PFToast(L10n.t(existing == nil ? "planning.sprint.created" : "planning.sprint.saved"), style: .success))
        }
    }

    private func confirmDelete() {
        guard let sprint else { return }
        let projectId = projectId
        let taskIds = taskIds
        presenter.present(detents: [.fit]) {
            ProjectConfirmSheet(title: L10n.t("planning.sprint.delete.title"),
                                message: L10n.t("planning.sprint.delete.message", ["name": sprint.name]),
                                confirmTitle: L10n.t("common.delete")) {
                guard let actions = model.planning else { return }
                Task {
                    if await model.perform({ try await actions.deleteSprint(projectId: projectId, id: sprint.id, taskIds: taskIds) }) {
                        PFHaptics.success()
                        presenter.dismissAll()
                        model.toasts.show(PFToast(L10n.t("planning.sprint.deleted"), style: .success))
                    }
                }
            }
        }
    }
}

/// Completing a sprint: unfinished tasks move to the next sprint or back to the backlog.
struct SprintCompleteSheet: View {
    let projectId: String
    let sprint: Sprint
    let unfinished: [WorkTask]
    /// The sprint the unfinished work can move to (next planned one), if any.
    let nextSprint: Sprint?

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var toNext = false
    @State private var isSaving = false

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSheetHeader(L10n.t("planning.sprint.complete.eyebrow"), title: L10n.t("planning.sprint.complete.title", ["name": sprint.name]))
            Text(unfinished.isEmpty ? L10n.t("planning.sprint.complete.allDone") : L10n.plural("planning.sprint.complete.unfinished", unfinished.count))
                .pfText(.body).foregroundStyle(PFColor.textMuted)
                .padding(.horizontal, PFSpace.page)
            if !unfinished.isEmpty {
                VStack(spacing: PFSpace.xs) {
                    if let nextSprint {
                        choice(L10n.t("planning.sprint.complete.toNext", ["name": nextSprint.name]), isOn: toNext) { toNext = true }
                    }
                    choice(L10n.t("planning.sprint.complete.toBacklog"), isOn: !toNext || nextSprint == nil) { toNext = false }
                }
                .padding(.horizontal, PFSpace.page)
            }
            PFButton(L10n.t("planning.sprint.complete.action"), systemImage: "checkmark", fullWidth: true, action: complete)
                .disabled(isSaving)
                .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
    }

    private func choice(_ title: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button {
            PFHaptics.selection()
            action()
        } label: {
            HStack(spacing: PFSpace.s) {
                Image(systemName: isOn ? "largecircle.fill.circle" : "circle").font(.system(size: 20)).foregroundStyle(isOn ? PFColor.textMain : PFColor.textSubtle)
                Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 52)
            .pfCard()
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }

    private func complete() {
        guard let actions = model.planning, !isSaving else { return }
        isSaving = true
        let destination = toNext ? nextSprint?.id : nil
        let ids = unfinished.map(\.id)
        Task {
            let ok = await model.perform { try await actions.completeSprint(projectId: projectId, id: sprint.id, unfinishedTaskIds: ids, destination: destination) }
            isSaving = false
            guard ok else { return }
            PFHaptics.success()
            presenter.dismiss()
            model.toasts.show(PFToast(L10n.t("planning.sprint.completed", ["name": sprint.name]), style: .success))
        }
    }
}
