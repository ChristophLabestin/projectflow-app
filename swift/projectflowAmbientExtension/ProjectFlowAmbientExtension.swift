import SwiftUI
import WidgetKit

#if canImport(ActivityKit)
import ActivityKit
#endif

@main
struct ProjectFlowAmbientBundle: WidgetBundle {
    var body: some Widget {
        ProjectFlowFocusWidget()
        ProjectFlowTodayWidget()
        if #available(iOS 16.1, *) {
            ProjectFlowFocusLiveActivity()
        }
    }
}

struct ProjectFlowFocusEntry: TimelineEntry {
    let date: Date
    let snapshot: ProjectFlowAmbientFocusSnapshot
}

struct ProjectFlowFocusProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProjectFlowFocusEntry {
        ProjectFlowFocusEntry(date: Date(), snapshot: ProjectFlowAmbientFocusSnapshot(
            itemId: "placeholder",
            itemType: "task",
            title: "Ship the current focus",
            status: "active"
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (ProjectFlowFocusEntry) -> Void) {
        completion(ProjectFlowFocusEntry(date: Date(), snapshot: ProjectFlowAmbientSnapshotStore.readFocusSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProjectFlowFocusEntry>) -> Void) {
        let entry = ProjectFlowFocusEntry(date: Date(), snapshot: ProjectFlowAmbientSnapshotStore.readFocusSnapshot())
        let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

struct ProjectFlowFocusWidget: Widget {
    let kind = "ProjectFlowFocusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProjectFlowFocusProvider()) { entry in
            ProjectFlowFocusWidgetView(entry: entry)
        }
        .configurationDisplayName("ProjectFlow Focus")
        .description("Keep the current focus visible from the Home Screen.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

struct ProjectFlowTodayWidget: Widget {
    let kind = "ProjectFlowTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProjectFlowFocusProvider()) { entry in
            ProjectFlowTodayWidgetView(entry: entry)
        }
        .configurationDisplayName("ProjectFlow Today")
        .description("Resume ProjectFlow from your current focus.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

private struct ProjectFlowFocusWidgetView: View {
    let entry: ProjectFlowFocusEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if family == .accessoryInline {
            Text(entry.snapshot.isEmpty ? "ProjectFlow: no focus" : "ProjectFlow: \(entry.snapshot.title)")
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Label(entry.snapshot.statusLabel, systemImage: iconName)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(tintColor)

                Text(entry.snapshot.title)
                    .font(family == .systemSmall ? .headline : .title3.weight(.semibold))
                    .lineLimit(family == .systemSmall ? 3 : 2)
                    .foregroundStyle(.primary)

                Spacer(minLength: 0)

                if !entry.snapshot.isEmpty {
                    Text(entry.snapshot.itemType.capitalized)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }
            .containerBackground(.background, for: .widget)
        }
    }

    private var iconName: String {
        switch entry.snapshot.status {
        case "blocked":
            return "xmark.octagon.fill"
        case "snoozed":
            return "zzz"
        case "active":
            return "scope"
        default:
            return "checklist"
        }
    }

    private var tintColor: Color {
        switch entry.snapshot.status {
        case "blocked":
            return .red
        case "snoozed":
            return .secondary
        case "active":
            return .blue
        default:
            return .secondary
        }
    }
}

private struct ProjectFlowTodayWidgetView: View {
    let entry: ProjectFlowFocusEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("ProjectFlow Today", systemImage: "rectangle.grid.2x2")
                    .font(.headline)
                Spacer()
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(entry.snapshot.statusLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(entry.snapshot.title)
                    .font(.title3.weight(.semibold))
                    .lineLimit(3)
            }

            Spacer(minLength: 0)

            Text(entry.snapshot.isEmpty ? "Open the app to pick a focus." : "Tap to resume.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .containerBackground(.background, for: .widget)
    }
}

#if canImport(ActivityKit)
@available(iOS 16.1, *)
struct ProjectFlowFocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ProjectFlowFocusActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                Label(label(for: context.state.status), systemImage: icon(for: context.state.status))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(color(for: context.state.status))

                Text(context.state.title)
                    .font(.headline)
                    .lineLimit(2)
            }
            .padding()
            .activityBackgroundTint(.black.opacity(0.85))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: icon(for: context.state.status))
                        .foregroundStyle(color(for: context.state.status))
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(label(for: context.state.status))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "scope")
            } compactTrailing: {
                Text(shortStatus(for: context.state.status))
            } minimal: {
                Image(systemName: "scope")
            }
        }
    }

    private func label(for status: String) -> String {
        switch status {
        case "snoozed":
            return "Snoozed Focus"
        case "blocked":
            return "Blocked Focus"
        default:
            return "Current Focus"
        }
    }

    private func shortStatus(for status: String) -> String {
        switch status {
        case "snoozed":
            return "Zz"
        case "blocked":
            return "!"
        default:
            return "Go"
        }
    }

    private func icon(for status: String) -> String {
        switch status {
        case "snoozed":
            return "zzz"
        case "blocked":
            return "xmark.octagon.fill"
        default:
            return "scope"
        }
    }

    private func color(for status: String) -> Color {
        switch status {
        case "blocked":
            return .red
        case "snoozed":
            return .secondary
        default:
            return .blue
        }
    }
}
#endif
