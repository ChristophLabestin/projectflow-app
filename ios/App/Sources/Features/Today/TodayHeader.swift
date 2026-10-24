import SwiftUI
import PFDesign
import PFData
import PFDomain
import PFModel

/// Floating chrome of Today. Nothing sits above the headline any more (workspace, account and areas live in
/// the sidebar): once the headline scrolls away a compact version of the day statement appears, on iPhone with
/// capture next to it. On the Duo outer display ✦ and capture stay in the side rail (`PFRootActions`).
struct TodayTopBar: View {
    /// 0 = headline fully visible, 1 = collapsed into the bar.
    let collapse: CGFloat
    let compact: String?

    @Environment(AppModel.self) private var model
    @Environment(\.pfSideRegionWidth) private var sideRegion

    var body: some View {
        HStack(spacing: PFSpace.xs) {
            ZStack(alignment: .leading) {
                if let compact {
                    compactTitle(compact)
                        .opacity(Double(max(collapse * 1.4 - 0.4, 0)))
                        .allowsHitTesting(false)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if sideRegion > 0 {
                PFRootActions { TodayActions() }
            } else {
                TodayActions()
                    .opacity(Double(max(collapse * 1.4 - 0.4, 0)))
                    .allowsHitTesting(collapse > 0.5)
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.vertical, 6)
    }

    private func compactTitle(_ text: String) -> some View {
        Text(text)
            .pfText(.section)
            .foregroundStyle(PFColor.textMain)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .pfGlass(in: .capsule, interactive: false)
    }
}

/// ✦ "Frag ProjectFlow" about the day (when in-app AI is on) and capture.
struct TodayActions: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if model.showsInAppAi {
            AiSparkButton { AiAsk.present(model: model, context: AiAskContext(surface: "today")) }
        }
        PFIconButton("plus", label: L10n.t("today.capture")) { CaptureLauncher.present(model: model) }
    }
}

/// The date above the headline. Tapping it opens the workspace sidebar (second way besides the edge swipe);
/// on iPhone ✦ and capture sit on the same line, level with the headline.
struct TodayDateRow: View {
    let now: Date
    @Environment(AppModel.self) private var model
    @Environment(\.pfSideRegionWidth) private var sideRegion

    var body: some View {
        // The row is only as tall as the date; ✦/+ hang centred on it without pushing the headline down.
        HStack(spacing: PFSpace.xs) {
            Button {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { model.router.isSidebarOpen = true }
            } label: {
                PFEyebrow(Formatting.longToday(now))
                    .padding(.vertical, 6)
                    .contentShape(.rect)
            }
            .buttonStyle(.pfPressable)
            .accessibilityHint(L10n.t("sidebar.open"))
            Spacer(minLength: 0)
        }
        .overlay(alignment: .trailing) {
            if sideRegion == 0 {
                HStack(spacing: PFSpace.xs) { TodayActions() }
            }
        }
    }
}
