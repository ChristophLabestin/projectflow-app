import SwiftUI
import PFData
import PFDesign
import PFModel

/// Profile editor (web `ProfileSettingsModal`): name, title, bio, skills, address, photo and the
/// visibility of each field (`privacySettings`).
struct ProfileScreen: View {
    @Environment(AppModel.self) private var model
    @State private var draft = ProfileDraft()
    @State private var original = ProfileDraft()
    @State private var loaded = false
    @State private var newSkill = ""
    @State private var isSaving = false
    @State private var isUploading = false

    private var isDirty: Bool { draft != original }

    var body: some View {
        SettingsScaffold(title: L10n.t("profile.title"), subtitle: model.profile?.email ?? model.auth.email) {
            if !loaded {
                PFSkeleton(height: 120, radius: PFRadius.card).padding(.top, PFSpace.l)
            } else {
                photoHeader.padding(.top, PFSpace.l)
                PFSectionHeader(L10n.t("profile.general"))
                VStack(spacing: PFSpace.xs) {
                    PFTextField(L10n.t("profile.name"), text: $draft.displayName, systemImage: "person")
                    PFTextField(L10n.t("profile.jobTitle"), text: $draft.title, systemImage: "briefcase")
                    PFTextField(L10n.t("profile.bio"), text: $draft.bio, systemImage: "text.alignleft", axis: .vertical)
                    PFTextField(L10n.t("profile.address"), text: $draft.address, systemImage: "mappin.and.ellipse")
                }
                PFSectionHeader(L10n.t("profile.skills"))
                skills
                PFSectionHeader(L10n.t("profile.privacy"))
                SettingsCard(footer: L10n.t("profile.privacy.footer")) {
                    ForEach(ProfileDraft.privacyKeys, id: \.self) { key in
                        SettingsRow(systemImage: Self.icon(key), title: L10n.t("profile.privacy.\(key)"),
                                    subtitle: L10n.t("profile.scope.\(draft.privacy[key]?.rawValue ?? "members")")) { presentScope(key) }
                    }
                }
                PFButton(isSaving ? L10n.t("common.loading") : L10n.t("common.save"), size: .large, fullWidth: true) { save() }
                    .disabled(!isDirty || isSaving)
                    .padding(.top, PFSpace.l)
            }
        }
        .task { await load() }
    }

    private var photoHeader: some View {
        HStack(spacing: PFSpace.m) {
            PFAvatar(name: draft.displayName, seed: model.uid, imageURL: draft.photoURL.isEmpty ? nil : draft.photoURL, size: 72)
                .overlay { if isUploading { ProgressView() } }
            VStack(alignment: .leading, spacing: PFSpace.xs) {
                PFButton(L10n.t("profile.photo.change"), systemImage: "camera", kind: .secondary, size: .small) { changePhoto() }.disabled(isUploading)
                if !draft.photoURL.isEmpty {
                    PFButton(L10n.t("profile.photo.remove"), kind: .ghost, size: .small) { draft.photoURL = "" }
                }
            }
            Spacer(minLength: 0)
        }
    }

    private var skills: some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            HStack(spacing: PFSpace.xs) {
                PFTextField(L10n.t("profile.skills.add"), text: $newSkill, systemImage: "sparkles") { addSkill() }
                PFIconButton("plus", label: L10n.t("profile.skills.add"), style: .primary, size: 42) { addSkill() }
            }
            if !draft.skills.isEmpty {
                PFChipRow {
                    ForEach(draft.skills, id: \.self) { skill in
                        PFChip(skill, systemImage: "xmark", isSet: true) { draft.skills.removeAll { $0 == skill } }
                    }
                }
            }
        }
    }

    private static func icon(_ key: String) -> String {
        switch key {
        case "email": "envelope"
        case "bio": "text.alignleft"
        case "skills": "sparkles"
        case "address": "mappin.and.ellipse"
        default: "chart.bar"
        }
    }

    private func addSkill() {
        let skill = newSkill.trimmingCharacters(in: .whitespaces)
        guard !skill.isEmpty, !draft.skills.contains(skill) else { return }
        draft.skills.append(skill)
        newSkill = ""
    }

    private func load() async {
        guard !loaded, let uid = model.uid else { return }
        let value = await ProfileDraft(uid: uid)
        draft = value
        original = value
        loaded = true
    }

    private func changePhoto() {
        isUploading = true
        Task {
            defer { isUploading = false }
            guard let file = await MediaUpload.pickAndUpload(model: model, purpose: .profilePhoto) else { return }
            draft.photoURL = file.url
            // The photo is saved right away (like the web upload); the other fields wait for "Save".
            do {
                try await model.profileActions?.setPhoto(url: file.url, tenantIds: model.session?.workspaces.map(\.id) ?? [])
                original.photoURL = file.url
                PFHaptics.success()
            } catch {
                model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
            }
        }
    }

    private func presentScope(_ key: String) {
        model.presenter.present(detents: [.fit]) {
            PrivacyScopeSheet(titleKey: key, current: draft.privacy[key] ?? .members) { draft.privacy[key] = $0 }
        }
    }

    private func save() {
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await model.profileActions?.saveProfile(draft, tenantIds: model.session?.workspaces.map(\.id) ?? [])
                original = draft
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("profile.saved"), style: .success))
            } catch {
                model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
            }
        }
    }
}

/// Who may see a profile field.
struct PrivacyScopeSheet: View {
    let titleKey: String
    let current: PrivacyScope
    let onSelect: (PrivacyScope) -> Void
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        TeamSheet(eyebrow: L10n.t("profile.privacy"), title: L10n.t("profile.privacy.\(titleKey)")) {
            PFCardList {
                ForEach(PrivacyScope.allCases, id: \.self) { scope in
                    TeamChoiceRow(title: L10n.t("profile.scope.\(scope.rawValue)"), subtitle: L10n.t("profile.scope.\(scope.rawValue).hint"), isSelected: current == scope) {
                        onSelect(scope)
                        presenter.dismiss()
                    }
                }
            }
        }
    }
}
