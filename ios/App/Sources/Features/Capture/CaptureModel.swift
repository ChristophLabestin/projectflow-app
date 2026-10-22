import SwiftUI
import Observation
import PFData
import PFDesign
import PFDomain
import PFModel

/// Where a capture starts from (pre-filled project, text from Siri/share, focus option).
struct CaptureContext: Hashable {
    var projectId: String?
    var initialText: String?
    var dueDate: FlexDate?
    var priority: TaskPriority?
    var offerFocus = true

    static let blank = CaptureContext()
}

@MainActor
enum CaptureLauncher {
    /// Opens the capture composer as a custom sheet with the keyboard up (concept §5.3).
    static func present(model: AppModel, context: CaptureContext = .blank) {
        guard model.workspace != nil else { return }
        let capture = CaptureModel(model: model, context: context)
        model.presenter.present(detents: [.fit]) {
            CaptureComposerView(capture: capture)
        }
    }
}

/// State of one open composer: the typed text, what the parser found, and the explicit chip choices.
/// Chips are the source of truth: choosing a value switches the matching text highlight off.
@Observable
final class CaptureModel {
    enum Panel: Hashable { case date, project, priority, assignee }

    struct Suggestion: Identifiable, Hashable {
        let id: String
        let label: String
        let insertion: String
        let isPerson: Bool
        let photoURL: String?
    }

    let model: AppModel
    let context: CaptureContext

    private(set) var text: String
    private(set) var parsed = CaptureParseResult(title: "", tokens: [])
    private var dismissed: Set<String> = []

    /// `nil` = follow tokens/context; `.some(nil)` = explicitly personal.
    private var explicitProject: String??
    /// `nil` = follow tokens/context; `.some(nil)` = explicitly no date.
    private var explicitDue: FlexDate??
    private var explicitAssignee: String?
    var priority: TaskPriority?
    var startFocus = false
    var panel: Panel?
    var isFocused = true

    init(model: AppModel, context: CaptureContext) {
        self.model = model
        self.context = context
        self.text = context.initialText ?? ""
        self.priority = context.priority
        reparse()
    }

    // MARK: Workspace data

    private var workspace: WorkspaceStore? { model.workspace }

    /// Projects a task can be created in: open, non-personal projects the user can see.
    var projects: [Project] {
        (workspace?.projects ?? []).filter { !$0.isPersonal && $0.status.lifecycle != .closed }
    }

