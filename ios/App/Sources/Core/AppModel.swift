import Foundation
import Network
import Observation
import SwiftUI
import PFData
import PFDesign
import PFModel

/// Composition root. Owns auth, the session, the active workspace and the UI services
/// (presenter, toasts, router). Features read it via `@Environment(AppModel.self)`.
@Observable
final class AppModel {
    let auth = AuthService()
    let router = AppRouter()
    let presenter = PFPresenter()
    let toasts = PFToastCenter()
    let swipes = PFSwipeCoordinator()
    let network = NetworkMonitor()

    private(set) var session: SessionStore?
    private(set) var workspace: WorkspaceStore?
    /// Bumped when the workspace store is replaced, so views can restart their tasks.
    private(set) var workspaceGeneration = 0

    init() {
        auth.start()
        network.start()
    }

    // MARK: Session lifecycle

    /// Called whenever the auth phase changes.
    func syncSession() async {
        guard let uid = auth.uid else {
            session?.stop()
            workspace?.stop()
            session = nil
            workspace = nil
            router.reset()
            SystemSync.signedOut()
            return
        }
        guard session?.uid != uid else { return }
        session?.stop()
        let session = SessionStore(uid: uid)
        self.session = session
        await session.start(defaultWorkspaceName: L10n.t("onboarding.defaultWorkspace"))
        bindWorkspace()
    }

    /// Rebuilds the workspace store when the active workspace changes.
    func bindWorkspace() {
        guard let session, let tenantId = session.activeWorkspaceId else { return }
        guard workspace?.tenantId != tenantId else { return }
        workspace?.stop()
        router.reset()
        let store = WorkspaceStore(tenantId: tenantId, uid: session.uid, role: session.role)
        store.start()
        workspace = store
        workspaceGeneration += 1
        SystemSync.workspaceBound(model: self)
        if let pending = router.pendingURL {
            router.pendingURL = nil
            router.handle(url: pending, activeTenant: tenantId)
        }
        // Debug/QA: `-pfOpenURL /project/p-website` opens a screen right after sign-in (used for screenshots).
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-pfOpenURL"), arguments.count > index + 1,
           let url = URL(string: "https://app.getprojectflow.com\(arguments[index + 1])") {
            router.handle(url: url, activeTenant: tenantId)
        }
    }

    func switchWorkspace(to id: String, announce: Bool = true) {
        guard let session, id != session.activeWorkspaceId else { return }
        session.switchWorkspace(to: id)
        bindWorkspace()
        if announce, let name = session.activeWorkspace?.name {
            toasts.show(PFToast(L10n.t("shell.switchedWorkspace", ["name": name])))
        }
    }

    // MARK: Convenience

    var uid: String? { auth.uid }
    var profile: UserProfile? { session?.profile }

    var actions: WorkActions? {
        guard let workspace, let session else { return nil }
        return WorkActions(tenantId: workspace.tenantId, uid: session.uid, actorName: session.profile?.displayName ?? auth.displayName ?? "")
    }

    var focusActions: FocusActions? { uid.map(FocusActions.init(uid:)) }
    var profileActions: ProfileActions? { uid.map(ProfileActions.init(uid:)) }

    var colorScheme: ColorScheme? {
        switch profile?.theme {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    /// Runs a write, shows a toast on failure. Returns true on success.
    @discardableResult
    func perform(_ work: () async throws -> Void) async -> Bool {
        do {
            try await work()
            return true
        } catch {
            toasts.show(PFToast(L10n.t("common.error"), style: .error))
            return false
        }
    }
}

/// Observes connectivity for the offline banner.
@Observable
final class NetworkMonitor {
    private(set) var isOnline = true
    private let monitor = NWPathMonitor()

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.isOnline = online }
        }
        monitor.start(queue: DispatchQueue(label: "pf.network"))
    }
}
