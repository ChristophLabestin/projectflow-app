import SwiftUI
import PFModel
import PFSnapshot

// Placeholder screens for the Today feature. Replace them with the real screens and delete this file.

struct TodayScreen: View { var body: some View { PlaceholderScreen(title: "Heute") } }

@MainActor
enum TodaySnapshotBuilder {
    static func build(model: AppModel) -> TodaySnapshot? { nil }
}
