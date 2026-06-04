import SwiftUI

struct InitiativesProjectListView: View {
    let tenantId: String
    let projectId: String
    let permissions: PermissionContext

    @StateObject private var store = InitiativesStore()
    @State private var showCreate = false
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text("Initiatives").font(.headline)
                Spacer()
                if PermissionEvaluator(context: permissions).allows(PermissionNode.initiativesCreate) {
                    Button("Add") { showCreate = true }
                        .font(.caption.weight(.semibold))
                }
            }
            if store.initiatives.isEmpty {
                Text("No initiatives yet.").font(.subheadline).foregroundStyle(colors.textMuted)
            } else {
                ForEach(store.initiatives, id: \.id) { initiative in
                    NavigationLink {
                        ProjectInitiativeDetailView(initiative: initiative, tenantId: tenantId, permissions: permissions)
                    } label: {
                        Text(initiative.title).font(.subheadline)
                    }
                }
            }
        }
        .padding(.horizontal, PFSpacing.md)
        .onAppear { store.listenProject(tenantId: tenantId, projectId: projectId) }
        .onDisappear { store.stop() }
        .sheet(isPresented: $showCreate) {
            InitiativeEditorView(tenantId: tenantId, projectId: projectId, initiative: nil, permissions: permissions)
        }
    }
}

struct ProjectTaskListEmbed: View {
    let tenantId: String
    let projectId: String
    let tasks: [ProjectTask]
    let permissions: PermissionContext

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            Text("Tasks").font(.headline).padding(.horizontal, PFSpacing.md)
            ForEach(tasks, id: \.id) { task in
                NavigationLink {
                    ProjectTaskDetailView(task: task, tenantId: tenantId, permissions: permissions)
                } label: {
                    Text(task.title).font(.subheadline).padding(.horizontal, PFSpacing.md)
                }
            }
        }
    }
}

