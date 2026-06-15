import SwiftUI
import FirebaseAuth

// MARK: - PersonalTasksView — Companion V2 (embedded in WorkView)

struct PersonalTasksView: View {
    @ObservedObject var store: PersonalTasksStore
    @EnvironmentObject private var session: AppSession
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Group {
            if store.isLoading && store.tasks.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.tasks.isEmpty {
                ScrollView {
                    PFEmptyState(
                        icon: "person.crop.circle",
                        title: L10n.tr("work.empty.personal", fallback: "No personal tasks"),
                        message: L10n.tr("work.empty.personal.message", fallback: "Capture quick personal to-dos here.")
                    )
                    .padding(.top, PFSpacing.xl)
                }
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: PFSpacing.sm) {
                        ForEach(store.tasks, id: \.id) { task in
                            NavigationLink {
                                PersonalTaskDetailView(task: task, store: store)
                            } label: {
                                PFCard {
                                    HStack(spacing: PFSpacing.md) {
                                        Button { Task { await toggle(task) } } label: {
                                            Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                                                .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
                                                .font(.title3)
                                        }
                                        .buttonStyle(.plain)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(task.title)
                                                .font(PFFont.rowTitle)
                                                .foregroundStyle(task.isCompleted ? colors.textMuted : colors.textMain)
                                                .strikethrough(task.isCompleted)
                                                .lineLimit(1)
                                            if let source = task.source, !source.isEmpty {
                                                Text(source)
                                                    .font(PFFont.detail)
                                                    .foregroundStyle(colors.textMuted)
                                                    .lineLimit(1)
                                            }
                                        }
                                        Spacer(minLength: 0)
                                        if !task.priority.isEmpty { PFPriorityChip(priority: task.priority) }
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .pfScreenPadding(vertical: PFSpacing.md)
                    .pfTabBarClearance()
                    .tabBarScrollShrink()
                }
            }
        }
    }

    private func toggle(_ task: PersonalTask) async {
        guard let tenantId = session.activeTenantId else { return }
        let next = !task.isCompleted
        try? await store.update(tenantId: tenantId, taskId: task.id, updates: ["isCompleted": next, "status": next ? "Done" : "Open"])
    }
}

struct PersonalTaskDetailView: View {
    let task: PersonalTask
    @ObservedObject var store: PersonalTasksStore
    @EnvironmentObject private var session: AppSession
    @State private var title: String
    @State private var description: String
    @State private var isCompleted: Bool
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(task: PersonalTask, store: PersonalTasksStore) {
        self.task = task
        self.store = store
        _title = State(initialValue: task.title)
        _description = State(initialValue: task.description)
        _isCompleted = State(initialValue: task.isCompleted)
    }

    var body: some View {
        Form {
            Toggle(L10n.tr("work.completed", fallback: "Completed"), isOn: $isCompleted)
                .onChange(of: isCompleted) { _, value in
                    Task { await save(["isCompleted": value, "status": value ? "Done" : "Open"]) }
                }
            TextField(L10n.tr("quickCreate.titlePlaceholder", fallback: "Title"), text: $title)
                .onSubmit { Task { await save(["title": title]) } }
            TextField(L10n.tr("quickCreate.descriptionPlaceholder", fallback: "Description"), text: $description, axis: .vertical)
                .lineLimit(3...8)
                .onSubmit { Task { await save(["description": description]) } }
        }
        .navigationTitle(L10n.tr("quickCreate.type.personal", fallback: "Personal"))
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { focusTask() } label: { Text(L10n.tr("tabs.focus", fallback: "Focus")) }
                Button { pinTask() } label: {
                    Image(systemName: session.pinnedTasksStore.isPinned(task.id) ? "pin.fill" : "pin")
                }
            }
        }
    }

    private func save(_ updates: [String: Any]) async {
        guard let tenantId = session.activeTenantId else { return }
        try? await store.update(tenantId: tenantId, taskId: task.id, updates: updates)
    }

    private func pinTask() {
        guard let tenantId = session.activeTenantId else { return }
        let item = PinnedItem(
            id: task.id,
            type: FocusItemType.personalTask.rawValue,
            title: title,
            projectId: "",
            tenantId: tenantId,
            priority: task.priority,
            isCompleted: isCompleted
        )
        if session.pinnedTasksStore.isPinned(task.id) {
            session.pinnedTasksStore.unpin(itemId: task.id)
        } else {
            session.pinnedTasksStore.pin(item: item)
        }
    }

    private func focusTask() {
        guard let tenantId = session.activeTenantId else { return }
        let item = PinnedItem(
            id: task.id,
            type: FocusItemType.personalTask.rawValue,
            title: title,
            projectId: "",
            tenantId: tenantId,
            priority: task.priority,
            isCompleted: isCompleted
        )
        session.pinnedTasksStore.startFocus(item: item)
    }
}
