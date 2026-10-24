import SwiftUI
import PFData
import PFDesign

/// Compact insights (full members): KPIs over 4/8/12 weeks, project health, workload and the AI weekly report.
/// Reads one precomputed doc (`insights_daily/latest`); the client aggregates over the selected period like the web.
struct InsightsScreen: View {
    let tenantId: String
    @Environment(AppModel.self) private var model
    @State private var snapshot: InsightsSnapshot?
    @State private var loaded = false
    @State private var weeks = 4
    @State private var refreshing = false
    @State private var report: (week: String, markdown: String)?
    @State private var generating = false

    var body: some View {
        SettingsScaffold(title: L10n.t("nav.insights"), subtitle: L10n.t("insights.subtitle"), topTrailing: AnyView(
            PFIconButton("arrow.clockwise", label: L10n.t(refreshing ? "insights.refreshing" : "insights.refresh")) { refresh() }
                .disabled(refreshing)
                .opacity(refreshing ? 0.5 : 1)
        )) {
            VStack(alignment: .leading, spacing: PFSpace.l) {
                PFSegmented([4, 8, 12].map { (value: $0, label: "\($0) \(L10n.t("insights.weeks"))") }, selection: $weeks)
                if !loaded {
                    PFSkeleton(height: 140)
                } else if let snapshot, !snapshot.projects.isEmpty {
                    kpis(snapshot)
                    health(snapshot)
                    workload(snapshot)
                    if let computed = snapshot.computedAt {
                        Text(L10n.t("insights.updated", ["time": Formatting.relative(computed)])).pfText(.meta).foregroundStyle(PFColor.textSubtle)
                    }
                } else {
                    Text(L10n.t("insights.empty")).pfText(.body).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                }
                reportCard
            }
            .padding(.top, PFSpace.l)
        }
        .task {
            snapshot = await InsightsData.latest(tenantId: tenantId)
            loaded = true
            report = await InsightsData.latestReport(tenantId: tenantId, language: L10n.language.rawValue)
        }
    }

    // MARK: KPIs

    private func sum(_ values: [Int], last n: Int) -> Int { values.suffix(n).reduce(0, +) }

