import ActivityKit
import SwiftUI
import WidgetKit
import PFDesign
import PFSnapshot

/// Focus Live Activity + Dynamic Island. Content state and attributes are a backend contract (C5).
struct FocusLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusActivityAttributes.self) { context in
            FocusActivityLockScreenView(state: context.state, strings: WidgetLanguage.strings)
                .activityBackgroundTint(PFColor.card)
                .activitySystemActionForegroundColor(PFColor.textMain)
                .widgetURL(link(context))
        } dynamicIsland: { context in
            let strings = WidgetLanguage.strings
            let state = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        FocusStatusDot(status: state.status)
                        WidgetEyebrow(text: focusEyebrow(status: state.status, strings: strings),
                                      color: state.isBlocked ? PFColor.dangerText : PFColor.textMuted)
                    }
                    .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    FocusActivityClock(state: state, strings: strings, size: 20)
                        .frame(width: 96)
                        .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.center) {
                    FocusIslandTitle(state: state).padding(.horizontal, 6)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    FocusActionButtons(status: state.status, strings: strings)
                        .padding(.top, 4)
                }
            } compactLeading: {
                FocusIslandCompactLeading(state: state)
            } compactTrailing: {
                FocusIslandCompactTrailing(state: state, strings: strings)
            } minimal: {
                FocusStatusDot(status: state.status)
            }
            .keylineTint(state.isBlocked ? PFColor.danger : PFColor.textMain)
            .widgetURL(link(context))
        }
    }

    private func link(_ context: ActivityViewContext<FocusActivityAttributes>) -> URL {
        let attributes = context.attributes
        return PFLink.focusItem(itemId: attributes.itemId, itemType: attributes.itemType,
                                tenantId: attributes.tenantId, projectId: attributes.projectId)
    }
}
