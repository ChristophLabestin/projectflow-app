import SwiftUI
import PFData
import PFDesign
import PFModel

/// Eingang (concept §5.7): triage with the right primary action per notification.
struct InboxScreen: View {
    @Environment(AppModel.self) private var model
    @State private var filter: InboxFilter = .all
    @State private var replyingTo: String?
    @State private var replyText = ""
    @State private var busyId: String?
    @State private var content = InboxContentCache()
    @AppStorage("pf.inbox.pushPrompted") private var pushPrompted = false

    private var workspace: WorkspaceStore? { model.workspace }
    private var items: [InboxItem] { workspace?.inbox ?? [] }
    private var visible: [InboxItem] { items.filter { InboxLogic.matches($0, filter: filter) } }
    private var isLoaded: Bool { workspace?.loaded.contains(.inbox) ?? false }
    private var unreadCount: Int { items.filter { !$0.read }.count }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    header
                    if let sentence = InboxLogic.summary(items, actorName: actorName) {
                        PFInboxSummary(eyebrow: L10n.t("inbox.eyebrowSince"), sentence: sentence)
                            .padding(.top, PFSpace.s)
                            .transition(.opacity)
                    }
                    PFSegmented([
                        (InboxFilter.all, L10n.t("inbox.filter.all")),
                        (InboxFilter.mentions, L10n.t("inbox.filter.mentions")),
                        (InboxFilter.assignments, L10n.t("inbox.filter.assignments")),
                    ], selection: $filter)
                    .padding(.top, PFSpace.l)
                    list(proxy)
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.bottom, PFSpace.xxl)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: filter)
        .animation(PFMotion.respecting(PFMotion.snappy), value: items.map(\.id))
        .task(id: items.map(\.id)) { await loadContext() }
        .task(id: "\(model.presenter.sheets.count)-\(items.count)") { await promptForPushIfNeeded() }
        .onboardingHost()
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center) {
            Text(L10n.t("tab.inbox")).pfText(.display).foregroundStyle(PFColor.textMain)
            Spacer()
            if unreadCount > 0 {
                PFIconButton("checkmark.circle", label: L10n.t("notifications.actions.markAllRead"), style: .glass) { markAllRead() }
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .padding(.top, PFSpace.xs)
        .frame(minHeight: 48)
    }

    // MARK: List

    @ViewBuilder
    private func list(_ proxy: ScrollViewProxy) -> some View {
        if !isLoaded {
            VStack(spacing: PFSpace.s) {
                ForEach(0..<3, id: \.self) { _ in
                    PFSkeleton(height: 112, radius: PFRadius.card)
                }
            }
            .padding(.top, PFSpace.l)
        } else if visible.isEmpty {
            PFEmptyState(
                systemImage: "tray",
                title: items.isEmpty ? L10n.t("notifications.empty.title") : L10n.t("inbox.empty.filteredTitle"),
                message: items.isEmpty ? L10n.t("notifications.empty.description") : L10n.t("inbox.empty.filteredMessage")
            )
            .padding(.top, PFSpace.xl)
        } else {
            ForEach(InboxLogic.grouped(visible), id: \.group) { section in
                PFSectionHeader(section.group.title) { PFCountPill(section.items.count) }
                VStack(spacing: 0) {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                        if index > 0 { PFRowDivider() }
                        // iOS 26 gives `.background`/`.clipped` rows a concentric (rounded) shape inside a clipped card;
                        // rows are straight, the card does the rounding.
                        row(item, proxy: proxy).containerShape(Rectangle()).id(item.id)
                    }
                }
                .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
                .pfCard()
            }
        }
    }

    private func row(_ item: InboxItem, proxy: ScrollViewProxy) -> some View {
        let task = task(for: item)
        return PFSwipeRow(leading: readAction(item), trailing: laterActions(item, task)) {
            InboxEntryView(
                item: item,
                task: task,
                actorName: actorName(item),
                actorPhotoURL: item.actorPhotoURL ?? workspace?.person(item.actorId)?.photoURL,
                excerpt: item.commentId.flatMap { content.excerpt(for: $0) },
                workspaceTag: nil,
                isReplying: replyingTo == item.id,
                replyText: $replyText,
                isBusy: busyId == item.id,
                isPlannedToday: task?.scheduledDate.map { Formatting.dayOffset($0) == 0 } ?? false,
                onOpen: { open(item) },
                onPlanToday: { planToday(item, task) },
                onReply: { startReply(item, proxy: proxy) },
                onSendReply: { sendReply(item) },
                onAccept: { accept(item) }
            )
        }
    }

    private func actorName(_ item: InboxItem) -> String? {
        item.actorName ?? workspace?.person(item.actorId)?.displayName
    }

    private func task(for item: InboxItem) -> WorkTask? {
        guard let taskId = item.taskId else { return nil }
        return workspace?.task(taskId) ?? ProjectTaskIndex.shared.task(projectId: item.projectId, id: taskId)
    }

    // MARK: Swipe actions

    private func readAction(_ item: InboxItem) -> PFSwipeAction {
        PFSwipeAction(item.read ? L10n.t("inbox.markUnread") : L10n.t("inbox.markRead"),
                      systemImage: item.read ? "circle" : "checkmark", tint: PFColor.success) {
            setRead(item, !item.read)
        }
    }

    private func laterActions(_ item: InboxItem, _ task: WorkTask?) -> [PFSwipeAction] {
        guard let task, !task.isCompleted else { return [] }
        return [PFSwipeAction(L10n.t("inbox.later"), systemImage: "clock", tint: PFColor.raised, foreground: PFColor.textMain) {
            remindLater(item, task)
        }]
    }

    // MARK: Loading

    private func loadContext() async {
        guard let workspace else { return }
        let relevant = items.prefix(40)
        let missing = relevant.filter { item in
            guard let taskId = item.taskId, item.projectId != nil else { return false }
            return workspace.task(taskId) == nil
        }
        let projectIds = Array(Set(missing.compactMap(\.projectId)))
        async let comments: Void = content.loadComments(for: Array(relevant))
        await ProjectTaskIndex.shared.ensureLoaded(projectIds: projectIds, workspace: workspace)
        await comments
    }

    /// Notification permission is asked when the first assignment shows up here (concept §7).
    /// Waits until no sheet (intro, composer) is open so the system dialog never covers it.
    private func promptForPushIfNeeded() async {
        guard !pushPrompted, items.contains(where: { $0.kind == .taskAssigned }) else { return }
        try? await Task.sleep(for: .milliseconds(1500))
        guard !Task.isCancelled, model.presenter.sheets.isEmpty else { return }
        pushPrompted = true
        await PushRegistrar.shared.requestPermissionIfNeeded()
    }

    // MARK: Actions

    private func setRead(_ item: InboxItem, _ read: Bool) {
        guard let actions = model.actions else { return }
        Task { await model.perform { try await actions.markRead(item, read) } }
    }

    private func markAllRead() {
        guard let actions = model.actions else { return }
        let unread = items.filter { !$0.read }
        guard !unread.isEmpty else { return }
        PFHaptics.success()
        Task { await model.perform { try await actions.markAllRead(unread) } }
        model.toasts.show(PFToast(L10n.t("notifications.toast.markAllRead"), style: .success, actionTitle: L10n.t("common.undo")) {
            Task { for item in unread { try? await actions.markRead(item, false) } }
        })
    }

    private func open(_ item: InboxItem) {
        if !item.read { setRead(item, true) }
        replyingTo = nil
        let router = model.router
        if let session = model.session, item.tenantId != session.activeWorkspaceId,
           session.workspaces.contains(where: { $0.id == item.tenantId }) {
            model.switchWorkspace(to: item.tenantId)
            if let route = route(for: item) { router.open(route.route, in: route.tab) }
            return
        }
        switch item.kind {
        case .morningBriefing:
            router.select(.today)
        case .dayClose:
            router.todayMode = .dayClose
            router.select(.today)
        case .taskDueToday:
            router.select(.work)
        default:
            if let target = route(for: item) { router.push(target.route) }
        }
    }

    private func route(for item: InboxItem) -> (route: AppRoute, tab: AppTab)? {
        guard let projectId = item.projectId else { return nil }
        if let taskId = item.taskId {
            return (.task(TaskRef(tenantId: item.tenantId, projectId: projectId, taskId: taskId)), .work)
        }
        if let initiativeId = item.initiativeId {
            return (.initiative(tenantId: item.tenantId, projectId: projectId, initiativeId: initiativeId), .projects)
        }
        return (.project(tenantId: item.tenantId, projectId: projectId), .projects)
    }

    private func planToday(_ item: InboxItem, _ task: WorkTask?) {
        guard let task else { return }
        if !item.read { setRead(item, true) }
        Task { await WorkItemActions(model: model).planToday(.task(task)) }
    }

    /// Reminder in one hour on the task (the server delivers it, contract C2).
    private func remindLater(_ item: InboxItem, _ task: WorkTask) {
        guard let actions = model.actions, let uid = model.uid else { return }
        let original = task.reminders
        let reminder = ProjectReminder(title: task.title, remindAt: FlexDate(instant: .now.addingTimeInterval(3600)), createdBy: uid)
        if !item.read { setRead(item, true) }
        PFHaptics.soft()
        Task { await model.perform { try await actions.setReminders(task.ref, original + [reminder]) } }
        model.toasts.show(PFToast(L10n.t("inbox.later.done"), actionTitle: L10n.t("common.undo")) {
            Task { await model.perform { try await actions.setReminders(task.ref, original) } }
        })
    }

    private func startReply(_ item: InboxItem, proxy: ScrollViewProxy) {
        replyText = InboxLogic.firstName(actorName(item)).map { "@\($0) " } ?? ""
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { replyingTo = item.id }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            withAnimation(PFMotion.respecting(PFMotion.snappy)) { proxy.scrollTo(item.id, anchor: .center) }
        }
    }

    private func sendReply(_ item: InboxItem) {
        let text = replyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let projectId = item.projectId, let targetId = item.taskId ?? item.initiativeId, let actions = model.actions else { return }
        let mentioned: [String] = {
            guard let actor = item.actorId, let name = InboxLogic.firstName(actorName(item)), text.contains("@\(name)") else { return [] }
            return [actor]
        }()
        let photo = model.profile?.photoURL
        let type = item.taskId != nil ? "task" : "initiative"
        PFHaptics.success()
        replyingTo = nil
        replyText = ""
        if !item.read { setRead(item, true) }
        model.toasts.show(PFToast(L10n.t("inbox.reply.sent"), style: .success))
        Task {
            await model.perform {
                try await actions.addComment(projectId: projectId, targetId: targetId, targetType: type, content: text,
                                             mentionedUserIds: mentioned, photoURL: photo)
            }
        }
    }

    private func accept(_ item: InboxItem) {
        guard let inviteId = item.inviteId else { return }
        let link = InviteLink(tenantId: item.tenantId, inviteId: inviteId)
        busyId = item.id
        Task {
            do {
                try await InviteService.accept(link, model: model)
                setRead(item, true)
                PFHaptics.success()
                if let name = model.session?.activeWorkspace?.name {
                    model.toasts.show(PFToast(L10n.t("invite.joined", ["name": name]), style: .success))
                }
            } catch {
                PFHaptics.warning()
                model.presenter.present(detents: [.fit]) { InviteAcceptSheet(link: link, failure: InviteFailure(error)) }
            }
            busyId = nil
        }
    }
}
