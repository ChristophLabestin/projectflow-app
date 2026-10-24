import Foundation
import FirebaseFirestore
import FirebaseAuth

// Wiki (`brain/plans/wiki-concept.md`, web `web/services/wiki/`). Metadata in `tenants/{t}/docs/{id}`, body = Tiptap JSON
// string in `docs/{id}/body/{n}` chunks. Saves use the same optimistic `bodyRev` check and derived fields as the web.

public struct WikiDocMeta: Identifiable, Hashable, Sendable {
    public let id: String
    public let spaceType: String
    public let projectId: String?
    public let parentId: String?
    public let order: Double
    public let title: String
    public let icon: String?
    public let excerpt: String
    public let searchText: String
    public let bodyRev: Int
    public let bodyChunks: Int
    public let linkedTaskRefs: [String]
    public let taskRefs: [String]
    public let createdBy: String?
    public let updatedByName: String?
    public let updatedAt: Date?
    public let isArchived: Bool

    init(id: String, data: [String: Any]) {
        self.id = id
        spaceType = data["spaceType"] as? String ?? "workspace"
        projectId = data["projectId"] as? String
        parentId = data["parentId"] as? String
        order = (data["order"] as? NSNumber)?.doubleValue ?? 0
        title = data["title"] as? String ?? ""
        icon = data["icon"] as? String
        excerpt = data["excerpt"] as? String ?? ""
        searchText = data["searchText"] as? String ?? ""
        bodyRev = (data["bodyRev"] as? NSNumber)?.intValue ?? 0
        bodyChunks = (data["bodyChunks"] as? NSNumber)?.intValue ?? 0
        linkedTaskRefs = data["linkedTaskRefs"] as? [String] ?? []
        taskRefs = data["taskRefs"] as? [String] ?? []
        createdBy = data["createdBy"] as? String
        updatedByName = data["updatedByName"] as? String
        updatedAt = (data["updatedAt"] as? Timestamp)?.dateValue()
        isArchived = data["archivedAt"] != nil && !(data["archivedAt"] is NSNull)
    }
}

public enum WikiSpace: Hashable, Sendable {
    case workspace
    case project(String)
}

/// Page tree of one space, live.
@Observable
public final class WikiStore {
    public let tenantId: String
    public let space: WikiSpace
    public private(set) var docs: [WikiDocMeta] = []
    public private(set) var isLoaded = false
    private var registration: ListenerRegistration?

    public init(tenantId: String, space: WikiSpace) {
        self.tenantId = tenantId
        self.space = space
    }

    public func start() {
        guard registration == nil else { return }
        let col = PFFirebase.db.collection("tenants").document(tenantId).collection("docs")
        let query: Query = switch space {
        case .workspace: col.whereField("spaceType", isEqualTo: "workspace")
        case .project(let projectId): col.whereField("spaceType", isEqualTo: "project").whereField("projectId", isEqualTo: projectId)
        }
        registration = query.addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.docs = snapshot?.documents.map { WikiDocMeta(id: $0.documentID, data: $0.data()) }.filter { !$0.isArchived } ?? self.docs
                self.isLoaded = true
            }
        }
    }

    public func stop() { registration?.remove(); registration = nil }

    /// Depth-first tree order with depth (pages whose parent is missing surface at the root).
    public var tree: [(doc: WikiDocMeta, depth: Int)] {
        let ids = Set(docs.map(\.id))
        var byParent: [String?: [WikiDocMeta]] = [:]
        for doc in docs {
            let parent = doc.parentId.flatMap { ids.contains($0) && $0 != doc.id ? $0 : nil }
            byParent[parent, default: []].append(doc)
        }
        var result: [(WikiDocMeta, Int)] = []
        var seen = Set<String>()
        func walk(_ parent: String?, _ depth: Int) {
            for doc in (byParent[parent] ?? []).sorted(by: { ($0.order, $0.title) < ($1.order, $1.title) }) where seen.insert(doc.id).inserted {
                result.append((doc, depth))
                walk(doc.id, depth + 1)
            }
        }
        walk(nil, 0)
        return result
    }
}

public enum WikiConflict: Error { case newerVersion(by: String?) }

public enum WikiData {
    static let chunkChars = 300_000

    private static func docs(_ tenantId: String) -> CollectionReference {
        PFFirebase.db.collection("tenants").document(tenantId).collection("docs")
    }

    public static func meta(tenantId: String, docId: String) async -> WikiDocMeta? {
        guard let snap = try? await docs(tenantId).document(docId).getDocument(), let data = snap.data() else { return nil }
        return WikiDocMeta(id: snap.documentID, data: data)
    }

