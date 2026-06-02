import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

enum TenantResolver {
    static let activeTenantKey = "activeTenantId"

    static func resolveTenantId(for user: User, fallbackMembershipTenantId: String? = nil) -> String? {
        if let stored = UserDefaults.standard.string(forKey: activeTenantKey), !stored.isEmpty {
            return stored
        }
        if let fallbackMembershipTenantId, !fallbackMembershipTenantId.isEmpty {
            return fallbackMembershipTenantId
        }
        return nil
    }

    static func setActiveTenantId(_ tenantId: String) {
        UserDefaults.standard.set(tenantId, forKey: activeTenantKey)
        NotificationCenter.default.post(name: .projectflowTenantDidChange, object: tenantId)
    }
}

extension Notification.Name {
    static let projectflowTenantDidChange = Notification.Name("projectflowTenantDidChange")
}

@MainActor
final class AppSession: ObservableObject {
    static let shared = AppSession()

    @Published var activeTenantId: String?
    @Published var membership: TenantMembership?
    @Published var tenant: Tenant?
    @Published var roles: [TenantRole] = []
    @Published var isLoadingTenant = false
    @Published var tenantBootstrapFailed = false
    @Published var appTheme: String = UserDefaults.standard.string(forKey: "appTheme") ?? "system"
    @Published var appLanguage: String = UserDefaults.standard.string(forKey: "appLanguage") ?? "en"

    let pinnedTasksStore = PinnedTasksStore()
    let notificationStore = NotificationStore()

    private let db = Firestore.firestore()
    private var membershipListener: ListenerRegistration?
    private var tenantListener: ListenerRegistration?
    private var tenantChangeObserver: AnyCancellable?
    private var currentUserId: String?

    private init() {
        tenantChangeObserver = NotificationCenter.default.publisher(for: .projectflowTenantDidChange)
            .receive(on: RunLoop.main)
            .sink { [weak self] notification in
                guard let self, let tenantId = notification.object as? String else { return }
                self.reloadTenantContext(tenantId: tenantId)
            }
    }

    func start(for user: User?) {
        stop()
        guard let user else {
            activeTenantId = nil
            membership = nil
            tenant = nil
            roles = []
            return
        }
        currentUserId = user.uid
        pinnedTasksStore.start()
        tenantBootstrapFailed = false

        if let tenantId = TenantResolver.resolveTenantId(for: user) {
            reloadTenantContext(tenantId: tenantId)
        } else {
            isLoadingTenant = true
            Task {
                if let tenantId = await TenantBootstrap.ensureActiveTenantId(for: user) {
                    if activeTenantId != tenantId {
                        reloadTenantContext(tenantId: tenantId)
                    }
                } else {
                    isLoadingTenant = false
                    tenantBootstrapFailed = true
                }
            }
        }
    }

    func stop() {
        membershipListener?.remove()
        tenantListener?.remove()
        membershipListener = nil
        tenantListener = nil
        pinnedTasksStore.stop()
        notificationStore.stop()
        PermissionService.shared.invalidateCache()
    }

    func switchWorkspace(to tenantId: String) {
        TenantResolver.setActiveTenantId(tenantId)
    }

    func setInitialTenantIfNeeded(_ tenantId: String) {
        if UserDefaults.standard.string(forKey: TenantResolver.activeTenantKey) == nil {
            TenantResolver.setActiveTenantId(tenantId)
        } else {
            reloadTenantContext(tenantId: tenantId)
        }
    }

    func reloadTenantContext(tenantId: String) {
        guard let userId = currentUserId else { return }
        membershipListener?.remove()
        tenantListener?.remove()
        isLoadingTenant = true
        activeTenantId = tenantId
        PermissionService.shared.invalidateCache(tenantId: tenantId)

        notificationStore.stop()
        notificationStore.start()

        membershipListener = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.members)
            .document(userId)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                if let snapshot, snapshot.exists {
                    membership = TenantMembership(id: snapshot.documentID, data: snapshot.data() ?? [:])
                } else {
                    membership = nil
                }
            }

        tenantListener = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                if let snapshot, snapshot.exists {
                    tenant = Tenant(id: snapshot.documentID, data: snapshot.data() ?? [:])
                } else {
                    tenant = nil
                }
                isLoadingTenant = false
            }

        Task {
            roles = await PermissionService.shared.loadRoles(tenantId: tenantId)
        }
    }

    func permissionContext(project: Project? = nil) -> PermissionContext {
        PermissionService.shared.buildContext(
            membership: membership,
            tenantOwnerId: tenant?.ownerId,
            currentUserId: currentUserId,
            project: project,
            roles: roles
        )
    }

    func preferredColorScheme() -> ColorScheme? {
        switch appTheme {
        case "light": return .light
        case "dark": return .dark
        default: return nil
        }
    }

    func setTheme(_ theme: String) {
        appTheme = theme
        UserDefaults.standard.set(theme, forKey: "appTheme")
    }

    func setLanguage(_ language: String) {
        appLanguage = language
        UserDefaults.standard.set(language, forKey: "appLanguage")
    }
}

import SwiftUI
