import SwiftUI
import PFData
import PFDesign
import PFModel

/// Initiative detail: status and health, success metric, its tasks and the discussion.
struct InitiativeScreen: View {
    let tenantId: String
    let projectId: String
    let initiativeId: String

    @Environment(AppModel.self) private var model

    @Environment(\.pfSideRegionWidth) private var sideRegion
    @Environment(PFPresenter.self) private var presenter
    @State private var store: ProjectStore
    @State private var comments: CommentsStore
    @State private var newTaskTitle = ""
    @State private var topInset: CGFloat = 0

    init(tenantId: String, projectId: String, initiativeId: String) {
        self.tenantId = tenantId
        self.projectId = projectId
        self.initiativeId = initiativeId
        _store = State(initialValue: ProjectStore(tenantId: tenantId, projectId: projectId))
        _comments = State(initialValue: CommentsStore(tenantId: tenantId, projectId: projectId, targetId: initiativeId))
    }

    private var initiative: Initiative? { store.initiatives.first { $0.id == initiativeId } }
    private var tasks: [WorkTask] { store.tasks.filter { $0.initiativeId == initiativeId } }
    private var access: ProjectAccess { ProjectAccess(model: model, project: store.project) }

    private var mentionable: [Person] {
        let people = model.workspace?.people ?? [:]
        let ids = store.project?.memberIds ?? []
        let members = ids.compactMap { people[$0] }
        return (members.isEmpty ? Array(people.values) : members).sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    var body: some View {
        ZStack(alignment: .top) {
            if let initiative {
                ScrollView {
                    VStack(alignment: .leading, spacing: PFSpace.l) {
                        Color.clear.frame(height: topInset + PFLayout.topBarClearance(sideRegion: sideRegion))
                        header(initiative)
                        if let metric = initiative.successMetric { metricCard(metric) }
                        progressCard
                        if initiative.feedbackEnabled || access.canManage {
                            InitiativeFeedbackCard(initiative: initiative, projectId: projectId)
                        }
                        tasksSection(initiative)
                        CommentsSection(projectId: projectId, targetId: initiativeId, targetType: "initiative",
                                        comments: comments.comments, mentionable: mentionable, canComment: true)
                            .padding(.horizontal, PFSpace.page)
                    }
                    .padding(.bottom, PFSpace.xxl)
                }
                .scrollIndicators(.hidden)
                .scrollDismissesKeyboard(.interactively)
                .ignoresSafeArea(.container, edges: [.top, .bottom])
            } else {
                loading
            }
            PFTopBar(backLabel: L10n.t("common.back"), onBack: { model.router.pop() }) {
                if initiative != nil {
                    PFIconButton("ellipsis", label: L10n.t("common.more"), style: .glass) { presentMenu() }
                }
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { topInset = $0 }
        .task {
            store.start()
            comments.start()
            // A deleted initiative closes the screen (initiatives arrive a moment after the tasks).
            try? await Task.sleep(for: .seconds(3))
            if initiative == nil, store.isLoaded {
                model.router.pop()
                model.toasts.show(PFToast(L10n.t("projects.initiative.notFound"), style: .warning))
            }
        }
        .onDisappear {
            store.stop()
            comments.stop()
        }
    }

    // MARK: Sections

    private func header(_ initiative: Initiative) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            if let project = store.project {
                Button {
                    model.router.pop()
                } label: {
                    PFEyebrow(project.title)
                }
                .buttonStyle(.plain)
            }
            Text(initiative.title).pfText(.title).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 6) {
                PFPill(initiative.statusLabel, tone: .status(initiative.tone))
                if let health = initiative.health {
                    PFPill(health.label, tone: health.tone) { PFDot(health.dot, size: 7) }
                }
                if let priority = initiative.priority {
                    PFPill(priority.label) { PFPrioritySignal(priority) }
                }
                if let due = initiative.dueDate {
                    PFPill(Formatting.shortDate(due), tone: .severity(Formatting.severity(due: due, isDone: initiative.isDone)))
                }
            }
            if let summary = initiative.summary, !summary.isEmpty {
                RichTextView(html: summary)
                    .padding(.top, 4)
            }
            let people = initiative.assigneeIds.compactMap { model.workspace?.person($0) }
            if !people.isEmpty {
                HStack(spacing: PFSpace.xs) {
                    PFAvatarStack(people: people.map { ($0.id, $0.displayName, $0.photoURL) }, size: 26, limit: 4)
                    Text(people.map(\.displayName).joined(separator: ", "))
                        .pfText(.meta)
                        .foregroundStyle(PFColor.textMuted)
                        .lineLimit(1)
                }
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, PFSpace.page)
    }

    private func metricCard(_ metric: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            PFEyebrow(L10n.t("projects.initiative.successMetric"))
            Text(metric).pfText(.body).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true)
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
        .padding(.horizontal, PFSpace.page)
    }

