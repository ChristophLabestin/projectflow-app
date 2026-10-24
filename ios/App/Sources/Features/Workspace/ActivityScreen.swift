import SwiftUI
import PFData
import PFDesign
import PFModel

/// Activity feed of the workspace or one project (`tenants/{t}/activity`): grouped by day, live first page,
/// "Mehr laden" for older events. A row opens its object (task, project, file, doc, flow when routable).
struct ActivityScreen: View {
    let tenantId: String
    let projectId: String?
    @State private var store: ActivityFeedStore
    @Environment(AppModel.self) private var model

    init(tenantId: String, projectId: String? = nil) {
        self.tenantId = tenantId
        self.projectId = projectId
        _store = State(initialValue: ActivityFeedStore(tenantId: tenantId, projectId: projectId))
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("nav.activity"), subtitle: L10n.t(projectId == nil ? "activity.subtitle" : "activity.projectSubtitle")) {
            VStack(alignment: .leading, spacing: PFSpace.l) { content }.padding(.top, PFSpace.l)
        }
        .task { store.start() }
        .onDisappear { store.stop() }
    }

    @ViewBuilder private var content: some View {
        if store.isLoading {
            PFSkeleton(height: 160)
        } else if store.failed {
            PFEmptyState(systemImage: "exclamationmark.triangle", title: L10n.t("activity.error"), message: "")
        } else if store.events.isEmpty {
            PFEmptyState(systemImage: "waveform.path.ecg", title: L10n.t("activity.empty.title"), message: L10n.t("activity.empty.message"))
                
        } else {
            ForEach(groups, id: \.title) { group in
                VStack(alignment: .leading, spacing: PFSpace.xs) {
                    PFEyebrow(group.title)
                    PFCardList {
                        ForEach(group.events) { event in ActivityEventRow(event: event, showsProject: projectId == nil) { open(event) } }
                    }
                    
                }
            }
            if store.hasMore {
                PFButton(L10n.t("activity.loadMore"), kind: .ghost, size: .medium, fullWidth: true) { Task { await store.loadMore() } }
                    
            } else {
                Text(L10n.t("activity.end")).pfText(.meta).foregroundStyle(PFColor.textSubtle)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var groups: [(title: String, events: [ActivityEvent])] {
        let calendar = Calendar.current
        var result: [(title: String, events: [ActivityEvent])] = []
        for event in store.events {
            let title: String
            if calendar.isDateInToday(event.createdAt) { title = L10n.t("activity.group.today") }
            else if calendar.isDateInYesterday(event.createdAt) { title = L10n.t("activity.group.yesterday") }
            else { title = event.createdAt.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(L10n.locale)) }
            if result.last?.title == title { result[result.count - 1].events.append(event) } else { result.append((title, [event])) }
        }
        return result
    }

    private func open(_ event: ActivityEvent) {
        switch event.objectType {
        case "task":
            if let projectId = event.projectId { model.router.push(.task(TaskRef(tenantId: tenantId, projectId: projectId, taskId: event.objectId))) }
        case "project":
            model.router.push(.project(tenantId: tenantId, projectId: event.objectId))
        case "comment", "subtask":
            if event.parentType == "task", let parent = event.parentId, let projectId = event.projectId {
                model.router.push(.task(TaskRef(tenantId: tenantId, projectId: projectId, taskId: parent)))
            }
        default:
            if let path = event.meta["path"], let url = URL(string: "https://app.getprojectflow.com\(path)") {
                model.router.handle(url: url, activeTenant: tenantId)
            }
        }
    }
}

/// One event: actor avatar (✦ for AI, gear for automations), sentence from the web's `activity.types.*`, time.
struct ActivityEventRow: View {
    let event: ActivityEvent
    var showsProject = true
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: PFSpace.s) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(sentence).pfText(.body).foregroundStyle(PFColor.textMain).fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 6) {
                        Text(event.createdAt.formatted(.dateTime.hour().minute().locale(L10n.locale)))
                        if showsProject, let project = event.projectTitle, !project.isEmpty { Text("· \(project)").lineLimit(1) }
                    }
                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.vertical, 12)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }

    @ViewBuilder private var avatar: some View {
        switch event.actor.kind {
        case "automation", "system":
            Image(systemName: event.actor.kind == "automation" ? "bolt.horizontal" : "gearshape")
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(PFColor.textMuted)
                .frame(width: 30, height: 30).background(PFColor.raised, in: .circle)
        default:
            PFAvatar(name: event.actor.name, seed: event.actor.id, imageURL: event.actor.photoURL, size: 30)
        }
    }

    private var actorName: String {
        switch event.actor.kind {
        case "system": return L10n.t("activity.actor.system")
        case "ai":
            let name = event.actor.name.isEmpty ? L10n.t("activity.actor.someone") : event.actor.name
            return L10n.t("activity.actor.via", ["name": name, "client": event.actor.client ?? "AI"])
        default: return event.actor.name.isEmpty ? L10n.t("activity.actor.someone") : event.actor.name
        }
    }

    private var sentence: AttributedString {
        let key = "activity.types.\(event.type)"
        var template = L10n.t(key)
        if template == key { template = L10n.t("activity.types.fallback") }
        if !template.contains("{actor}") { template = "{actor} " + template }
        let field = event.changes.keys.first
        let change = event.changes.values.first
        func display(_ value: String?) -> String {
            guard let value else { return "" }
            switch field {
            case "status": return TaskStatus(rawValue: value)?.label ?? value
            case "priority": return TaskPriority(rawValue: value)?.label ?? value
            case "dueDate": return FlexDate.parse(string: value).map(Formatting.shortDate) ?? value
            default: return value
            }
        }
        let values: [String: String] = [
            "actor": actorName, "object": event.objectTitle.isEmpty ? "–" : "„\(event.objectTitle)“",
            "to": display(change?.to), "from": display(change?.from),
            "names": event.meta["assigneeNames"] ?? event.meta["userNames"] ?? "", "parent": event.meta["parentTitle"] ?? "",
        ]
        var text = AttributedString(template)
        for (name, value) in values {
            while let range = text.range(of: "{\(name)}") {
                var part = AttributedString(value)
                if name == "actor" || name == "object" { part.font = .body.weight(.semibold) }
                text.replaceSubrange(range, with: part)
            }
        }
        return text
    }
}
