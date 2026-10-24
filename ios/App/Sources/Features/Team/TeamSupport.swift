import SwiftUI
import PFData
import PFDesign
import PFModel

/// Everything the team screens need about the active workspace: live store, writes and the signed-in
/// user's standing (rules of `firestore.rules`: Owner/Admin manage; only the Owner touches Admins).
@MainActor
struct TeamContext {
    let store: TeamStore
    let actions: TeamActions
    let tenantId: String
    let tenantName: String
    let uid: String
    let myRole: WorkspaceRole
    let people: [String: Person]

    var isOwner: Bool { myRole == .owner }
    var canAdmin: Bool { myRole == .owner || myRole == .admin }

    func person(_ id: String) -> Person? { people[id] }

    /// Whether the signed-in user may change or remove this member (never the Owner or oneself).
    func canManage(_ target: Person) -> Bool {
        guard canAdmin, target.id != uid, target.role != .owner else { return false }
        return isOwner || target.role != .admin
    }

    /// Roles the signed-in user may hand out.
    var assignableRoles: [WorkspaceRole] { isOwner ? [.admin, .member, .guest] : [.member, .guest] }

    var inviteRoles: [WorkspaceRole] { assignableRoles }

    func inviteURL(_ inviteId: String) -> URL? {
        URL(string: "https://\(SharedConstants.webHost)/invite/\(tenantId)/\(inviteId)")
    }

    var inviterName: String { people[uid]?.displayName ?? "" }
}

/// Builds the live `TeamStore` for the active workspace and hands a `TeamContext` to the content.
struct TeamHost<Content: View>: View {
    @Environment(AppModel.self) private var model
    @State private var store: TeamStore?
    @ViewBuilder let content: (TeamContext) -> Content

    private var tenantId: String? { model.workspace?.tenantId }

    var body: some View {
        // A VStack (not Group): modifiers on an empty Group never run, so `.task` would not start the store.
        VStack(spacing: 0) {
            if let store, let context = context(store) {
                content(context)
            }
        }
        .frame(maxWidth: .infinity)
        .task(id: tenantId) { rebuild() }
        .onDisappear { store?.stop() }
    }

    private func rebuild() {
        store?.stop()
        guard let tenantId, let session = model.session else { store = nil; return }
        let canAdmin = session.role == .owner || session.role == .admin
        let next = TeamStore(tenantId: tenantId, canAdmin: canAdmin)
        next.start()
        store = next
    }

    private func context(_ store: TeamStore) -> TeamContext? {
        guard let session = model.session, let workspace = model.workspace, store.tenantId == workspace.tenantId else { return nil }
        return TeamContext(store: store, actions: TeamActions(tenantId: store.tenantId, uid: session.uid),
                           tenantId: store.tenantId, tenantName: session.activeWorkspace?.name ?? "",
                           uid: session.uid, myRole: session.role, people: workspace.people)
    }
}

enum TeamLogic {
    static func roleLabel(_ raw: String) -> String { AccountLogic.roleLabel(WorkspaceRole(raw: raw)) }

    static func initial(_ role: WorkspaceRole?) -> Int {
        switch role {
        case .owner: 0
        case .admin: 1
        case .member, .none: 2
        case .custom: 3
        case .guest: 4
        }
    }

    static func sorted(_ people: [Person]) -> [Person] {
        people.sorted { a, b in
            let ra = initial(a.role), rb = initial(b.role)
            return ra != rb ? ra < rb : a.displayName.localizedCaseInsensitiveCompare(b.displayName) == .orderedAscending
        }
    }

    static func expiryText(_ invitation: TeamInvitation) -> String {
        guard let date = invitation.expiresAt else { return L10n.t("team.invite.noExpiry") }
        if invitation.isExpired { return L10n.t("team.invite.expired") }
        return L10n.t("team.invite.expires", ["date": date.formatted(.dateTime.day().month(.abbreviated).locale(L10n.locale))])
    }

    @MainActor
    static func share(_ items: [Any]) {
        guard let root = UIApplication.shared.keyWindowScene?.keyWindow?.rootViewController else { return }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = top.view
        top.present(controller, animated: true)
    }

    @MainActor
    static func copy(_ text: String) {
        UIPasteboard.general.string = text
        PFHaptics.success()
    }
}

/// Person row: avatar, name, subtitle, trailing content; optional tap.
struct TeamPersonRow<Trailing: View>: View {
    let person: Person
    var subtitle: String?
    var isYou = false
    var action: (() -> Void)?
    @ViewBuilder let trailing: Trailing

    var body: some View {
        let content = HStack(spacing: PFSpace.s) {
            PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(person.displayName).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    if isYou { Text(L10n.t("team.you")).pfText(.meta).foregroundStyle(PFColor.textMuted) }
                }
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            trailing
            if action != nil {
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(PFColor.textSubtle)
            }
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 64)
        .contentShape(.rect)
        if let action {
            Button(action: action) { content }.buttonStyle(.pfPressable)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }
}

extension TeamPersonRow where Trailing == EmptyView {
    init(person: Person, subtitle: String? = nil, isYou: Bool = false, action: (() -> Void)? = nil) {
        self.init(person: person, subtitle: subtitle, isYou: isYou, action: action) { EmptyView() }
    }
}

/// Selectable row used in pickers: the chosen one is inverted (primary fill, check flips to primary-text).
struct TeamChoiceRow: View {
    let title: String
    var subtitle: String?
    var leading: AnyView?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button {
            PFHaptics.selection()
            action()
        } label: {
            HStack(spacing: PFSpace.s) {
                if let leading { leading }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).pfText(.rowTitle).foregroundStyle(isSelected ? PFColor.onPrimary : PFColor.textMain)
                        .multilineTextAlignment(.leading)
                    if let subtitle {
                        Text(subtitle).pfText(.meta).foregroundStyle(isSelected ? PFColor.onPrimary.opacity(0.75) : PFColor.textMuted)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(isSelected ? PFColor.onPrimary : PFColor.textSubtle)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 56)
            // Choice rule (web "selected"): the chosen role/project/person is inverted, glyphs flip with it.
            .background(isSelected ? PFColor.primary : Color.clear, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

/// Sheet frame: eyebrow + title, scrolling body, optional footer button.
struct TeamSheet<Body: View>: View {
    let eyebrow: String?
    let title: String
    @ViewBuilder let content: Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpace.m) {
                VStack(alignment: .leading, spacing: 4) {
                    if let eyebrow { PFEyebrow(eyebrow) }
                    Text(title).pfText(.section).foregroundStyle(PFColor.textMain)
                }
                content
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.bottom, PFSpace.l)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

/// Failure toast with the server's reason when it is a permission problem.
@MainActor
func teamFail(_ model: AppModel, _ error: Error) {
    let text = (error as NSError).localizedDescription
    let message = PlanErrorCode.code(in: error) != nil ? model.errorMessage(error)
        : text.localizedCaseInsensitiveContains("permission") ? L10n.t("team.error.permission") : L10n.t("common.error")
    model.toasts.show(PFToast(message, style: .error))
}

extension AppModel {
    /// After leaving or deleting a workspace: reload memberships and switch to the remaining one.
    func refreshAfterWorkspaceLoss() async {
        await session?.reloadWorkspaces()
        bindWorkspace()
    }
}
