import SwiftUI
import PFData
import PFDesign

extension SessionStore.WorkspaceSummary {
    /// The personal workspace is always shown as "Persönlich" (billing contract §7), team workspaces by name.
    var displayName: String { isPersonal ? L10n.t("workspace.personal") : name }
}

/// Workspace switcher: the personal workspace on top, separate from the team workspaces.
struct WorkspaceSwitcherSheet: View {
    let workspaces: [SessionStore.WorkspaceSummary]
    let activeId: String?
    let onSelect: (String) -> Void
    @Environment(PFPresenter.self) private var presenter

    private var personal: [SessionStore.WorkspaceSummary] { workspaces.filter(\.isPersonal) }
    private var teams: [SessionStore.WorkspaceSummary] { workspaces.filter { !$0.isPersonal } }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            if !personal.isEmpty { section(L10n.t("workspace.personal"), personal) }
            if !teams.isEmpty { section(L10n.t("workspace.teams"), teams) }
        }
        .padding(.bottom, PFSpace.l)
    }

    private func section(_ title: String, _ items: [SessionStore.WorkspaceSummary]) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(title).padding(.horizontal, PFSpace.page)
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, workspace in
                    if index > 0 { PFRowDivider() }
                    row(workspace)
                }
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .padding(.horizontal, PFSpace.page)
        }
    }

    private func row(_ workspace: SessionStore.WorkspaceSummary) -> some View {
        let selected = workspace.id == activeId
        return Button {
            onSelect(workspace.id)
            presenter.dismiss()
        } label: {
            HStack(spacing: PFSpace.s) {
                Group {
                    if workspace.isPersonal {
                        Image(systemName: "person.fill").font(.system(size: 13, weight: .bold))
                    } else {
                        Text(String(workspace.name.first ?? "W").uppercased()).pfText(.buttonSmall)
                    }
                }
                .foregroundStyle(PFColor.onPrimary)
                .frame(width: 28, height: 28)
                .background(PFColor.primary, in: .rect(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(workspace.displayName).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    // A renamed personal workspace keeps its own name as a hint.
                    if workspace.isPersonal, workspace.name != L10n.t("workspace.personal") {
                        Text(workspace.name).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                    }
                }
                Spacer()
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(PFColor.textMain)
                }
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
