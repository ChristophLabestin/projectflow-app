import SwiftUI
import UIKit
import PFData
import PFDesign
import PFModel

/// Task detail (concept §5.6), ordered by how often each part is used:
/// header with pills → workbench → subtasks → description → discussion → details.
/// Sections live in `TaskDetailSections.swift`; stored state is internal so those extensions can use it.
struct TaskDetailScreen: View {
    let ref: TaskRef

    @Environment(AppModel.self) var model
    @Environment(PFPresenter.self) var presenter
    @State var store: TaskDetailStore
    @State var project: ProjectStore
    @State var titleDraft = ""
    @State var nextStepDraft = ""
    @State var blockerDraft = ""
    @State var newSubtask = ""
    @State var topInset: CGFloat = 0
    @State var editor = RichEditorController()
    @State var isEditingDescription = false
    @State var descriptionBase: String?
    @State var keyboardVisible = false
    @State var focusBlockerField = false
    @State var isDeleting = false
    @SwiftUI.FocusState var subtaskFocused: Bool

    init(ref: TaskRef) {
        self.ref = ref
        _store = State(initialValue: TaskDetailStore(ref: ref))
        _project = State(initialValue: ProjectStore(tenantId: ref.tenantId, projectId: ref.projectId))
    }

    // MARK: Derived

    var task: WorkTask? { store.task }
    var projectModel: Project? { project.project ?? model.workspace?.project(ref.projectId) }
    var access: ProjectAccess { ProjectAccess(model: model, project: projectModel) }
    var canEdit: Bool { access.canEditTasks }
    var initiative: Initiative? { task?.initiativeId.flatMap { id in project.initiatives.first { $0.id == id } } }
    var item: WorkItem? { task.map(WorkItem.task) }
    var isPinned: Bool { model.profile?.pinnedItems.contains { $0.id == ref.taskId } ?? false }
    var isFocused: Bool { model.profile?.focus?.itemId == ref.taskId }

    /// People that can be assigned or mentioned: project members, falling back to the whole workspace.
    var members: [Person] {
        let people = model.workspace?.people ?? [:]
        let ids = projectModel?.memberIds ?? []
        let found = ids.compactMap { people[$0] }
        let list = found.isEmpty ? Array(people.values) : found
        return list.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    func run(_ work: @escaping (WorkActions) async throws -> Void) {
        guard let actions = model.actions else { return }
        Task { await model.perform { try await work(actions) } }
    }

    // MARK: Body

    var body: some View {
        ZStack(alignment: .top) {
            if let task {
                content(task)
            } else {
                loading
            }
            topBar
        }
        .pfBottomFloat {
            if task != nil { floating }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { topInset = $0 }
        .task {
            store.start()
            project.start()
        }
        .onDisappear {
            store.stop()
            project.stop()
        }
        .onChange(of: task, initial: true) { old, new in
            guard let new else { return }
            if old?.title != new.title || old == nil { titleDraft = new.title }
            if old?.nextStep != new.nextStep || old == nil { nextStepDraft = new.nextStep ?? "" }
            if old?.blockerNote != new.blockerNote || old == nil { blockerDraft = new.blockerNote ?? "" }
        }
        .onChange(of: store.isMissing) { _, missing in
            guard missing, !isDeleting else { return }
            model.router.pop()
            model.toasts.show(PFToast(L10n.t("taskDetail.notFound.title"), style: .warning))
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardVisible = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardVisible = false }
    }

    private func content(_ task: WorkTask) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                Color.clear.frame(height: topInset + 48)
                header(task)
                workbench(task)
                subtasksCard(task)
                descriptionCard(task)
                CommentsSection(projectId: ref.projectId, targetId: ref.taskId, targetType: "task", comments: store.comments,
                                mentionable: members, canComment: true)
                detailsCard(task)
                remindersCard(task)
                relationshipsCard(task)
                activityCard
                Color.clear.frame(height: 96)
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.bottom, PFSpace.l)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(.container, edges: [.top, .bottom])
    }

