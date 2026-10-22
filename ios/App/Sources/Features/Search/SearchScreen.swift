import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Suche (concept §5.8): same grammar as the web palette (`>` `#` `!` `?`, `is:`, `prio:`), local results,
/// recents and commands in the empty state.
struct SearchScreen: View {
    private enum Chip: Hashable { case all, projects, tasks, commands }

    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var colorScheme
    @State private var query = ""
    @State private var chip: Chip = .all
    @SwiftUI.FocusState private var focused: Bool
    private let recents = SearchRecents.shared
    private let index = ProjectTaskIndex.shared
    private static let taskLimit = 40

    private var workspace: WorkspaceStore? { model.workspace }
    private var parsed: SearchQuery { SearchQuery.parse(query) }

    // MARK: Scope

    private var scope: SearchScope {
        if let prefix = parsed.prefixScope { return prefix }
        switch chip {
        case .all: return .all
        case .projects: return .projects
        case .tasks: return .tasks
        case .commands: return .commands
        }
    }

    private func includes(_ candidate: SearchScope) -> Bool { scope == .all || scope == candidate }

    private var hasInput: Bool { !parsed.terms.isEmpty || parsed.hasTaskFilters || parsed.prefixScope != nil || chip != .all }
    private var needsTasks: Bool { includes(.tasks) && (!parsed.terms.isEmpty || parsed.hasTaskFilters) }

    // MARK: Body

