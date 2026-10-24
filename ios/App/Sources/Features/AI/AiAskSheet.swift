import SwiftUI
import PFData
import PFDesign
import PFModel

/// "Frag ProjectFlow" (the iOS counterpart of ⌘J): one input line with a context tag, the short streamed answer and
/// action cards that only run after confirmation. Plain system surfaces, no gradients or glow.
struct AiAskSheet: View {
    let context: AiAskContext
    var initialQuestion: String?

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter

    private struct Turn: Identifiable {
        let id = UUID()
        let question: String
        var answer = ""
        var step: String?
        var proposals: [AiProposal] = []
        var hint: String?
        var failed = false
    }

    private enum ProposalState: Equatable { case open, working, applied(canUndo: Bool), undone, dismissed }

    @State private var input = ""
    @State private var turns: [Turn] = []
    @State private var contextTitle: String?
    @State private var running: Task<Void, Never>?
    @State private var proposalStates: [String: ProposalState] = [:]
    @SwiftUI.FocusState private var focused: Bool

    private var isRunning: Bool { running != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            HStack(spacing: PFSpace.xs) {
                Text(L10n.t("ai.badge")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                Text(L10n.t("ai.ask.title")).pfText(.section).foregroundStyle(PFColor.textMain)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                if !turns.isEmpty, !isRunning {
                    Button { turns = []; proposalStates = [:] } label: {
                        Text(L10n.t("ai.ask.new")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted).frame(minHeight: 32)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            contextTag
            if turns.isEmpty {
                Text(L10n.t("ai.ask.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                // The sheet scrolls itself; the input line is pinned as its footer, above the keyboard.
                VStack(alignment: .leading, spacing: PFSpace.l) {
                    ForEach(turns) { turn in turnView(turn).id(turn.id) }
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.bottom, PFSpace.l)
        .pfSheetFooter([isRunning ? 1 : 0, input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 1 : 0]) { inputRow.padding(.horizontal, PFSpace.page).padding(.vertical, PFSpace.xs) }
        .environment(\.openURL, OpenURLAction { url in route(url) })
        .onAppear {
            if let initialQuestion, !initialQuestion.isEmpty { send(initialQuestion) } else { focused = true }
        }
        .onDisappear { running?.cancel() }
    }

    // MARK: Pieces

    private var contextTag: some View {
        let label: String = switch context.entity {
        case .task: L10n.t("ai.ask.context.task")
        case .project: L10n.t("ai.ask.context.project")
        case nil: L10n.t("ai.ask.context.today")
        }
        return HStack(spacing: 6) {
            Image(systemName: context.entity == nil ? "sun.horizon" : "scope").font(.system(size: 11, weight: .semibold))
            Text(contextTitle.map { "\(label): \($0)" } ?? label).lineLimit(1)
        }
        .pfText(.metaStrong)
        .foregroundStyle(PFColor.textMuted)
        .padding(.horizontal, 10)
        .frame(minHeight: 26)
        .background(PFColor.raised, in: .capsule)
    }

    private var inputRow: some View {
        HStack(spacing: PFSpace.xs) {
            TextField("", text: $input, prompt: Text(L10n.t("ai.ask.placeholder")).foregroundStyle(PFColor.textSubtle), axis: .vertical)
                .pfText(.body)
                .foregroundStyle(PFColor.textMain)
                .lineLimit(1...4)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit { send(input) }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(PFColor.sheetGroup, in: .rect(cornerRadius: 20, style: .continuous))
            if isRunning {
                PFIconButton("stop.fill", label: L10n.t("ai.ask.stop"), style: .raised) { running?.cancel(); running = nil }
            } else {
                PFIconButton("arrow.up", label: L10n.t("ai.ask.send"), style: .primary) { send(input) }
                    .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .opacity(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1)
            }
        }
    }

    private func turnView(_ turn: Turn) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(turn.question).pfText(.bodyEmphasis).foregroundStyle(PFColor.textMain)
                .fixedSize(horizontal: false, vertical: true)
            if let step = turn.step, turn.answer.isEmpty {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.mini)
                    Text(step).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
            }
            if !turn.answer.isEmpty {
                AiMarkdownText(turn.answer)
            }
            if let hint = turn.hint {
                Label(hint, systemImage: turn.failed ? "exclamationmark.circle" : "info.circle")
                    .pfText(.meta)
                    .foregroundStyle(turn.failed ? PFColor.dangerText : PFColor.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ForEach(turn.proposals) { proposal in proposalCard(proposal) }
        }
    }

    private func proposalCard(_ proposal: AiProposal) -> some View {
        let state = proposalStates[proposal.id] ?? .open
        return VStack(alignment: .leading, spacing: PFSpace.xs) {
            HStack(spacing: 6) {
                Text(L10n.t("ai.proposal.\(proposal.tool)")).pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                if let title = proposal.taskTitle ?? proposal.projectTitle {
                    Text("· \(title)").pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
            }
            ForEach(proposal.changes, id: \.self) { change in
                VStack(alignment: .leading, spacing: 2) {
                    if let from = change.from, !from.isEmpty {
                        Text(from).pfText(.meta).foregroundStyle(PFColor.textMuted).strikethrough()
                    }
                    Text(change.to).pfText(.body).foregroundStyle(PFColor.textMain)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: PFSpace.xs) {
                switch state {
                case .open, .working:
                    PFButton(L10n.t("ai.proposal.apply"), kind: .primary, size: .small) { apply(proposal) }
                        .disabled(state == .working)
                    PFButton(L10n.t("ai.proposal.dismiss"), kind: .ghost, size: .small) { proposalStates[proposal.id] = .dismissed }
                        .disabled(state == .working)
                case .applied(let canUndo):
                    Label(L10n.t("ai.proposal.applied"), systemImage: "checkmark").pfText(.metaStrong).foregroundStyle(PFColor.successText)
                    if canUndo {
                        PFButton(L10n.t("ai.proposal.undo"), kind: .ghost, size: .small) { undo(proposal) }
                    }
                case .undone:
                    Text(L10n.t("ai.proposal.undone")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                case .dismissed:
                    Text(L10n.t("ai.proposal.dismissed")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                }
            }
            .padding(.top, 2)
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
    }

    // MARK: Actions

    private func send(_ text: String) {
        let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isRunning, let tenantId = model.workspace?.tenantId else { return }
        input = ""
        var history: [AiMessage] = []
        for turn in turns where !turn.failed {
            history.append(AiMessage(role: .user, content: turn.question))
            if !turn.answer.isEmpty { history.append(AiMessage(role: .assistant, content: turn.answer)) }
        }
        history.append(AiMessage(role: .user, content: question))
        turns.append(Turn(question: question, step: L10n.t("ai.step.generic")))
        let index = turns.count - 1
        let language = L10n.language.rawValue
        let context = context
        running = Task {
            defer { running = nil }
            do {
                for try await event in AiAssist.ask(tenantId: tenantId, language: language, messages: history, context: context) {
                    guard turns.indices.contains(index) else { break }
                    switch event {
                    case .context(let project, let task): contextTitle = task ?? project
                    case .step(let tool): turns[index].step = stepText(tool)
                    case .delta(let text): turns[index].answer += text
                    case .proposal(let proposal): turns[index].proposals.append(proposal)
                    case .done: break
                    case .error(let code, _):
                        turns[index].hint = model.aiMessage(code: code)
                        turns[index].failed = !AppModel.aiIsPlanHint(code)
                    }
                }
            } catch is CancellationError {
            } catch {
                if turns.indices.contains(index) {
                    turns[index].hint = L10n.t("ai.error.generic")
                    turns[index].failed = true
                }
            }
        }
    }

    private func stepText(_ tool: String) -> String {
        let key = "ai.tool.\(tool)"
        let name = L10n.t(key)
        return name == key ? L10n.t("ai.step.generic") : L10n.t("ai.step.read", ["name": name])
    }

    private func apply(_ proposal: AiProposal) {
        proposalStates[proposal.id] = .working
        Task {
            do {
                let result = try await AiAssist.apply(proposal)
                proposalStates[proposal.id] = .applied(canUndo: result.canUndo)
                PFHaptics.success()
            } catch {
                proposalStates[proposal.id] = .open
                model.toasts.show(PFToast(model.errorMessage(error), style: .error))
            }
        }
    }

    private func undo(_ proposal: AiProposal) {
        Task {
            do {
                try await AiAssist.undo(proposal)
                proposalStates[proposal.id] = .undone
            } catch {
                model.toasts.show(PFToast(model.errorMessage(error), style: .error))
            }
        }
    }

    /// `pf://task/{projectId}/{taskId}` and `pf://project/{projectId}` open in the app; other links stay text.
    private func route(_ url: URL) -> OpenURLAction.Result {
        guard url.scheme == "pf", let tenantId = model.workspace?.tenantId else { return .discarded }
        let parts = url.pathComponents.filter { $0 != "/" }
        switch url.host() {
        case "task" where parts.count >= 2:
            presenter.dismiss()
            model.router.push(.task(TaskRef(tenantId: tenantId, projectId: parts[0], taskId: parts[1])))
        case "project" where parts.count >= 1:
            presenter.dismiss()
            model.router.push(.project(tenantId: tenantId, projectId: parts[0]))
        default:
            return .discarded
        }
        return .handled
    }
}

/// Markdown-light answer: **bold**, `code`, "- " lists and `pf://` links; other links render as plain text and images
/// are dropped (contract).
struct AiMarkdownText: View {
    let lines: [String]

    init(_ text: String) {
        lines = text.components(separatedBy: "\n")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if trimmed.isEmpty {
                    Color.clear.frame(height: 2)
                } else if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("•").foregroundStyle(PFColor.textMuted)
                        Text(Self.attributed(String(trimmed.dropFirst(2))))
                    }
                    .pfText(.body)
                    .foregroundStyle(PFColor.textMain)
                } else {
                    Text(Self.attributed(trimmed)).pfText(.body).foregroundStyle(PFColor.textMain)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    static func attributed(_ line: String) -> AttributedString {
        var cleaned = line.replacingOccurrences(of: #"!\[[^\]]*\]\([^)]*\)"#, with: "", options: .regularExpression)
        // Only pf:// links stay links.
        cleaned = cleaned.replacingOccurrences(of: #"\[([^\]]+)\]\((?!pf://)[^)]*\)"#, with: "$1", options: .regularExpression)
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        return (try? AttributedString(markdown: cleaned, options: options)) ?? AttributedString(line)
    }
}
