import SwiftUI
import FirebaseAuth

struct ProjectInitiativeDetailView: View {
    let initiative: Initiative
    let tenantId: String
    let permissions: PermissionContext

    @EnvironmentObject private var session: AppSession
    @StateObject private var tasksStore = TasksStore()
    @StateObject private var commentsStore = CommentsStore()
    @State private var childTasks: [ProjectTask] = []
    @State private var showEditor = false
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                heroSection
                if !initiative.description.isEmpty {
                    PFCard {
                        Text(initiative.description).font(.body).foregroundStyle(colors.textMain)
                    }
                }
                childTasksSection
                CommentsSection(
                    tenantId: tenantId,
                    projectId: initiative.projectId,
                    targetId: initiative.id,
                    targetType: CommentTargetType.initiative.rawValue,
                    permissions: permissions,
                    store: commentsStore
                )
            }
            .padding(.horizontal, PFSpacing.md)
            .padding(.bottom, PFSpacing.xl)
        }
        .background(AppBackground())
        .navigationTitle(initiative.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    pinInitiative()
                } label: {
                    Image(systemName: session.pinnedTasksStore.isPinned(initiative.id) ? "pin.fill" : "pin")
                }
                Button("Focus") { focusInitiative() }
                if PermissionEvaluator(context: permissions).allows(PermissionNode.initiativesEdit) {
                    Button("Edit") { showEditor = true }
                }
            }
        }
        .sheet(isPresented: $showEditor) {
            InitiativeEditorView(
                tenantId: tenantId,
                projectId: initiative.projectId,
                initiative: initiative,
                permissions: permissions
            )
        }
        .onAppear {
            tasksStore.start(tenantId: tenantId, projectId: initiative.projectId)
            commentsStore.listen(
                tenantId: tenantId,
                projectId: initiative.projectId,
                targetId: initiative.id,
                targetType: CommentTargetType.initiative.rawValue
            )
        }
        .onDisappear { commentsStore.stop() }
        .onReceive(tasksStore.$tasks) { tasks in
            childTasks = tasks.filter { $0.initiativeId == initiative.id }
        }
    }

    private var heroSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text(initiative.status)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(colors.primaryFade)
                    .clipShape(Capsule())
                Text(initiative.health)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
                Spacer()
                Text(initiative.priority)
                    .font(.caption.weight(.medium))
            }
            if let form = initiative.feedbackForm, form.enabled, let url = URL(string: form.publicURL) {
                Link(destination: url) {
                    Label("Public feedback form", systemImage: "link")
                        .font(.caption)
                }
            }
        }
        .padding(.top, PFSpacing.sm)
    }

    private var childTasksSection: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                Text("Tasks").font(.headline)
                if childTasks.isEmpty {
                    Text("No linked tasks yet.").font(.subheadline).foregroundStyle(colors.textMuted)
                } else {
                    ForEach(childTasks, id: \.id) { task in
                        NavigationLink {
                            ProjectTaskDetailView(task: task, tenantId: tenantId, permissions: permissions)
                        } label: {
                            HStack {
                                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
                                Text(task.title).lineLimit(1)
                            }
                        }
                    }
                }
            }
        }
    }

    private func pinInitiative() {
        let item = PinnedItem(
            id: initiative.id,
            type: FocusItemType.initiative.rawValue,
            title: initiative.title,
            projectId: initiative.projectId,
            tenantId: tenantId,
            priority: initiative.priority,
            isCompleted: false
        )
        if session.pinnedTasksStore.isPinned(initiative.id) {
            session.pinnedTasksStore.unpin(itemId: initiative.id)
        } else {
            session.pinnedTasksStore.pin(item: item)
        }
    }

    private func focusInitiative() {
        let item = PinnedItem(
            id: initiative.id,
            type: FocusItemType.initiative.rawValue,
            title: initiative.title,
            projectId: initiative.projectId,
            tenantId: tenantId,
            priority: initiative.priority,
            isCompleted: false
        )
        session.pinnedTasksStore.startFocus(item: item)
    }
}

struct InitiativeEditorView: View {
    let tenantId: String
    let projectId: String
    var initiative: Initiative?
    let permissions: PermissionContext

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var status = "Open"
    @State private var priority = "Medium"
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                TextField("Title", text: $title)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(3...8)
                Picker("Status", selection: $status) {
                    Text("Open").tag("Open")
                    Text("In Progress").tag("In Progress")
                    Text("Done").tag("Done")
                    Text("Planning").tag("Planning")
                }
                Picker("Priority", selection: $priority) {
                    Text("Low").tag("Low")
                    Text("Medium").tag("Medium")
                    Text("High").tag("High")
                    Text("Urgent").tag("Urgent")
                }
            }
            .navigationTitle(initiative == nil ? "New Initiative" : "Edit Initiative")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save") { Task { await save() } }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .onAppear {
                if let initiative {
                    title = initiative.title
                    description = initiative.description
                    status = initiative.status
                    priority = initiative.priority
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let store = InitiativesStore()
        let ownerId = Auth.auth().currentUser?.uid ?? ""
        do {
            if var existing = initiative {
                existing.title = title
                existing.description = description
                existing.status = status
                existing.priority = priority
                try await store.update(
                    tenantId: tenantId,
                    projectId: projectId,
                    initiativeId: existing.id,
                    updates: existing.data,
                    permissions: permissions
                )
            } else {
                var created = Initiative(id: "", data: [:])
                created.projectId = projectId
                created.tenantId = tenantId
                created.ownerId = ownerId
                created.title = title
                created.description = description
                created.status = status
                created.priority = priority
                _ = try await store.create(tenantId: tenantId, projectId: projectId, initiative: created, permissions: permissions)
            }
            dismiss()
        } catch {
            print("Initiative save failed: \(error)")
        }
    }
}
