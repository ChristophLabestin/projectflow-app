import SwiftUI

struct ProjectOverviewView: View {
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    let tenantId: String?
    @StateObject private var store = ProjectOverviewStore()

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text(project.title)
                        .font(.largeTitle)
                        .foregroundStyle(colors.textMain)

                    Text(project.description.isEmpty ? "No description yet." : project.description)
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)

                    StatusPill(text: project.status)
                }

                if let tenantId {
                    if store.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    }

                    LazyVGrid(columns: columns, spacing: PFSpacing.md) {
                        SummaryCard(title: "Tasks", value: store.tasks.count)
                        SummaryCard(title: "Flows", value: store.flows.count)
                        SummaryCard(title: "Issues", value: store.issues.count)
                        SummaryCard(title: "Activity", value: store.activity.count)
                    }

                    sectionCard(title: "Recent Activity", emptyMessage: "No activity yet.") {
                        ForEach(store.activity.prefix(6)) { item in
                            ActivityRow(item: item)
                        }
                    }

                    sectionCard(title: "Latest Tasks", emptyMessage: "No tasks yet.") {
                        ForEach(recent(items: store.tasks)) { task in
                            OverviewRow(title: task.title, detail: task.status.isEmpty ? "Open" : task.status)
                        }
                    }

                    sectionCard(title: "Latest Flows", emptyMessage: "No flows yet.") {
                        ForEach(recent(items: store.flows)) { flow in
                            OverviewRow(title: flow.title, detail: flow.stage)
                        }
                    }

                    sectionCard(title: "Latest Issues", emptyMessage: "No issues yet.") {
                        ForEach(recent(items: store.issues)) { issue in
                            OverviewRow(title: issue.title, detail: issue.status)
                        }
                    }
                } else {
                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("Select a workspace to view project data.")
                                .font(.headline)
                                .foregroundStyle(colors.textMain)
                            Text("We could not resolve an active tenant for this session.")
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                }
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
        .onAppear {
            guard let tenantId else { return }
            store.start(tenantId: tenantId, projectId: project.id)
        }
        .onDisappear {
            store.stop()
        }
    }

    private func recent<T: Identifiable>(items: [T]) -> [T] {
        Array(items.prefix(4))
    }

    private func sectionCard<Content: View>(
        title: String,
        emptyMessage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: title)
                if isEmptySection(title: title) {
                    Text(emptyMessage)
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        content()
                    }
                }
            }
        }
    }

    private func isEmptySection(title: String) -> Bool {
        switch title {
        case "Recent Activity":
            return store.activity.isEmpty
        case "Latest Tasks":
            return store.tasks.isEmpty
        case "Latest Flows":
            return store.flows.isEmpty
        case "Latest Issues":
            return store.issues.isEmpty
        default:
            return true
        }
    }
}

private struct SummaryCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: Int

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text(title.uppercased())
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
                Text("\(value)")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)
            }
        }
    }
}

private struct StatusPill: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(colors.textMain)
            .padding(.horizontal, PFSpacing.sm)
            .padding(.vertical, 4)
            .background(colors.surfaceCard)
            .clipShape(Capsule())
    }
}

private struct OverviewRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let detail: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMain)
                .lineLimit(1)

            Spacer()

            Text(detail)
                .font(.caption)
                .foregroundStyle(colors.textMuted)
        }
    }
}

private struct ActivityRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let item: ActivityItem

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text(item.action.isEmpty ? "Activity update" : item.action)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMain)

            Text(item.details.isEmpty ? item.target : item.details)
                .font(.caption)
                .foregroundStyle(colors.textMuted)
        }
    }
}
