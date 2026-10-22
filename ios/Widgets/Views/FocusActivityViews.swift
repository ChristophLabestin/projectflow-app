import AppIntents
import SwiftUI
import WidgetKit
import PFDesign
import PFModel

// Focus Live Activity: lock screen / banner view and the Dynamic Island regions (contract C5 content state).

extension FocusActivityAttributes.ContentState {
    var startDate: Date { Date(timeIntervalSince1970: startedAt) }
    var snoozeEnd: Date? { snoozedUntil.map { Date(timeIntervalSince1970: $0) } }
    var isPaused: Bool { status == "snoozed" }
    var isBlocked: Bool { status == "blocked" }

    var detailLine: String? {
        var parts: [String] = []
        if let projectName, !projectName.isEmpty { parts.append(projectName) }
        if let nextStep, !nextStep.isEmpty { parts.append(nextStep) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

/// Elapsed time that counts up on its own (display only), or the pause end / blocked marker.
struct FocusActivityClock: View {
    let state: FocusActivityAttributes.ContentState
    let strings: ExtensionStrings
    var size: CGFloat = 26
    var alignment: Alignment = .trailing

    var body: some View {
        Group {
            if state.isPaused, let until = state.snoozeEnd {
                Text(strings.t("w.pausedUntil", ["time": strings.time(until)]))
                    .font(WidgetFont.row(size * 0.55))
                    .foregroundStyle(PFColor.textMuted)
            } else {
                Text(state.startDate, style: .timer)
                    .font(WidgetFont.display(size).monospacedDigit())
                    .foregroundStyle(PFColor.textMain)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .multilineTextAlignment(alignment == .trailing ? .trailing : .leading)
        .frame(maxWidth: .infinity, alignment: alignment)
    }
}

/// Lock screen and notification banner presentation.
struct FocusActivityLockScreenView: View {
    let state: FocusActivityAttributes.ContentState
    let strings: ExtensionStrings

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 8) {
                FocusStatusDot(status: state.status)
                WidgetEyebrow(text: focusEyebrow(status: state.status, strings: strings),
                              color: state.isBlocked ? PFColor.dangerText : PFColor.textMuted)
                FocusActivityClock(state: state, strings: strings, size: 24)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(state.title)
                    .font(WidgetFont.display(20))
                    .foregroundStyle(PFColor.textMain)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                if let detail = state.detailLine {
                    Text(detail).font(WidgetFont.meta(13)).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
            }
            FocusActionButtons(status: state.status, strings: strings)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Dynamic Island

struct FocusIslandCompactLeading: View {
    let state: FocusActivityAttributes.ContentState

    var body: some View {
        FocusStatusDot(status: state.status).padding(.leading, 4)
    }
}

struct FocusIslandCompactTrailing: View {
    let state: FocusActivityAttributes.ContentState
    let strings: ExtensionStrings

    var body: some View {
        Group {
            if state.isPaused {
                Image(systemName: "pause.fill").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textMuted)
            } else {
                Text(state.startDate, style: .timer)
                    .font(.system(size: 13, weight: .semibold).monospacedDigit())
                    .foregroundStyle(PFColor.textMain)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 52, alignment: .trailing)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

/// Expanded island content: pieces are placed by `FocusLiveActivityWidget`.
struct FocusIslandTitle: View {
    let state: FocusActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(state.title)
                .font(WidgetFont.display(17))
                .foregroundStyle(PFColor.textMain)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            if let detail = state.detailLine {
                Text(detail).font(WidgetFont.meta(12)).foregroundStyle(PFColor.textMuted).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
