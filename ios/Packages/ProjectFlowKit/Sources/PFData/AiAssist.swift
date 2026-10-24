import Foundation
import FirebaseAuth

// In-app AI (contract: side-session note `ios-in-app-ai-contract.md`, web `web/components/ai/`). The AI has no name:
// only "✦" / "✦ KI". Server decides access (policy + billing); plan refusals come back as codes, not failures.

/// One server-sent event of `aiAssist`.
public enum AiEvent: Sendable, Equatable {
    case context(projectTitle: String?, taskTitle: String?)
    case step(tool: String)
    case delta(String)
    case proposal(AiProposal)
    case done
    case error(code: String, message: String)
}

/// Action card: runs only after the user confirms (`aiApplyProposal`), undoable for 24 h (`aiUndoProposal`).
public struct AiProposal: Sendable, Equatable, Identifiable, Hashable {
    public struct Change: Sendable, Equatable, Hashable {
        public let field: String
        public let from: String?
        public let to: String
        public init(field: String, from: String?, to: String) { self.field = field; self.from = from; self.to = to }
    }
    public let id: String
    public let tool: String
    public let projectId: String?
    public let projectTitle: String?
    public let taskId: String?
    public let taskTitle: String?
    public let changes: [Change]

    public init(id: String, tool: String, projectId: String?, projectTitle: String?, taskId: String?, taskTitle: String?, changes: [Change]) {
        self.id = id; self.tool = tool; self.projectId = projectId; self.projectTitle = projectTitle
        self.taskId = taskId; self.taskTitle = taskTitle; self.changes = changes
    }

    init?(json: [String: Any]) {
        guard let id = json["id"] as? String, let tool = json["tool"] as? String else { return nil }
        let target = json["target"] as? [String: Any] ?? [:]
        let changes = (json["changes"] as? [[String: Any]] ?? []).compactMap { change -> Change? in
            guard let field = change["field"] as? String else { return nil }
            return Change(field: field, from: Self.text(change["from"]), to: Self.text(change["to"]) ?? "")
        }
        self.init(id: id, tool: tool, projectId: target["projectId"] as? String, projectTitle: target["projectTitle"] as? String,
                  taskId: target["taskId"] as? String, taskTitle: target["taskTitle"] as? String, changes: changes)
    }

    private static func text(_ value: Any?) -> String? {
        switch value {
        case let string as String: string
        case let number as NSNumber: number.stringValue
        case nil, is NSNull: nil
        default: String(describing: value!)
        }
    }
}

/// Write actions for a field (`capability: "write"`).
public enum AiWriteAction: String, Sendable, CaseIterable {
    case draft, expand, shorten, rephrase, friendlier, formal, bullets, translate, fix, custom
}

/// Which field the text belongs to (`input.field`).
public enum AiField: String, Sendable { case description, comment, title, wiki, freeText }

/// Context for "Frag ProjectFlow" (`capability: "assist"`).
public struct AiAskContext: Sendable, Equatable {
    public enum Entity: Sendable, Equatable { case task(id: String, projectId: String), project(id: String) }
    public var surface: String
    public var projectId: String?
    public var entity: Entity?
    public var selectionText: String?

    public init(surface: String, projectId: String? = nil, entity: Entity? = nil, selectionText: String? = nil) {
        self.surface = surface; self.projectId = projectId; self.entity = entity; self.selectionText = selectionText
    }

    var json: [String: Any] {
        var context: [String: Any] = ["surface": surface]
        if let projectId { context["projectId"] = projectId }
        switch entity {
        case .task(let id, let projectId): context["entity"] = ["kind": "task", "id": id, "projectId": projectId]
        case .project(let id): context["entity"] = ["kind": "project", "id": id]
        case nil: break
        }
        if let selectionText, !selectionText.isEmpty { context["selection"] = ["text": String(selectionText.prefix(600))] }
        return context
    }

    /// History document id suffix (`users/{uid}/ai_threads/{tenantId}__{key}`).
    public var threadKey: String {
        switch entity {
        case .task(let id, _): "task-\(id)"
        case .project(let id): "project-\(id)"
        case nil: surface
        }
    }
}

public struct AiMessage: Sendable, Equatable, Codable {
    public enum Role: String, Sendable, Codable { case user, assistant }
    public let role: Role
    public let content: String
    public init(role: Role, content: String) { self.role = role; self.content = content }
}

/// Plan refusals: show a hint, never an error (contract "Freischaltung").
public enum AiErrorCode {
    public static let planCodes: Set<String> = ["ai-addon-required", "ai-plan-required", "ai-not-enabled", "credits-exhausted"]
}

public enum AiAssist {
    /// DEBUG/QA: scripted events instead of the network (`-pfAiFake`), for simulators without an OpenAI key.
    nonisolated(unsafe) public static var fake: (@Sendable ([String: Any]) -> [AiEvent])?

    static var endpoint: URL {
        switch PFFirebase.backend {
        case .production:
            URL(string: "https://app.getprojectflow.com/api/assist")!
        case let .emulator(host, _, _, functionsPort, _):
            URL(string: "http://\(host):\(functionsPort)/demo-projectflow/\(PFFirebase.functionsRegion)/aiAssist")!
        }
    }

