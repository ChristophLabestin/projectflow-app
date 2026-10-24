import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Projects tab: "Wo hinschauen" carousel (attention ranking), then the portfolio grouped like the web list.
struct ProjectsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var portfolio = ProjectsPortfolio()
    @State private var collapsed: Set<PortfolioGroup> = Set(ProjectsScreen.storedCollapsed())

    private static let collapsedKey = "pf.projects.collapsedGroups"

    private static func storedCollapsed() -> [PortfolioGroup] {
        guard let raw = UserDefaults.standard.array(forKey: collapsedKey) as? [String] else { return [.closed] }
        return raw.compactMap(PortfolioGroup.init(rawValue:))
    }

    private var workspace: WorkspaceStore? { model.workspace }
    private var projects: [Project] { workspace?.projects ?? [] }
    private var health: [String: HealthSnapshot] { workspace?.healthSnapshots ?? [:] }
    private var canCreate: Bool { ProjectAccess.canCreateProjects(model.session?.role ?? .member) }
    private var isRoot: Bool { model.router.stacks[.projects]?.path.isEmpty ?? true }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                WorkspaceAreasRow()
                    .padding(.horizontal, PFSpace.page)
                    .padding(.top, PFSpace.xs)
                    .padding(.bottom, PFSpace.l)
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

    private var header: some View {
        HStack(alignment: .center) {
            Text(L10n.t("projects.portfolio.title")).pfText(.display).foregroundStyle(PFColor.textMain)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if canCreate {
                PFRootActions {
                    PFIconButton("plus", label: L10n.t("projects.new.title"), style: .glass) {
                        presenter.present(detents: [.large]) { ProjectCreateSheet() }
                    }
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.top, PFSpace.xs)
        .padding(.bottom, PFSpace.xs)
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        let result = portfolio.attention(projects: projects, health: health)
        let rows = portfolio.rows(projects: projects, health: health)
        if !result.entries.isEmpty {
            attentionSection(result)
        }
        ForEach(PortfolioGroup.allCases, id: \.self) { group in
            if let groupRows = rows[group], !groupRows.isEmpty {
                groupSection(group, rows: groupRows)
            }
        }
    }

    private func attentionSection(_ result: AttentionResult) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            VStack(alignment: .leading, spacing: 6) {
                PFEyebrow(L10n.t("projects.attention.eyebrow"))
                statement(result.statement)
            }
            .padding(.horizontal, PFSpace.page)

            if result.attention.isEmpty {
                Text(L10n.t("dashboard.pulse.attention.empty"))
                    .pfText(.meta)
                    .foregroundStyle(PFColor.textMuted)
                    .padding(.horizontal, PFSpace.page)
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: PFSpace.s) {
                        ForEach(result.attention, id: \.self) { id in
                            if let entry = result.entry(id), let project = workspace?.project(id) {
                                attentionCard(entry, project: project)
                            }
                        }
                    }
                    .scrollTargetLayout()
                    .padding(.horizontal, PFSpace.page)
                    .padding(.vertical, 6)
                }
                .scrollIndicators(.hidden)
                .scrollTargetBehavior(.viewAligned)
                if result.quietCount > 0 {
                    Text(L10n.plural("dashboard.pulse.attention.quiet", result.quietCount))
                        .pfText(.meta)
                        .foregroundStyle(PFColor.textMuted)
                        .padding(.horizontal, PFSpace.page)
                }
            }
        }
        .padding(.top, PFSpace.s)
    }

    private func attentionCard(_ entry: AttentionEntry, project: Project) -> some View {
        let snapshot = health[project.id]
        let reasons = entry.chips.map { chip in
            PFHealthCard.Reason(id: chip.key.rawValue, text: L10n.t(chip.labelKey, chip.params), tone: tone(chip.tone))
        }
        return PFHealthCard(
            title: project.title,
            subtitle: L10n.plural("projects.summary.open", entry.openCount),
            score: snapshot?.score,
            trend: PFTrend(raw: snapshot?.trend),
            reasons: reasons,
            action: { model.router.push(.project(tenantId: project.tenantId, projectId: project.id)) }
        ) {
            PFProjectGlyph(title: project.title, imageURL: project.squareIcon, size: snapshot?.score == nil ? 46 : 30)
        }
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
        return text.pfText(.title).fixedSize(horizontal: false, vertical: true)
    }

    // MARK: Groups

    private func groupSection(_ group: PortfolioGroup, rows: [ProjectsPortfolio.Row]) -> some View {
        let isCollapsed = collapsed.contains(group)
        let count = rows.reduce(0) { $0 + 1 + $1.children.count }
        return VStack(alignment: .leading, spacing: 0) {
            GroupHeader(title: L10n.t("projects.portfolio.group.\(group.rawValue)"), color: dot(group), count: count, collapsed: isCollapsed) {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { toggle(group) }
            }
            .padding(.horizontal, PFSpace.page)
            if !isCollapsed {
                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        if index > 0 { PFRowDivider(leadingInset: 72) }
                        ProjectRowView(row: row, indent: false)
                        ForEach(row.children) { child in
                            PFRowDivider(leadingInset: 72)
                            ProjectRowView(row: portfolio.childRow(child), indent: true)
                        }
                    }
                }
                .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
                .pfCard()
                .padding(.horizontal, PFSpace.page)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
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

    private func toggle(_ group: PortfolioGroup) {
        if collapsed.contains(group) { collapsed.remove(group) } else { collapsed.insert(group) }
        UserDefaults.standard.set(collapsed.map(\.rawValue), forKey: Self.collapsedKey)
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
            PFSkeleton(height: 14, radius: 4).frame(width: 120)
            PFSkeleton(height: 28, radius: 6)
            HStack(spacing: PFSpace.s) {
                PFSkeleton(height: 178, radius: PFRadius.card).frame(width: 236)
                PFSkeleton(height: 178, radius: PFRadius.card)
            }
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
    @Environment(AppModel.self) private var model

    var body: some View {
        Button {
            model.router.push(.project(tenantId: row.project.tenantId, projectId: row.project.id))
        } label: {
            HStack(spacing: PFSpace.s) {
                if indent {
                    RoundedRectangle(cornerRadius: 1).fill(PFColor.hairlineStrong).frame(width: 2, height: 30).padding(.leading, 10)
                }
                PFProjectGlyph(title: row.project.title, imageURL: row.project.squareIcon, size: indent ? 36 : 44)
                VStack(alignment: .leading, spacing: 3) {
                    Text(row.project.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                    signals
                }
                Spacer(minLength: PFSpace.xs)
                if row.project.status.lifecycle != .closed {
                    VStack(alignment: .trailing, spacing: 5) {
                        Text(ProjectsFormat.percent(row.progress)).pfText(.number).foregroundStyle(PFColor.textMuted)
                        PFProgressBar(value: row.progress, height: 4).frame(width: 52)
                    }
                }
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)).foregroundStyle(PFColor.textSubtle)
            }
            .padding(.leading, indent ? 18 : PFSpace.m)
            .padding(.trailing, PFSpace.m)
            .frame(minHeight: 68)
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
