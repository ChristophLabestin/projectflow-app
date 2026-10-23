import SwiftUI
import UIKit
import PFData
import PFDesign
import PFModel

/// Personal task: same layout as the task detail with the fields a private task has
/// (title, status, priority, due and planned day, description, focus, pin, delete).
struct PersonalTaskScreen: View {
    let tenantId: String
    let taskId: String

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var titleDraft = ""
    @State private var topInset: CGFloat = 0
    @State private var editor = RichEditorController()
    @State private var isEditingDescription = false
    @State private var keyboardVisible = false
    @State private var isDeleting = false

    private var task: PersonalTask? { model.workspace?.personalTasks.first { $0.id == taskId } }
    private var item: WorkItem? { task.map(WorkItem.personal) }
    private var isPinned: Bool { model.profile?.pinnedItems.contains { $0.id == taskId } ?? false }
    private var isFocused: Bool { model.profile?.focus?.itemId == taskId }
    private var isLoaded: Bool { model.workspace?.loaded.contains(.personalTasks) ?? false }

    private func run(_ work: @escaping (WorkActions) async throws -> Void) {
        guard let actions = model.actions else { return }
        Task { await model.perform { try await work(actions) } }
    }

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
        .onChange(of: task?.title, initial: true) { _, title in if let title { titleDraft = title } }
        .onChange(of: task == nil) { _, missing in
            if missing, isLoaded, !isDeleting {
                model.router.pop()
                model.toasts.show(PFToast(L10n.t("taskDetail.notFound.title"), style: .warning))
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(2))
            if task == nil, isLoaded, !isDeleting {
                model.router.pop()
                model.toasts.show(PFToast(L10n.t("taskDetail.notFound.title"), style: .warning))
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardVisible = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardVisible = false }
    }

    // MARK: Content

