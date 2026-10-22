import SwiftUI
import WidgetKit

@main
struct ProjectFlowWidgetBundle: WidgetBundle {
    var body: some Widget {
        PlaceholderWidget()
    }
}

struct PlaceholderWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "placeholder", provider: PlaceholderProvider()) { _ in Text("ProjectFlow") }
    }
}

struct PlaceholderProvider: TimelineProvider {
    struct Entry: TimelineEntry { let date: Date }
    func placeholder(in context: Context) -> Entry { Entry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: .now)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        completion(Timeline(entries: [Entry(date: .now)], policy: .never))
    }
}