    @ViewBuilder private var progressCard: some View {
        if !tasks.isEmpty {
            let done = tasks.filter(\.isCompleted).count
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    PFEyebrow(L10n.t("projects.initiative.progress"))
                    Spacer()
                    Text("\(done)/\(tasks.count)").pfText(.number).foregroundStyle(PFColor.textMuted)
                }
                PFProgressBar(value: Double(done) / Double(tasks.count), height: 6)
            }
            .padding(PFSpace.m)
            .pfCard()
            .padding(.horizontal, PFSpace.page)
        }
    }

    private func tasksSection(_ initiative: Initiative) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(L10n.t("projects.initiative.tasks"))
                    .pfText(.section)
                    .foregroundStyle(PFColor.textMain)
                Spacer(minLength: 0)
                if access.canManage {
                    PFButton(L10n.t("planning.initiative.attach"), systemImage: "checklist", kind: .ghost, size: .small) {
                        InitiativeManagement(model: model, store: store, initiative: initiative).presentAttach()
                    }
                }
            }
            .padding(.horizontal, PFSpace.page)
            if access.canEditTasks {
                PFTextField(L10n.t("projects.addTask"), text: $newTaskTitle, systemImage: "plus", onSubmit: addTask)
                    .padding(.horizontal, PFSpace.page)
                    .padding(.top, PFSpace.s)
            }
            if tasks.isEmpty {
                Text(L10n.t("projects.initiative.noTasks"))
                    .pfText(.meta)
                    .foregroundStyle(PFColor.textMuted)
                    .padding(.horizontal, PFSpace.page)
                    .padding(.top, PFSpace.s)
            } else {
                ProjectTaskList(tasks: tasks, grouping: .status, initiatives: store.initiatives)
            }
        }
    }

    // MARK: Actions

    private func presentMenu() {
        let url = ProjectLinks.initiative(projectId: projectId, id: initiativeId)
        var items: [ActionSheet.Item] = [
            .init(title: L10n.t("common.copyLink"), systemImage: "link") { ProjectsClipboard.copy(url, model: model) },
            .init(title: L10n.t("common.openInWeb"), systemImage: "safari") { ProjectsClipboard.open(url) },
        ]
        if access.canManage, let initiative {
            items = InitiativeManagement(model: model, store: store, initiative: initiative).items() + items
        }
        presenter.present(detents: [.fit]) { ActionSheet(title: initiative?.title, items: items) }
    }

    private func addTask() {
        let title = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, let actions = model.actions else { return }
        newTaskTitle = ""
        Task {
            await model.perform { _ = try await actions.createTask(projectId: projectId, title: title, initiativeId: initiativeId) }
            PFHaptics.success()
        }
    }

    private var loading: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            Color.clear.frame(height: 60)
            PFSkeleton(height: 12, radius: 4).frame(width: 120)
            PFSkeleton(height: 30, radius: 6).frame(width: 240)
            PFSkeleton(height: 90, radius: PFRadius.card)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.xl)
        .frame(maxHeight: .infinity, alignment: .top)
    }
}