    /// Body as Tiptap JSON (`{ type: "doc", content: [...] }`).
    public static func body(tenantId: String, docId: String) async throws -> [String: Any] {
        let snap = try await docs(tenantId).document(docId).collection("body").getDocuments()
        let raw = snap.documents
            .map { (i: ($0.data()["i"] as? NSNumber)?.intValue ?? Int($0.documentID) ?? 0, data: $0.data()["data"] as? String ?? "") }
            .sorted { $0.i < $1.i }.map(\.data).joined()
        guard let data = raw.data(using: .utf8), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["type"] as? String == "doc" else { return WikiContent.emptyDoc }
        return json
    }

    /// Saves title + body if nobody saved since `expectedRev`; returns the new revision.
    public static func save(tenantId: String, docId: String, title: String, json: [String: Any], expectedRev: Int, force: Bool = false) async throws -> Int {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let rawData = try JSONSerialization.data(withJSONObject: json)
        let raw = String(decoding: rawData, as: UTF8.self)
        let chunks = WikiContent.chunks(raw, size: chunkChars)
        let ref = docs(tenantId).document(docId)
        let result = try await PFFirebase.db.runTransaction { transaction, errorPointer -> Any? in
            do {
                let snap = try transaction.getDocument(ref)
                guard let data = snap.data() else { return nil }
                let meta = WikiDocMeta(id: docId, data: data)
                if !force, meta.bodyRev != expectedRev {
                    errorPointer?.pointee = NSError(domain: "wiki", code: 409, userInfo: ["by": meta.updatedByName ?? ""])
                    return nil
                }
                for (index, chunk) in chunks.enumerated() {
                    transaction.setData(["i": index, "data": chunk], forDocument: ref.collection("body").document("\(index)"))
                }
                if meta.bodyChunks > chunks.count {
                    for index in chunks.count..<meta.bodyChunks { transaction.deleteDocument(ref.collection("body").document("\(index)")) }
                }
                var update = WikiContent.derivedMeta(title: title, json: json, linkedTaskRefs: meta.linkedTaskRefs)
                update["title"] = title
                update["bodyChunks"] = chunks.count
                update["bodyRev"] = meta.bodyRev + 1
                update["bodySize"] = raw.utf16.count
                update["updatedBy"] = user.uid
                update["updatedByName"] = user.displayName ?? user.email?.components(separatedBy: "@").first ?? ""
                update["updatedAt"] = FieldValue.serverTimestamp()
                transaction.updateData(update, forDocument: ref)
                return meta.bodyRev + 1
            } catch {
                errorPointer?.pointee = error as NSError
                return nil
            }
        }
        guard let rev = result as? Int else { throw WikiConflict.newerVersion(by: nil) }
        return rev
    }

    /// New page in a space (optionally under a parent), empty body.
    public static func create(tenantId: String, space: WikiSpace, title: String, parentId: String?, order: Double,
                              linkedTaskRefs: [String] = []) async throws -> String {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let ref = docs(tenantId).document()
        let json = WikiContent.emptyDoc
        let raw = String(decoding: try JSONSerialization.data(withJSONObject: json), as: UTF8.self)
        var data: [String: Any] = WikiContent.derivedMeta(title: title, json: json, linkedTaskRefs: linkedTaskRefs)
        let projectId: Any = { if case .project(let id) = space { return id } else { return NSNull() } }()
        data.merge([
            "tenantId": tenantId,
            "spaceType": { if case .project = space { "project" } else { "workspace" } }(),
            "projectId": projectId, "parentId": parentId ?? NSNull(), "order": order, "title": title, "icon": NSNull(),
            "linkedTaskRefs": linkedTaskRefs, "bodyChunks": 1, "bodyRev": 1, "bodySize": raw.utf16.count,
            "createdBy": user.uid, "updatedBy": user.uid, "updatedByName": user.displayName ?? "",
            "createdAt": FieldValue.serverTimestamp(), "updatedAt": FieldValue.serverTimestamp(),
            "archivedAt": NSNull(), "archivedBy": NSNull(),
        ]) { _, new in new }
        let batch = PFFirebase.db.batch()
        batch.setData(data, forDocument: ref)
        batch.setData(["i": 0, "data": raw], forDocument: ref.collection("body").document("0"))
        try await batch.commit()
        return ref.documentID
    }

