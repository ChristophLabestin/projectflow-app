import Foundation
import Observation
import FirebaseFirestore
import PFData
import PFModel

/// Comment excerpts for mention/comment entries, loaded once per comment (local cache first).
@Observable
final class InboxContentCache {
    private var comments: [String: String] = [:]
    private var requested: Set<String> = []

    /// The comment text as a short quote, or nil while it is not loaded.
    func excerpt(for commentId: String) -> String? {
        guard let text = comments[commentId] else { return nil }
        return L10n.t("inbox.quote", ["text": text])
    }

    func loadComments(for items: [InboxItem]) async {
        for item in items where item.kind == .commentMention || item.kind == .commentAdded {
            guard let commentId = item.commentId, let projectId = item.projectId, !requested.contains(commentId) else { continue }
            requested.insert(commentId)
            guard let snapshot = try? await PFPath.comments(item.tenantId, projectId).document(commentId).getDocument(),
                  let content = snapshot.data()?["content"] as? String else { continue }
            let collapsed = content.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).joined(separator: " ")
            if !collapsed.isEmpty { comments[commentId] = collapsed }
        }
    }
}
