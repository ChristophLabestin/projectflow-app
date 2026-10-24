import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Projects tab: headline with +, focus cards for the projects that need attention, filter chips, compact list.
struct ProjectsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var portfolio = ProjectsPortfolio()
    /// nil = all open projects (focus cards + list); a group = only that group.
    @State private var filter: PortfolioGroup?
    @Environment(\.pfSideRegionWidth) private var sideRegion

    /// iPhone Duo closed: narrow column next to the rail — denser cards and rows.
    private var compact: Bool { sideRegion > 0 }

    private var workspace: WorkspaceStore? { model.workspace }
    private var projects: [Project] { workspace?.projects ?? [] }
    private var health: [String: HealthSnapshot] { workspace?.healthSnapshots ?? [:] }
    private var canCreate: Bool { ProjectAccess.canCreateProjects(model.session?.role ?? .member) }
    private var isRoot: Bool { model.router.stacks[.projects]?.path.isEmpty ?? true }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                if let workspace, workspace.loaded.contains(.projects) {
                    if projects.isEmpty {
                        emptyState
                    } else {
                        content
                    }
                } else {
                    skeleton
                }
            }
            .padding(.bottom, PFSpace.xxl)
        }
        .scrollIndicators(.hidden)
        .task(id: loadKey) { await portfolio.refresh(model: model) }
        .onChange(of: isRoot) { _, root in
            if root { Task { await portfolio.refresh(model: model) } }
        }
    }

    /// Reload the signals when the set of open projects changes.
    private var loadKey: String {
        "\(model.workspaceGeneration)|" + projects.filter { $0.status.lifecycle != .closed }.map(\.id).sorted().joined(separator: ",")
    }

    // MARK: Header

    /// No page title and no eyebrow: the attention headline ("2 von 2 Projekten …") shares its line with +.
    /// Without attention entries (or projects) the line just reads "Projekte".
    private var header: some View {
        let result = workspace?.loaded.contains(.projects) == true && !projects.isEmpty
            ? portfolio.attention(projects: projects, health: health) : nil
        return HStack(alignment: .top, spacing: PFSpace.s) {
            Group {
                if let result, !result.entries.isEmpty {
                    statement(result.statement)
                } else {
                    Text(L10n.t("projects.portfolio.title")).pfText(compact ? .section : .title).foregroundStyle(PFColor.textMain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
            if canCreate {
                PFRootActions {
                    PFIconButton("plus", label: L10n.t("projects.new.title"), style: .glass) {
                        presenter.present(detents: [.large]) { ProjectCreateSheet() }
                    }
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.s)
    }

    // MARK: Content
    //
    // Redesign (2026-10-24): one source per project, no duplicates.
    //   1. Focus — the projects that need attention (max 3) as full-width cards: health, reasons, progress, people.
    //   2. Filter chips — Alle · Aktiv · In Planung · Pausiert · Abgeschlossen (counts; selected inverted).
    //   3. Compact list — every other project once, grouped by status; closed projects only behind their chip.
    // iPhone Duo closed (side region): denser cards and rows, ring without percent text.

    @ViewBuilder
    private var content: some View {
        let result = portfolio.attention(projects: projects, health: health)
        let rows = portfolio.rows(projects: projects, health: health)
        let byId = Dictionary(rows.values.flatMap { $0 }.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let focusIds = filter == nil ? result.attention : []
        if !focusIds.isEmpty {
            VStack(spacing: PFSpace.s) {
                ForEach(focusIds, id: \.self) { id in
                    if let entry = result.entry(id), let row = byId[id] { focusCard(entry, row: row) }
                }
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.top, PFSpace.m)
        }
        filterChips(rows)
            // Duo: a horizontal scroll view draws into the side region; keep the chips out from under the rail.
            .clipShape(.rect)
            .padding(.top, focusIds.isEmpty ? PFSpace.m : PFSpace.l)
        let groups = filter.map { [$0] } ?? PortfolioGroup.allCases.filter { $0 != .closed }
        let hidden = Set(focusIds)
        VStack(alignment: .leading, spacing: PFSpace.l) {
            ForEach(groups, id: \.self) { group in
                let groupRows = (rows[group] ?? []).filter { !hidden.contains($0.id) }
                if !groupRows.isEmpty { listSection(group, rows: groupRows, titled: filter == nil) }
            }
            if filter == nil, let closed = rows[.closed], !closed.isEmpty {
                closedLink(closed.count)
            }
            if filter != nil, (rows[filter!] ?? []).isEmpty {
                Text(L10n.t("projects.filter.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .padding(.horizontal, PFSpace.page)
            }
        }
        .padding(.top, PFSpace.m)
        .animation(PFMotion.respecting(PFMotion.snappy), value: filter)
    }

    // MARK: Focus cards

    private func focusCard(_ entry: AttentionEntry, row: ProjectsPortfolio.Row) -> some View {
        let project = row.project
        let snapshot = health[project.id]
        let people = project.memberIds.prefix(4).compactMap { uid in
            workspace?.people[uid].map { (id: uid, name: $0.displayName, url: $0.photoURL) }
        }
        return Button {
            model.router.push(.project(tenantId: project.tenantId, projectId: project.id))
        } label: {
            VStack(alignment: .leading, spacing: compact ? 10 : PFSpace.s) {
                HStack(alignment: .center, spacing: PFSpace.s) {
                    PFProjectGlyph(title: project.title, imageURL: project.squareIcon, size: compact ? 36 : 42)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(project.title).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(1)
                        Text(focusMeta(entry, project: project)).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    if let score = snapshot?.score {
                        PFHealthRing(score: score, size: compact ? 36 : 42, lineWidth: 4)
                    }
                }
                if !entry.chips.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(entry.chips.prefix(compact ? 2 : 3), id: \.key) { chip in
                            PFPill(L10n.t(chip.labelKey, chip.params), tone: tone(chip.tone), compact: true)
                        }
                    }
                }
                HStack(spacing: PFSpace.s) {
                    PFProgressBar(value: row.progress, height: 5)
                    Text(ProjectsFormat.percent(row.progress)).pfText(.number).foregroundStyle(PFColor.textMuted)
                        .monospacedDigit()
                    if !people.isEmpty && !compact { PFAvatarStack(people: Array(people), size: 22, limit: 3) }
                }
            }
            .padding(compact ? PFSpace.m - 2 : PFSpace.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pfCard()
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityElement(children: .combine)
    }

    private func focusMeta(_ entry: AttentionEntry, project: Project) -> String {
        var parts = [L10n.plural("projects.summary.open", entry.openCount)]
        if let due = project.dueDate { parts.append(L10n.t("projects.focus.due", ["date": Formatting.shortDate(due)])) }
        return parts.joined(separator: " · ")
    }

    private func tone(_ tone: AttentionChip.Tone) -> PFPill.Tone {
        switch tone {
        case .danger: .severity(.overdue)
        case .warning: .severity(.due)
        case .info: .status(.open)
        case .neutral: .neutral
        }
    }

    /// The statement sentence with its value emphasised ("**1** von 3 Projekten verliert gerade Tempo.").
    private func statement(_ statement: AttentionStatement) -> some View {
        let value = statement.value ?? statement.valueKey.map { L10n.t($0) } ?? ""
        let template = L10n.t(statement.key, statement.params)
        let parts = template.components(separatedBy: "{value}")
        var text = Text(parts.first ?? "").foregroundStyle(PFColor.textMuted)
        for part in parts.dropFirst() {
            text = text + Text(value).foregroundStyle(PFColor.textMain) + Text(part).foregroundStyle(PFColor.textMuted)
        }
        return text.pfText(compact ? .section : .title).fixedSize(horizontal: false, vertical: true)
    }

    // MARK: Filter and list

    private func filterChips(_ rows: [PortfolioGroup: [ProjectsPortfolio.Row]]) -> some View {
        let count: (PortfolioGroup) -> Int = { group in (rows[group] ?? []).reduce(0) { $0 + 1 + $1.children.count } }
        let open = PortfolioGroup.allCases.filter { $0 != .closed }.reduce(0) { $0 + count($1) }
        return PFChipRow {
            PFChip("\(L10n.t("projects.filter.all")) \(open)", isSet: filter == nil) { filter = nil }
            ForEach(PortfolioGroup.allCases.filter { count($0) > 0 }, id: \.self) { group in
                PFChip("\(L10n.t("projects.portfolio.group.\(group.rawValue)")) \(count(group))", isSet: filter == group) {
                    filter = filter == group ? nil : group
                }
            }
        }
    }

    private func listSection(_ group: PortfolioGroup, rows: [ProjectsPortfolio.Row], titled: Bool) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            if titled {
                HStack(spacing: 6) {
                    Circle().fill(dot(group)).frame(width: 7, height: 7)
                    PFEyebrow(L10n.t("projects.portfolio.group.\(group.rawValue)"))
                }
                .padding(.horizontal, PFSpace.page)
            }
            PFCardList {
                ForEach(rows) { row in
                    ProjectRowView(row: row, indent: false, compact: compact)
                    ForEach(row.children) { child in
                        ProjectRowView(row: portfolio.childRow(child), indent: true, compact: compact)
                    }
                }
            }
            .padding(.horizontal, PFSpace.page)
        }
    }

    private func closedLink(_ count: Int) -> some View {
        Button { filter = .closed } label: {
            HStack(spacing: 6) {
                Image(systemName: "archivebox").font(.system(size: 13, weight: .medium))
                Text(L10n.plural("projects.filter.closedLink", count)).pfText(.metaStrong)
                Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold))
            }
            .foregroundStyle(PFColor.textMuted)
            .frame(minHeight: 44)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .padding(.horizontal, PFSpace.page)
    }

    private func dot(_ group: PortfolioGroup) -> Color {
        switch group {
        case .attention: PFColor.danger
        case .active: PFColor.success
        case .planning: PFColor.statusBase(.open)
        case .paused: PFColor.warning
        case .closed: PFColor.textSubtle
        }
    }

    // MARK: States

    private var emptyState: some View {
        PFEmptyState(systemImage: "square.stack.3d.up", title: L10n.t("projects.portfolio.empty"), message: L10n.t("projects.portfolio.emptyHint"),
                     actionTitle: canCreate ? L10n.t("projects.portfolio.emptyCta") : nil,
                     action: canCreate ? { presenter.present(detents: [.large]) { ProjectCreateSheet() } } : nil)
            .padding(.horizontal, PFSpace.page)
            .padding(.top, PFSpace.xl)
    }

    private var skeleton: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            PFSkeleton(height: 140, radius: PFRadius.card)
            PFSkeleton(height: 34, radius: 17).frame(width: 220)
            PFSkeleton(height: 64, radius: PFRadius.card)
            PFSkeleton(height: 64, radius: PFRadius.card)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.l)
    }
}

/// One portfolio row: glyph, title, signals line (like the web row), progress and chevron.
struct ProjectRowView: View {
    let row: ProjectsPortfolio.Row
    let indent: Bool
    var compact = false
    @Environment(AppModel.self) private var model

    var body: some View {
        Button {
            model.router.push(.project(tenantId: row.project.tenantId, projectId: row.project.id))
        } label: {
            HStack(spacing: PFSpace.s) {
                if indent {
                    RoundedRectangle(cornerRadius: 1).fill(PFColor.hairlineStrong).frame(width: 2, height: 30).padding(.leading, 10)
                }
                PFProjectGlyph(title: row.project.title, imageURL: row.project.squareIcon, size: indent || compact ? 34 : 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text(row.project.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    signals
                }
                Spacer(minLength: PFSpace.xs)
                // Progress as a small ring (percent beside it on iPhone, ring only on the narrow Duo column).
                if row.project.status.lifecycle != .closed {
                    if !compact {
                        Text(ProjectsFormat.percent(row.progress)).pfText(.number).foregroundStyle(PFColor.textMuted).monospacedDigit()
                    }
                    ProgressDot(value: row.progress)
                }
            }
            .padding(.leading, indent ? 18 : PFSpace.m)
            .padding(.trailing, PFSpace.m)
            .frame(minHeight: compact ? 58 : 64)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var signals: some View {
        if let signals = row.signals {
            let parts = parts(signals)
            if parts.isEmpty {
                Text(L10n.t(row.total - row.done > 0 ? "projects.portfolio.onTrack" : "projects.portfolio.noOpenTasks"))
                    .pfText(.meta).foregroundStyle(PFColor.successText).lineLimit(1)
            } else {
                parts.enumerated().reduce(Text("")) { result, entry in
                    let piece = Text(entry.element.text).foregroundStyle(entry.element.color)
                    return entry.offset == 0 ? piece : result + Text(" · ").foregroundStyle(PFColor.textMuted) + piece
                }
                .pfText(.metaStrong)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            }
        } else {
            Text(row.project.status.label).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
        }
    }

    private func parts(_ signals: PortfolioSignals) -> [(text: String, color: Color)] {
        var result: [(String, Color)] = []
        if signals.overdue > 0 { result.append((L10n.t("projects.portfolio.overdue", ["count": signals.overdue]), PFColor.dangerText)) }
        if signals.blocked > 0 { result.append((L10n.t("projects.portfolio.blocked", ["count": signals.blocked]), PFColor.dangerText)) }
        if row.dueToday > 0 { result.append((L10n.t("projects.portfolio.dueToday", ["count": row.dueToday]), PFColor.warningText)) }
        return result
    }
}

/// Small progress ring for list rows.
private struct ProgressDot: View {
    let value: Double

    var body: some View {
        ZStack {
            Circle().stroke(PFColor.raised, lineWidth: 3)
            Circle().trim(from: 0, to: max(0.001, min(1, value)))
                .stroke(value >= 1 ? PFColor.success : PFColor.textMain, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 20, height: 20)
        .accessibilityHidden(true)
    }
}
