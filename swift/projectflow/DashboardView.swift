import SwiftUI
import FirebaseAuth

struct DashboardView: View {
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var store = DashboardStore()
    @StateObject private var pinnedProjectStore = PinnedProjectStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text("Dashboard")
                    .font(.largeTitle)
                    .foregroundStyle(colors.textMain)

                if store.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                }

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        PFSectionHeader(title: "Pinned Project")
                        if let project = pinnedProjectStore.pinnedProject {
                            HStack {
                                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                                    Text(project.title)
                                        .font(.headline)
                                        .foregroundStyle(colors.textMain)
                                    Text(project.status)
                                        .font(.caption)
                                        .foregroundStyle(colors.textMuted)
                                }

                                Spacer()

                                if let user = Auth.auth().currentUser,
                                   let tenantId = TenantResolver.resolveTenantId(for: user) {
                                    Button {
                                        pinnedProjectStore.unpin(tenantId: tenantId)
                                    } label: {
                                        Image(systemName: "pin.slash")
                                            .font(.caption)
                                            .foregroundStyle(colors.textMuted)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        } else {
                            Text("No project pinned yet.")
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                }

                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        PFSectionHeader(title: "Pinned Tasks")
                        if pinnedTasksStore.pinnedItems.isEmpty {
                            Text("No pinned tasks yet.")
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                        } else {
                            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                                ForEach(pinnedTasksStore.pinnedItems.prefix(4)) { item in
                                    HStack {
                                        Text(item.title)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(colors.textMain)
                                            .lineLimit(1)

                                        Spacer()

                                        Text(item.type.capitalized)
                                            .font(.caption)
                                            .foregroundStyle(colors.textMuted)

                                        Button {
                                            pinnedTasksStore.unpin(itemId: item.id)
                                        } label: {
                                            Image(systemName: "pin.slash")
                                                .font(.caption)
                                                .foregroundStyle(colors.textMuted)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }

                LazyVGrid(columns: columns, spacing: PFSpacing.md) {
                    MetricCard(
                        title: "Projects",
                        value: "\(store.projectCount)",
                        detail: "Workspace projects",
                        icon: "square.stack.3d.down.forward"
                    )

                    MetricCard(
                        title: "Tasks",
                        value: "\(store.taskCount)",
                        detail: "\(store.openTaskCount) open",
                        icon: "checklist"
                    )

                    MetricCard(
                        title: "Issues",
                        value: "\(store.issueCount)",
                        detail: "\(store.openIssueCount) open",
                        icon: "exclamationmark.bubble"
                    )

                    MetricCard(
                        title: "Flows",
                        value: "\(store.flowCount)",
                        detail: "Active ideas",
                        icon: "sparkles"
                    )
                }

                recentCard(
                    title: "Recent Tasks",
                    emptyMessage: "No tasks yet.",
                    rows: store.recentTasks.map { task in
                        DashboardRow(title: task.title, detail: task.status.isEmpty ? "Open" : task.status)
                    }
                )

                recentCard(
                    title: "Recent Issues",
                    emptyMessage: "No issues yet.",
                    rows: store.recentIssues.map { issue in
                        DashboardRow(title: issue.title, detail: issue.status)
                    }
                )

                recentCard(
                    title: "Recent Flows",
                    emptyMessage: "No flows yet.",
                    rows: store.recentFlows.map { flow in
                        DashboardRow(title: flow.title, detail: flow.stage)
                    }
                )
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
        .onAppear {
            store.start()
            pinnedTasksStore.start()
            if let user = Auth.auth().currentUser,
               let tenantId = TenantResolver.resolveTenantId(for: user) {
                pinnedProjectStore.start(tenantId: tenantId)
            }
        }
        .onDisappear {
            store.stop()
            pinnedProjectStore.stop()
            pinnedTasksStore.stop()
        }
    }
}

private struct MetricCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String
    let detail: String
    let icon: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                HStack(spacing: PFSpacing.xs) {
                    Image(systemName: icon)
                        .foregroundStyle(colors.primary)
                    Text(title.uppercased())
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(colors.textMuted)
                }

                Text(value)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(colors.textMuted)
            }
        }
    }
}

private struct DashboardRow: Identifiable {
    let id = UUID()
    let title: String
    let detail: String
}

private extension DashboardView {
    func recentCard(title: String, emptyMessage: String, rows: [DashboardRow]) -> some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: title)

                if rows.isEmpty {
                    Text(emptyMessage)
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        ForEach(rows) { row in
                            HStack {
                                Text(row.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(colors.textMain)
                                    .lineLimit(1)

                                Spacer()

                                Text(row.detail)
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                    }
                }
            }
        }
    }
}
