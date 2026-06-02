import SwiftUI
import FirebaseAuth

struct PersonalTasksView: View {
    @ObservedObject var store: PersonalTasksStore
    @EnvironmentObject private var session: AppSession
    @State private var showCreate = false
    @State private var newTitle = ""
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Group {
            if store.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.tasks.isEmpty {
                ContentUnavailableView("No Personal Tasks", systemImage: "person.crop.circle", description: Text("Capture tasks from the share sheet or add one here."))
            } else {
                List(store.tasks, id: \.id) { task in
                    NavigationLink {
                        PersonalTaskDetailView(task: task, store: store)
                    } label: {
                        HStack {
                            Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
                            VStack(alignment: .leading) {
                                Text(task.title).strikethrough(task.isCompleted)
                                if let source = task.source, !source.isEmpty {
                                    Text(source).font(.caption).foregroundStyle(colors.textMuted)
                                }
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showCreate = true } label: { Image(systemName: "plus") }
            }
        }
        .alert("New Personal Task", isPresented: $showCreate) {
            TextField("Title", text: $newTitle)
            Button("Cancel", role: .cancel) { newTitle = "" }
            Button("Add") { Task { await createTask() } }
        }
    }

    private func createTask() async {
        guard let tenantId = session.activeTenantId else { return }
        let title = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        var task = PersonalTask(id: "", data: [:])
        task.title = title
        task.ownerId = Auth.auth().currentUser?.uid ?? ""
        _ = try? await store.create(tenantId: tenantId, task: task)
        newTitle = ""
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
            Toggle("Completed", isOn: $isCompleted)
                .onChange(of: isCompleted) { _, value in
                    Task { await save(["isCompleted": value, "status": value ? "Done" : "Open"]) }
                }
            TextField("Title", text: $title)
                .onSubmit { Task { await save(["title": title]) } }
            TextField("Description", text: $description, axis: .vertical)
                .lineLimit(3...8)
                .onSubmit { Task { await save(["description": description]) } }
        }
        .navigationTitle("Personal Task")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { focusTask() } label: { Text("Focus") }
                Button {
                    pinTask()
                } label: {
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
