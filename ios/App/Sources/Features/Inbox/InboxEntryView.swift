import SwiftUI
import PFDesign
import PFModel

/// One inbox row: avatar/symbol, headline, optional quote, the affected task as a mini row and the
/// primary action for the kind of notification (concept §5.7).
struct InboxEntryView: View {
    let item: InboxItem
    let task: WorkTask?
    let actorName: String?
    let actorPhotoURL: String?
    let excerpt: String?
    let workspaceTag: String?
    let isReplying: Bool
    @Binding var replyText: String
    let isBusy: Bool
    let isPlannedToday: Bool
    let onOpen: () -> Void
    let onPlanToday: () -> Void
    let onReply: () -> Void
    let onSendReply: () -> Void
    let onAccept: () -> Void

    var body: some View {
        PFInboxRow(
            isUnread: !item.read,
            title: InboxLogic.headline(for: item, actor: InboxLogic.firstName(actorName)),
            message: excerpt ?? InboxLogic.serverMessage(for: item),
            time: InboxLogic.timeLabel(item),
            tag: workspaceTag,
            leading: { leading },
            mini: { mini },
            footer: { footer }
        )
        .onTapGesture { onOpen() }
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: L10n.t("common.open")) { onOpen() }
    }

    // MARK: Leading

    @ViewBuilder private var leading: some View {
        if let symbol = InboxLogic.symbol(for: item.kind), actorName == nil {
            PFInboxSymbol(systemImage: symbol)
        } else {
            PFAvatar(name: actorName ?? "?", seed: item.actorId ?? actorName, imageURL: actorPhotoURL, size: 36)
        }
    }

    // MARK: Mini task row

    @ViewBuilder private var mini: some View {
        if let task {
            PFInboxMiniTask(
                title: task.title,
                statusLabel: task.status.label,
                statusTone: task.status.tone,
                meta: task.isCompleted ? nil : Formatting.dueText(task.dueDate),
                metaSeverity: Formatting.severity(due: task.dueDate, isDone: task.isCompleted),
                isDone: task.isCompleted
            )
        }
    }

    // MARK: Primary action

    @ViewBuilder private var footer: some View {
        switch item.kind {
        case .taskAssigned, .subtaskAssigned:
            if let task, !task.isCompleted {
                HStack(spacing: PFSpace.xs) {
                    if isPlannedToday {
                        PFButton(L10n.t("inbox.action.planned"), systemImage: "checkmark", kind: .tinted(PFColor.successText), size: .small) {}
                            .disabled(true)
                    } else {
                        PFButton(L10n.t("inbox.action.planToday"), systemImage: "sun.max", size: .small, action: onPlanToday)
                    }
                    PFButton(L10n.t("common.open"), kind: .ghost, size: .small, action: onOpen)
                }
            }
        case .commentMention, .commentAdded:
            if isReplying {
                PFInboxReplyField(text: $replyText, placeholder: L10n.t("inbox.reply.placeholder"),
                                  sendLabel: L10n.t("inbox.reply.send"), isSending: isBusy, onSend: onSendReply)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            } else if item.projectId != nil, item.taskId != nil || item.initiativeId != nil {
                HStack(spacing: PFSpace.xs) {
                    PFButton(L10n.t("inbox.action.reply"), systemImage: "arrowshape.turn.up.left", size: .small, action: onReply)
                    PFButton(L10n.t("common.open"), kind: .ghost, size: .small, action: onOpen)
                }
            }
        case .workspaceInvite:
            if item.inviteId != nil {
                PFButton(isBusy ? L10n.t("common.loading") : L10n.t("notifications.actions.accept"), systemImage: "checkmark", size: .small, action: onAccept)
                    .disabled(isBusy)
            }
        default:
            EmptyView()
        }
    }
}
