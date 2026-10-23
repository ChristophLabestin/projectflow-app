import SwiftUI
import UIKit
import FirebaseAuth
import FirebaseFirestore
import PFData
import PFDesign
import PFModel

// MARK: - Data export

/// `exportMyData` → share sheet (system integration). Small exports come back inline, large ones as a signed URL.
@MainActor
enum DataExport {
    static func run(model: AppModel) async {
        model.toasts.show(PFToast(L10n.t("account.export.preparing"), duration: 3))
        do {
            guard let result = try await PFCallables.call("exportMyData") as? [String: Any] else { throw PFDataError.message("export") }
            if result["format"] as? String == "url", let urlString = result["url"] as? String, let url = URL(string: urlString) {
                present([url])
            } else if let payload = result["data"], JSONSerialization.isValidJSONObject(payload) {
                let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
                let file = FileManager.default.temporaryDirectory.appendingPathComponent("ProjectFlow-Export.json")
                try data.write(to: file, options: .atomic)
                present([file])
            } else {
                throw PFDataError.message("export")
            }
        } catch {
            model.toasts.show(PFToast(L10n.t("account.export.failed"), style: .error))
        }
    }

    private static func present(_ items: [Any]) {
        guard let root = UIApplication.shared.keyWindowScene?.keyWindow?.rootViewController else { return }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = top.view
        top.present(controller, animated: true)
    }
}

// MARK: - Account deletion

/// A workspace the user owns that still has other members: `deleteMyAccount` refuses until it is
/// transferred or deleted (`functions/src/account-data.ts` `planAccountDeletion`).
struct DeletionBlocker: Identifiable, Hashable {
    let id: String
    let name: String
    let others: [Person]

    var transferCandidates: [Person] { others.filter { $0.role != .guest } }
}

@MainActor
enum AccountDeletionPlan {
    static func blockers(model: AppModel) async -> [DeletionBlocker] {
        guard let session = model.session else { return [] }
        var result: [DeletionBlocker] = []
        for workspace in session.workspaces where workspace.ownerId == session.uid {
            guard let snapshot = try? await PFPath.members(workspace.id).limit(to: 50).getDocuments() else { continue }
            let people = snapshot.documents.map { Person(id: ($0.data()["uid"] as? String) ?? $0.documentID, fields: Fields($0.data())) }
            let others = people.filter { $0.id != session.uid }
                .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
            if !others.isEmpty { result.append(DeletionBlocker(id: workspace.id, name: workspace.name, others: others)) }
        }
        return result
    }
}

/// Konto löschen: explains the consequences, resolves owned shared workspaces, then deletes.
struct AccountDeletionSheet: View {
    private enum Stage: Equatable {
        case overview
        case transfer(DeletionBlocker)
        case deleteWorkspace(DeletionBlocker)
    }

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var stage: Stage = .overview
    @State private var blockers: [DeletionBlocker]?
    @State private var isWorking = false
    @State private var confirmName = ""
    @State private var errorText: String?
    @State private var needsRelogin = false

