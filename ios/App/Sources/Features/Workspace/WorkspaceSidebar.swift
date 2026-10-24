import SwiftUI
import PFData
import PFDesign

/// Workspace sidebar (edge swipe on a root tab, or the menu button on Today), like the ChatGPT app:
/// the active workspace's areas, all workspaces to switch between, workspace settings at the bottom.
struct WorkspaceSidebar: View {
    @Environment(AppModel.self) private var model

    private var workspaces: [SessionStore.WorkspaceSummary] {
        let all = model.session?.workspaces ?? []
        return all.filter(\.isPersonal) + all.filter { !$0.isPersonal }
    }
    private var active: SessionStore.WorkspaceSummary? { model.session?.activeWorkspace }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.l) {
                    if let active { header(active) }
                    section(L10n.t("sidebar.areas")) {
                        ForEach(WorkspaceArea.all(model: model)) { area in
                            row(icon: area.icon, title: L10n.t("nav.\(area.id)")) { open(area.route) }
                        }
                    }
                    section(L10n.t("sidebar.workspaces")) {
                        ForEach(workspaces) { workspace in workspaceRow(workspace) }
                        row(icon: "plus", title: L10n.t("sidebar.newWorkspace"), muted: true) {
                            close()
                            model.presenter.present(detents: [.fit]) { CreateWorkspaceSheet() }
                        }
                    }
                }
                .padding(.horizontal, PFSpace.s)
                .padding(.top, PFSpace.m)
                .padding(.bottom, PFSpace.l)
            }
            .scrollIndicators(.hidden)
            PFRowDivider()
            row(icon: "gearshape", title: L10n.t("team.workspaceSettings")) { open(.accountPage(.workspaceSettings)) }
                .padding(.horizontal, PFSpace.s)
                .padding(.vertical, PFSpace.xs)
        }
    }

    private func header(_ workspace: SessionStore.WorkspaceSummary) -> some View {
        HStack(spacing: PFSpace.s) {
            WorkspaceMonogram(name: workspace.isPersonal ? workspace.displayName : workspace.name, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(workspace.displayName).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(1)
                Text(AccountLogic.roleLabel(workspace.role)).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
        }
        .padding(.horizontal, PFSpace.s)
        .accessibilityElement(children: .combine)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            PFEyebrow(title).padding(.horizontal, PFSpace.s).padding(.bottom, 4)
            content()
        }
    }

    private func row(icon: String, title: String, muted: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: PFSpace.s) {
                Image(systemName: icon).font(.system(size: 16, weight: .medium)).frame(width: 28)
                Text(title).pfText(.rowTitle).lineLimit(1)
                Spacer(minLength: 0)
            }
            .foregroundStyle(muted ? PFColor.textMuted : PFColor.textMain)
            .padding(.horizontal, PFSpace.s)
            .frame(minHeight: 44)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }

    private func workspaceRow(_ workspace: SessionStore.WorkspaceSummary) -> some View {
        let selected = workspace.id == active?.id
        return Button {
            close()
            guard !selected else { return }
            PFHaptics.selection()
            model.switchWorkspace(to: workspace.id)
        } label: {
            HStack(spacing: PFSpace.s) {
                WorkspaceMonogram(name: workspace.isPersonal ? workspace.displayName : workspace.name, size: 28)
                Text(workspace.displayName).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(PFColor.textMain)
                }
            }
            .padding(.horizontal, PFSpace.s)
            .frame(minHeight: 44)
            .background(selected ? PFColor.raised : .clear, in: .rect(cornerRadius: 12, style: .continuous))
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    private func open(_ route: AppRoute) {
        close()
        model.router.push(route)
    }

    private func close() {
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { model.router.isSidebarOpen = false }
    }
}