    var body: some View {
        VStack(spacing: 0) {
            searchField
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.xs)
            PFChipRow {
                chipButton(.all, L10n.t("search.scope.all"))
                chipButton(.projects, L10n.t("tab.projects"))
                chipButton(.tasks, L10n.t("search.scope.tasks"))
                chipButton(.commands, L10n.t("search.scope.commands"))
            }
            .padding(.top, PFSpace.xxs)
            ScrollView {
                content
                    .padding(.horizontal, PFSpace.page)
                    .padding(.bottom, PFSpace.xxl)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .animation(PFMotion.respecting(PFMotion.fast), value: hasInput)
        .task {
            recents.prepare(uid: model.uid)
            try? await Task.sleep(for: .milliseconds(120))
            focused = true
        }
        .task(id: needsTasks) {
            guard needsTasks, let workspace else { return }
            let open = workspace.projects.filter { $0.status.lifecycle != .closed }.map(\.id)
            await index.ensureLoaded(projectIds: open, workspace: workspace)
        }
    }

    // MARK: Field and chips

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").font(.system(size: 16, weight: .semibold)).foregroundStyle(PFColor.textMuted)
            TextField("", text: $query, prompt: Text(L10n.t("search.placeholder")).foregroundStyle(PFColor.textSubtle))
                .textFieldStyle(.plain)
                .pfText(.body)
                .foregroundStyle(PFColor.textMain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($focused)
                .onSubmit(submit)
            if !query.isEmpty {
                Button {
                    query = ""
                    focused = true
                } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 17)).foregroundStyle(PFColor.textSubtle)
                        .frame(width: 32, height: 44).contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L10n.t("search.clear"))
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, query.isEmpty ? 16 : 4)
        .frame(minHeight: 52)
        .background(PFColor.card, in: .capsule)
        .pfElevation(.card, radius: 100)
        .contentShape(.capsule)
        .onTapGesture { focused = true }
    }

    private func chipButton(_ value: Chip, _ title: String) -> some View {
        PFChip(title, isSet: chip == value && parsed.prefixScope == nil) {
            chip = chip == value ? .all : value
        }
    }

    // MARK: Content

    @ViewBuilder private var content: some View {
        if scope == .help {
            helpContent
        } else if !hasInput {
            emptyContent
        } else {
            resultsContent
        }
    }

    // MARK: Empty state: tips, recents, commands

    private var emptyContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !recents.items.filter({ $0.tenantId == workspace?.tenantId }).isEmpty {
                PFSectionHeader(L10n.t("search.section.recent")) {
                    Button { recents.clear() } label: {
                        Text(L10n.t("search.clearRecent")).pfText(.buttonSmall).foregroundStyle(PFColor.textMuted)
                            .padding(.horizontal, 8).frame(minHeight: 32)
                    }
                    .buttonStyle(.pfPressable)
                }
                PFCardList {
                    ForEach(recents.items.filter { $0.tenantId == workspace?.tenantId }) { item in
                        SearchRow(systemImage: item.kind == .project ? "square.stack.3d.up" : (item.kind == .personal ? "lock" : "checkmark.circle"),
                                  title: item.title, subtitle: item.subtitle) { open(recent: item) }
                    }
                }
            }
            if !recents.queries.isEmpty {
                PFSectionHeader(L10n.t("search.section.recentQueries"))
                FlowChips(spacing: 8) {
                    ForEach(recents.queries, id: \.self) { recentQuery in
                        PFChip(recentQuery, systemImage: "clock.arrow.circlepath") { query = recentQuery }
                    }
                }
            }
            PFSectionHeader(L10n.t("search.section.actions"))
            commandCard(SearchCommands.all(model: model, isDark: colorScheme == .dark, openProjects: openProjectsScope).filter { $0.section == .action })
            PFSectionHeader(L10n.t("search.tips.title"))
            tipChips
        }
    }

    private var tipChips: some View {
        FlowChips(spacing: 8) {
            ForEach(Self.tips, id: \.token) { tip in
                PFChip("\(tip.token)  \(L10n.t(tip.label))") {
                    query = tip.token.count == 1 ? tip.token : tip.token + " "
                    focused = true
                }
            }
        }
    }

    private static let tips: [(token: String, label: String)] = [
        (">", "search.tips.commands"), ("#", "search.tips.projects"), ("!", "search.tips.tasks"), ("?", "search.tips.help"),
        ("is:overdue", "search.tips.overdue"), ("is:mine", "search.tips.mine"), ("prio:high", "search.tips.priority"),
    ]

    private func commandCard(_ commands: [SearchCommand]) -> some View {
        PFCardList {
            ForEach(commands) { command in
                SearchRow(systemImage: command.systemImage, title: command.title, subtitle: nil, showsChevron: false) {
                    focused = false
                    command.run()
                }
            }
        }
    }

    // MARK: Help (`?`)

    private var helpContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            PFSectionHeader(L10n.t("search.tips.title"))
            PFCardList {
                ForEach(Self.helpRows, id: \.token) { row in
                    SearchRow(systemImage: "text.cursor", title: row.token, subtitle: L10n.t(row.label), showsChevron: false) {
                        query = row.token.count == 1 ? row.token : row.token + " "
                        focused = true
                    }
                }
            }
        }
    }

    private static let helpRows: [(token: String, label: String)] = [
        (">", "search.help.commands"), ("#", "search.help.projects"), ("!", "search.help.tasks"),
        ("is:open", "search.help.open"), ("is:done", "search.help.done"), ("is:overdue", "search.help.overdue"),
        ("is:today", "search.help.today"), ("is:mine", "search.help.mine"),
        ("prio:urgent", "search.help.prio"), ("prio:high", "search.help.prio"),
    ]

    // MARK: Results

    private var allTasks: [WorkItem] {
        guard let workspace else { return [] }
        var items: [WorkItem] = workspace.myTasks.map(WorkItem.task) + workspace.personalTasks.map(WorkItem.personal)
        let live = Set(workspace.myTasks.map(\.id))
        items += index.cachedTasks(excluding: live).map(WorkItem.task)
        return items
    }

    private func matches(_ item: WorkItem) -> Bool {
        let uid = model.uid
        for filter in parsed.taskFilters {
            switch filter {
            case .open: if item.isCompleted { return false }
            case .done: if !item.isCompleted { return false }
            case .overdue: if item.isCompleted || item.dueDate.map({ Formatting.dayOffset($0) >= 0 }) ?? true { return false }
            case .today: if item.dueDate.map({ Formatting.dayOffset($0) != 0 }) ?? true { return false }
            case .mine:
                switch item {
                case .personal: break
                case .task(let task): if !task.effectiveAssignees.contains(uid ?? "") { return false }
                }
            }
        }
        if let priority = parsed.priority, item.priority?.rawValue.lowercased() != priority.rawValue { return false }
        return true
    }

    private func rankedTasks() -> [WorkItem] {
        let candidates = allTasks.filter(matches)
        if parsed.terms.isEmpty {
            // Filter-only query ("is:overdue"): most urgent first.
            return candidates.enumerated().sorted { a, b in
                let da = a.element.dueDate?.instant ?? .distantFuture, db = b.element.dueDate?.instant ?? .distantFuture
                if da != db { return da < db }
                let pa = a.element.priority?.rank ?? 1, pb = b.element.priority?.rank ?? 1
                return pa != pb ? pa > pb : a.offset < b.offset
            }.map(\.element)
        }
        let myId = model.uid ?? ""
        return SearchRanker.rank(candidates, terms: parsed.terms, title: \.title, secondary: { item in
            switch item {
            case .personal: [L10n.t("common.personal")]
            case .task(let task): [workspace?.project(task.projectId)?.title ?? "", task.summary ?? ""]
            }
        }, bonus: { item in
            var bonus = 0.0
            if item.isCompleted { bonus -= 0.5 }
            if case .task(let task) = item, task.effectiveAssignees.contains(myId) { bonus += 0.25 }
            if item.isPersonal { bonus += 0.25 }
            return bonus
        })
    }

    private func rankedProjects() -> [Project] {
        guard let workspace else { return [] }
        return SearchRanker.rank(workspace.projects, terms: parsed.terms, title: \.title, secondary: { [$0.summary] },
                                 bonus: { $0.status.lifecycle == .closed ? -0.5 : 0 })
    }

    private func rankedCommands() -> [SearchCommand] {
        let all = SearchCommands.all(model: model, isDark: colorScheme == .dark, openProjects: openProjectsScope)
        return SearchRanker.rank(all, terms: parsed.terms, title: \.title, secondary: { $0.keywords })
    }

    @ViewBuilder private var resultsContent: some View {
        let showsCommands = includes(.commands) && !parsed.hasTaskFilters && (scope == .commands || !parsed.terms.isEmpty)
        let projects = includes(.projects) && !parsed.hasTaskFilters ? rankedProjects() : []
        let tasks = includes(.tasks) ? rankedTasks() : []
        let commands = showsCommands ? rankedCommands() : []
        VStack(alignment: .leading, spacing: 0) {
            if index.isLoading && includes(.tasks) {
                Text(L10n.t("search.loading")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .padding(.top, PFSpace.s)
            }
            if !commands.isEmpty {
                PFSectionHeader(L10n.t("search.section.actions"))
                commandCard(commands)
            }
            if !projects.isEmpty {
                PFSectionHeader(L10n.t("tab.projects")) { PFCountPill(projects.count) }
                PFCardList {
                    ForEach(projects.prefix(12)) { project in
                        SearchProjectRow(project: project, terms: parsed.terms) { open(project: project) }
                    }
                }
            }
            if !tasks.isEmpty {
                PFSectionHeader(L10n.t("search.scope.tasks")) { PFCountPill(tasks.count) }
                PFCardList {
                    ForEach(tasks.prefix(Self.taskLimit)) { item in
                        WorkItemRow(item: item, onOpen: { open(task: item) })
                    }
                }
                if tasks.count > Self.taskLimit {
                    Text(L10n.t("search.moreResults", ["count": tasks.count - Self.taskLimit]))
                        .pfText(.meta).foregroundStyle(PFColor.textMuted).padding(.top, PFSpace.s)
                }
            }
            if commands.isEmpty, projects.isEmpty, tasks.isEmpty, !index.isLoading {
                PFEmptyState(systemImage: "magnifyingglass", title: L10n.t("search.noResults", ["query": query.trimmingCharacters(in: .whitespaces)]),
                             message: L10n.t("search.noResultsHint"))
                    .padding(.top, PFSpace.xl)
            }
        }
    }

    // MARK: Actions

    private func submit() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        recents.addQuery(trimmed)
        guard hasInput, scope != .help else { return }
        if includes(.commands), let command = rankedCommands().first, scope == .commands {
            focused = false
            command.run()
        } else if includes(.projects), !parsed.hasTaskFilters, let project = rankedProjects().first, scope == .projects || rankedTasks().isEmpty {
            open(project: project)
        } else if let task = rankedTasks().first {
            open(task: task)
        } else if let project = rankedProjects().first {
            open(project: project)
        }
    }

    private func openProjectsScope() {
        query = "#"
        focused = true
    }

    private func remember() {
        recents.addQuery(query)
    }

    private func open(project: Project) {
        remember()
        recents.addItem(SearchRecentItem(kind: .project, id: project.id, tenantId: project.tenantId, projectId: nil,
                                         title: project.title, subtitle: L10n.t("search.projectStatus.\(project.status.rawValue)")))
        focused = false
        model.router.push(.project(tenantId: project.tenantId, projectId: project.id))
    }

    private func open(task item: WorkItem) {
        remember()
        let projectTitle = workspace?.project(item.projectId)?.title
        let recent = SearchRecentItem(kind: item.isPersonal ? .personal : .task, id: item.rawId,
                                      tenantId: workspace?.tenantId ?? "", projectId: item.projectId, title: item.title,
                                      subtitle: item.isPersonal ? L10n.t("common.personal") : projectTitle)
        recents.addItem(recent)
        focused = false
        model.router.push(item.route)
    }

    private func open(recent item: SearchRecentItem) {
        focused = false
        switch item.kind {
        case .project:
            model.router.push(.project(tenantId: item.tenantId, projectId: item.id))
        case .personal:
            model.router.push(.personalTask(tenantId: item.tenantId, id: item.id))
        case .task:
            guard let projectId = item.projectId else { return }
            model.router.push(.task(TaskRef(tenantId: item.tenantId, projectId: projectId, taskId: item.id)))
        }
    }
}

