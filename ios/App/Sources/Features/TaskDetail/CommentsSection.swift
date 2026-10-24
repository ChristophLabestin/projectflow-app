import SwiftUI
import PFData
import PFDesign
import PFModel

/// Discussion block shared by task and initiative detail: comments plus a composer with `@`
/// autocomplete. Mentioned people go into `mentionedUserIds` (contract C1); the server sends the
/// notifications from the comment text and that array.
struct CommentsSection: View {
    let projectId: String
    let targetId: String
    /// "task" or "initiative" (`Comment.targetType`).
    let targetType: String
    let comments: [Comment]
    /// People that can be mentioned (project members).
    let mentionable: [Person]
    let canComment: Bool

    @Environment(AppModel.self) private var model
    @State private var draft = ""
    /// ✦ in the keyboard toolbar: hidden while typing, back after an 800 ms pause (web `CARET_SPARK_DELAY_MS`).
    @State private var showsSpark = false
    @State private var isSending = false
    @SwiftUI.FocusState private var focused: Bool

    private var query: String? {
        guard let range = draft.range(of: #"@([\p{L}\p{N}_]*)$"#, options: .regularExpression) else { return nil }
        // `@` must start the text or follow whitespace.
        if range.lowerBound > draft.startIndex, !draft[draft.index(before: range.lowerBound)].isWhitespace { return nil }
        return String(draft[range].dropFirst())
    }

    private var suggestions: [Person] {
        guard let query else { return [] }
        return mentionable
            .filter { $0.id != model.uid }
            .filter { query.isEmpty || $0.displayName.localizedCaseInsensitiveContains(query) }
            .prefix(5)
            .map { $0 }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            Text(L10n.t("taskDetail.comments.title", ["count": comments.count]))
                .pfText(.section)
                .foregroundStyle(PFColor.textMain)
                .padding(.horizontal, PFSpace.xxs)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) {
                if comments.isEmpty {
                    Text(L10n.t("taskDetail.comments.empty"))
                        .pfText(.meta)
                        .foregroundStyle(PFColor.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(PFSpace.m)
                } else {
                    ForEach(Array(comments.enumerated()), id: \.element.id) { index, comment in
                        if index > 0 { PFRowDivider(leadingInset: 58) }
                        commentRow(comment)
                    }
                }
                if canComment {
                    PFRowDivider()
                    composer
                }
            }
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfCard()
        }
    }

    // MARK: Rows

    private func commentRow(_ comment: Comment) -> some View {
        HStack(alignment: .top, spacing: PFSpace.s) {
            PFAvatar(name: comment.userDisplayName, seed: comment.userId, imageURL: comment.userPhotoURL, size: 30)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(comment.userDisplayName).pfText(.metaStrong).foregroundStyle(PFColor.textMain).lineLimit(1)
                    if let date = comment.createdAt?.instant {
                        Text(Formatting.relative(date)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    }
                    Spacer(minLength: 0)
                    if comment.userId == model.uid {
                        Button { confirmDelete(comment) } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(PFColor.textMuted)
                                .frame(width: 32, height: 28)
                                .contentShape(.rect)
                        }
                        .buttonStyle(.pfPressable)
                        .accessibilityLabel(L10n.t("taskDetail.comments.delete"))
                    }
                }
                Text(highlighted(comment.content))
                    .pfText(.body)
                    .foregroundStyle(PFColor.textMain)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
        .padding(PFSpace.m)
        .accessibilityElement(children: .combine)
    }

    /// Own comments can be deleted (rules allow only the author).
    private func confirmDelete(_ comment: Comment) {
        let projectId = projectId
        model.presenter.present(detents: [.fit]) {
            ProjectConfirmSheet(title: L10n.t("taskDetail.comments.delete.title"), message: L10n.t("taskDetail.comments.delete.message"),
                                confirmTitle: L10n.t("taskDetail.comments.delete")) {
                guard let actions = model.planning else { return }
                Task {
                    if await model.perform({ try await actions.deleteComment(projectId: projectId, commentId: comment.id) }) {
                        PFHaptics.success()
                        model.toasts.show(PFToast(L10n.t("taskDetail.comments.deleted"), style: .success))
                    }
                }
            }
        }
    }