    private func kpis(_ s: InsightsSnapshot) -> some View {
        let open = s.projects.reduce(0) { $0 + $1.open }
        let overdue = s.projects.reduce(0) { $0 + $1.overdue }
        let completed = s.projects.reduce(0) { $0 + sum($1.completed, last: weeks) }
        let onTime = s.projects.reduce(0) { $0 + $1.onTime }
        let late = s.projects.reduce(0) { $0 + $1.late }
        let cycleDays = s.projects.reduce(0.0) { $0 + $1.cycleDaysSum.suffix(weeks).reduce(0, +) }
        let cycleCount = s.projects.reduce(0) { $0 + sum($1.cycleCount, last: weeks) }
        let rate = onTime + late > 0 ? "\(Int((Double(onTime) / Double(onTime + late) * 100).rounded())) %" : "–"
        let cycle = cycleCount > 0 ? (cycleDays / Double(cycleCount)).formatted(.number.precision(.fractionLength(1)).locale(L10n.locale)) + " " + L10n.t("insights.days") : "–"
        return VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(L10n.t("insights.kpis"))
            Grid(horizontalSpacing: PFSpace.s, verticalSpacing: PFSpace.s) {
                GridRow {
                    tile(L10n.t("insights.kpi.open"), "\(open)", tint: PFColor.textMain)
                    tile(L10n.t("insights.kpi.overdue"), "\(overdue)", tint: overdue > 0 ? PFColor.dangerText : PFColor.textMain)
                }
                GridRow {
                    tile(L10n.t("insights.kpi.completed"), "\(completed)", tint: PFColor.textMain)
                    tile(L10n.t("insights.kpi.onTime"), rate, tint: PFColor.textMain)
                }
                GridRow {
                    tile(L10n.t("insights.kpi.cycleTime"), cycle, tint: PFColor.textMain).gridCellColumns(2)
                }
            }
        }
    }

    private func tile(_ label: String, _ value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).pfText(.title).foregroundStyle(tint).monospacedDigit()
            Text(label).pfText(.meta).foregroundStyle(PFColor.textMuted)
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
        .pfElevation(.card, radius: PFRadius.card)
        .accessibilityElement(children: .combine)
    }

    // MARK: Health and workload

    private func health(_ s: InsightsSnapshot) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(L10n.t("insights.health.title"))
            PFCardList {
                ForEach(s.projects.sorted { rank($0.health) > rank($1.health) }) { project in
                    Button { model.router.push(.project(tenantId: tenantId, projectId: project.id)) } label: {
                        HStack(alignment: .top, spacing: PFSpace.s) {
                            Circle().fill(healthColor(project.health)).frame(width: 10, height: 10).padding(.top, 6)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(project.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                                Text([L10n.t("insights.health.\(project.health)"),
                                      L10n.t("insights.health.open", ["n": project.open]),
                                      project.overdue > 0 ? L10n.t("insights.health.overdue", ["n": project.overdue]) : nil,
                                      project.blocked > 0 ? L10n.t("insights.health.blocked", ["n": project.blocked]) : nil]
                                    .compactMap { $0 }.joined(separator: " · "))
                                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, PFSpace.m).padding(.vertical, 12).contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
        }
    }

    private func workload(_ s: InsightsSnapshot) -> some View {
        var totals: [String: (open: Int, overdue: Int)] = [:]
        for project in s.projects {
            for (uid, value) in project.people {
                let current = totals[uid] ?? (0, 0)
                totals[uid] = (current.open + value.0, current.overdue + value.1)
            }
        }
        let people = model.workspace?.people ?? [:]
        let rows = totals.sorted { $0.value.open > $1.value.open }.prefix(8)
        return VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(L10n.t("insights.people"))
            if rows.isEmpty {
                Text(L10n.t("insights.chart.workloadEmpty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            } else {
                let maxOpen = max(rows.map(\.value.open).max() ?? 1, 1)
                PFCardList {
                    ForEach(Array(rows), id: \.key) { uid, value in
                        let name = people[uid]?.displayName ?? "–"
                        HStack(spacing: PFSpace.s) {
                            PFAvatar(name: name, seed: uid, imageURL: people[uid]?.photoURL, size: 26)
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(name).pfText(.body).foregroundStyle(PFColor.textMain).lineLimit(1)
                                    Spacer()
                                    Text("\(value.open)").pfText(.metaStrong).foregroundStyle(PFColor.textMain).monospacedDigit()
                                    if value.overdue > 0 {
                                        Text(L10n.t("insights.load.overdue", ["n": value.overdue])).pfText(.meta).foregroundStyle(PFColor.dangerText)
                                    }
                                }
                                PFProgressBar(value: Double(value.open) / Double(maxOpen))
                            }
                        }
                        .padding(.horizontal, PFSpace.m).padding(.vertical, 10)
                    }
                }
            }
        }
    }

    private func rank(_ health: String) -> Int { health == "risk" ? 2 : health == "watch" ? 1 : 0 }

    private func healthColor(_ health: String) -> Color {
        switch health {
        case "risk": PFColor.danger
        case "watch": PFColor.warning
        default: PFColor.success
        }
    }

    // MARK: Weekly report

    private var reportCard: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(L10n.t("insights.report.title"))
            VStack(alignment: .leading, spacing: PFSpace.s) {
                if let report, !report.markdown.isEmpty {
                    AiMarkdownText(report.markdown)
                    Text(report.week).pfText(.meta).foregroundStyle(PFColor.textSubtle)
                } else {
                    Text(L10n.t("insights.report.hint")).pfText(.body).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: PFSpace.xs) {
                    PFButton(L10n.t(generating ? "insights.report.generating" : "insights.report.generate"), kind: .secondary, size: .small) { generate() }
                        .disabled(generating)
                    if let report, !report.markdown.isEmpty {
                        PFButton(L10n.t("insights.report.copy"), systemImage: "doc.on.doc", kind: .ghost, size: .small) {
                            UIPasteboard.general.string = report.markdown
                            model.toasts.show(PFToast(L10n.t("insights.report.copied"), style: .success))
                        }
                    }
                }
            }
            .padding(PFSpace.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PFColor.card, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .pfElevation(.card, radius: PFRadius.card)
        }
    }

    // MARK: Actions

    private func refresh() {
        refreshing = true
        Task {
            defer { refreshing = false }
            do { snapshot = try await InsightsData.refresh(tenantId: tenantId) }
            catch { model.toasts.show(PFToast(L10n.t("insights.error"), style: .error)) }
        }
    }

    private func generate() {
        generating = true
        Task {
            defer { generating = false }
            do { report = try await InsightsData.generateReport(tenantId: tenantId, language: L10n.language.rawValue) }
            catch {
                let code = PlanErrorCode.code(in: error)
                model.toasts.show(PFToast(code != nil ? model.errorMessage(error) : L10n.t("insights.report.error"), style: code != nil ? .warning : .error))
            }
        }
    }
}