// MARK: - Rows

/// Icon tile · title · subtitle row used for recents, commands and help.
private struct SearchRow: View {
    let systemImage: String
    let title: String
    let subtitle: String?
    var showsChevron = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpace.s) {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(PFColor.textMuted)
                    .frame(width: 34, height: 34)
                    .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    if let subtitle { Text(subtitle).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1) }
                }
                Spacer(minLength: 0)
                if showsChevron {
                    Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(PFColor.textSubtle)
                }
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 56)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }
}

/// Project result: monogram tile, title with highlighted terms, status.
private struct SearchProjectRow: View {
    let project: Project
    let terms: [String]
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: PFSpace.s) {
                Text(project.monogram)
                    .pfText(.section)
                    .foregroundStyle(PFColor.textMain)
                    .frame(width: 36, height: 36)
                    .background(PFColor.raised, in: .rect(cornerRadius: PFRadius.control, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(highlighted).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    HStack(spacing: 6) {
                        PFPill(L10n.t("search.projectStatus.\(project.status.rawValue)"), tone: .status(project.status.tone), compact: true)
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(PFColor.textSubtle)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 60)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }

    private var highlighted: AttributedString {
        var text = AttributedString(project.title)
        for range in SearchQuery.highlightRanges(in: project.title, terms: terms) {
            guard let lower = AttributedString.Index(range.lowerBound, within: text), let upper = AttributedString.Index(range.upperBound, within: text) else { continue }
            text[lower..<upper].backgroundColor = PFColor.primary.opacity(0.14)
        }
        return text
    }
}

/// Wrapping row of chips.
private struct FlowChips<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: Content

    var body: some View {
        FlowLayout(spacing: spacing) { content }
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(width: proposal.width ?? 320, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(width: bounds.width, subviews: subviews)
        for (index, origin) in result.origins.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y), proposal: .unspecified)
        }
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> (size: CGSize, origins: [CGPoint]) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxX = max(maxX, x - spacing)
        }
        return (CGSize(width: maxX, height: y + rowHeight), origins)
    }
}
