import SwiftUI
import PFDesign
import PFModel

/// The one task row used everywhere (Today, Work, Projects, Search, Inbox previews):
/// ring check · title · meta (project/lock + due) · priority signal · avatars,
/// wrapped in the shared swipe grammar and peek.
struct WorkItemRow: View {
    let item: WorkItem
    var showsProject = true
    var dashed = false
    var subtitleOverride: String?
    var trailingAccessory: AnyView?
    var onOpen: (() -> Void)?

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        let actions = WorkItemActions(model: model)
        PFSwipeRow(leading: actions.swipeComplete(item), trailing: item.isCompleted ? [] : actions.swipeTrailing(item)) {
            HStack(alignment: .top, spacing: 2) {
                PFRingCheck(isOn: item.isCompleted, severity: item.severity == .done ? .neutral : item.severity, dashed: dashed,
                            label: item.isCompleted ? L10n.t("common.reopen") : L10n.t("common.complete")) {
                    Task { await actions.toggleComplete(item) }
                }
                .padding(.leading, 3)
                Button { open() } label: {
                    HStack(alignment: .center, spacing: PFSpace.s) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.title)
                                .pfText(.rowTitle)
                                .foregroundStyle(item.isCompleted ? PFColor.textMuted : PFColor.textMain)
                                .strikethrough(item.isCompleted, color: PFColor.textMuted)
                                .multilineTextAlignment(.leading)
                                .lineLimit(3)
                            meta
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        trailing
                    }
                    .padding(.vertical, 13)
                    .padding(.trailing, PFSpace.m)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
            .frame(minHeight: 56)
        }
        .pfPeek(presenter, actions: { actions.peekActions(item) }) {
            WorkItemPeek(item: item)
        }
        .accessibilityElement(children: .contain)
    }

    private func open() {
        if let onOpen { onOpen() } else { model.router.push(item.route) }
    }

    @ViewBuilder private var meta: some View {
        let due = Formatting.dueText(item.dueDate)
        HStack(spacing: 4) {
            if let subtitleOverride {
                Text(subtitleOverride).foregroundStyle(PFColor.severityText(item.severity == .done ? .neutral : item.severity))
            } else {
                if let due {
                    Text(due).foregroundStyle(PFColor.severityText(item.isCompleted ? .neutral : item.severity))
                }
                if showsProject {
                    if due != nil { Text("·").foregroundStyle(PFColor.textMuted) }
                    if item.isPersonal {
                        Image(systemName: "lock.fill").font(.system(size: 10, weight: .semibold))
                        Text(L10n.t("common.personal"))
                    } else if let project = model.workspace?.project(item.projectId) {
                        Text(project.title)
                    }
                }
            }
        }
        .pfText(.meta)
        .foregroundStyle(PFColor.textMuted)
        .lineLimit(1)
    }

    @ViewBuilder private var trailing: some View {
        HStack(spacing: 8) {
            if let trailingAccessory { trailingAccessory }
            if item.status == .blocked { PFPill(item.status.label, tone: .status(.blocked), compact: true) }
            PFPrioritySignal(item.priority)
            if let task = item.task, let workspace = model.workspace {
                let people = task.effectiveAssignees.filter { $0 != model.uid }.compactMap { workspace.person($0) }
                if !people.isEmpty {
                    PFAvatarStack(people: people.map { ($0.id, $0.displayName, $0.photoURL) }, size: 22, limit: 2)
                }
            }
        }
    }
}

/// Peek preview card: title, status, due, next step / blocker.
struct WorkItemPeek: View {
    let item: WorkItem
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            if let project = model.workspace?.project(item.projectId) {
                PFEyebrow(project.title)
            } else if item.isPersonal {
                PFEyebrow(L10n.t("common.personal"))
            }
            Text(item.title).pfText(.title).foregroundStyle(PFColor.textMain).lineLimit(4)
            HStack(spacing: 6) {
                PFPill(item.status.label, tone: .status(item.status.tone), compact: true)
                if let priority = item.priority {
                    PFPill(priority.label, compact: true) { PFPrioritySignal(priority) }
                }
                if let due = Formatting.dueText(item.dueDate) {
                    PFPill(due, tone: .severity(item.severity), compact: true)
                }
            }
            if let task = item.task {
                if task.status == .blocked, let note = task.blockerNote {
                    Label(note, systemImage: "exclamationmark.octagon").pfText(.body).foregroundStyle(PFColor.dangerText)
                } else if let next = task.nextStep {
                    VStack(alignment: .leading, spacing: 4) {
                        PFEyebrow(L10n.t("task.nextStep"))
                        Text(next).pfText(.body).foregroundStyle(PFColor.textMain)
                    }
                }
            }
        }
        .padding(PFSpace.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard(radius: PFRadius.surface)
    }
}

/// Group header used by bucketed lists: dot · label · count.
struct GroupHeader: View {
    let title: String
    let color: Color
    let count: Int
    var collapsed: Bool?
    var onToggle: (() -> Void)?

    var body: some View {
        Button { onToggle?() } label: {
            HStack(spacing: 8) {
                if let collapsed {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(PFColor.textMuted)
                        .rotationEffect(.degrees(collapsed ? -90 : 0))
                }
                PFDot(color)
                Text(title).pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                PFCountPill(count)
                Spacer()
            }
            .padding(.top, PFSpace.l)
            .padding(.bottom, PFSpace.xs)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(onToggle == nil)
        .accessibilityAddTraits(.isHeader)
    }
}