    func members(of projectId: String?) -> [Person] {
        guard let workspace, let project = workspace.project(projectId) else { return [] }
        let ids = Set(project.memberIds + [project.ownerId].compactMap { $0 })
        let everyone = Array(workspace.people.values)
        let members = ids.isEmpty ? everyone : everyone.filter { ids.contains($0.id) }
        return members.sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    // MARK: Effective values

    /// Project id, or nil for a personal task.
    var projectId: String? {
        if let explicitProject { return explicitProject }
        return parsed.projectId ?? context.projectId.flatMap { workspace?.project($0) != nil ? $0 : nil }
    }

    var project: Project? { workspace?.project(projectId) }
    var isPersonal: Bool { projectId == nil }

    var dueDate: FlexDate? {
        if let explicitDue { return explicitDue }
        return parsed.dueDate ?? context.dueDate
    }

    var assigneeId: String? {
        guard !isPersonal else { return nil }
        return explicitAssignee ?? parsed.personId ?? model.uid
    }

    var assigneeIsMe: Bool { isPersonal || assigneeId == model.uid }
    var assignee: Person? { workspace?.person(assigneeId) }

    var title: String { parsed.title }
    var canSave: Bool { !title.isEmpty }
    var offersFocus: Bool { context.offerFocus && assigneeIsMe }

    var highlights: [NSRange] { parsed.tokens.map(\.range) }

    // MARK: Editing

    func setText(_ value: String) {
        guard value != text else { return }
        text = value
        reparse()
    }

    func dismissToken(at range: NSRange) {
        guard let token = parsed.tokens.first(where: { $0.range == range }) else { return }
        dismissed.insert(token.key)
        PFHaptics.selection()
        withAnimation(PFMotion.fast) { reparse() }
    }

    func setProject(_ id: String?) {
        explicitProject = .some(id)
        dismissTokens(of: .project)
        if id == nil { explicitAssignee = nil; dismissTokens(of: .person) }
        reparse()
    }

    func setDue(_ day: FlexDate?) {
        explicitDue = .some(day)
        dismissTokens(of: .date)
        reparse()
    }

    func setAssignee(_ id: String?) {
        explicitAssignee = id
        dismissTokens(of: .person)
        reparse()
    }

    private func dismissTokens(of kind: CaptureToken.Kind) {
        for token in parsed.tokens where token.kind == kind { dismissed.insert(token.key) }
    }

    func toggle(_ panel: Panel) {
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { self.panel = self.panel == panel ? nil : panel }
    }

    // MARK: Parsing

    private func options(people: [Person]) -> CaptureParser.Options {
        CaptureParser.Options(
            now: .now, calendar: Formatting.calendar,
            projects: projects.map { CaptureEntity(id: $0.id, name: $0.title) },
            people: people.map { CaptureEntity(id: $0.id, name: $0.displayName) },
            dismissed: dismissed
        )
    }

    private func reparse() {
        // First pass finds a `#project`; `@person` only makes sense once the task lives in a project.
        let first = CaptureParser.parse(text, options: options(people: []))
        let targetId = explicitProject ?? first.projectId ?? context.projectId
        guard let targetId, workspace?.project(targetId) != nil else {
            parsed = first
            return
        }
        parsed = CaptureParser.parse(text, options: options(people: members(of: targetId)))
    }

    // MARK: Suggestions while typing `#` / `@`

    var suggestions: [Suggestion] {
        guard let range = text.range(of: #"(?:^|\s)([#@])([^\s]*)$"#, options: .regularExpression) else { return [] }
        let fragment = String(text[range]).trimmingCharacters(in: .whitespaces)
        let sigil = fragment.first
        let query = SearchQuery.normalize(String(fragment.dropFirst()))
        let terms = query.split(whereSeparator: { "-_".contains($0) }).map(String.init)
        if sigil == "#" {
            return SearchRanker.rank(projects, terms: terms, title: \.title, limit: 6).map { project in
                Suggestion(id: project.id, label: project.title, insertion: "#" + Self.slug(project.title), isPerson: false, photoURL: nil)
            }
        }
        let people = members(of: projectId)
        return SearchRanker.rank(people.sorted { $0.displayName < $1.displayName }, terms: terms, title: \.displayName, limit: 6).map { person in
            Suggestion(id: person.id, label: person.displayName, insertion: "@" + Self.slug(person.displayName.split(separator: " ").first.map(String.init) ?? person.displayName),
                       isPerson: true, photoURL: person.photoURL)
        }
    }

    func apply(_ suggestion: Suggestion) {
        guard let range = text.range(of: #"(?:^|\s)([#@])([^\s]*)$"#, options: .regularExpression) else { return }
        let prefix = text[range].first?.isWhitespace == true ? " " : ""
        setText(String(text[..<range.lowerBound]) + prefix + suggestion.insertion + " ")
        PFHaptics.selection()
    }

    static func slug(_ name: String) -> String {
        let allowed = name.lowercased().map { $0.isLetter || $0.isNumber ? String($0) : "-" }.joined()
        return allowed.split(separator: "-", omittingEmptySubsequences: true).joined(separator: "-")
    }

    // MARK: Save

    /// Creates the task and closes the composer right away. Writes go to the local Firestore cache first
    /// (offline-safe); the server confirmation is never awaited on the main path.
    func save() {
        guard canSave, let workspace, let actions = model.actions else { return }
        let title = title
        let due = dueDate
        let priority = priority
        let projectId = projectId
        let assignee = assigneeId
        let wantsFocus = startFocus && offersFocus
        let known = Set(workspace.myTasks.map(\.id) + workspace.personalTasks.map(\.id))
        let model = model
        let online = model.network.isOnline

        PFHaptics.success()
        model.presenter.dismiss()
        model.toasts.show(PFToast(online ? L10n.t("capture.saved") : L10n.t("capture.savedOffline"), style: .success))

        Task {
            do {
                if let projectId {
                    try await actions.createTask(projectId: projectId, title: title, dueDate: due, priority: priority,
                                                 assigneeIds: assignee.map { [$0] })
                } else {
                    try await actions.createPersonalTask(title: title, dueDate: due, priority: priority)
                }
            } catch {
                model.toasts.show(PFToast(L10n.t("common.error"), style: .error))
            }
        }
        if wantsFocus {
            Task { await Self.startFocusWhenVisible(model: model, title: title, personal: projectId == nil, known: known) }
        }
    }

    /// The new item shows up in the live listeners immediately (latency compensation), also offline.
    private static func startFocusWhenVisible(model: AppModel, title: String, personal: Bool, known: Set<String>) async {
        for _ in 0..<40 {
            if let workspace = model.workspace {
                if personal, let item = workspace.personalTasks.first(where: { !known.contains($0.id) && $0.title == title }) {
                    await FocusController(model: model).start(personal: item)
                    return
                }
                if !personal, let item = workspace.myTasks.first(where: { !known.contains($0.id) && $0.title == title }) {
                    await FocusController(model: model).start(task: item)
                    return
                }
            }
            try? await Task.sleep(for: .milliseconds(100))
        }
    }
}
