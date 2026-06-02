import Foundation
import FirebaseAuth
import FirebaseFirestore

enum TenantBootstrap {
    /// Mirrors web `ensureActiveTenantId`: resolve workspace from cache, memberships, or project membership.
    @MainActor
    static func ensureActiveTenantId(for user: User) async -> String? {
        if let cached = UserDefaults.standard.string(forKey: TenantResolver.activeTenantKey), !cached.isEmpty {
            return cached
        }

        let db = Firestore.firestore()

        if let fromMembership = await discoverFromMemberships(db: db, userId: user.uid) {
            TenantResolver.setActiveTenantId(fromMembership)
            return fromMembership
        }

        if let fromOwned = await discoverFromProjects(db: db, userId: user.uid, field: "ownerId", isEqualTo: user.uid) {
            TenantResolver.setActiveTenantId(fromOwned)
            return fromOwned
        }

        if let fromMember = await discoverFromProjects(db: db, userId: user.uid, field: "memberIds", arrayContains: user.uid) {
            TenantResolver.setActiveTenantId(fromMember)
            return fromMember
        }

        return nil
    }

    private static func discoverFromMemberships(db: Firestore, userId: String) async -> String? {
        do {
            let snapshot = try await db.collectionGroup(FirestorePath.members)
                .whereField("uid", isEqualTo: userId)
                .limit(to: 10)
                .getDocumentsAsync()
            return tenantId(from: snapshot.documents)
        } catch {
            print("TenantBootstrap: membership discovery failed: \(error.localizedDescription)")
            return nil
        }
    }

    private static func discoverFromProjects(
        db: Firestore,
        userId: String,
        field: String,
        isEqualTo: String? = nil,
        arrayContains: String? = nil
    ) async -> String? {
        do {
            var query: Query = db.collectionGroup(FirestorePath.projects)
            if let isEqualTo {
                query = query.whereField(field, isEqualTo: isEqualTo)
            } else if let arrayContains {
                query = query.whereField(field, arrayContains: arrayContains)
            } else {
                return nil
            }
            let snapshot = try await query.limit(to: 50).getDocumentsAsync()
            return tenantId(from: snapshot.documents)
        } catch {
            print("TenantBootstrap: project discovery (\(field)) failed: \(error.localizedDescription)")
            return nil
        }
    }

    private static func tenantId(from documents: [QueryDocumentSnapshot]) -> String? {
        for doc in documents {
            if let tenantId = doc.reference.parent.parent?.documentID, !tenantId.isEmpty {
                return tenantId
            }
        }
        return nil
    }
}
