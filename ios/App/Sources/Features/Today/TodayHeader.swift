import SwiftUI
import PFDesign
import PFData
import PFDomain
import PFModel

/// Floating chrome row of Today: sidebar button · capture · avatar (account). While the headline
/// scrolls away, a compact version of the day statement appears next to the sidebar button.
struct TodayTopBar: View {
    /// 0 = headline fully visible, 1 = collapsed into the bar.
    let collapse: CGFloat
    let compact: String?

    @Environment(AppModel.self) private var model
    @Environment(\.pfSideRegionWidth) private var sideRegion

    var body: some View {
        HStack(spacing: PFSpace.xs) {
            sidebarButton
            ZStack(alignment: .leading) {
                if let compact {
                    compactTitle(compact)
                        .opacity(Double(max(collapse * 1.4 - 0.4, 0)))
                        .allowsHitTesting(false)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            PFRootActions {
                // iPhone: capture, then account. Duo outer display (stacked rail): account on top, capture below it.
                if sideRegion > 0 {
                    accountButton
                    if model.showsInAppAi { askButton }
                    captureButton
                } else {
                    if model.showsInAppAi { askButton }
                    captureButton
                    accountButton
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.vertical, 6)
    }

    /// ✦ "Frag ProjectFlow" about the day.
    private var askButton: some View {
        AiSparkButton { AiAsk.present(model: model, context: AiAskContext(surface: "today")) }
    }

    private var captureButton: some View {
        PFIconButton("plus", label: L10n.t("today.capture")) { CaptureLauncher.present(model: model) }
    }

    /// Account: the photo (or initials) fills the whole circle, no frame around it.
    private var accountButton: some View {
        Button { model.router.push(.account) } label: {
            PFAvatar(name: model.profile?.displayName ?? "", seed: model.uid, imageURL: model.profile?.photoURL, size: 44)
        }
        .buttonStyle(.pfPressable)
        .accessibilityLabel(L10n.t("today.account"))
    }

    /// Opens the workspace sidebar (also reachable by swiping in from the left edge).
    private var sidebarButton: some View {
        PFIconButton("line.3.horizontal", label: L10n.t("sidebar.open")) {
            withAnimation(PFMotion.respecting(PFMotion.snappy)) { model.router.isSidebarOpen = true }
        }
        .accessibilityValue(model.session?.activeWorkspace?.displayName ?? "")
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
