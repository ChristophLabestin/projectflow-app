import SwiftUI
import PFData
import PFDesign
import PFModel

/// Workspace groups (`tenants/{t}/groups`): list for everybody, create/edit/delete for Owner/Admin.
struct GroupsScreen: View {
    var body: some View { TeamHost { context in GroupsContent(context: context) } }
}

private struct GroupsContent: View {
    let context: TeamContext
    @Environment(AppModel.self) private var model

    var body: some View {
        SettingsScaffold(title: L10n.t("team.groups"), subtitle: context.tenantName, topTrailing: context.canAdmin ? AnyView(
            PFIconButton("plus", label: L10n.t("team.group.new")) { present(nil) }
        ) : nil) {
            if !context.store.loaded.contains("groups") {
                PFSkeleton(height: 60, radius: PFRadius.card).padding(.top, PFSpace.l)
            } else if context.store.groups.isEmpty {
                PFEmptyState(systemImage: "person.3", title: L10n.t("team.groups.empty"), message: L10n.t("team.groups.emptyMessage"),
                             actionTitle: context.canAdmin ? L10n.t("team.group.new") : nil, action: context.canAdmin ? { present(nil) } : nil)
                    .padding(.top, PFSpace.l)
            } else {
                SettingsCard(footer: context.canAdmin ? nil : L10n.t("team.groups.readonly")) {
                    ForEach(context.store.groups) { group in
                        SettingsRow(systemImage: "person.3", title: group.name,
                                    subtitle: group.summary.isEmpty ? L10n.plural("team.group.members", group.memberIds.count) : group.summary,
                                    showsChevron: context.canAdmin, action: context.canAdmin ? { present(group) } : nil) {
                            PFDot(TeamSwatch.color(group.color), size: 12)
                        }
                    }
                }
                .padding(.top, PFSpace.l)
            }
        }
    }

    private func present(_ group: TeamGroup?) {
        model.presenter.present(detents: [.large]) { GroupSheet(context: context, groupId: group?.id) }
    }
}

/// Create or edit a group: name, colour, description, members, delete.
struct GroupSheet: View {
    let context: TeamContext
    let groupId: String?
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var name = ""
    @State private var summary = ""
    @State private var color = TeamSwatch.presets[0]
    @State private var isWorking = false
    @State private var loadedFields = false

    private var group: TeamGroup? { groupId.flatMap { context.store.group($0) } }

    var body: some View {
        TeamSheet(eyebrow: context.tenantName, title: group == nil ? L10n.t("team.group.new") : L10n.t("team.group.edit")) {
            PFTextField(L10n.t("team.group.name"), text: $name, systemImage: "person.3")
            PFTextField(L10n.t("team.group.description"), text: $summary, systemImage: "text.alignleft", axis: .vertical)
            TeamSwatchPicker(L10n.t("team.color"), selection: $color)
            if let group {
                PFSectionHeader(L10n.plural("team.group.members", group.memberIds.count))
                PFCardList {
                    ForEach(TeamLogic.sorted(Array(context.people.values))) { person in
                        TeamChoiceRow(title: person.displayName, subtitle: person.email,
                                      leading: AnyView(PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 34)),
                                      isSelected: group.memberIds.contains(person.id)) {
                            let isMember = group.memberIds.contains(person.id)
                            Task {
                                do { try await context.actions.setGroupMember(person.id, groupId: group.id, isMember: !isMember) } catch { teamFail(model, error) }
                            }
                        }
                    }
                }
                PFButton(L10n.t("team.group.delete"), kind: .danger, size: .large, fullWidth: true) { confirmDelete(group) }
            }
        }
        .pfSheetFooter([isWorking, name.trimmingCharacters(in: .whitespaces).isEmpty]) {
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { save() }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isWorking)
                .padding(.horizontal, PFSpace.page)
        }
        .onAppear {
            guard !loadedFields, let group else { return }
            loadedFields = true
            name = group.name
            summary = group.summary
            color = group.color
        }
    }

    private func save() {
        isWorking = true
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        Task {
            defer { isWorking = false }
            do {
                if let groupId {
                    try await context.actions.updateGroup(groupId, name: trimmed, color: color, summary: summary)
                } else {
                    try await context.actions.createGroup(name: trimmed, color: color, summary: summary)
                }
                PFHaptics.success()
                presenter.dismiss()
            } catch {
                teamFail(model, error)
            }
        }
    }

    private func confirmDelete(_ group: TeamGroup) {
        presenter.dismiss()
        Task {
            try? await Task.sleep(for: .milliseconds(380))
            model.presenter.present(detents: [.fit]) {
                ConfirmSheet(title: L10n.t("team.group.delete"), message: L10n.t("team.group.deleteMessage", ["name": group.name]), confirmTitle: L10n.t("common.delete")) {
                    Task {
                        do { try await context.actions.deleteGroup(group.id, memberIds: group.memberIds) } catch { teamFail(model, error) }
                    }
                }
            }
        }
    }
}