    // MARK: Requests

    public static func write(tenantId: String, language: String, action: AiWriteAction, field: AiField, text: String,
                             instruction: String? = nil, itemTitle: String? = nil, projectTitle: String? = nil,
                             before: String? = nil, after: String? = nil) -> AsyncThrowingStream<AiEvent, Error> {
        var input: [String: Any] = ["action": action.rawValue, "field": field.rawValue, "text": text]
        if let instruction, !instruction.isEmpty { input["instruction"] = String(instruction.prefix(300)) }
        if let itemTitle { input["itemTitle"] = itemTitle }
        if let projectTitle { input["projectTitle"] = projectTitle }
        if let before, !before.isEmpty { input["before"] = String(before.suffix(600)) }
        if let after, !after.isEmpty { input["after"] = String(after.prefix(600)) }
        return stream(["tenantId": tenantId, "language": language, "capability": "write", "input": input])
    }

    public static func ask(tenantId: String, language: String, messages: [AiMessage], context: AiAskContext) -> AsyncThrowingStream<AiEvent, Error> {
        let trimmed = messages.suffix(20).map { ["role": $0.role.rawValue, "content": $0.content] }
        return stream(["tenantId": tenantId, "language": language, "capability": "assist", "messages": trimmed, "context": context.json])
    }

    // MARK: Proposals and policy

    public struct ApplyResult: Sendable { public let canUndo: Bool; public let createdId: String? }

    public static func apply(_ proposal: AiProposal) async throws -> ApplyResult {
        if fake != nil { return ApplyResult(canUndo: true, createdId: nil) }
        let data = try await PFCallables.call("aiApplyProposal", ["proposalId": proposal.id]) as? [String: Any]
        return ApplyResult(canUndo: data?["canUndo"] as? Bool ?? false, createdId: data?["createdId"] as? String)
    }

    public static func undo(_ proposal: AiProposal) async throws {
        if fake != nil { return }
        _ = try await PFCallables.call("aiUndoProposal", ["proposalId": proposal.id])
    }

    /// `ai_config/policy`: in-app AI on for this workspace (`inAppAi == true && inAppEnabled != false`).
    public static func inAppEnabled(tenantId: String) async -> Bool {
        if fake != nil { return true }
        guard let data = try? await PFCallables.call("getWorkspaceAiPolicy", ["tenantId": tenantId]) as? [String: Any],
              let policy = data["policy"] as? [String: Any] else { return false }
        return policy["inAppAi"] as? Bool == true && policy["inAppEnabled"] as? Bool != false
    }

    // MARK: Transport

    static func stream(_ body: [String: Any]) -> AsyncThrowingStream<AiEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                if let fake {
                    for event in fake(body) {
                        try? await Task.sleep(for: .milliseconds(event.isDelta ? 35 : 260))
                        continuation.yield(event)
                    }
                    continuation.finish()
                    return
                }
                do {
                    guard let user = Auth.auth().currentUser else { throw URLError(.userAuthenticationRequired) }
                    let token = try await user.getIDToken()
                    var request = URLRequest(url: endpoint)
                    request.httpMethod = "POST"
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    request.httpBody = try JSONSerialization.data(withJSONObject: body)
                    request.timeoutInterval = 90
                    let (bytes, response) = try await URLSession.shared.bytes(for: request)
                    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                    guard (200..<300).contains(status) else {
                        var raw = Data()
                        for try await byte in bytes { raw.append(byte); if raw.count > 4096 { break } }
                        let json = (try? JSONSerialization.jsonObject(with: raw)) as? [String: Any]
                        let code = json?["code"] as? String ?? (status == 402 ? "ai-plan-required" : status == 401 ? "unauthenticated" : "internal")
                        continuation.yield(.error(code: code, message: json?["message"] as? String ?? ""))
                        continuation.finish()
                        return
                    }
                    // `event: <name>` then one `data: <json>` line per event (blank separator lines may be skipped).
                    var name = "message"
                    for try await line in bytes.lines {
                        if line.hasPrefix("event:") {
                            name = line.dropFirst(6).trimmingCharacters(in: .whitespaces)
                        } else if line.hasPrefix("data:") {
                            let payload = Data(line.dropFirst(5).trimmingCharacters(in: .whitespaces).utf8)
                            let json = (try? JSONSerialization.jsonObject(with: payload)) as? [String: Any] ?? [:]
                            if let event = Self.event(name, json) { continuation.yield(event) }
                            name = "message"
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    static func event(_ name: String, _ json: [String: Any]) -> AiEvent? {
        switch name {
        case "context":
            return .context(projectTitle: (json["project"] as? [String: Any])?["title"] as? String,
                            taskTitle: (json["task"] as? [String: Any])?["title"] as? String)
        case "step": return (json["tool"] as? String).map { .step(tool: $0) }
        case "delta": return (json["text"] as? String).map { .delta($0) }
        case "proposal": return AiProposal(json: json).map { .proposal($0) }
        case "done": return .done
        case "error": return .error(code: json["code"] as? String ?? "internal", message: json["message"] as? String ?? "")
        default: return nil
        }
    }
}

extension AiEvent {
    var isDelta: Bool { if case .delta = self { true } else { false } }
}