    /// `@Name` tokens for known people stand out (bold, like the web chip).
    private func highlighted(_ content: String) -> AttributedString {
        var result = AttributedString(content)
        let names = mentionable.map(\.displayName).filter { !$0.isEmpty }.sorted { $0.count > $1.count }
        for name in names {
            let pattern = "@" + NSRegularExpression.escapedPattern(for: name) + #"(?=\s|[.,!?;:]|$)"#
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let range = NSRange(content.startIndex..., in: content)
            for match in regex.matches(in: content, range: range) {
                guard let stringRange = Range(match.range, in: content), let attributedRange = Range(stringRange, in: result) else { continue }
                result[attributedRange].font = .system(size: 17, weight: .bold)
                result[attributedRange].backgroundColor = PFColor.raised
            }
        }
        return result
    }

    // MARK: Composer

    private var composer: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !suggestions.isEmpty {
                VStack(spacing: 0) {
                    ForEach(suggestions) { person in
                        Button { insert(person) } label: {
                            HStack(spacing: PFSpace.s) {
                                PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 26)
                                Text(person.displayName).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                                Spacer()
                            }
                            .padding(.horizontal, PFSpace.m)
                            .frame(minHeight: 44)
                            .contentShape(.rect)
                        }
                        .buttonStyle(.pfPressable)
                    }
                    PFRowDivider(leadingInset: 0)
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
            HStack(alignment: .bottom, spacing: PFSpace.xs) {
                TextField("", text: $draft, prompt: Text(L10n.t("taskDetail.comments.placeholder")).foregroundStyle(PFColor.textSubtle), axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...6)
                    .pfText(.body)
                    .foregroundStyle(PFColor.textMain)
                    .focused($focused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(PFColor.raised, in: .rect(cornerRadius: 20, style: .continuous))
                    .toolbar {
                        ToolbarItemGroup(placement: .keyboard) {
                            if focused, model.showsInAppAi, showsSpark {
                                Spacer()
                                Button { presentAiAssist() } label: {
                                    Text("✦").font(.system(size: 16, weight: .semibold)).foregroundStyle(PFColor.textMuted)
                                }
                                .accessibilityLabel(L10n.t("ai.open"))
                            }
                        }
                    }
                    .task(id: "\(draft.count)|\(focused)") {
                        showsSpark = false
                        try? await Task.sleep(for: .milliseconds(800))
                        if !Task.isCancelled { showsSpark = true }
                    }
                Button(action: send) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(PFColor.onPrimary)
                        .frame(width: 40, height: 40)
                        .background(PFColor.primary, in: .circle)
                        .opacity(canSend ? 1 : 0.35)
                }
                .buttonStyle(.pfPressable)
                .disabled(!canSend)
                .accessibilityLabel(L10n.t("taskDetail.comments.send"))
            }
            .padding(PFSpace.xs)
        }
        .animation(PFMotion.respecting(PFMotion.fast), value: suggestions.map(\.id))
    }

    private var canSend: Bool { !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending }

    private func insert(_ person: Person) {
        guard let range = draft.range(of: #"@([\p{L}\p{N}_]*)$"#, options: .regularExpression) else { return }
        PFHaptics.selection()
        draft.replaceSubrange(range, with: "@\(person.displayName) ")
    }

    /// People whose `@Name` appears in the text (same matching as the web comment section).
    private func mentionedIds(in content: String) -> [String] {
        var ids: [String] = []
        for person in mentionable where person.id != model.uid {
            let pattern = "@" + NSRegularExpression.escapedPattern(for: person.displayName) + #"(\s|[.,!?;:]|$)"#
            if content.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil { ids.append(person.id) }
        }
        return ids
    }

    private func send() {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty, let actions = model.actions else { return }
        isSending = true
        let mentions = mentionedIds(in: content)
        Task {
            let ok = await model.perform {
                try await actions.addComment(projectId: projectId, targetId: targetId, targetType: targetType, content: content,
                                             mentionedUserIds: mentions, photoURL: model.profile?.photoURL)
            }
            isSending = false
            if ok {
                PFHaptics.success()
                draft = ""
            }
        }
    }

    private func presentAiAssist() {
        let text = draft
        model.presenter.present(detents: [.fit]) {
            AiFieldAssistSheet(field: .comment, text: text) { result in draft = result }
        }
    }

}
