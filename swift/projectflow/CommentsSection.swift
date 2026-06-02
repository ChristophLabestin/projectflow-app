import SwiftUI
import FirebaseAuth

struct CommentsSection: View {
    let tenantId: String
    let projectId: String
    let targetId: String
    let targetType: String
    let permissions: PermissionContext
    @ObservedObject var store: CommentsStore

    @State private var draft = ""
    @State private var isPosting = false
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                Text("Comments").font(.headline)
                if store.comments.isEmpty {
                    Text("No comments yet.").font(.subheadline).foregroundStyle(colors.textMuted)
                } else {
                    ForEach(store.comments, id: \.id) { comment in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(comment.userDisplayName).font(.caption.weight(.semibold))
                            Text(comment.content).font(.subheadline)
                        }
                        .padding(.vertical, 4)
                        if comment.id != store.comments.last?.id {
                            Divider()
                        }
                    }
                }
                if PermissionEvaluator(context: permissions).allows(PermissionNode.commentsCreate) {
                    HStack {
                        TextField("Add a comment…", text: $draft, axis: .vertical)
                            .lineLimit(1...3)
                        Button {
                            Task { await post() }
                        } label: {
                            Image(systemName: "paperplane.fill")
                        }
                        .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isPosting)
                    }
                }
            }
        }
    }

    private func post() async {
        guard let user = Auth.auth().currentUser else { return }
        isPosting = true
        defer { isPosting = false }
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        var comment = Comment(id: "", data: [:])
        comment.projectId = projectId
        comment.targetId = targetId
        comment.targetType = targetType
        comment.userId = user.uid
        comment.userDisplayName = user.displayName ?? user.email ?? "User"
        comment.content = content
        try? await store.post(tenantId: tenantId, projectId: projectId, comment: comment, permissions: permissions)
        draft = ""
    }
}