    public static func link(tenantId: String, docId: String, taskRef: String) async throws {
        try await docs(tenantId).document(docId).updateData(["linkedTaskRefs": FieldValue.arrayUnion([taskRef]),
                                                              "taskRefs": FieldValue.arrayUnion([taskRef])])
    }

    public static func unlink(tenantId: String, docId: String, taskRef: String) async throws {
        try await docs(tenantId).document(docId).updateData(["linkedTaskRefs": FieldValue.arrayRemove([taskRef]),
                                                              "taskRefs": FieldValue.arrayRemove([taskRef])])
    }

    /// Pages linked to or mentioning a task (guests: only their project's pages).
    public static func listenDocs(forTask taskRef: String, tenantId: String, projectId: String, guest: Bool,
                                  onChange: @escaping ([WikiDocMeta]) -> Void) -> ListenerRegistration {
        var query: Query = docs(tenantId)
        if guest { query = query.whereField("spaceType", isEqualTo: "project").whereField("projectId", isEqualTo: projectId) }
        return query.whereField("taskRefs", arrayContains: taskRef).addSnapshotListener { snapshot, _ in
            MainActor.assumeIsolated {
                onChange(snapshot?.documents.map { WikiDocMeta(id: $0.documentID, data: $0.data()) }.filter { !$0.isArchived } ?? [])
            }
        }
    }
}

/// Content helpers mirroring `web/services/wiki/wikiContent.ts`.
public enum WikiContent {
    public static let mentionNode = "wikiMention"
    public static var emptyDoc: [String: Any] { ["type": "doc", "content": [["type": "paragraph"]]] }

    static func chunks(_ value: String, size: Int) -> [String] {
        guard !value.isEmpty else { return [""] }
        var result: [String] = []
        var index = value.startIndex
        while index < value.endIndex {
            let end = value.index(index, offsetBy: size, limitedBy: value.endIndex) ?? value.endIndex
            result.append(String(value[index..<end]))
            index = end
        }
        return result
    }

    private static let blockTypes: Set<String> = ["paragraph", "heading", "listItem", "taskItem", "blockquote", "codeBlock",
                                                  "tableCell", "tableHeader", "detailsSummary", "wikiCallout", "horizontalRule"]

    public static func plainText(_ node: [String: Any]) -> String {
        var out = ""
        func walk(_ current: [String: Any]) {
            let type = current["type"] as? String
            if type == "text" { out += current["text"] as? String ?? ""; return }
            if type == mentionNode { out += "@" + ((current["attrs"] as? [String: Any])?["label"] as? String ?? ""); return }
            if type == "wikiFile" { out += (current["attrs"] as? [String: Any])?["name"] as? String ?? "" }
            if type == "hardBreak" { out += "\n"; return }
            (current["content"] as? [[String: Any]] ?? []).forEach(walk)
            if let type, blockTypes.contains(type) { out += "\n" }
        }
        walk(node)
        return out.replacingOccurrences(of: #"[ \t]+\n"#, with: "\n", options: .regularExpression)
            .replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// `excerpt`, `searchText`, `outLinks`, `mentionTaskRefs`, `mentionedUserIds`, `taskRefs` (same as web `deriveContentMeta`).
    static func derivedMeta(title: String, json: [String: Any], linkedTaskRefs: [String]) -> [String: Any] {
        let plain = plainText(json)
        let flat = plain.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
        let excerpt = flat.count > 200 ? String(flat.prefix(199)).trimmingCharacters(in: .whitespaces) + "…" : flat
        let search = String("\(title)\n\(plain)".lowercased().replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces).prefix(6000))
        var outLinks: [String] = [], tasks: [String] = [], users: [String] = []
        func walk(_ current: [String: Any]) {
            if current["type"] as? String == mentionNode, let attrs = current["attrs"] as? [String: Any], let id = attrs["id"] as? String {
                switch attrs["kind"] as? String {
                case "doc": if !outLinks.contains(id) { outLinks.append(id) }
                case "user": if !users.contains(id) { users.append(id) }
                case "task":
                    if let projectId = attrs["projectId"] as? String, !tasks.contains("\(projectId)/\(id)") { tasks.append("\(projectId)/\(id)") }
                default: break
                }
            }
            (current["content"] as? [[String: Any]] ?? []).forEach(walk)
        }
        walk(json)
        var taskRefs = linkedTaskRefs
        for ref in tasks where !taskRefs.contains(ref) { taskRefs.append(ref) }
        return ["excerpt": excerpt, "searchText": search, "outLinks": outLinks, "mentionTaskRefs": tasks,
                "mentionedUserIds": users, "taskRefs": taskRefs]
    }
}
