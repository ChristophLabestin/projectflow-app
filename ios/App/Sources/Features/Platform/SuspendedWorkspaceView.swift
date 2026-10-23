import SwiftUI
import PFData
import PFDesign

/// Full-screen notice while the active workspace is suspended by the platform (`tenants/{id}.suspendedAt`).
/// Nothing tenant-scoped is loaded (the rules deny it); the user can switch to another workspace, contact support
/// or sign out. Lifting the suspension brings the app back live (tenant doc listener in `SessionStore`).
struct SuspendedWorkspaceView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    private var others: [SessionStore.WorkspaceSummary] {
        guard let session = model.session else { return [] }
        return session.workspaces.filter { $0.id != session.activeWorkspaceId && !session.suspendedWorkspaceIds.contains($0.id) }
    }

    var body: some View {
        ZStack {
            PFCanvas()
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.xl) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(PFColor.dangerText)
                        .frame(width: 72, height: 72)
                        .background(PFColor.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .pfElevation(.card, radius: 22)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: PFSpace.xs) {
                        Text(L10n.t("platform.suspended.title", ["name": model.session?.activeWorkspace?.name ?? ""]))
                            .pfText(.display).foregroundStyle(PFColor.textMain)
                            .accessibilityAddTraits(.isHeader)
                        Text(L10n.t("platform.suspended.message"))
                            .pfText(.body).foregroundStyle(PFColor.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if !others.isEmpty {
                        VStack(alignment: .leading, spacing: PFSpace.xs) {
                            PFEyebrow(L10n.t("platform.suspended.switch"))
                            PFCardList {
                                ForEach(others) { workspace in
                                    Button { switchTo(workspace) } label: {
                                        HStack(spacing: PFSpace.s) {
                                            Image(systemName: "building.2").font(.system(size: 15, weight: .semibold))
                                                .foregroundStyle(PFColor.textMuted).frame(width: 24)
                                            Text(workspace.name).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                                            Spacer(minLength: 0)
                                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
                                                .foregroundStyle(PFColor.textSubtle)
                                        }
                                        .padding(.horizontal, PFSpace.m)
                                        .frame(minHeight: 52)
                                        .contentShape(.rect)
                                    }
                                    .buttonStyle(.pfPressable)
                                }
                            }
                        }
                    }
                    VStack(spacing: PFSpace.xs) {
                        PFButton(L10n.t("platform.suspended.support"), systemImage: "envelope", kind: .secondary, size: .large, fullWidth: true) {
                            if let url = URL(string: "mailto:support@getprojectflow.com") { openURL(url) }
                        }
                        PFButton(L10n.t("platform.suspended.signOut"), systemImage: "rectangle.portrait.and.arrow.right", kind: .ghost,
                                 size: .large, fullWidth: true) { signOut() }
                    }
                }
                .padding(.horizontal, PFSpace.page)
                .padding(.vertical, PFSpace.xl)
                .frame(maxWidth: 560, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    private func switchTo(_ workspace: SessionStore.WorkspaceSummary) {
        PFHaptics.selection()
        withAnimation(PFMotion.respecting(PFMotion.normal)) { model.session?.switchWorkspace(to: workspace.id) }
    }

    private func signOut() {
        let uid = model.uid
        Task {
            await PushRegistrar.shared.signOut()
            if let uid { SearchRecents.erase(uid: uid) }
            model.auth.signOut()
        }
    }
}
