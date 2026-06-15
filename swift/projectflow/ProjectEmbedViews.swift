import SwiftUI

// MARK: - Embedded module lists for the project detail page (Companion V2)
//
// These render INSIDE the project overview's ScrollView, so they use plain
// VStacks (never List/Form, which collapse to zero height inside a ScrollView).

struct InitiativesProjectListView: View {
    let tenantId: String
    let projectId: String
    let permissions: PermissionContext

    @StateObject private var store = InitiativesStore()
    @State private var showCreate = false
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var canCreate: Bool { PermissionEvaluator(context: permissions).allows(PermissionNode.initiativesCreate) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(
                title: L10n.tr("work.initiatives", fallback: "Initiatives"),
                actionTitle: canCreate ? L10n.tr("common.add", fallback: "Add") : nil,
                action: canCreate ? { showCreate = true } : nil
            )
            if store.initiatives.isEmpty {
                PFCard { PFEmptyState(icon: "flag", title: L10n.tr("work.empty.initiatives", fallback: "No initiatives yet")) }
            } else {
                VStack(spacing: PFSpacing.sm) {
                    ForEach(store.initiatives, id: \.id) { initiative in
                        NavigationLink {
                            ProjectInitiativeDetailView(initiative: initiative, tenantId: tenantId, permissions: permissions)
                        } label: {
                            PFCard {
                                PFListRow(
                                    title: initiative.title,
                                    subtitle: initiative.status,
                                    icon: "flag",
                                    iconTint: PFSemantic.healthTint(initiative.health, colors: colors)
                                ) {
                                    if !initiative.priority.isEmpty { PFPriorityChip(priority: initiative.priority) }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .onAppear { store.listenProject(tenantId: tenantId, projectId: projectId) }
        .onDisappear { store.stop() }
        .sheet(isPresented: $showCreate) {
            InitiativeEditorView(tenantId: tenantId, projectId: projectId, initiative: nil, permissions: permissions)
        }
    }
}

struct ProjectTaskListEmbed: View {
    let project: Project
    let tenantId: String
    let tasks: [ProjectTask]
    let permissions: PermissionContext

    @StateObject private var tasksStore = TasksStore()
    @State private var showCreate = false
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var canCreate: Bool { PermissionEvaluator(context: permissions).allows(PermissionNode.tasksCreate) }

    private var sortedTasks: [ProjectTask] {
        tasks.sorted { a, b in
            if a.isCompleted != b.isCompleted { return !a.isCompleted }
            if a.dueDate.isEmpty != b.dueDate.isEmpty { return !a.dueDate.isEmpty }
            return a.dueDate < b.dueDate
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(
                title: L10n.tr("work.tasks", fallback: "Tasks"),
                actionTitle: canCreate ? L10n.tr("common.add", fallback: "Add") : nil,
                action: canCreate ? { showCreate = true } : nil
            )
            if tasks.isEmpty {
                PFCard { PFEmptyState(icon: "checklist", title: L10n.tr("work.empty.tasks", fallback: "No tasks yet")) }
            } else {
                VStack(spacing: PFSpacing.sm) {
                    ForEach(sortedTasks, id: \.id) { task in
                        taskRow(task)
                    }
                }
            }
        }
        .sheet(isPresented: $showCreate) {
            QuickCreateSheet(
                tenantId: tenantId,
                projects: [project],
                defaultProjectId: project.id,
                initialType: .task,
                permissions: permissions
            )
        }
    }

    private func taskRow(_ task: ProjectTask) -> some View {
        PFCard {
            HStack(spacing: PFSpacing.md) {
                Button {
                    Task { await tasksStore.toggleComplete(tenantId: tenantId, projectId: project.id, task: task, permissions: permissions) }
                } label: {
                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
                        .font(.title3)
                }
                .buttonStyle(.plain)

                NavigationLink {
                    ProjectTaskDetailView(task: task, tenantId: tenantId, permissions: permissions)
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(task.title)
                            .font(PFFont.rowTitle)
                            .foregroundStyle(task.isCompleted ? colors.textMuted : colors.textMain)
                            .strikethrough(task.isCompleted)
                            .lineLimit(2)
                        HStack(spacing: PFSpacing.xs) {
                            PFStatusChip(status: task.status)
                            if !task.priority.isEmpty { PFPriorityChip(priority: task.priority) }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(colors.textSubtle)
            }
        }
    }
}
