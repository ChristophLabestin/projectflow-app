import SwiftUI
import WidgetKit
import PFDesign
import PFSnapshot

@main
struct ProjectFlowWidgetBundle: WidgetBundle {
    init() {
        PFFont.registerIfNeeded()
    }

    var body: some Widget {
        TodayWidget()
        FocusWidget()
        FocusLiveActivityWidget()
        CaptureControl()
        FocusToggleControl()
    }
}

// MARK: - Heute

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: .now, snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        completion(TodayEntry(date: .now, snapshot: context.isPreview ? .preview : WidgetSnapshot.current()))
    }

    /// The app rewrites the snapshot and reloads timelines whenever work changes. On top of that the widget
    /// re-reads every 30 minutes and flips to a "new day" state at midnight (the plan is recomputed by the app).
    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date.now
        let snapshot = WidgetSnapshot.current()
        var entries = [TodayEntry(date: now, snapshot: snapshot)]
        let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0, second: 5), matchingPolicy: .nextTime)
        if let midnight, midnight.timeIntervalSince(now) < 86_400 {
            entries.append(TodayEntry(date: midnight, snapshot: snapshot))
        }
        let refresh = min(now.addingTimeInterval(1800), midnight ?? now.addingTimeInterval(1800))
        completion(Timeline(entries: entries, policy: .after(refresh)))
    }
}

struct TodayWidget: Widget {
    static let kind = "de.christophlabestin.projectflow.widget.today"

    var body: some WidgetConfiguration {
        let strings = ExtensionStrings()
        return StaticConfiguration(kind: Self.kind, provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName(strings.t("w.today.name"))
        .description(strings.t("w.today.description"))
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}

// MARK: - Fokus

struct FocusProvider: TimelineProvider {
    func placeholder(in context: Context) -> FocusEntry {
        FocusEntry(date: .now, snapshot: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (FocusEntry) -> Void) {
        completion(FocusEntry(date: .now, snapshot: context.isPreview ? .preview : WidgetSnapshot.current()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FocusEntry>) -> Void) {
        let now = Date.now
        let entry = FocusEntry(date: now, snapshot: WidgetSnapshot.current())
        completion(Timeline(entries: [entry], policy: .after(now.addingTimeInterval(1800))))
    }
}

struct FocusWidget: Widget {
    static let kind = "de.christophlabestin.projectflow.widget.focus"

    var body: some WidgetConfiguration {
        let strings = ExtensionStrings()
        return StaticConfiguration(kind: Self.kind, provider: FocusProvider()) { entry in
            FocusWidgetView(entry: entry)
        }
        .configurationDisplayName(strings.t("w.focus.name"))
        .description(strings.t("w.focus.description"))
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