    // MARK: Top bar

    private var topBar: some View {
        PFTopBar(backLabel: L10n.t("common.back"), onBack: { model.router.pop() }) {
            if let item {
                PFIconButton(isPinned ? "pin.fill" : "pin", label: isPinned ? L10n.t("common.unpin") : L10n.t("common.pin"), style: .glass) {
                    PFHaptics.selection()
                    Task { await WorkItemActions(model: model).togglePin(item) }
                }
                ShareGlassButton(url: ProjectLinks.task(ref), label: L10n.t("common.share"))
                PFIconButton("ellipsis", label: L10n.t("common.more"), style: .glass) { presentMenu() }
            }
        }
    }

    private func presentMenu() {
        guard let task else { return }
        let url = ProjectLinks.task(ref)
        var items: [ActionSheet.Item] = []
        if !task.isCompleted {
            items.append(.init(title: isFocused ? L10n.t("taskDetail.focus.open") : L10n.t("common.startFocus"), systemImage: "scope") { startFocus() })
        }
        items.append(.init(title: L10n.t("common.copyLink"), systemImage: "link") { ProjectsClipboard.copy(url, model: model) })
        items.append(.init(title: L10n.t("common.openInWeb"), systemImage: "safari") { ProjectsClipboard.open(url) })
        if canEdit {
            items.append(.init(title: L10n.t("taskDetail.delete.action"), systemImage: "trash", destructive: true) { confirmDelete() })
        }
        presenter.present(detents: [.fit]) { ActionSheet(title: nil, items: items) }
    }

    func startFocus() {
        guard let item else { return }
        if isFocused {
            model.router.isFocusRoomOpen = true
            return
        }
        Task {
            await WorkItemActions(model: model).startFocus(item)
            model.router.isFocusRoomOpen = true
        }
    }

    private func confirmDelete() {
        guard let task else { return }
        presenter.present(detents: [.fit]) {
            ProjectConfirmSheet(title: L10n.t("taskDetail.confirm.delete.title"), message: L10n.t("taskDetail.confirm.delete.message", ["title": task.title]),
                         confirmTitle: L10n.t("taskDetail.confirm.delete.confirm")) { delete() }
        }
    }

    private func delete() {
        guard let actions = model.actions else { return }
        isDeleting = true
        model.router.pop()
        Task {
            let ok = await model.perform { try await actions.delete(ref) }
            if ok {
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("taskDetail.delete.done"), style: .success))
            }
        }
    }

    // MARK: Floating action

    @ViewBuilder
    private var floating: some View {
        if isEditingDescription {
            DescriptionToolbar(controller: editor, onLink: presentLinkSheet, onCancel: cancelDescription, onDone: saveDescription)
        } else if canEdit, !keyboardVisible, let task {
            if task.isCompleted {
                PFButton(L10n.t("common.reopen"), systemImage: "arrow.uturn.backward", kind: .secondary, size: .large, fullWidth: true) {
                    Task { await WorkItemActions(model: model).toggleComplete(.task(task)) }
                }
            } else {
                PFButton(L10n.t("taskDetail.actions.markDone"), systemImage: "checkmark", kind: .primary, size: .large, fullWidth: true) {
                    Task { await WorkItemActions(model: model).toggleComplete(.task(task)) }
                }
                .shadow(color: .black.opacity(0.28), radius: 18, y: 8)
            }
        }
    }

    private var loading: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Color.clear.frame(height: 64)
            PFSkeleton(height: 12, radius: 4).frame(width: 140)
            PFSkeleton(height: 30, radius: 6)
            PFSkeleton(height: 30, radius: 15).frame(width: 220)
            PFSkeleton(height: 110, radius: PFRadius.card)
            PFSkeleton(height: 150, radius: PFRadius.card)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.xl)
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
