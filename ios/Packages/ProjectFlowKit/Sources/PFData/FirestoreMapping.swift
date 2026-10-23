import Foundation
import FirebaseFirestore
import PFModel

extension DocumentSnapshot {
    /// Document data with Firestore types normalised (`Timestamp` → `Date`), wrapped in `Fields`.
    var fields: Fields? {
        guard let data = data(with: .estimate) else { return nil }
        return Fields(PFMapping.normalize(data))
    }
}

enum PFMapping {
    static func normalize(_ map: [String: Any]) -> [String: Any] {
        var result: [String: Any] = [:]
        for (key, value) in map { result[key] = normalize(value) }
        return result
    }

    static func normalize(_ value: Any) -> Any {
        switch value {
        case let timestamp as Timestamp: return timestamp.dateValue()
        case let map as [String: Any]: return normalize(map)
        case let list as [Any]: return list.map(normalize)
        case let ref as DocumentReference: return ref.path
        default: return value
        }
    }
}

/// Paths used by the web app (`tenants/{t}/…`). Keep in sync with `brain/reference/app/FIRESTORE_STRUCTURE.md`.
public enum PFPath {
    public static func tenant(_ t: String) -> DocumentReference { PFFirebase.db.collection("tenants").document(t) }
    public static func projects(_ t: String) -> CollectionReference { tenant(t).collection("projects") }
    public static func project(_ t: String, _ p: String) -> DocumentReference { projects(t).document(p) }
    public static func tasks(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("tasks") }
    public static func task(_ ref: TaskRef) -> DocumentReference { tasks(ref.tenantId, ref.projectId).document(ref.taskId) }
    public static func subtasks(_ ref: TaskRef) -> CollectionReference { task(ref).collection("subtasks") }
    public static func comments(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("comments") }
    public static func activities(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("activities") }
    public static func initiatives(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("initiatives") }
    public static func milestones(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("milestones") }
    public static func sprints(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("sprints") }
    public static func categories(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("categories") }
    public static func groups(_ t: String) -> CollectionReference { tenant(t).collection("groups") }
    public static func healthSnapshots(_ t: String, _ p: String) -> CollectionReference { project(t, p).collection("healthSnapshots") }
    public static func members(_ t: String) -> CollectionReference { tenant(t).collection("members") }
    public static func notifications(_ t: String) -> CollectionReference { tenant(t).collection("notifications") }
    public static func personalTasks(_ t: String, _ uid: String) -> CollectionReference {
        tenant(t).collection("users").document(uid).collection("personalTasks")
    }
    public static func user(_ uid: String) -> DocumentReference { PFFirebase.db.collection("users").document(uid) }
    public static func devices(_ uid: String) -> CollectionReference { user(uid).collection("devices") }
    public static func liveActivities(_ uid: String) -> CollectionReference { user(uid).collection("liveActivities") }
}

/// Holds Firestore listener registrations and removes them together.
@MainActor
final class ListenerBag {
    private var registrations: [String: ListenerRegistration] = [:]

    func set(_ key: String, _ registration: ListenerRegistration) {
        registrations[key]?.remove()
        registrations[key] = registration
    }

    func remove(_ key: String) {
        registrations[key]?.remove()
        registrations[key] = nil
    }

    func removeAll() {
        registrations.values.forEach { $0.remove() }
        registrations.removeAll()
    }

    var keys: Set<String> { Set(registrations.keys) }
}

public enum PFDataError: LocalizedError {
    case notSignedIn
    case noWorkspace
    case permissionDenied
    case message(String)

    public var errorDescription: String? {
        switch self {
        case .notSignedIn: "Not signed in"
        case .noWorkspace: "No workspace"
        case .permissionDenied: "Permission denied"
        case .message(let m): m
        }
    }
}