    private var isApple: Bool { model.auth.providerIDs.contains("apple.com") }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                switch stage {
                case .overview: overview
                case .transfer(let blocker): transfer(blocker)
                case .deleteWorkspace(let blocker): deleteWorkspace(blocker)
                }
                if let errorText {
                    Text(errorText).pfText(.meta).foregroundStyle(PFColor.dangerText).fixedSize(horizontal: false, vertical: true)
                    if needsRelogin {
                        PFButton(L10n.t("shell.signOut"), kind: .ghost, size: .small) {
                            presenter.dismissAll()
                            Task {
                                await PushRegistrar.shared.signOut()
                                model.auth.signOut()
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.bottom, PFSpace.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .animation(PFMotion.respecting(PFMotion.snappy), value: stage)
        .task { blockers = await AccountDeletionPlan.blockers(model: model) }
    }

    // MARK: Overview

    private var overview: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            VStack(alignment: .leading, spacing: 4) {
                PFEyebrow(L10n.t("account.delete.eyebrow"), color: PFColor.dangerText)
                Text(L10n.t("account.delete.title")).pfText(.title).foregroundStyle(PFColor.textMain)
            }
            Text(L10n.t("account.delete.message")).pfText(.body).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)

            if let blockers {
                if blockers.isEmpty {
                    PFButton(isWorking ? L10n.t("common.loading") : L10n.t("account.delete.confirm"), kind: .danger, size: .large, fullWidth: true) { deleteAccount() }
                        .disabled(isWorking)
                    PFButton(L10n.t("common.cancel"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
                } else {
                    VStack(alignment: .leading, spacing: PFSpace.s) {
                        Text(L10n.t("account.delete.blocked")).pfText(.section).foregroundStyle(PFColor.textMain)
                        Text(L10n.t("account.delete.blockedMessage")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    ForEach(blockers) { blocker in blockerCard(blocker) }
                    PFButton(L10n.t("common.cancel"), kind: .ghost, size: .large, fullWidth: true) { presenter.dismiss() }
                }
            } else {
                PFSkeleton(height: 52, radius: PFRadius.card)
            }
        }
    }

    private func blockerCard(_ blocker: DeletionBlocker) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(blocker.name).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                    Text(L10n.plural("account.delete.members", blocker.others.count + 1)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                Spacer()
                PFAvatarStack(people: blocker.others.map { ($0.id, $0.displayName, $0.photoURL) }, size: 26, limit: 3)
            }
            HStack(spacing: PFSpace.xs) {
                if !blocker.transferCandidates.isEmpty {
                    PFButton(L10n.t("account.delete.transfer"), systemImage: "arrow.left.arrow.right", size: .small) {
                        errorText = nil
                        stage = .transfer(blocker)
                    }
                }
                PFButton(L10n.t("account.delete.deleteWorkspace"), kind: .ghost, size: .small) {
                    errorText = nil
                    confirmName = ""
                    stage = .deleteWorkspace(blocker)
                }
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
    }

    // MARK: Transfer ownership

    private func transfer(_ blocker: DeletionBlocker) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            backButton
            VStack(alignment: .leading, spacing: 4) {
                PFEyebrow(blocker.name)
                Text(L10n.t("account.delete.transfer")).pfText(.title).foregroundStyle(PFColor.textMain)
            }
            Text(L10n.t("account.delete.transferMessage")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            PFCardList {
                ForEach(blocker.transferCandidates) { person in
                    Button { transferOwnership(blocker, to: person) } label: {
                        HStack(spacing: PFSpace.s) {
                            PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 36)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(person.displayName).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                                if let role = person.role { Text(AccountLogic.roleLabel(role)).pfText(.meta).foregroundStyle(PFColor.textMuted) }
                            }
                            Spacer()
                        }
                        .padding(.horizontal, PFSpace.m)
                        .frame(minHeight: 60)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                    .disabled(isWorking)
                }
            }
            if !blocker.others.filter({ $0.role == .guest }).isEmpty {
                Text(L10n.t("account.delete.guestsHint")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
        }
    }

    private func transferOwnership(_ blocker: DeletionBlocker, to person: Person) {
        isWorking = true
        errorText = nil
        Task {
            do {
                _ = try await PFCallables.call("transferWorkspaceOwnership", ["tenantId": blocker.id, "newOwnerId": person.id])
                PFHaptics.success()
                await session()?.reloadWorkspaces()
                blockers = await AccountDeletionPlan.blockers(model: model)
                stage = .overview
            } catch {
                errorText = L10n.t("account.delete.failed")
            }
            isWorking = false
        }
    }

    // MARK: Delete workspace

    private func deleteWorkspace(_ blocker: DeletionBlocker) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            backButton
            VStack(alignment: .leading, spacing: 4) {
                PFEyebrow(blocker.name, color: PFColor.dangerText)
                Text(L10n.t("account.delete.deleteWorkspace")).pfText(.title).foregroundStyle(PFColor.textMain)
            }
            Text(L10n.t("account.delete.deleteWorkspaceMessage", ["name": blocker.name, "count": blocker.others.count + 1]))
                .pfText(.body).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            PFTextField(blocker.name, text: $confirmName, systemImage: "character.cursor.ibeam")
            PFButton(isWorking ? L10n.t("common.loading") : L10n.t("account.delete.deleteWorkspaceConfirm"), kind: .danger, size: .large, fullWidth: true) {
                removeWorkspace(blocker)
            }
            .disabled(confirmName.trimmingCharacters(in: .whitespaces) != blocker.name.trimmingCharacters(in: .whitespaces) || isWorking)
        }
    }

    private func removeWorkspace(_ blocker: DeletionBlocker) {
        isWorking = true
        errorText = nil
        Task {
            do {
                _ = try await PFCallables.call("deleteWorkspace", ["tenantId": blocker.id, "confirmName": confirmName.trimmingCharacters(in: .whitespaces)])
                PFHaptics.success()
                await session()?.reloadWorkspaces()
                blockers = await AccountDeletionPlan.blockers(model: model)
                stage = .overview
            } catch {
                errorText = L10n.t("account.delete.failed")
            }
            isWorking = false
        }
    }

    private var backButton: some View {
        Button { stage = .overview } label: {
            Label(L10n.t("common.back"), systemImage: "chevron.left").pfText(.buttonSmall).foregroundStyle(PFColor.textMuted)
                .padding(.horizontal, 4).frame(minHeight: 36)
        }
        .buttonStyle(.pfPressable)
    }

    private func session() -> SessionStore? { model.session }

    // MARK: Delete the account

    private func deleteAccount() {
        isWorking = true
        errorText = nil
        Task {
            do {
                var code: String?
                if isApple {
                    // A fresh Apple sign-in refreshes the Firebase login (the callable needs a recent one)
                    // and yields the authorization code that revokes the Apple token.
                    let coordinator = AppleSignInCoordinator()
                    try await coordinator.signIn(auth: model.auth)
                    code = AppleSignInCoordinator.lastAuthorizationCode
                }
                let uid = model.uid
                try await model.auth.deleteAccount(appleAuthorizationCode: code)
                if let uid { SearchRecents.erase(uid: uid) }
                presenter.dismissAll()
            } catch {
                errorText = Self.message(for: error)
                needsRelogin = (error as NSError).localizedDescription.contains("recent-login-required")
                isWorking = false
            }
        }
    }

    private static func message(for error: Error) -> String {
        let text = (error as NSError).localizedDescription
        if text.contains("recent-login-required") { return L10n.t("account.delete.recentLogin") }
        if text.contains("owner-of-shared-workspaces") { return L10n.t("account.delete.blockedMessage") }
        return L10n.t("account.delete.failed")
    }
}