    private func content(_ task: PersonalTask) -> some View {
        let actions = WorkItemActions(model: model)
        return ScrollView {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                Color.clear.frame(height: topInset + 48)
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 6) {
                        Image(systemName: "lock.fill").font(.system(size: 10, weight: .bold)).foregroundStyle(PFColor.textMuted)
                        PFEyebrow(L10n.t("common.personal"))
                    }
                    PFEditableText(L10n.t("taskDetail.title.placeholder"), text: $titleDraft, style: .title, lineLimit: 1...6) { value in
                        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { titleDraft = task.title; return }
                        guard trimmed != task.title else { return }
                        run { try await $0.updatePersonalTask(taskId, ["title": trimmed]) }
                    }
                    .accessibilityAddTraits(.isHeader)
                    pills(task, actions: actions)
                }
                if !task.isCompleted { focusCard }
                descriptionCard(task)
                detailsCard(task, actions: actions)
                Color.clear.frame(height: 96)
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.bottom, PFSpace.l)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(.container, edges: [.top, .bottom])
    }

    private func pills(_ task: PersonalTask, actions: WorkItemActions) -> some View {
        FlowLayout(spacing: 8) {
            PFPillButton(task.status.label, tone: .status(task.status.tone)) { actions.presentStatus(.personal(task)) }
            PFPillButton(task.priority?.label ?? L10n.t("priority.none"), tone: .neutral, action: { actions.presentPriority(.personal(task)) }) {
                PFPrioritySignal(task.priority)
            }
            if let due = task.dueDate {
                PFPillButton(Formatting.dueText(due) ?? Formatting.shortDate(due),
                             tone: .severity(task.isCompleted ? .neutral : Formatting.severity(due: due))) { presentDate(.due, task, actions: actions) }
            } else {
                PFPillButton(L10n.t("taskDetail.timeline.noDueDate"), tone: .neutral, action: { presentDate(.due, task, actions: actions) }) {
                    Image(systemName: "calendar").font(.system(size: 10, weight: .bold))
                }
            }
        }
    }

    private var focusCard: some View {
        HStack(spacing: PFSpace.xs) {
            PFButton(isFocused ? L10n.t("taskDetail.focus.open") : L10n.t("common.startFocus"), systemImage: "scope", size: .small) { startFocus() }
            Spacer(minLength: 0)
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
    }

    private func descriptionCard(_ task: PersonalTask) -> some View {
        let document = RichHTML.parse(task.summary)
        return VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack {
                Text(L10n.t("taskDetail.description.label")).pfText(.section).foregroundStyle(PFColor.textMain)
                Spacer()
                if !isEditingDescription, !document.isEmpty, document.isEditable {
                    Button {
                        withAnimation(PFMotion.respecting(PFMotion.fast)) { isEditingDescription = true }
                    } label: {
                        Image(systemName: "pencil").font(.system(size: 14, weight: .semibold)).foregroundStyle(PFColor.textMuted)
                            .frame(width: 34, height: 34).background(PFColor.raised, in: .circle)
                    }
                    .buttonStyle(.pfPressable)
                    .accessibilityLabel(L10n.t("common.edit"))
                }
            }
            if isEditingDescription {
                RichTextEditorView(controller: editor)
                    .task {
                        editor.load(document)
                        editor.focus()
                    }
            } else if document.isEmpty {
                Button {
                    withAnimation(PFMotion.respecting(PFMotion.fast)) { isEditingDescription = true }
                } label: {
                    Label(L10n.t("taskDetail.description.add"), systemImage: "text.alignleft")
                        .pfText(.metaStrong)
                        .foregroundStyle(PFColor.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(minHeight: 40)
                        .contentShape(.rect)
                }
                .buttonStyle(.pfPressable)
            } else {
                RichTextView(html: task.summary)
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
    }

    private func detailsCard(_ task: PersonalTask, actions: WorkItemActions) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(L10n.t("taskDetail.details.title")).pfText(.section).foregroundStyle(PFColor.textMain).padding(.horizontal, PFSpace.xxs)
            PFCardList {
                dateRow(L10n.t("taskDetail.timeline.dueDate"), task.dueDate, isDue: true, task: task) { presentDate(.due, task, actions: actions) }
                dateRow(L10n.t("taskDetail.timeline.scheduled"), task.scheduledDate, isDue: false, task: task) { presentDate(.scheduled, task, actions: actions) }
                if let created = task.createdAt?.instant {
                    PFDetailRow(L10n.t("taskDetail.details.created")) {
                        Text(created.formatted(.dateTime.day().month(.abbreviated).year().locale(L10n.locale))).foregroundStyle(PFColor.textMuted)
                    }
                }
            }
        }
    }

    private func dateRow(_ label: String, _ value: FlexDate?, isDue: Bool, task: PersonalTask, action: @escaping () -> Void) -> some View {
        PFDetailRow(label, showsChevron: true, action: action) {
            if let value {
                Text(Formatting.shortDate(value))
                    .foregroundStyle(isDue ? PFColor.severityText(Formatting.severity(due: value, isDone: task.isCompleted)) : PFColor.textMain)
            } else {
                Text("—").foregroundStyle(PFColor.textSubtle)
            }
        }
    }

    private enum DateField { case due, scheduled }

    private func presentDate(_ field: DateField, _ task: PersonalTask, actions: WorkItemActions) {
        let item = WorkItem.personal(task)
        presenter.present(detents: [.fit]) {
            DateSheet(eyebrow: field == .due ? L10n.t("taskDetail.timeline.dueDate") : L10n.t("taskDetail.timeline.scheduled"), title: task.title,
                      initial: field == .due ? task.dueDate : task.scheduledDate) { date in
                Task {
                    if field == .due { await actions.setDue(item, date) } else { await actions.setScheduled(item, date) }
                }
            }
        }
    }

    // MARK: Chrome

    private var topBar: some View {
        PFTopBar(backLabel: L10n.t("common.back"), onBack: { model.router.pop() }) {
            if let item {
                PFIconButton(isPinned ? "pin.fill" : "pin", label: isPinned ? L10n.t("common.unpin") : L10n.t("common.pin"), style: .glass) {
                    PFHaptics.selection()
                    Task { await WorkItemActions(model: model).togglePin(item) }
                }
                PFIconButton("ellipsis", label: L10n.t("common.more"), style: .glass) { presentMenu() }
            }
        }
    }

    private func presentMenu() {
        guard let task else { return }
        var items: [ActionSheet.Item] = []
        if !task.isCompleted {
            items.append(.init(title: isFocused ? L10n.t("taskDetail.focus.open") : L10n.t("common.startFocus"), systemImage: "scope") { startFocus() })
        }
        items.append(.init(title: L10n.t("taskDetail.delete.action"), systemImage: "trash", destructive: true) {
            presenter.present(detents: [.fit]) {
                ProjectConfirmSheet(title: L10n.t("taskDetail.confirm.delete.title"), message: L10n.t("taskDetail.confirm.delete.message", ["title": task.title]),
                             confirmTitle: L10n.t("taskDetail.confirm.delete.confirm")) { delete() }
            }
        })
        presenter.present(detents: [.fit]) { ActionSheet(title: nil, items: items) }
    }

    private func startFocus() {
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

    private func delete() {
        guard let actions = model.actions else { return }
        isDeleting = true
        model.router.pop()
        Task {
            let ok = await model.perform { try await actions.deletePersonalTask(taskId) }
            if ok {
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("taskDetail.delete.done"), style: .success))
            }
        }
    }

    @ViewBuilder
    private var floating: some View {
        if isEditingDescription {
            DescriptionToolbar(controller: editor, onLink: presentLink, onCancel: {
                editor.resign()
                withAnimation(PFMotion.respecting(PFMotion.fast)) { isEditingDescription = false }
            }, onDone: saveDescription)
        } else if !keyboardVisible, let task {
            if task.isCompleted {
                PFButton(L10n.t("common.reopen"), systemImage: "arrow.uturn.backward", kind: .secondary, size: .large, fullWidth: true) {
                    if let item { Task { await WorkItemActions(model: model).toggleComplete(item) } }
                }
            } else {
                PFButton(L10n.t("taskDetail.actions.markDone"), systemImage: "checkmark", kind: .primary, size: .large, fullWidth: true) {
                    if let item { Task { await WorkItemActions(model: model).toggleComplete(item) } }
                }
                .shadow(color: .black.opacity(0.28), radius: 18, y: 8)
            }
        }
    }

    private func presentLink() {
        let current = editor.currentLink
        presenter.present(detents: [.fit]) { LinkSheet(initial: current) { url in editor.applyLink(url) } }
    }

    private func saveDescription() {
        let html = editor.html()
        editor.resign()
        withAnimation(PFMotion.respecting(PFMotion.fast)) { isEditingDescription = false }
        run { try await $0.updatePersonalTask(taskId, ["description": html]) }
    }

    private var loading: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Color.clear.frame(height: 64)
            PFSkeleton(height: 12, radius: 4).frame(width: 100)
            PFSkeleton(height: 30, radius: 6)
            PFSkeleton(height: 110, radius: PFRadius.card)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.xl)
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
