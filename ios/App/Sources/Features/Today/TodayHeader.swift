import SwiftUI
import PFDesign
import PFDomain
import PFModel

/// Floating chrome row of Today: workspace menu · capture · avatar (account). While the headline
/// scrolls away, the workspace name gives way to a compact version of the day statement.
struct TodayTopBar: View {
    /// 0 = headline fully visible, 1 = collapsed into the bar.
    let collapse: CGFloat
    let compact: String?

    @Environment(AppModel.self) private var model
    @Environment(\.pfSideRegionWidth) private var sideRegion

    var body: some View {
        HStack(spacing: PFSpace.xs) {
            ZStack(alignment: .leading) {
                workspaceChip
                    .opacity(Double(1 - min(collapse * 1.6, 1)))
                    .allowsHitTesting(collapse < 0.5)
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
                    captureButton
                } else {
                    captureButton
                    accountButton
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.vertical, 6)
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

    private var workspaceChip: some View {
        Button { presentWorkspaces() } label: {
            HStack(spacing: 6) {
                Text(model.session?.activeWorkspace?.name ?? "")
                    .pfText(.section)
                    .foregroundStyle(PFColor.textMain)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(PFColor.textMuted)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .pfGlass(in: .capsule)
        }
        .buttonStyle(.pfPressable)
        .accessibilityLabel(L10n.t("today.switchWorkspace"))
        .accessibilityValue(model.session?.activeWorkspace?.name ?? "")
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

    private func presentWorkspaces() {
        guard let session = model.session else { return }
        let workspaces = session.workspaces
        let active = session.activeWorkspaceId
        let model = model
        model.presenter.present(detents: [.fit]) {
            OptionSheet(title: L10n.t("today.workspaceSheet.title"), options: workspaces.map { workspace in
                OptionSheet.Option(id: workspace.id, label: workspace.name, isSelected: workspace.id == active) {
                    Text(String(workspace.name.first ?? "W").uppercased())
                        .pfText(.buttonSmall)
                        .foregroundStyle(PFColor.onPrimary)
                        .frame(width: 28, height: 28)
                        .background(PFColor.primary, in: .rect(cornerRadius: 8, style: .continuous))
                }
            }) { id in
                model.switchWorkspace(to: id)
            }
        }
    }
}
